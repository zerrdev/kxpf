import { spawn, ChildProcess, exec } from 'child_process';
import { promisify } from 'util';

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
  static async start(serviceName: string, localPort: number, remotePort: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const isWindows = process.platform === 'win32';
      let child: ChildProcess;

      if (isWindows) {
        // Windows: Use shell directly
        const args = [
          'port-forward',
          `service/${serviceName}`,
          `${localPort}:${remotePort}`
        ];
        child = spawn('kubectl', args, {
          detached: true,
          stdio: 'ignore',
          shell: true
        });
      } else {
        // Unix: Try kubectl first, fallback to minikube kubectl
        const command = `(kubectl port-forward service/${serviceName} ${localPort}:${remotePort} 2>/dev/null || minikube kubectl -- port-forward service/${serviceName} ${localPort}:${remotePort}) &`;
        child = spawn('bash', ['-c', command], {
          detached: true,
          stdio: 'ignore'
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

      // Wait a moment to ensure the process started successfully
      setTimeout(() => {
        // Unref to allow parent process to exit
        child.unref();
        console.log(`Started port-forward for ${serviceName} on localhost:${localPort} -> ${remotePort}`);
        resolve();
      }, 100);
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
        // Windows: Use WMIC to list processes
        const { stdout } = await execAsync('wmic process where "name=\'kubectl.exe\'" get commandline,processid /format:csv');
        output = stdout;

        const lines = output.split('\n').filter(line => line.includes('port-forward'));

        for (const line of lines) {
          const match = line.match(/service\/([^\s]+)\s+(\d+):(\d+)/);
          if (match) {
            const [, serviceName, localPort, remotePort] = match;
            const pidMatch = line.match(/,(\d+)\s*$/);
            const pid = pidMatch ? parseInt(pidMatch[1], 10) : undefined;

            portForwards.push({
              serviceName,
              localPort: parseInt(localPort, 10),
              remotePort: parseInt(remotePort, 10),
              pid
            });
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
