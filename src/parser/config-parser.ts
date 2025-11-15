import { ConfigParseError, GroupNotFoundError, ServiceNotFoundError } from '../errors';
import { validateServiceName, validateGroupName, validateContextName, validatePort } from '../utils/error-handler';

export interface Service {
  name: string;
  localPort: number;
  remotePort: number;
}

export interface Group {
  name: string;
  context?: string;
  services: Service[];
}

export interface Config {
  groups: Map<string, Group>;
}

export class ConfigParser {
  /**
   * Parses the kxpf config file format with comprehensive validation
   * @param content - The raw config file content
   * @param filename - Optional filename for better error reporting
   * @returns Parsed configuration object
   * @throws ConfigParseError if parsing fails
   */
  static parse(content: string, filename?: string): Config {
    const groups = new Map<string, Group>();
    const lines = content.split('\n');
    let currentGroup: Group | null = null;
    let inGroup = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]?.trim();
      if (!line) {
        continue;
      }
      
      const lineNumber = i + 1;

      try {
        // Skip empty lines
        if (line === '') {
          continue;
        }

        // Skip comments
        if (line.startsWith('#')) {
          continue;
        }

        // Check for group declaration (e.g., "group1: {" or "group1:{")
        const groupMatch = line.match(/^([a-zA-Z0-9-_]+)\s*:\s*\{/);
        if (groupMatch) {
          if (inGroup) {
            throw new ConfigParseError('Nested groups are not supported', filename, lineNumber);
          }

          const groupName = groupMatch[1];
          if (!groupName) {
            throw new ConfigParseError('Invalid group name format', filename, lineNumber);
          }
          
          try {
            validateGroupName(groupName);
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown validation error';
            throw new ConfigParseError(`Invalid group name "${groupName}": ${errorMessage}`, filename, lineNumber);
          }

          currentGroup = {
            name: groupName,
            services: []
          };
          inGroup = true;
          continue;
        }

        // Check for group end
        if (line === '}') {
          if (!inGroup) {
            throw new ConfigParseError('Unexpected group end "}"', filename, lineNumber);
          }
          if (currentGroup) {
            if (currentGroup.services.length === 0) {
              throw new ConfigParseError(`Group "${currentGroup.name}" is empty`, filename, lineNumber);
            }
            groups.set(currentGroup.name, currentGroup);
            currentGroup = null;
          }
          inGroup = false;
          continue;
        }

        // Parse content within a group
        if (inGroup && currentGroup) {
          // Check for context declaration (e.g., "context: minikube")
          const contextMatch = line.match(/^context\s*:\s*(.+)$/);
          if (contextMatch) {
            const context = contextMatch[1]?.trim();
            if (!context) {
              throw new ConfigParseError('Invalid context format', filename, lineNumber);
            }
            
            try {
              validateContextName(context);
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : 'Unknown validation error';
              throw new ConfigParseError(`Invalid context "${context}": ${errorMessage}`, filename, lineNumber);
            }
            currentGroup.context = context;
            continue;
          }

          // Service format: "service-name, local-port, remote-port;" or without semicolon
          // Remove trailing semicolon if present
          const serviceLine = line.replace(/;$/, '').trim();

          const parts = serviceLine.split(',').map(p => p.trim());

          if (parts.length === 3) {
            const [name, localPortStr, remotePortStr] = parts;

            if (!name || !localPortStr || !remotePortStr) {
              throw new ConfigParseError(
                'Service definition must have exactly 3 parts: name, local-port, remote-port',
                filename,
                lineNumber
              );
            }

            try {
              validateServiceName(name);
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : 'Unknown validation error';
              throw new ConfigParseError(`Invalid service name "${name}": ${errorMessage}`, filename, lineNumber);
            }

            const localPort = parseInt(localPortStr, 10);
            const remotePort = parseInt(remotePortStr, 10);

            if (isNaN(localPort) || isNaN(remotePort)) {
              throw new ConfigParseError(
                `Invalid port numbers: "${localPortStr}", "${remotePortStr}". Must be integers.`,
                filename,
                lineNumber
              );
            }

            try {
              validatePort(localPort);
              validatePort(remotePort);
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : 'Unknown validation error';
              throw new ConfigParseError(`Invalid port: ${errorMessage}`, filename, lineNumber);
            }

            // Check for duplicate service names within the group
            if (currentGroup.services.some(s => s.name === name)) {
              throw new ConfigParseError(`Duplicate service name "${name}" in group "${currentGroup.name}"`, filename, lineNumber);
            }

            const service: Service = {
              name: name,
              localPort,
              remotePort
            };

            currentGroup.services.push(service);
          } else {
            throw new ConfigParseError(
              `Invalid service format. Expected "service-name,local-port,remote-port", got: "${line}"`,
              filename,
              lineNumber
            );
          }
        } else {
          throw new ConfigParseError(`Unexpected content outside group: "${line}"`, filename, lineNumber);
        }
      } catch (error) {
        if (error instanceof ConfigParseError) {
          throw error;
        }
        throw new ConfigParseError(error instanceof Error ? error.message : 'Unknown parsing error', filename, i + 1);
      }
    }

    if (!inGroup && currentGroup) {
      throw new ConfigParseError('Config file ends without closing group', filename);
    }

    if (groups.size === 0) {
      throw new ConfigParseError('No groups found in configuration', filename);
    }

    return { groups };
  }

  /**
   * Finds a group by name
   * @param config - The parsed configuration
   * @param groupName - The name of the group to find
   * @returns The group if found
   * @throws GroupNotFoundError if the group is not found
   */
  static findGroup(config: Config, groupName: string): Group {
    const group = config.groups.get(groupName);
    if (!group) {
      throw new GroupNotFoundError(groupName);
    }
    return group;
  }

  /**
   * Finds services in a group that match a prefix
   * @param group - The group to search
   * @param servicePrefix - The prefix to match (optional, if not provided returns all services)
   * @returns Array of matching services
   * @throws ServiceNotFoundError if no services match the prefix
   */
  static findServicesWithPrefix(group: Group, servicePrefix?: string): Service[] {
    if (!servicePrefix) {
      if (group.services.length === 0) {
        throw new ServiceNotFoundError('No services found in group', group.name);
      }
      return group.services;
    }

    const matchingServices = group.services.filter(s => s.name.startsWith(servicePrefix));
    
    if (matchingServices.length === 0) {
      throw new ServiceNotFoundError(servicePrefix, group.name);
    }

    return matchingServices;
  }
}
