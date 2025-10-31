import { PortForwardManager } from '../manager/port-forward';

export async function stopAllCommand(): Promise<void> {
  try {
    const stoppedCount = await PortForwardManager.stopAll();

    if (stoppedCount > 0) {
      console.log(`\nStopped all ${stoppedCount} port-forward(s)`);
    }
  } catch (error: any) {
    console.error('Error stopping port-forwards:', error.message);
    process.exit(1);
  }
}
