import { PortForwardManager } from '../manager/port-forward';
import { handleError } from '../utils/error-handler';
import { debugLog, isDebugEnabled } from '../utils/debug';

export async function stopAllCommand(): Promise<void> {
  try {
    debugLog(`Debug mode enabled: ${isDebugEnabled()}`);
    debugLog('Stopping all port-forwards...');

    const stoppedCount = await PortForwardManager.stopAll();

    if (stoppedCount > 0) {
      console.log(`\nStopped all ${stoppedCount} port-forward(s)`);
    } else {
      console.log('No running port-forwards found');
    }

    debugLog(`Stopped all ${stoppedCount} port-forward(s)`);
  } catch (error) {
    debugLog(`Error in stopAllCommand: ${error instanceof Error ? error.message : 'Unknown error'}`);
    handleError(error);
  }
}
