import { PortForwardManager } from '../manager/port-forward';
import { handleError } from '../utils/error-handler';

export async function stopCommand(servicePrefix: string): Promise<void> {
  try {
    const stoppedCount = await PortForwardManager.stop(servicePrefix);

    if (stoppedCount > 0) {
      console.log(`\nStopped ${stoppedCount} port-forward(s)`);
    } else {
      console.log(`No running port-forwards found matching "${servicePrefix}"`);
    }
  } catch (error) {
    handleError(error);
  }
}
