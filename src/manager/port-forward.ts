import { spawn, ChildProcess, exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { KubectlNotFoundError, PortForwardError } from '../errors';
import { debugLog } from '../utils/debug';

const execAsync = promisify(exec);

export interface PortForward {
  serviceName: string;
  localPort: number;
  remotePort: number;
  pid?: number | undefined;
}

export class PortForwardManager {
  /**
   * Validates port-forward parameters before starting
   */
  private static validateStartParams(serviceName: string, localPort: number, remotePort: number): void {
    if (!serviceName || typeof serviceName !== 'string') {
      throw new Error('Service name is required and must be a string');
    }
    
    if (!Number.isInteger(localPort) || localPort < 1 || localPort > 65535) {
      throw new Error(`Invalid local port: ${localPort}. Must be an integer between 1 and 65535.`);
    }
    
    if (!Number.isInteger(remotePort) || remotePort < 1 || remotePort > 65535) {
      throw new Error(`Invalid remote port: ${remotePort}. Must be an integer between 1 and 65535.`);
    }
  }

  /**
   * Checks if kubectl is available
   */
  private static async checkKubectlAvailability(): Promise<void> {
    debugLog('Checking kubectl availability...');
    try {
      debugLog('Running command: kubectl version --client');
      const { stdout } = await execAsync('kubectl version --client');
      debugLog('kubectl command executed successfully');

      if (!stdout.includes('Client Version:')) {
        debugLog('kubectl client version not found in output');
        throw new KubectlNotFoundError();
      }

      debugLog('kubectl is available and working');
    } catch (error) {
      debugLog(`kubectl check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw new KubectlNotFoundError(error instanceof Error ? error : undefined);
    }
  }

  /**
   * Starts a port-forward for a service in detached mode
   * @param serviceName - Kubernetes service name
   * @param localPort - Local port to bind to
   * @param remotePort - Remote port on the service
   * @param context - Optional Kubernetes context
   * @throws PortForwardError if the operation fails
   */
  static async start(serviceName: string, localPort: number, remotePort: number, context?: string): Promise<void> {
    try {
      debugLog(`Starting port-forward for service: ${serviceName} (local:${localPort} -> remote:${remotePort})${context ? ` in context: ${context}` : ''}`);

      // Validate parameters
      this.validateStartParams(serviceName, localPort, remotePort);
      debugLog('Parameters validated successfully');

      // Check kubectl availability
      await this.checkKubectlAvailability();
      debugLog('Kubectl availability confirmed');

      return new Promise((resolve, reject) => {
        const isWindows = process.platform === 'win32';
        let child: ChildProcess;
        let errorOutput = '';

        if (isWindows) {
          // Windows: Use VBScript to run kubectl completely hidden (no window flash)
          const contextArg = context ? ` --context ${context}` : '';
          const kubectlCmd = `kubectl port-forward service/${serviceName} ${localPort}:${remotePort}${contextArg}`;
          debugLog(`Executing on Windows: ${kubectlCmd}`);

          // Create a temporary VBScript file that runs kubectl hidden
          const vbsContent = `Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "${kubectlCmd}", 0, False
Set WshShell = Nothing`;

          const tempDir = os.tmpdir();
          const vbsPath = path.join(tempDir, `kxpf-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.vbs`);
          debugLog(`VBScript path: ${vbsPath}`);

          try {
            fs.writeFileSync(vbsPath, vbsContent);
            debugLog('VBScript file created successfully');
          } catch (error) {
            debugLog(`Failed to create VBScript file: ${error instanceof Error ? error.message : 'Unknown error'}`);
            reject(new PortForwardError(serviceName, 'Failed to create temporary VBScript file', error as Error));
            return;
          }

          // Run the VBScript using wscript.exe (no console window at all)
          child = spawn('wscript.exe', [vbsPath], {
            detached: true,
            stdio: ['ignore', 'ignore', 'ignore'],
            windowsHide: true
          });

          // Delete the VBScript file after a short delay
          setTimeout(() => {
            try {
              fs.unlinkSync(vbsPath);
              debugLog('VBScript file deleted');
            } catch (err) {
              debugLog(`Warning: Could not delete VBScript file: ${err instanceof Error ? err.message : 'Unknown error'}`);
              // Ignore error if file doesn't exist
            }
          }, 2000);
        } else {
          // Unix: Try kubectl first, fallback to minikube kubectl
          const kubectlCmd = `kubectl port-forward service/${serviceName} ${localPort}:${remotePort} ${context ? `--context ${context}` : ''}`;
          const minikubeCmd = `minikube kubectl -- port-forward service/${serviceName} ${localPort}:${remotePort} ${context ? `--context ${context}` : ''}`;
          debugLog(`Executing on Unix: ${kubectlCmd} (with minikube fallback)`);

          const command = `(${kubectlCmd} || ${minikubeCmd}) &`;
          child = spawn('bash', ['-c', command], {
            detached: true,
            stdio: ['ignore', 'pipe', 'pipe']
          });
        }

        // Collect error output temporarily
        if (child.stderr) {
          child.stderr.on('data', (data) => {
            const dataStr = data.toString();
            debugLog(`Port-forward stderr for ${serviceName}: ${dataStr}`);
            errorOutput += dataStr;
          });
        }

        // Handle spawn errors (e.g., kubectl not found)
        child.on('error', (err) => {
          debugLog(`Port-forward spawn error for ${serviceName}: ${err.message}`);
          if (err.message.includes('ENOENT')) {
            reject(new KubectlNotFoundError(err));
          } else {
            reject(new PortForwardError(serviceName, err.message, err));
          }
        });

        // Check if process exits immediately (indicates error)
        child.on('exit', (code) => {
          debugLog(`Port-forward process for ${serviceName} exited with code: ${code}`);
          if (code !== 0 && code !== null) {
            const error = errorOutput.trim() || `kubectl port-forward exited with code ${code}`;
            debugLog(`Port-forward failed for ${serviceName} with error: ${error}`);
            reject(new PortForwardError(serviceName, error));
          }
        });

        // Wait a moment to ensure the process started successfully
        setTimeout(() => {
          debugLog(`Port-forward for ${serviceName} successfully initiated`);

          // If we get here without error, the process started successfully
          // Remove the exit listener and unref to allow parent process to exit
          child.removeAllListeners('exit');
          child.unref();

          // Close stdio streams to truly detach
          if (child.stdout) child.stdout.destroy();
          if (child.stderr) child.stderr.destroy();

          console.log(`Started port-forward for ${serviceName} on localhost:${localPort} -> ${remotePort}`);
          resolve();
        }, 500);
      });
    } catch (error) {
      debugLog(`Error in PortForwardManager.start for ${serviceName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      if (error instanceof PortForwardError || error instanceof KubectlNotFoundError) {
        throw error;
      }
      throw new PortForwardError(serviceName, error instanceof Error ? error.message : 'Unknown error', error as Error);
    }
  }

  /**
   * Lists all running port-forwards by parsing kubectl processes (internal, no deduplication)
   * This uses system commands to find kubectl port-forward processes
   */
  private static async listAll(): Promise<PortForward[]> {
    const isWindows = process.platform === 'win32';
    const portForwards: PortForward[] = [];

    debugLog('Listing all running port-forwards...');
    try {
      let output: string;

      if (isWindows) {
        debugLog('Running on Windows platform');
        // Windows: Use PowerShell with WMI to get kubectl process command lines
        // Use a simpler approach that works across different shell environments
        const psScript = `Get-WmiObject Win32_Process -Filter \\"name='kubectl.exe'\\" | Where-Object { $_.CommandLine -like '*port-forward*' } | ForEach-Object { @{pid=$_.ProcessId; cmd=$_.CommandLine} } | ConvertTo-Json`;

        debugLog(`Executing PowerShell command: powershell.exe -NoProfile -Command "${psScript}"`);
        const { stdout } = await execAsync(`powershell.exe -NoProfile -Command "${psScript}"`);
        output = stdout.trim();
        debugLog(`PowerShell command output: ${output}`);

        if (output) {
          try {
            const processes = JSON.parse(output);
            debugLog(`Parsed ${Array.isArray(processes) ? processes.length : 1} process(es) from PowerShell output`);
            const processList = Array.isArray(processes) ? processes : [processes];

            for (const proc of processList) {
              if (!proc || !proc.cmd) {
                debugLog('Skipping invalid process entry');
                continue;
              }
              debugLog(`Processing process command: ${proc.cmd}`);
              const match = proc.cmd.match(/service\/([^\s]+)\s+(\d+):(\d+)/);
              if (match) {
                const [, serviceName, localPort, remotePort] = match;
                debugLog(`Found port-forward: ${serviceName} (local:${localPort} -> remote:${remotePort}, PID:${proc.pid})`);
                portForwards.push({
                  serviceName,
                  localPort: parseInt(localPort, 10),
                  remotePort: parseInt(remotePort, 10),
                  pid: proc.pid
                });
              } else {
                debugLog('No port-forward pattern found in process command');
              }
            }
          } catch (parseError) {
            debugLog(`Failed to parse PowerShell output: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
            // If JSON parsing fails or no processes found, return empty array
          }
        } else {
          debugLog('No PowerShell output received');
        }
      } else {
        debugLog('Running on Unix platform');
        // Unix: Use ps to list processes (supports both kubectl and minikube kubectl)
        const cmd = 'ps aux | grep "port-forward" | grep -E "(kubectl|minikube)"';
        debugLog(`Executing command: ${cmd}`);
        const { stdout } = await execAsync(cmd);
        output = stdout;
        debugLog(`Command output: ${output}`);

        const lines = output.split('\n').filter(line => line.trim());

        for (const line of lines) {
          debugLog(`Processing line: ${line}`);
          const match = line.match(/service\/([^\s]+)\s+(\d+):(\d+)/);
          if (match) {
            const [, serviceName, localPort, remotePort] = match;
            const pidMatch = line.match(/^\S+\s+(\d+)/);
            const pid = pidMatch && pidMatch[1] ? parseInt(pidMatch[1], 10) : undefined;

            if (serviceName && localPort && remotePort) {
              debugLog(`Found port-forward: ${serviceName} (local:${localPort} -> remote:${remotePort}${pid ? `, PID:${pid}` : ''})`);
              const portForward: PortForward = {
                serviceName: serviceName,
                localPort: parseInt(localPort, 10),
                remotePort: parseInt(remotePort, 10),
                ...(pid !== undefined && { pid })
              };
              portForwards.push(portForward);
            } else {
              debugLog('Incomplete port-forward data found');
            }
          } else {
            debugLog('No port-forward pattern found in line');
          }
        }
      }
    } catch (error: any) {
      debugLog(`Error listing port-forwards: ${error instanceof Error ? error.message : 'Unknown error'}`);
      // If no processes found, grep/wmic returns error, but that's okay
      if (!error.stdout || error.stdout.trim() === '') {
        debugLog('No running port-forwards found');
        return [];
      }
    }

    debugLog(`Found ${portForwards.length} running port-forwards`);
    return portForwards;
  }

  /**
   * Lists all running port-forwards (deduplicated for display)
   */
  static async list(): Promise<PortForward[]> {
    const portForwards = await this.listAll();

    // Deduplicate port-forwards (minikube creates multiple processes for the same service)
    const uniqueForwards = new Map<string, PortForward>();
    for (const pf of portForwards) {
      const key = `${pf.serviceName}:${pf.localPort}:${pf.remotePort}`;
      if (!uniqueForwards.has(key)) {
        uniqueForwards.set(key, pf);
      }
    }

    return Array.from(uniqueForwards.values());
  }

  /**
   * Stops port-forwards matching a service name prefix
   */
  static async stop(servicePrefix: string): Promise<number> {
    debugLog(`Stopping port-forwards matching prefix: ${servicePrefix}`);
    const running = await this.listAll();
    const matching = running.filter(pf => pf.serviceName.startsWith(servicePrefix));
    debugLog(`Found ${matching.length} matching port-forwards to stop`);

    if (matching.length === 0) {
      debugLog(`No running port-forwards found matching "${servicePrefix}"`);
      console.log(`No running port-forwards found matching "${servicePrefix}"`);
      return 0;
    }

    // Track which services we've already logged
    const logged = new Set<string>();

    for (const pf of matching) {
      debugLog(`Stopping port-forward for ${pf.serviceName} (PID: ${pf.pid}, localhost:${pf.localPort})`);
      if (pf.pid) {
        await this.killProcess(pf.pid);
        const key = `${pf.serviceName}:${pf.localPort}`;
        if (!logged.has(key)) {
          console.log(`Stopped port-forward for ${pf.serviceName} (localhost:${pf.localPort})`);
          logged.add(key);
          debugLog(`Stopped port-forward for ${pf.serviceName} (PID: ${pf.pid})`);
        }
      } else {
        debugLog(`No PID found for port-forward: ${pf.serviceName} (localhost:${pf.localPort})`);
      }
    }

    debugLog(`Stopped ${logged.size} unique port-forwards`);
    return logged.size;
  }

  /**
   * Stops all running port-forwards
   */
  static async stopAll(): Promise<number> {
    debugLog('Stopping all running port-forwards...');
    const running = await this.listAll();
    debugLog(`Found ${running.length} running port-forwards to stop`);

    if (running.length === 0) {
      debugLog('No running port-forwards found');
      console.log('No running port-forwards found');
      return 0;
    }

    // Track which services we've already logged
    const logged = new Set<string>();

    for (const pf of running) {
      debugLog(`Stopping port-forward for ${pf.serviceName} (PID: ${pf.pid}, localhost:${pf.localPort})`);
      if (pf.pid) {
        await this.killProcess(pf.pid);
        const key = `${pf.serviceName}:${pf.localPort}`;
        if (!logged.has(key)) {
          console.log(`Stopped port-forward for ${pf.serviceName} (localhost:${pf.localPort})`);
          logged.add(key);
          debugLog(`Stopped port-forward for ${pf.serviceName} (PID: ${pf.pid})`);
        }
      } else {
        debugLog(`No PID found for port-forward: ${pf.serviceName} (localhost:${pf.localPort})`);
      }
    }

    debugLog(`Stopped ${logged.size} unique port-forwards`);
    return logged.size;
  }

  /**
   * Kills a process by PID (cross-platform)
   */
  private static async killProcess(pid: number): Promise<void> {
    const isWindows = process.platform === 'win32';
    debugLog(`Killing process with PID: ${pid} on ${isWindows ? 'Windows' : 'Unix'}`);

    try {
      if (isWindows) {
        const cmd = `taskkill /F /PID ${pid}`;
        debugLog(`Executing command: ${cmd}`);
        await execAsync(cmd);
        debugLog(`Process ${pid} killed successfully on Windows`);
      } else {
        const cmd = `kill ${pid}`;
        debugLog(`Executing command: ${cmd}`);
        await execAsync(cmd);
        debugLog(`Process ${pid} killed successfully on Unix`);
      }
    } catch (error) {
      debugLog(`Failed to kill process ${pid}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      // Process might already be dead, ignore error
    }
  }
}
