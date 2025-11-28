import { readConfig } from '../utils/config-path';
import { ConfigParser } from '../parser/config-parser';
import { PortForwardManager } from '../manager/port-forward';
import { KubectlNotFoundError } from '../errors';
import { handleError } from '../utils/error-handler';
import { debugLog, debugLogObject, isDebugEnabled } from '../utils/debug';

export async function upCommand(groupName: string, servicePrefix?: string, debug?: boolean): Promise<void> {
  try {
    debugLog(`Debug mode enabled: ${isDebugEnabled()}`);

    // Update debug setting if explicitly passed
    if (debug !== undefined) {
      // Debug setting is already handled globally via the setDebug function
    }

    // Read and parse config
    debugLog('Reading config file...');
    const configContent = readConfig();
    debugLog('Config file read successfully');

    debugLog('Parsing config file...');
    const config = ConfigParser.parse(configContent);
    debugLogObject(config, 'Parsed config');

    // Find the group
    debugLog(`Finding group: ${groupName}`);
    const group = ConfigParser.findGroup(config, groupName);
    debugLogObject(group, `Found group: ${groupName}`);

    // Find services to start
    debugLog(`Finding services with prefix: ${servicePrefix || '(none, all services in group)'}`);
    const services = ConfigParser.findServicesWithPrefix(group, servicePrefix);
    debugLogObject(services, 'Found services');

    // Start port-forwards
    console.log(`Starting port-forwards for group "${groupName}"...`);
    if (group.context) {
      console.log(`Using context: ${group.context}`);
    }

    const successfulServices: string[] = [];

    for (const service of services) {
      debugLog(`Starting port-forward for service: ${service.name} (local:${service.localPort} -> remote:${service.remotePort})`);
      try {
        await PortForwardManager.start(service.name, service.localPort, service.remotePort, group.context);
        successfulServices.push(service.name);
        debugLog(`Successfully started port-forward for service: ${service.name}`);
      } catch (error) {
        debugLog(`Failed to start port-forward for service: ${service.name} - ${error instanceof Error ? error.message : 'Unknown error'}`);
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
    debugLog(`Error in upCommand: ${error instanceof Error ? error.message : 'Unknown error'}`);
    handleError(error);
  }
}
