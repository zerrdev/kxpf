import { exec } from 'child_process';
import { promisify } from 'util';
import { readConfig } from '../utils/config-path';
import { ConfigParser } from '../parser/config-parser';

const execAsync = promisify(exec);

export async function findCommand(searchTerm: string, groupName?: string): Promise<void> {
  try {
    let context: string | undefined;

    // If group is specified, get its context
    if (groupName) {
      const configContent = readConfig();
      const config = ConfigParser.parse(configContent);

      const group = ConfigParser.findGroup(config, groupName);
      if (!group) {
        console.error(`Group "${groupName}" not found in config`);
        process.exit(1);
      }

      context = group.context;
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
      const line = lines[i].trim();
      if (!line) continue;

      // Parse service line (format: NAMESPACE NAME TYPE CLUSTER-IP EXTERNAL-IP PORT(S) AGE SELECTOR)
      const parts = line.split(/\s+/);
      if (parts.length < 6) continue;

      const [namespace, name, type, clusterIP, , ports] = parts;

      // Check if service name matches search term
      if (name.includes(searchTerm)) {
        matchingServices.push({ namespace, name, type, clusterIP, ports });
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

    // Display services
    for (const service of matchingServices) {
      console.log(`${service.name}`);
      console.log(`  Namespace: ${service.namespace}`);
      console.log(`  Type: ${service.type}`);
      console.log(`  Cluster IP: ${service.clusterIP}`);
      console.log(`  Ports: ${service.ports}`);
      console.log('');
    }
  } catch (error: any) {
    if (error.message.includes('command not found') || error.message.includes('not recognized')) {
      console.error('Error: kubectl not found. Please ensure kubectl is installed and in your PATH.');
    } else {
      console.error('Error searching for services:', error.message);
    }
    process.exit(1);
  }
}
