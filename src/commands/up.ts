import { readConfig } from '../utils/config-path';
import { ConfigParser } from '../parser/config-parser';
import { PortForwardManager } from '../manager/port-forward';
import { KubectlNotFoundError } from '../errors';
import { handleError } from '../utils/error-handler';

export async function upCommand(groupName: string, servicePrefix?: string): Promise<void> {
  try {
    // Read and parse config
    const configContent = readConfig();
    const config = ConfigParser.parse(configContent);

    // Find the group
    const group = ConfigParser.findGroup(config, groupName);

    // Find services to start
    const services = ConfigParser.findServicesWithPrefix(group, servicePrefix);

    // Start port-forwards
    console.log(`Starting port-forwards for group "${groupName}"...`);
    if (group.context) {
      console.log(`Using context: ${group.context}`);
    }
    
    const successfulServices: string[] = [];
    
    for (const service of services) {
      try {
        await PortForwardManager.start(service.name, service.localPort, service.remotePort, group.context);
        successfulServices.push(service.name);
      } catch (error) {
        if (error instanceof KubectlNotFoundError) {
          throw error;
        }
        console.warn(`Warning: Failed to start port-forward for ${service.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    if (successfulServices.length > 0) {
      console.log(`\nSuccessfully started ${successfulServices.length} port-forward(s)`);
      if (successfulServices.length !== services.length) {
        console.log(`Note: ${services.length - successfulServices.length} service(s) failed to start`);
      }
    } else {
      console.error('\nNo port-forwards were successfully started');
      process.exit(1);
    }
  } catch (error) {
    handleError(error);
  }
}
