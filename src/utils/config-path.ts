import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { ConfigParseError } from '../errors';

const CONFIG_FILENAME = '.kxpf.config';

/**
 * Gets the path to the config file
 * - Unix: ~/.kxpf.config
 * - Windows: %userprofile%/.kxpf.config
 * @returns The full path to the config file
 * @throws Error if home directory cannot be determined
 */
export function getConfigPath(): string {
  try {
    const homeDir = os.homedir();
    if (!homeDir) {
      throw new Error('Cannot determine home directory');
    }
    return path.join(homeDir, CONFIG_FILENAME);
  } catch (error) {
    throw new Error(`Failed to get config path: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Creates a default config file if it doesn't exist
 * @throws ConfigParseError if the config file cannot be created
 */
export function ensureConfigExists(): void {
  const configPath = getConfigPath();

  try {
    if (!fs.existsSync(configPath)) {
      const defaultConfig = `# Config format: service-name,local-port,remote-port
# Optional: Set a context per group with "context: context-name"

example-group: {
    example-service,8080,80
}

# Example with context:
# production: {
#     context: prod-cluster
#     api-service,8081,80
#     web-service,8082,80
# }
`;
      fs.writeFileSync(configPath, defaultConfig, 'utf-8');
      // Set appropriate permissions (read/write for owner only)
      try {
        fs.chmodSync(configPath, 0o600);
      } catch (chmodError) {
        // Ignore chmod errors on Windows or systems where chmod is not supported
        if (process.platform !== 'win32') {
          console.warn(`Warning: Could not set file permissions for ${configPath}`);
        }
      }
    }
  } catch (error) {
    throw new ConfigParseError(`Failed to create config file at ${configPath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Reads the config file content
 * @returns The config file content as a string
 * @throws ConfigParseError if the config file cannot be read
 */
export function readConfig(): string {
  ensureConfigExists();
  const configPath = getConfigPath();

  try {
    return fs.readFileSync(configPath, 'utf-8');
  } catch (error) {
    throw new ConfigParseError(`Failed to read config file at ${configPath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Validates that the config file exists and is readable
 * @returns true if the config file exists and is readable, false otherwise
 */
export function isConfigValid(): boolean {
  try {
    const configPath = getConfigPath();
    return fs.existsSync(configPath) && fs.statSync(configPath).isFile();
  } catch {
    return false;
  }
}

/**
 * Gets information about the config file
 * @returns Object containing config file information
 */
export function getConfigInfo(): { path: string; exists: boolean; size?: number; lastModified?: Date } {
  const configPath = getConfigPath();
  const exists = fs.existsSync(configPath);
  
  if (!exists) {
    return { path: configPath, exists: false };
  }

  try {
    const stats = fs.statSync(configPath);
    return {
      path: configPath,
      exists: true,
      size: stats.size,
      lastModified: stats.mtime
    };
  } catch (error) {
    return {
      path: configPath,
      exists: true // File exists but we can't read stats
    };
  }
}
