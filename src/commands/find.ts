import { exec } from 'child_process';
import { promisify } from 'util';
import { readConfig } from '../utils/config-path';
import { ConfigParser } from '../parser/config-parser';
import { GroupNotFoundError } from '../errors';
import { handleError } from '../utils/error-handler';

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
    validateSearchTerm(searchTerm);
    
    let context: string | undefined;

    // If group is specified, get its context
    if (groupName) {
      const configContent = readConfig();
      const config = ConfigParser.parse(configContent);

      try {
        const group = ConfigParser.findGroup(config, groupName);
        context = group.context;
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

    // Execute kubectl command
    const { stdout } = await execAsync(kubectlCmd);

    // Parse output
    const lines = stdout.split('\n').filter(line => line.trim());
    if (lines.length <= 1) {
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
        matchingServices.push({
          namespace: namespace,
          name: name,
          type: type,
          clusterIP: clusterIP,
          ports: ports
        });
      }
    }

    // Display results
    if (matchingServices.length === 0) {
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
    handleError(error);
  }
}
