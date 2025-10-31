import { PortForwardManager } from '../manager/port-forward';

export async function lsCommand(): Promise<void> {
  try {
    const running = await PortForwardManager.list();

    if (running.length === 0) {
      console.log('No running port-forwards found');
      return;
    }

    console.log('\nRunning port-forwards:');
    console.log('─'.repeat(70));
    console.log(
      'Service Name'.padEnd(30) +
      'Local Port'.padEnd(15) +
      'Remote Port'.padEnd(15)
    );
    console.log('─'.repeat(70));

    for (const pf of running) {
      console.log(
        pf.serviceName.padEnd(30) +
        pf.localPort.toString().padEnd(15) +
        pf.remotePort.toString().padEnd(15)
      );
    }

    console.log('─'.repeat(70));
    console.log(`Total: ${running.length} port-forward(s)\n`);
  } catch (error: any) {
    console.error('Error listing port-forwards:', error.message);
    process.exit(1);
  }
}
