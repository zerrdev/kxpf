import { PortForwardManager } from '../manager/port-forward';
import { handleError } from '../utils/error-handler';

export async function stopAllCommand(): Promise<void> {
  try {
    const stoppedCount = await PortForwardManager.stopAll();

    if (stoppedCount > 0) {
      console.log(`\nStopped all ${stoppedCount} port-forward(s)`);
    } else {
      console.log('No running port-forwards found');
    }
  } catch (error) {
    handleError(error);
  }
}
