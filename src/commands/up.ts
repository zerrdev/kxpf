import { readConfig } from '../utils/config-path';
import { ConfigParser } from '../parser/config-parser';
import { PortForwardManager } from '../manager/port-forward';

export async function upCommand(groupName: string, servicePrefix?: string): Promise<void> {
  try {
    // Read and parse config
    const configContent = readConfig();
    const config = ConfigParser.parse(configContent);

    // Find the group
    const group = ConfigParser.findGroup(config, groupName);
    if (!group) {
      console.error(`Group "${groupName}" not found in config`);
      process.exit(1);
    }

    // Find services to start
    const services = ConfigParser.findServicesWithPrefix(group, servicePrefix);

    if (services.length === 0) {
      if (servicePrefix) {
        console.error(`No services found matching "${servicePrefix}" in group "${groupName}"`);
      } else {
        console.error(`No services found in group "${groupName}"`);
      }
      process.exit(1);
    }

    // Start port-forwards
    console.log(`Starting port-forwards for group "${groupName}"...`);
    for (const service of services) {
      await PortForwardManager.start(service.name, service.localPort, service.remotePort);
    }

    console.log(`\nSuccessfully started ${services.length} port-forward(s)`);
  } catch (error: any) {
    console.error('Error starting port-forwards:', error.message);
    process.exit(1);
  }
}
