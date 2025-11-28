import { getConfigPath, ensureConfigExists, getConfigInfo } from '../utils/config-path';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import * as os from 'os';
import { handleError } from '../utils/error-handler';
import { debugLog, isDebugEnabled } from '../utils/debug';

const execAsync = promisify(exec);

/**
 * Detects if VSCode is available on the system
 */
async function isVSCodeAvailable(): Promise<boolean> {
  try {
    debugLog('Checking if VSCode is available...');
    const isWindows = process.platform === 'win32';

    if (isWindows) {
      // On Windows, try multiple approaches to detect VSCode
      const commands = [
        'where code',  // Look in PATH
        'powershell -Command "Get-Command code"'  // PowerShell command detection
      ];

      for (const command of commands) {
        try {
          const { stdout } = await execAsync(command, { timeout: 5000 });
          if (stdout.trim()) {
            debugLog('VSCode found via command: ' + command);
            return true;
          }
        } catch {
          // Continue to next command
        }
      }

      // Try common installation paths on Windows
      const commonPaths = [
        `${os.homedir()}\\AppData\\Local\\Programs\\Microsoft VS Code\\bin\\code.cmd`,
        `${os.homedir()}\\AppData\\Local\\Programs\\Microsoft VS Code\\Code.exe`,
        `C:\\Program Files\\Microsoft VS Code\\bin\\code.cmd`,
        `C:\\Program Files\\Microsoft VS Code\\Code.exe`
      ];

      for (const path of commonPaths) {
        try {
          const fs = await import('fs/promises');
          try {
            await fs.access(path);
            debugLog('VSCode found at path: ' + path);
            return true;
          } catch {
            // File doesn't exist or not accessible
          }
        } catch {
          // Module import failed or other error
        }
      }
    } else {
      // On Unix-like systems, try which and command -v
      const commands = [
        'which code',
        'command -v code'
      ];

      for (const command of commands) {
        try {
          const { stdout } = await execAsync(command);
          if (stdout.trim()) {
            debugLog('VSCode found via command: ' + command);
            return true;
          }
        } catch {
          // Continue to next command
        }
      }
    }

    debugLog('VSCode not found');
    return false;
  } catch {
    debugLog('Error checking for VSCode availability');
    return false;
  }
}

/**
 * Opens file with system default editor on Windows as fallback
 */
function openWithDefaultEditor(filePath: string): void {
  debugLog('Opening file with system default editor: ' + filePath);
  if (process.platform === 'win32') {
    spawn('start', ['""', filePath], { shell: true, detached: true });
  } else if (process.platform === 'darwin') {
    spawn('open', [filePath], { detached: true });
  } else {
    // Linux and other Unix-like systems
    const editors = ['xdg-open', 'gio', 'gvfs-open'];
    for (const editor of editors) {
      try {
        spawn(editor, [filePath], { detached: true });
        return;
      } catch {
        continue;
      }
    }
    // Fallback to common editors
    const commonEditors = ['nano', 'vim', 'emacs', 'gedit', 'kate'];
    for (const editor of commonEditors) {
      try {
        spawn(editor, [filePath], { detached: true });
        return;
      } catch {
        continue;
      }
    }
  }
}

/**
 * Opens the config file in the default editor or shows its location
 */
export async function configCommand(): Promise<void> {
  try {
    debugLog(`Debug mode enabled: ${isDebugEnabled()}`);
    debugLog('Running config command...');

    ensureConfigExists();
    const configPath = getConfigPath();
    const configInfo = getConfigInfo();

    debugLog(`Config file path: ${configPath}`);
    debugLog(`Config file exists: ${configInfo.exists}`);

    console.log(`Config file: ${configPath}`);

    if (configInfo.exists) {
      console.log(`Size: ${configInfo.size} bytes`);
      if (configInfo.lastModified) {
        console.log(`Last modified: ${configInfo.lastModified.toLocaleString()}`);
      }
    }

    // Try to open with VSCode
    const isAvailable = await isVSCodeAvailable();

    if (isAvailable) {
      const isWindows = process.platform === 'win32';
      let vscode: any;

      if (isWindows) {
        // On Windows, try to find the exact VSCode executable path
        try {
          const { stdout } = await execAsync('where code');
          const firstLine = stdout.split('\n')[0];
          const codePath = firstLine ? firstLine.trim() : 'code';
          debugLog(`Opening VSCode via path: ${codePath}`);
          vscode = spawn('"' + codePath + '"', [configPath], {
            stdio: 'ignore',
            detached: true,
            shell: true
          });
        } catch {
          // Fallback to just using 'code' command
          debugLog('Opening VSCode via code command');
          vscode = spawn('code', [configPath], {
            stdio: 'ignore',
            detached: true
          });
        }
      } else {
        // On Unix-like systems
        debugLog('Opening VSCode via code command');
        vscode = spawn('code', [configPath], {
          stdio: 'ignore',
          detached: true
        });
      }

      vscode.on('error', () => {
        debugLog('VSCode found but failed to launch, trying system default editor');
        console.log('\nVSCode found but failed to launch. Trying system default editor...');
        try {
          openWithDefaultEditor(configPath);
          console.log('Opening config file with system default editor...');
        } catch {
          console.log('\nFailed to open with any editor. You can:');
          console.log(`1. Install VSCode: https://code.visualstudio.com/`);
          console.log(`2. Use another editor to open: ${configPath}`);
          console.log('3. Edit the config file manually');
        }
      });

      vscode.on('spawn', () => {
        debugLog('Successfully opened config file in editor');
        console.log(`\nOpening config file in VSCode...`);
        vscode.unref();
      });

      // Add a small delay to ensure the message is displayed
      setTimeout(() => {
        process.exit(0);
      }, 100);
    } else {
      debugLog('VSCode not available, opening with system default editor');
      console.log('\nVSCode not found. Opening with system default editor...');
      try {
        openWithDefaultEditor(configPath);
        console.log('Opening config file with system default editor...');
      } catch (error) {
        console.log('\nFailed to open with system default editor. You can:');
        console.log('1. Install VSCode: https://code.visualstudio.com/');
        console.log(`2. Use another editor to open: ${configPath}`);
        console.log('3. Edit the config file manually');
      }

      process.exit(0);
    }
  } catch (error) {
    debugLog(`Error in configCommand: ${error instanceof Error ? error.message : 'Unknown error'}`);
    handleError(error);
  }
}
