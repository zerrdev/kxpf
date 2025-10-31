import { PortForwardManager, PortForward } from '../port-forward';
import { spawn, exec } from 'child_process';
import { EventEmitter } from 'events';

// Mock child_process module
jest.mock('child_process');

const mockedSpawn = spawn as jest.MockedFunction<typeof spawn>;
const mockedExec = exec as jest.MockedFunction<typeof exec>;

// Helper to create a mock ChildProcess
class MockChildProcess extends EventEmitter {
  pid = 12345;
  unref = jest.fn();
}

describe('PortForwardManager', () => {
  let originalPlatform: PropertyDescriptor | undefined;
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();

    // Spy on console.log to avoid noise in test output
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

    // Save original platform descriptor
    originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
  });

  afterEach(() => {
    // Restore console.log
    consoleLogSpy.mockRestore();

    // Restore platform
    if (originalPlatform) {
      Object.defineProperty(process, 'platform', originalPlatform);
    }
  });

  describe('start', () => {
    describe('Windows environment', () => {
      beforeEach(() => {
        // Mock Windows platform
        Object.defineProperty(process, 'platform', {
          value: 'win32',
          configurable: true
        });
      });

      it('should spawn kubectl with correct arguments on Windows', async () => {
        const mockChild = new MockChildProcess();
        mockedSpawn.mockReturnValue(mockChild as any);

        const promise = PortForwardManager.start('my-service', 8080, 80);

        // Wait for the timeout
        await new Promise(resolve => setTimeout(resolve, 150));

        expect(mockedSpawn).toHaveBeenCalledWith(
          'kubectl',
          ['port-forward', 'service/my-service', '8080:80'],
          {
            detached: true,
            stdio: 'ignore',
            shell: true
          }
        );
        expect(mockChild.unref).toHaveBeenCalled();
        await promise;
      });

      it('should include context flag when provided on Windows', async () => {
        const mockChild = new MockChildProcess();
        mockedSpawn.mockReturnValue(mockChild as any);

        const promise = PortForwardManager.start('my-service', 8080, 80, 'prod-cluster');

        await new Promise(resolve => setTimeout(resolve, 150));

        expect(mockedSpawn).toHaveBeenCalledWith(
          'kubectl',
          ['port-forward', 'service/my-service', '8080:80', '--context', 'prod-cluster'],
          {
            detached: true,
            stdio: 'ignore',
            shell: true
          }
        );
        await promise;
      });

      it('should reject with error if kubectl not found on Windows', async () => {
        const mockChild = new MockChildProcess();
        mockedSpawn.mockReturnValue(mockChild as any);

        const promise = PortForwardManager.start('my-service', 8080, 80);

        // Emit error
        const error: NodeJS.ErrnoException = new Error('spawn kubectl ENOENT');
        error.code = 'ENOENT';
        mockChild.emit('error', error);

        await expect(promise).rejects.toThrow('kubectl not found');
      });

      it('should reject with error on other spawn errors on Windows', async () => {
        const mockChild = new MockChildProcess();
        mockedSpawn.mockReturnValue(mockChild as any);

        const promise = PortForwardManager.start('my-service', 8080, 80);

        // Emit error
        const error = new Error('Some other error');
        mockChild.emit('error', error);

        await expect(promise).rejects.toThrow('Some other error');
      });
    });

    describe('Unix environment', () => {
      beforeEach(() => {
        // Mock Unix platform
        Object.defineProperty(process, 'platform', {
          value: 'linux',
          configurable: true
        });
      });

      it('should spawn bash with kubectl command on Unix', async () => {
        const mockChild = new MockChildProcess();
        mockedSpawn.mockReturnValue(mockChild as any);

        const promise = PortForwardManager.start('my-service', 8080, 80);

        await new Promise(resolve => setTimeout(resolve, 150));

        expect(mockedSpawn).toHaveBeenCalledWith(
          'bash',
          ['-c', expect.stringContaining('kubectl port-forward service/my-service 8080:80')],
          {
            detached: true,
            stdio: 'ignore'
          }
        );
        expect(mockChild.unref).toHaveBeenCalled();
        await promise;
      });

      it('should include minikube fallback on Unix', async () => {
        const mockChild = new MockChildProcess();
        mockedSpawn.mockReturnValue(mockChild as any);

        await PortForwardManager.start('my-service', 8080, 80);

        const spawnCall = mockedSpawn.mock.calls[0];
        const command = spawnCall[1][1] as string;

        expect(command).toContain('kubectl port-forward');
        expect(command).toContain('minikube kubectl');
        expect(command).toMatch(/\|\|/); // Should have fallback
      });

      it('should include context flag when provided on Unix', async () => {
        const mockChild = new MockChildProcess();
        mockedSpawn.mockReturnValue(mockChild as any);

        await PortForwardManager.start('my-service', 8080, 80, 'prod-cluster');

        const spawnCall = mockedSpawn.mock.calls[0];
        const command = spawnCall[1][1] as string;

        expect(command).toContain('--context prod-cluster');
      });

      it('should reject with error if kubectl not found on Unix', async () => {
        const mockChild = new MockChildProcess();
        mockedSpawn.mockReturnValue(mockChild as any);

        const promise = PortForwardManager.start('my-service', 8080, 80);

        const error: NodeJS.ErrnoException = new Error('spawn bash ENOENT');
        error.code = 'ENOENT';
        mockChild.emit('error', error);

        await expect(promise).rejects.toThrow('kubectl not found');
      });
    });
  });

  describe('listAll (private method tested through list)', () => {
    describe('Windows environment', () => {
      beforeEach(() => {
        Object.defineProperty(process, 'platform', {
          value: 'win32',
          configurable: true
        });
      });

      it('should parse wmic output on Windows', async () => {
        const wmicOutput = `Node,CommandLine,ProcessId
NODE1,kubectl.exe port-forward service/api-service 8080:80,1234
NODE1,kubectl.exe port-forward service/web-service 3000:3000,5678
`;

        mockedExec.mockImplementation(((cmd: string, callback: any) => {
          if (callback) {
            callback(null, { stdout: wmicOutput, stderr: '' } as any, '');
          }
          return {} as any;
        }) as any);

        const portForwards = await PortForwardManager.list();

        expect(mockedExec).toHaveBeenCalledWith(
          expect.stringContaining('wmic process'),
          expect.any(Function)
        );
        expect(portForwards).toHaveLength(2);
        expect(portForwards[0]).toEqual({
          serviceName: 'api-service',
          localPort: 8080,
          remotePort: 80,
          pid: 1234
        });
        expect(portForwards[1]).toEqual({
          serviceName: 'web-service',
          localPort: 3000,
          remotePort: 3000,
          pid: 5678
        });
      });

      it('should return empty array when no processes found on Windows', async () => {
        mockedExec.mockImplementation(((cmd: string, callback: any) => {
          if (callback) {
            const error: any = new Error('No processes found');
            error.stdout = '';
            callback(error, { stdout: '', stderr: '' } as any, '');
          }
          return {} as any;
        }) as any);

        const portForwards = await PortForwardManager.list();

        expect(portForwards).toHaveLength(0);
      });
    });

    describe('Unix environment', () => {
      beforeEach(() => {
        Object.defineProperty(process, 'platform', {
          value: 'linux',
          configurable: true
        });
      });

      it('should parse ps output on Unix', async () => {
        const psOutput = `user     1234  0.0  0.1 123456 12345 ?  Ss   10:00   0:00 kubectl port-forward service/api-service 8080:80
user     5678  0.0  0.1 123456 12345 ?  Ss   10:01   0:00 kubectl port-forward service/web-service 3000:3000`;

        mockedExec.mockImplementation(((cmd: string, callback: any) => {
          if (callback) {
            callback(null, { stdout: psOutput, stderr: '' } as any, '');
          }
          return {} as any;
        }) as any);

        const portForwards = await PortForwardManager.list();

        expect(mockedExec).toHaveBeenCalledWith(
          expect.stringContaining('ps aux'),
          expect.any(Function)
        );
        expect(portForwards).toHaveLength(2);
        expect(portForwards[0]).toEqual({
          serviceName: 'api-service',
          localPort: 8080,
          remotePort: 80,
          pid: 1234
        });
        expect(portForwards[1]).toEqual({
          serviceName: 'web-service',
          localPort: 3000,
          remotePort: 3000,
          pid: 5678
        });
      });

      it('should parse minikube kubectl processes on Unix', async () => {
        const psOutput = `user     1234  0.0  0.1 123456 12345 ?  Ss   10:00   0:00 minikube kubectl -- port-forward service/api-service 8080:80`;

        mockedExec.mockImplementation(((cmd: string, callback: any) => {
          if (callback) {
            callback(null, { stdout: psOutput, stderr: '' } as any, '');
          }
          return {} as any;
        }) as any);

        const portForwards = await PortForwardManager.list();

        expect(portForwards).toHaveLength(1);
        expect(portForwards[0]).toEqual({
          serviceName: 'api-service',
          localPort: 8080,
          remotePort: 80,
          pid: 1234
        });
      });

      it('should return empty array when no processes found on Unix', async () => {
        mockedExec.mockImplementation(((cmd: string, callback: any) => {
          if (callback) {
            const error: any = new Error('No processes found');
            error.stdout = '';
            callback(error, { stdout: '', stderr: '' } as any, '');
          }
          return {} as any;
        }) as any);

        const portForwards = await PortForwardManager.list();

        expect(portForwards).toHaveLength(0);
      });
    });
  });

  describe('list (deduplication)', () => {
    beforeEach(() => {
      Object.defineProperty(process, 'platform', {
        value: 'linux',
        configurable: true
      });
    });

    it('should deduplicate port-forwards with same service and ports', async () => {
      // Simulate minikube creating multiple processes for same service
      const psOutput = `user     1234  0.0  0.1 123456 12345 ?  Ss   10:00   0:00 kubectl port-forward service/api-service 8080:80
user     5678  0.0  0.1 123456 12345 ?  Ss   10:00   0:00 kubectl port-forward service/api-service 8080:80
user     9012  0.0  0.1 123456 12345 ?  Ss   10:01   0:00 kubectl port-forward service/web-service 3000:3000`;

      mockedExec.mockImplementation(((cmd: string, callback: any) => {
        if (callback) {
          callback(null, { stdout: psOutput, stderr: '' } as any, '');
        }
        return {} as any;
      }) as any);

      const portForwards = await PortForwardManager.list();

      // Should be deduplicated to 2 unique services
      expect(portForwards).toHaveLength(2);
    });
  });

  describe('stop', () => {
    describe('Windows environment', () => {
      beforeEach(() => {
        Object.defineProperty(process, 'platform', {
          value: 'win32',
          configurable: true
        });
      });

      it('should stop matching port-forwards on Windows', async () => {
        const wmicOutput = `Node,CommandLine,ProcessId
NODE1,kubectl.exe port-forward service/api-service 8080:80,1234
NODE1,kubectl.exe port-forward service/api-gateway 8081:80,5678
NODE1,kubectl.exe port-forward service/web-service 3000:3000,9012
`;

        let execCallCount = 0;
        mockedExec.mockImplementation(((cmd: string, callback: any) => {
          execCallCount++;
          if (execCallCount === 1) {
            // First call is wmic to list processes
            if (callback) {
              callback(null, { stdout: wmicOutput, stderr: '' } as any, '');
            }
          } else {
            // Subsequent calls are taskkill
            if (callback) {
              callback(null, { stdout: '', stderr: '' } as any, '');
            }
          }
          return {} as any;
        }) as any);

        const stoppedCount = await PortForwardManager.stop('api');

        expect(stoppedCount).toBe(2);
        expect(mockedExec).toHaveBeenCalledWith(
          expect.stringContaining('taskkill /F /PID 1234'),
          expect.any(Function)
        );
        expect(mockedExec).toHaveBeenCalledWith(
          expect.stringContaining('taskkill /F /PID 5678'),
          expect.any(Function)
        );
      });

      it('should return 0 when no matching processes found on Windows', async () => {
        const wmicOutput = `Node,CommandLine,ProcessId
NODE1,kubectl.exe port-forward service/web-service 3000:3000,9012
`;

        mockedExec.mockImplementation(((cmd: string, callback: any) => {
          if (callback) {
            callback(null, { stdout: wmicOutput, stderr: '' } as any, '');
          }
          return {} as any;
        }) as any);

        const stoppedCount = await PortForwardManager.stop('api');

        expect(stoppedCount).toBe(0);
        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining('No running port-forwards found matching "api"')
        );
      });
    });

    describe('Unix environment', () => {
      beforeEach(() => {
        Object.defineProperty(process, 'platform', {
          value: 'linux',
          configurable: true
        });
      });

      it('should stop matching port-forwards on Unix', async () => {
        const psOutput = `user     1234  0.0  0.1 123456 12345 ?  Ss   10:00   0:00 kubectl port-forward service/api-service 8080:80
user     5678  0.0  0.1 123456 12345 ?  Ss   10:01   0:00 kubectl port-forward service/api-gateway 8081:80`;

        let execCallCount = 0;
        mockedExec.mockImplementation(((cmd: string, callback: any) => {
          execCallCount++;
          if (execCallCount === 1) {
            // First call is ps to list processes
            if (callback) {
              callback(null, { stdout: psOutput, stderr: '' } as any, '');
            }
          } else {
            // Subsequent calls are kill
            if (callback) {
              callback(null, { stdout: '', stderr: '' } as any, '');
            }
          }
          return {} as any;
        }) as any);

        const stoppedCount = await PortForwardManager.stop('api');

        expect(stoppedCount).toBe(2);
        expect(mockedExec).toHaveBeenCalledWith(
          expect.stringContaining('kill 1234'),
          expect.any(Function)
        );
        expect(mockedExec).toHaveBeenCalledWith(
          expect.stringContaining('kill 5678'),
          expect.any(Function)
        );
      });
    });
  });

  describe('stopAll', () => {
    describe('Windows environment', () => {
      beforeEach(() => {
        Object.defineProperty(process, 'platform', {
          value: 'win32',
          configurable: true
        });
      });

      it('should stop all port-forwards on Windows', async () => {
        const wmicOutput = `Node,CommandLine,ProcessId
NODE1,kubectl.exe port-forward service/api-service 8080:80,1234
NODE1,kubectl.exe port-forward service/web-service 3000:3000,5678
`;

        let execCallCount = 0;
        mockedExec.mockImplementation(((cmd: string, callback: any) => {
          execCallCount++;
          if (execCallCount === 1) {
            if (callback) {
              callback(null, { stdout: wmicOutput, stderr: '' } as any, '');
            }
          } else {
            if (callback) {
              callback(null, { stdout: '', stderr: '' } as any, '');
            }
          }
          return {} as any;
        }) as any);

        const stoppedCount = await PortForwardManager.stopAll();

        expect(stoppedCount).toBe(2);
        expect(mockedExec).toHaveBeenCalledWith(
          expect.stringContaining('taskkill /F /PID'),
          expect.any(Function)
        );
      });

      it('should return 0 when no processes running on Windows', async () => {
        mockedExec.mockImplementation(((cmd: string, callback: any) => {
          if (callback) {
            const error: any = new Error('No processes found');
            error.stdout = '';
            callback(error, { stdout: '', stderr: '' } as any, '');
          }
          return {} as any;
        }) as any);

        const stoppedCount = await PortForwardManager.stopAll();

        expect(stoppedCount).toBe(0);
        expect(consoleLogSpy).toHaveBeenCalledWith('No running port-forwards found');
      });
    });

    describe('Unix environment', () => {
      beforeEach(() => {
        Object.defineProperty(process, 'platform', {
          value: 'linux',
          configurable: true
        });
      });

      it('should stop all port-forwards on Unix', async () => {
        const psOutput = `user     1234  0.0  0.1 123456 12345 ?  Ss   10:00   0:00 kubectl port-forward service/api-service 8080:80
user     5678  0.0  0.1 123456 12345 ?  Ss   10:01   0:00 kubectl port-forward service/web-service 3000:3000`;

        let execCallCount = 0;
        mockedExec.mockImplementation(((cmd: string, callback: any) => {
          execCallCount++;
          if (execCallCount === 1) {
            if (callback) {
              callback(null, { stdout: psOutput, stderr: '' } as any, '');
            }
          } else {
            if (callback) {
              callback(null, { stdout: '', stderr: '' } as any, '');
            }
          }
          return {} as any;
        }) as any);

        const stoppedCount = await PortForwardManager.stopAll();

        expect(stoppedCount).toBe(2);
        expect(mockedExec).toHaveBeenCalledWith(
          expect.stringContaining('kill'),
          expect.any(Function)
        );
      });
    });
  });

  describe('killProcess (private method)', () => {
    it('should ignore errors when killing already dead process', async () => {
      Object.defineProperty(process, 'platform', {
        value: 'linux',
        configurable: true
      });

      const psOutput = `user     1234  0.0  0.1 123456 12345 ?  Ss   10:00   0:00 kubectl port-forward service/api-service 8080:80`;

      let execCallCount = 0;
      mockedExec.mockImplementation(((cmd: string, callback: any) => {
        execCallCount++;
        if (execCallCount === 1) {
          if (callback) {
            callback(null, { stdout: psOutput, stderr: '' } as any, '');
          }
        } else {
          // Simulate error when killing (process already dead)
          if (callback) {
            callback(new Error('No such process'), { stdout: '', stderr: '' } as any, '');
          }
        }
        return {} as any;
      }) as any);

      // Should not throw
      await expect(PortForwardManager.stop('api')).resolves.toBe(1);
    });
  });
});
