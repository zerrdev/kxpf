import { exec } from 'child_process';
import { promisify } from 'util';
import { readConfig } from '../utils/config-path';
import { ConfigParser } from '../parser/config-parser';
import { GroupNotFoundError } from '../errors';
import { handleError } from '../utils/error-handler';
import { debugLog, debugLogObject, isDebugEnabled } from '../utils/debug';

const execAsync = promisify(exec);

/**
 * Validates search term input
 */
function validateSearchTerm(searchTerm: string): void {
  if (!searchTerm || typeof searchTerm !== 'string' || searchTerm.trim().length === 0) {
    throw new Error('Search term cannot be empty');
  }

  if (searchTerm.length < 2) {
    throw new Error('Search term must be at least 2 characters long');
  }
}

export async function findCommand(searchTerm: string, groupName?: string): Promise<void> {
  try {
    debugLog(`Debug mode enabled: ${isDebugEnabled()}`);
    debugLog(`Finding services matching: ${searchTerm}${groupName ? ` in group: ${groupName}` : ''}`);

    validateSearchTerm(searchTerm);

    let context: string | undefined;

    // If group is specified, get its context
    if (groupName) {
      debugLog(`Getting context for group: ${groupName}`);
      const configContent = readConfig();
      debugLog('Config file read successfully');
      const config = ConfigParser.parse(configContent);
      debugLogObject(config, 'Parsed config');

      try {
        const group = ConfigParser.findGroup(config, groupName);
        context = group.context;
        debugLog(`Found context for group: ${groupName} -> ${context || '(none)'}`);
      } catch (error) {
        if (error instanceof GroupNotFoundError) {
          throw error;
        }
        throw error;
      }

      if (context) {
        console.log(`Searching in context: ${context}\n`);
      }
    }

    // Build kubectl command
    const contextFlag = context ? `--context ${context}` : '';
    const kubectlCmd = `kubectl get services ${contextFlag} --all-namespaces -o wide`;
    debugLog(`Executing kubectl command: ${kubectlCmd}`);

    // Execute kubectl command
    const { stdout } = await execAsync(kubectlCmd);
    debugLog('Kubectl command executed successfully');

    // Parse output
    const lines = stdout.split('\n').filter(line => line.trim());
    debugLog(`Found ${lines.length} lines in kubectl output`);

    if (lines.length <= 1) {
      debugLog('No services found in cluster output');
      console.log('No services found in cluster');
      return;
    }

    // Filter services matching search term
    const matchingServices: Array<{ namespace: string; name: string; type: string; clusterIP: string; ports: string }> = [];

    // Skip header line
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i]?.trim();
      if (!line) continue;

      // Parse service line (format: NAMESPACE NAME TYPE CLUSTER-IP EXTERNAL-IP PORT(S) AGE SELECTOR)
      const parts = line.split(/\s+/);
      if (parts.length < 6) continue;

      const [namespace, name, type, clusterIP, , ports] = parts;

      // Validate that all required fields are present
      if (!namespace || !name || !type || !clusterIP || !ports) {
        continue;
      }

      // Check if service name matches search term (case insensitive)
      if (name.toLowerCase().includes(searchTerm.toLowerCase())) {
        debugLog(`Found matching service: ${name}`);
        matchingServices.push({
          namespace: namespace,
          name: name,
          type: type,
          clusterIP: clusterIP,
          ports: ports
        });
      }
    }

    debugLog(`Found ${matchingServices.length} matching services`);

    // Display results
    if (matchingServices.length === 0) {
      debugLog('No services matched the search term');
      if (groupName) {
        console.log(`No services found matching "${searchTerm}" in context of group "${groupName}"`);
      } else {
        console.log(`No services found matching "${searchTerm}"`);
      }
      return;
    }

    console.log(`Found ${matchingServices.length} service(s) matching "${searchTerm}":\n`);

    // Display services with improved formatting
    for (const service of matchingServices) {
      console.log(`• ${service.name}`);
      console.log(`  Namespace: ${service.namespace}`);
      console.log(`  Type: ${service.type}`);
      console.log(`  Cluster IP: ${service.clusterIP}`);
      console.log(`  Ports: ${service.ports}`);
      console.log('');
    }
  } catch (error) {
    debugLog(`Error in findCommand: ${error instanceof Error ? error.message : 'Unknown error'}`);
    handleError(error);
  }
}
