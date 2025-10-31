import { PortForwardManager } from '../manager/port-forward';

export async function stopCommand(servicePrefix: string): Promise<void> {
  try {
    const stoppedCount = await PortForwardManager.stop(servicePrefix);

    if (stoppedCount > 0) {
      console.log(`\nStopped ${stoppedCount} port-forward(s)`);
    }
  } catch (error: any) {
    console.error('Error stopping port-forwards:', error.message);
    process.exit(1);
  }
}
