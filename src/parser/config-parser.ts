export interface Service {
  name: string;
  localPort: number;
  remotePort: number;
}

export interface Group {
  name: string;
  services: Service[];
}

export interface Config {
  groups: Map<string, Group>;
}

export class ConfigParser {
  /**
   * Parses the kxpf config file format
   * @param content - The raw config file content
   * @returns Parsed configuration object
   */
  static parse(content: string): Config {
    const groups = new Map<string, Group>();
    const lines = content.split('\n');

    let currentGroup: Group | null = null;
    let inGroup = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Skip empty lines
      if (line === '') {
        continue;
      }

      // Skip comments
      if (line.startsWith('#')) {
        continue;
      }

      // Check for group declaration (e.g., "group1: {" or "group1:{")
      const groupMatch = line.match(/^([a-zA-Z-]+)\s*:\s*\{/);
      if (groupMatch) {
        const groupName = groupMatch[1];
        currentGroup = {
          name: groupName,
          services: []
        };
        inGroup = true;
        continue;
      }

      // Check for group end
      if (line === '}') {
        if (currentGroup) {
          groups.set(currentGroup.name, currentGroup);
          currentGroup = null;
        }
        inGroup = false;
        continue;
      }

      // Parse service definition within a group
      if (inGroup && currentGroup) {
        // Service format: "service-name, local-port, remote-port;" or without semicolon
        // Remove trailing semicolon if present
        const serviceLine = line.replace(/;$/, '').trim();

        const parts = serviceLine.split(',').map(p => p.trim());

        if (parts.length === 3) {
          const [name, localPort, remotePort] = parts;

          const service: Service = {
            name,
            localPort: parseInt(localPort, 10),
            remotePort: parseInt(remotePort, 10)
          };

          currentGroup.services.push(service);
        }
      }
    }

    return { groups };
  }

  /**
   * Finds a group by name
   * @param config - The parsed configuration
   * @param groupName - The name of the group to find
   * @returns The group if found, undefined otherwise
   */
  static findGroup(config: Config, groupName: string): Group | undefined {
    return config.groups.get(groupName);
  }

  /**
   * Finds services in a group that match a prefix
   * @param group - The group to search
   * @param servicePrefix - The prefix to match
   * @returns Array of matching services
   */
  static findServicesWithPrefix(group: Group, servicePrefix?: string): Service[] {
    if (!servicePrefix) {
      return group.services;
    }
    return group.services.filter(s => s.name.startsWith(servicePrefix));
  }
}
