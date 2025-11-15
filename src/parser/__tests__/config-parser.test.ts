import { describe, it, expect } from '@jest/globals';
import { ConfigParser } from '../config-parser';
import { 
  ConfigParseError, 
  GroupNotFoundError, 
  ServiceNotFoundError 
} from '../../errors';

describe('ConfigParser', () => {
  describe('parse', () => {
    it('should parse valid config with single group', () => {
      const configContent = `
example-group: {
    example-service,8080,80
}
`;
      const result = ConfigParser.parse(configContent);
      
      expect(result.groups.size).toBe(1);
      const group = result.groups.get('example-group');
      expect(group).toBeDefined();
      expect(group?.name).toBe('example-group');
      expect(group?.services).toHaveLength(1);
      expect(group?.services[0]).toEqual({
        name: 'example-service',
        localPort: 8080,
        remotePort: 80
      });
    });

    it('should parse config with context', () => {
      const configContent = `
production: {
    context: prod-cluster
    api-service,8081,80
    web-service,8082,80
}
`;
      const result = ConfigParser.parse(configContent);
      
      expect(result.groups.size).toBe(1);
      const group = result.groups.get('production');
      expect(group?.context).toBe('prod-cluster');
      expect(group?.services).toHaveLength(2);
    });

    it('should parse config with multiple groups', () => {
      const configContent = `
dev: {
    api-service,8080,80
}

prod: {
    context: production
    api-service,8081,80
    web-service,8082,80
}
`;
      const result = ConfigParser.parse(configContent);
      
      expect(result.groups.size).toBe(2);
      expect(result.groups.has('dev')).toBe(true);
      expect(result.groups.has('prod')).toBe(true);
    });

    it('should handle semicolons in service definitions', () => {
      const configContent = `
example: {
    service1,8080,80;
    service2,8081,80
}
`;
      const result = ConfigParser.parse(configContent);
      
      const group = result.groups.get('example');
      expect(group?.services).toHaveLength(2);
    });

    it('should skip comments and empty lines', () => {
      const configContent = `
# This is a comment
example: {
    # Another comment
    service,8080,80
    
    # Empty line above
}
`;
      const result = ConfigParser.parse(configContent);
      
      const group = result.groups.get('example');
      expect(group?.services).toHaveLength(1);
    });

    it('should throw error for invalid group name', () => {
      const configContent = `
invalid@group: {
    service,8080,80
}
`;
      expect(() => ConfigParser.parse(configContent))
        .toThrow(ConfigParseError);
    });

    it('should throw error for invalid service name', () => {
      const configContent = `
example: {
    invalid-service-name,8080,80
}
`;
      expect(() => ConfigParser.parse(configContent))
        .toThrow(ConfigParseError);
    });

    it('should throw error for invalid port numbers', () => {
      const configContent = `
example: {
    service,invalid,80
}
`;
      expect(() => ConfigParser.parse(configContent))
        .toThrow(ConfigParseError);
    });

    it('should throw error for out of range ports', () => {
      const configContent = `
example: {
    service,0,80
}
`;
      expect(() => ConfigParser.parse(configContent))
        .toThrow(ConfigParseError);
    });

    it('should throw error for empty group', () => {
      const configContent = `
empty: {
}
`;
      expect(() => ConfigParser.parse(configContent))
        .toThrow(ConfigParseError);
    });

    it('should throw error for duplicate service names', () => {
      const configContent = `
example: {
    service,8080,80
    service,8081,81
}
`;
      expect(() => ConfigParser.parse(configContent))
        .toThrow(ConfigParseError);
    });

    it('should throw error for no groups found', () => {
      const configContent = `
# Just comments
# No groups
`;
      expect(() => ConfigParser.parse(configContent))
        .toThrow(ConfigParseError);
    });

    it('should include filename and line number in errors', () => {
      const configContent = `
example: {
    invalid-service-name,8080,80
}
`;
      try {
        ConfigParser.parse(configContent, 'test.config');
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigParseError);
        expect((error as ConfigParseError).file).toBe('test.config');
        expect((error as ConfigParseError).line).toBe(3);
      }
    });
  });

  describe('findGroup', () => {
    it('should return group when found', () => {
      const configContent = `
example: {
    service,8080,80
}
`;
      const config = ConfigParser.parse(configContent);
      const group = ConfigParser.findGroup(config, 'example');
      
      expect(group.name).toBe('example');
    });

    it('should throw GroupNotFoundError when group not found', () => {
      const configContent = `
example: {
    service,8080,80
}
`;
      const config = ConfigParser.parse(configContent);
      
      expect(() => ConfigParser.findGroup(config, 'nonexistent'))
        .toThrow(GroupNotFoundError);
    });
  });

  describe('findServicesWithPrefix', () => {
    const createTestConfig = () => {
      const configContent = `
example: {
    api-service,8080,80
    web-service,8081,80
    db-service,5432,5432
}
`;
      return ConfigParser.parse(configContent);
    };

    it('should return all services when no prefix provided', () => {
      const config = createTestConfig();
      const group = config.groups.get('example')!;
      const services = ConfigParser.findServicesWithPrefix(group);
      
      expect(services).toHaveLength(3);
    });

    it('should return filtered services when prefix provided', () => {
      const config = createTestConfig();
      const group = config.groups.get('example')!;
      const services = ConfigParser.findServicesWithPrefix(group, 'api');
      
      expect(services).toHaveLength(1);
      expect(services[0].name).toBe('api-service');
    });

    it('should throw ServiceNotFoundError when no services match prefix', () => {
      const config = createTestConfig();
      const group = config.groups.get('example')!;
      
      expect(() => ConfigParser.findServicesWithPrefix(group, 'nonexistent'))
        .toThrow(ServiceNotFoundError);
    });

    it('should throw ServiceNotFoundError when group has no services', () => {
      const configContent = `
empty: {
    context: test
}
`;
      const config = ConfigParser.parse(configContent);
      const group = config.groups.get('empty')!;
      
      expect(() => ConfigParser.findServicesWithPrefix(group))
        .toThrow(ServiceNotFoundError);
    });
  });
});