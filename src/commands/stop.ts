import { PortForwardManager } from '../manager/port-forward';
import { handleError } from '../utils/error-handler';
import { debugLog, isDebugEnabled } from '../utils/debug';

export async function stopCommand(servicePrefix: string): Promise<void> {
  try {
    debugLog(`Debug mode enabled: ${isDebugEnabled()}`);
    debugLog(`Stopping port-forwards matching prefix: ${servicePrefix}`);

    const stoppedCount = await PortForwardManager.stop(servicePrefix);

    if (stoppedCount > 0) {
      console.log(`\nStopped ${stoppedCount} port-forward(s)`);
    } else {
      console.log(`No running port-forwards found matching "${servicePrefix}"`);
    }

    debugLog(`Stopped ${stoppedCount} port-forward(s)`);
  } catch (error) {
    debugLog(`Error in stopCommand: ${error instanceof Error ? error.message : 'Unknown error'}`);
    handleError(error);
  }
}
