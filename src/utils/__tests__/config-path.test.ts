import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { getConfigPath, ensureConfigExists, readConfig } from '../config-path';

// Mock the fs and os modules
jest.mock('fs');
jest.mock('os');

const mockedFs = fs as jest.Mocked<typeof fs>;
const mockedOs = os as jest.Mocked<typeof os>;

describe('config-path', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  describe('getConfigPath', () => {
    describe('Unix environment', () => {
      it('should return correct path with Unix home directory', () => {
        mockedOs.homedir.mockReturnValue('/home/testuser');

        const configPath = getConfigPath();

        expect(configPath).toBe('/home/testuser/.kxpf.config');
        expect(mockedOs.homedir).toHaveBeenCalledTimes(1);
      });

      it('should handle root user home directory', () => {
        mockedOs.homedir.mockReturnValue('/root');

        const configPath = getConfigPath();

        expect(configPath).toBe('/root/.kxpf.config');
      });

      it('should handle home directory with special characters', () => {
        mockedOs.homedir.mockReturnValue('/home/user-name_123');

        const configPath = getConfigPath();

        expect(configPath).toBe('/home/user-name_123/.kxpf.config');
      });
    });

    describe('Windows environment', () => {
      it('should return correct path with Windows home directory', () => {
        mockedOs.homedir.mockReturnValue('C:\\Users\\TestUser');

        const configPath = getConfigPath();

        expect(configPath).toBe(path.join('C:\\Users\\TestUser', '.kxpf.config'));
        expect(mockedOs.homedir).toHaveBeenCalledTimes(1);
      });

      it('should handle Windows home directory with spaces', () => {
        mockedOs.homedir.mockReturnValue('C:\\Users\\Test User');

        const configPath = getConfigPath();

        expect(configPath).toBe(path.join('C:\\Users\\Test User', '.kxpf.config'));
      });

      it('should handle Windows home directory on different drive', () => {
        mockedOs.homedir.mockReturnValue('D:\\Users\\TestUser');

        const configPath = getConfigPath();

        expect(configPath).toBe(path.join('D:\\Users\\TestUser', '.kxpf.config'));
      });
    });
  });

  describe('ensureConfigExists', () => {
    describe('Unix environment', () => {
      beforeEach(() => {
        mockedOs.homedir.mockReturnValue('/home/testuser');
      });

      it('should create config file if it does not exist', () => {
        mockedFs.existsSync.mockReturnValue(false);
        mockedFs.writeFileSync.mockImplementation(() => {});

        ensureConfigExists();

        expect(mockedFs.existsSync).toHaveBeenCalledWith('/home/testuser/.kxpf.config');
        expect(mockedFs.writeFileSync).toHaveBeenCalledTimes(1);
        expect(mockedFs.writeFileSync).toHaveBeenCalledWith(
          '/home/testuser/.kxpf.config',
          expect.stringContaining('# Config format:'),
          'utf-8'
        );
      });

      it('should not create config file if it already exists', () => {
        mockedFs.existsSync.mockReturnValue(true);

        ensureConfigExists();

        expect(mockedFs.existsSync).toHaveBeenCalledWith('/home/testuser/.kxpf.config');
        expect(mockedFs.writeFileSync).not.toHaveBeenCalled();
      });

      it('should create config with default content including example group', () => {
        mockedFs.existsSync.mockReturnValue(false);
        mockedFs.writeFileSync.mockImplementation(() => {});

        ensureConfigExists();

        const writeCall = mockedFs.writeFileSync.mock.calls[0];
        const content = writeCall[1] as string;

        expect(content).toContain('example-group:');
        expect(content).toContain('example-service,8080,80');
        expect(content).toContain('# Config format:');
      });
    });

    describe('Windows environment', () => {
      beforeEach(() => {
        mockedOs.homedir.mockReturnValue('C:\\Users\\TestUser');
      });

      it('should create config file on Windows if it does not exist', () => {
        mockedFs.existsSync.mockReturnValue(false);
        mockedFs.writeFileSync.mockImplementation(() => {});

        ensureConfigExists();

        const expectedPath = path.join('C:\\Users\\TestUser', '.kxpf.config');
        expect(mockedFs.existsSync).toHaveBeenCalledWith(expectedPath);
        expect(mockedFs.writeFileSync).toHaveBeenCalledTimes(1);
      });

      it('should not create config file on Windows if it already exists', () => {
        mockedFs.existsSync.mockReturnValue(true);

        ensureConfigExists();

        expect(mockedFs.writeFileSync).not.toHaveBeenCalled();
      });
    });
  });

  describe('readConfig', () => {
    describe('Unix environment', () => {
      beforeEach(() => {
        mockedOs.homedir.mockReturnValue('/home/testuser');
      });

      it('should read existing config file', () => {
        const mockContent = 'test-group: {\n  test-service,8080,80\n}';
        mockedFs.existsSync.mockReturnValue(true);
        mockedFs.readFileSync.mockReturnValue(mockContent);

        const content = readConfig();

        expect(content).toBe(mockContent);
        expect(mockedFs.readFileSync).toHaveBeenCalledWith(
          '/home/testuser/.kxpf.config',
          'utf-8'
        );
      });

      it('should create config file before reading if it does not exist', () => {
        const mockContent = 'default content';
        mockedFs.existsSync.mockReturnValue(false);
        mockedFs.writeFileSync.mockImplementation(() => {});
        mockedFs.readFileSync.mockReturnValue(mockContent);

        const content = readConfig();

        expect(mockedFs.writeFileSync).toHaveBeenCalledTimes(1);
        expect(mockedFs.readFileSync).toHaveBeenCalledTimes(1);
        expect(content).toBe(mockContent);
      });
    });

    describe('Windows environment', () => {
      beforeEach(() => {
        mockedOs.homedir.mockReturnValue('C:\\Users\\TestUser');
      });

      it('should read existing config file on Windows', () => {
        const mockContent = 'test-group: {\n  test-service,8080,80\n}';
        const expectedPath = path.join('C:\\Users\\TestUser', '.kxpf.config');
        mockedFs.existsSync.mockReturnValue(true);
        mockedFs.readFileSync.mockReturnValue(mockContent);

        const content = readConfig();

        expect(content).toBe(mockContent);
        expect(mockedFs.readFileSync).toHaveBeenCalledWith(expectedPath, 'utf-8');
      });

      it('should create config file on Windows before reading if it does not exist', () => {
        const mockContent = 'default content';
        mockedFs.existsSync.mockReturnValue(false);
        mockedFs.writeFileSync.mockImplementation(() => {});
        mockedFs.readFileSync.mockReturnValue(mockContent);

        const content = readConfig();

        expect(mockedFs.writeFileSync).toHaveBeenCalledTimes(1);
        expect(mockedFs.readFileSync).toHaveBeenCalledTimes(1);
      });
    });
  });
});
