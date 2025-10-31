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
    const isWindows = process.platform === 'win32';

    const args = [
      'port-forward',
      `service/${serviceName}`,
      `${localPort}:${remotePort}`
    ];

    // Spawn detached process
    const child: ChildProcess = spawn('kubectl', args, {
      detached: true,
      stdio: 'ignore',
      shell: isWindows
    });

    // Unref to allow parent process to exit
    child.unref();

    console.log(`Started port-forward for ${serviceName} on localhost:${localPort} -> ${remotePort}`);
  }

  /**
   * Lists all running port-forwards by parsing kubectl processes
   * This uses system commands to find kubectl port-forward processes
   */
  static async list(): Promise<PortForward[]> {
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
        // Unix: Use ps to list processes
        const { stdout } = await execAsync('ps aux | grep "[k]ubectl port-forward"');
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
   * Stops port-forwards matching a service name prefix
   */
  static async stop(servicePrefix: string): Promise<number> {
    const running = await this.list();
    const matching = running.filter(pf => pf.serviceName.startsWith(servicePrefix));

    if (matching.length === 0) {
      console.log(`No running port-forwards found matching "${servicePrefix}"`);
      return 0;
    }

    for (const pf of matching) {
      if (pf.pid) {
        await this.killProcess(pf.pid);
        console.log(`Stopped port-forward for ${pf.serviceName} (localhost:${pf.localPort})`);
      }
    }

    return matching.length;
  }

  /**
   * Stops all running port-forwards
   */
  static async stopAll(): Promise<number> {
    const running = await this.list();

    if (running.length === 0) {
      console.log('No running port-forwards found');
      return 0;
    }

    for (const pf of running) {
      if (pf.pid) {
        await this.killProcess(pf.pid);
        console.log(`Stopped port-forward for ${pf.serviceName} (localhost:${pf.localPort})`);
      }
    }

    return running.length;
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
