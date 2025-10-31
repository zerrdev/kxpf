import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

const CONFIG_FILENAME = '.kxpf.config';

/**
 * Gets the path to the config file
 * - Unix: ~/.kxpf.config
 * - Windows: %userprofile%/.kxpf.config
 */
export function getConfigPath(): string {
  const homeDir = os.homedir();
  return path.join(homeDir, CONFIG_FILENAME);
}

/**
 * Creates a default config file if it doesn't exist
 */
export function ensureConfigExists(): void {
  const configPath = getConfigPath();

  if (!fs.existsSync(configPath)) {
    const defaultConfig = `# Config format: service-name,local-port,remote-port

example-group: {
    example-service,8080,80
}
`;
    fs.writeFileSync(configPath, defaultConfig, 'utf-8');
  }
}

/**
 * Reads the config file content
 */
export function readConfig(): string {
  ensureConfigExists();
  const configPath = getConfigPath();
  return fs.readFileSync(configPath, 'utf-8');
}
