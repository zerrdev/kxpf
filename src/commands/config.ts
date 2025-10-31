import { getConfigPath, ensureConfigExists } from '../utils/config-path';
import { spawn } from 'child_process';

export async function configCommand(): Promise<void> {
  try {
    ensureConfigExists();
    const configPath = getConfigPath();

    // Try to open with VSCode
    const vscode = spawn('code', [configPath], {
      stdio: 'ignore',
      detached: true
    });

    vscode.on('error', (err) => {
      // VSCode not found, show path instead
      console.log('VSCode not found. Config file location:');
      console.log(configPath);
    });

    vscode.on('spawn', () => {
      console.log(`Opening config file in VSCode: ${configPath}`);
      vscode.unref();
    });
  } catch (error: any) {
    const configPath = getConfigPath();
    console.log('Could not open VSCode. Config file location:');
    console.log(configPath);
  }
}
