import { spawn, ChildProcess, exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const execAsync = promisify(exec);

export interface PortForward {
  serviceName: string;
  localPort: number;
  remotePort: number;
  pid?: number;
}

export class PortForwardManager {
  /**
   * Starts a port-forward for a service in detached mode
   */
  static async start(serviceName: string, localPort: number, remotePort: number, context?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const isWindows = process.platform === 'win32';
      let child: ChildProcess;
      let errorOutput = '';

      const contextFlag = context ? `--context ${context}` : '';

      if (isWindows) {
        // Windows: Use VBScript to run kubectl completely hidden (no window flash)
        const contextArg = context ? ` --context ${context}` : '';
        const kubectlCmd = `kubectl port-forward service/${serviceName} ${localPort}:${remotePort}${contextArg}`;

        // Create a temporary VBScript file that runs kubectl hidden
        const vbsContent = `Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "${kubectlCmd}", 0, False
Set WshShell = Nothing`;

        const tempDir = os.tmpdir();
        const vbsPath = path.join(tempDir, `kxpf-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.vbs`);

        fs.writeFileSync(vbsPath, vbsContent);

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
          } catch (err) {
            // Ignore error if file doesn't exist
          }
        }, 2000);
      } else {
        // Unix: Try kubectl first, fallback to minikube kubectl
        const kubectlCmd = `kubectl port-forward service/${serviceName} ${localPort}:${remotePort} ${contextFlag}`;
        const minikubeCmd = `minikube kubectl -- port-forward service/${serviceName} ${localPort}:${remotePort} ${contextFlag}`;
        const command = `(${kubectlCmd} || ${minikubeCmd}) &`;
        child = spawn('bash', ['-c', command], {
          detached: true,
          stdio: ['ignore', 'pipe', 'pipe']
        });
      }

      // Collect error output temporarily
      if (child.stderr) {
        child.stderr.on('data', (data) => {
          errorOutput += data.toString();
        });
      }

      // Handle spawn errors (e.g., kubectl not found)
      child.on('error', (err) => {
        if (err.message.includes('ENOENT')) {
          reject(new Error('kubectl not found. Please ensure kubectl is installed and in your PATH.'));
        } else {
          reject(err);
        }
      });

      // Check if process exits immediately (indicates error)
      child.on('exit', (code) => {
        if (code !== 0 && code !== null) {
          const error = errorOutput.trim() || `kubectl port-forward exited with code ${code}`;
          reject(new Error(`Failed to start port-forward for ${serviceName}: ${error}`));
        }
      });

      // Wait a moment to ensure the process started successfully
      setTimeout(() => {
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
  }

  /**
   * Lists all running port-forwards by parsing kubectl processes (internal, no deduplication)
   * This uses system commands to find kubectl port-forward processes
   */
  private static async listAll(): Promise<PortForward[]> {
    const isWindows = process.platform === 'win32';
    const portForwards: PortForward[] = [];

    try {
      let output: string;

      if (isWindows) {
        // Windows: Use PowerShell with WMI to get kubectl process command lines
        // Use a simpler approach that works across different shell environments
        const psScript = `Get-WmiObject Win32_Process -Filter \\"name='kubectl.exe'\\" | Where-Object { $_.CommandLine -like '*port-forward*' } | ForEach-Object { @{pid=$_.ProcessId; cmd=$_.CommandLine} } | ConvertTo-Json`;

        const { stdout } = await execAsync(`powershell.exe -NoProfile -Command "${psScript}"`);
        output = stdout.trim();

        if (output) {
          try {
            const processes = JSON.parse(output);
            const processList = Array.isArray(processes) ? processes : [processes];

            for (const proc of processList) {
              if (!proc || !proc.cmd) continue;
              const match = proc.cmd.match(/service\/([^\s]+)\s+(\d+):(\d+)/);
              if (match) {
                const [, serviceName, localPort, remotePort] = match;
                portForwards.push({
                  serviceName,
                  localPort: parseInt(localPort, 10),
                  remotePort: parseInt(remotePort, 10),
                  pid: proc.pid
                });
              }
            }
          } catch (parseError) {
            // If JSON parsing fails or no processes found, return empty array
          }
        }
      } else {
        // Unix: Use ps to list processes (supports both kubectl and minikube kubectl)
        const { stdout } = await execAsync('ps aux | grep "port-forward" | grep -E "(kubectl|minikube)"');
        output = stdout;

        const lines = output.split('\n').filter(line => line.trim());

        for (const line of lines) {
          const match = line.match(/service\/([^\s]+)\s+(\d+):(\d+)/);
          if (match) {
            const [, serviceName, localPort, remotePort] = match;
            const pidMatch = line.match(/^\S+\s+(\d+)/);
            const pid = pidMatch ? parseInt(pidMatch[1], 10) : undefined;

            portForwards.push({
              serviceName,
              localPort: parseInt(localPort, 10),
              remotePort: parseInt(remotePort, 10),
              pid
            });
          }
        }
      }
    } catch (error: any) {
      // If no processes found, grep/wmic returns error, but that's okay
      if (!error.stdout || error.stdout.trim() === '') {
        return [];
      }
    }

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
    const running = await this.listAll();
    const matching = running.filter(pf => pf.serviceName.startsWith(servicePrefix));

    if (matching.length === 0) {
      console.log(`No running port-forwards found matching "${servicePrefix}"`);
      return 0;
    }

    // Track which services we've already logged
    const logged = new Set<string>();

    for (const pf of matching) {
      if (pf.pid) {
        await this.killProcess(pf.pid);
        const key = `${pf.serviceName}:${pf.localPort}`;
        if (!logged.has(key)) {
          console.log(`Stopped port-forward for ${pf.serviceName} (localhost:${pf.localPort})`);
          logged.add(key);
        }
      }
    }

    return logged.size;
  }

  /**
   * Stops all running port-forwards
   */
  static async stopAll(): Promise<number> {
    const running = await this.listAll();

    if (running.length === 0) {
      console.log('No running port-forwards found');
      return 0;
    }

    // Track which services we've already logged
    const logged = new Set<string>();

    for (const pf of running) {
      if (pf.pid) {
        await this.killProcess(pf.pid);
        const key = `${pf.serviceName}:${pf.localPort}`;
        if (!logged.has(key)) {
          console.log(`Stopped port-forward for ${pf.serviceName} (localhost:${pf.localPort})`);
          logged.add(key);
        }
      }
    }

    return logged.size;
  }

  /**
   * Kills a process by PID (cross-platform)
   */
  private static async killProcess(pid: number): Promise<void> {
    const isWindows = process.platform === 'win32';

    try {
      if (isWindows) {
        await execAsync(`taskkill /F /PID ${pid}`);
      } else {
        await execAsync(`kill ${pid}`);
      }
    } catch (error) {
      // Process might already be dead, ignore error
    }
  }
}
