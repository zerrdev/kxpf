import { ConfigParser, Config, Group, Service } from '../config-parser';

describe('ConfigParser', () => {
  describe('parse', () => {
    it('should parse a simple single group configuration', () => {
      const content = `
test-group: {
    service1,8080,80
}
`;
      const config = ConfigParser.parse(content);

      expect(config.groups.size).toBe(1);
      expect(config.groups.has('test-group')).toBe(true);

      const group = config.groups.get('test-group');
      expect(group).toBeDefined();
      expect(group?.name).toBe('test-group');
      expect(group?.services).toHaveLength(1);
      expect(group?.services[0]).toEqual({
        name: 'service1',
        localPort: 8080,
        remotePort: 80
      });
    });

    it('should parse multiple services in a group', () => {
      const content = `
production: {
    api-service,8081,80
    web-service,8082,80
    db-service,5432,5432
}
`;
      const config = ConfigParser.parse(content);

      const group = config.groups.get('production');
      expect(group?.services).toHaveLength(3);
      expect(group?.services[0]).toEqual({
        name: 'api-service',
        localPort: 8081,
        remotePort: 80
      });
      expect(group?.services[1]).toEqual({
        name: 'web-service',
        localPort: 8082,
        remotePort: 80
      });
      expect(group?.services[2]).toEqual({
        name: 'db-service',
        localPort: 5432,
        remotePort: 5432
      });
    });

    it('should parse multiple groups', () => {
      const content = `
dev-group: {
    service1,8080,80
}

prod-group: {
    service2,8081,80
}
`;
      const config = ConfigParser.parse(content);

      expect(config.groups.size).toBe(2);
      expect(config.groups.has('dev-group')).toBe(true);
      expect(config.groups.has('prod-group')).toBe(true);
    });

    it('should parse group with context', () => {
      const content = `
production: {
    context: prod-cluster
    api-service,8081,80
}
`;
      const config = ConfigParser.parse(content);

      const group = config.groups.get('production');
      expect(group?.context).toBe('prod-cluster');
      expect(group?.services).toHaveLength(1);
    });

    it('should skip comment lines starting with #', () => {
      const content = `
# This is a comment
test-group: {
    # Another comment
    service1,8080,80
    # Yet another comment
}
`;
      const config = ConfigParser.parse(content);

      const group = config.groups.get('test-group');
      expect(group?.services).toHaveLength(1);
    });

    it('should skip empty lines', () => {
      const content = `

test-group: {

    service1,8080,80

}

`;
      const config = ConfigParser.parse(content);

      const group = config.groups.get('test-group');
      expect(group?.services).toHaveLength(1);
    });

    it('should handle services with semicolon terminator', () => {
      const content = `
test-group: {
    service1,8080,80;
    service2,8081,80;
}
`;
      const config = ConfigParser.parse(content);

      const group = config.groups.get('test-group');
      expect(group?.services).toHaveLength(2);
    });

    it('should handle group names with hyphens and numbers', () => {
      const content = `
my-group-123: {
    service1,8080,80
}
`;
      const config = ConfigParser.parse(content);

      expect(config.groups.has('my-group-123')).toBe(true);
    });

    it('should handle service names with hyphens and numbers', () => {
      const content = `
test-group: {
    my-service-v2,8080,80
}
`;
      const config = ConfigParser.parse(content);

      const group = config.groups.get('test-group');
      expect(group?.services[0].name).toBe('my-service-v2');
    });

    it('should handle group declaration without spaces around colon and brace', () => {
      const content = `
test-group:{
    service1,8080,80
}
`;
      const config = ConfigParser.parse(content);

      expect(config.groups.has('test-group')).toBe(true);
    });

    it('should handle group declaration with spaces around colon and brace', () => {
      const content = `
test-group : {
    service1,8080,80
}
`;
      const config = ConfigParser.parse(content);

      expect(config.groups.has('test-group')).toBe(true);
    });

    it('should ignore malformed service lines', () => {
      const content = `
test-group: {
    service1,8080,80
    invalid-line
    service2,8081,80
}
`;
      const config = ConfigParser.parse(content);

      const group = config.groups.get('test-group');
      // Should only parse the two valid service lines
      expect(group?.services).toHaveLength(2);
    });

    it('should handle empty groups', () => {
      const content = `
empty-group: {
}
`;
      const config = ConfigParser.parse(content);

      const group = config.groups.get('empty-group');
      expect(group).toBeDefined();
      expect(group?.services).toHaveLength(0);
    });

    it('should parse complex real-world config', () => {
      const content = `
# Development environment
dev: {
    context: minikube
    api-service,8080,80
    frontend-service,3000,3000
}

# Production environment
prod: {
    context: prod-cluster
    api-service,8081,80
    frontend-service,8082,3000
    db-service,5432,5432
}

# Testing
test: {
    mock-api,9000,80
}
`;
      const config = ConfigParser.parse(content);

      expect(config.groups.size).toBe(3);

      const dev = config.groups.get('dev');
      expect(dev?.context).toBe('minikube');
      expect(dev?.services).toHaveLength(2);

      const prod = config.groups.get('prod');
      expect(prod?.context).toBe('prod-cluster');
      expect(prod?.services).toHaveLength(3);

      const test = config.groups.get('test');
      expect(test?.context).toBeUndefined();
      expect(test?.services).toHaveLength(1);
    });
  });

  describe('findGroup', () => {
    it('should find existing group', () => {
      const content = `
test-group: {
    service1,8080,80
}
`;
      const config = ConfigParser.parse(content);
      const group = ConfigParser.findGroup(config, 'test-group');

      expect(group).toBeDefined();
      expect(group?.name).toBe('test-group');
    });

    it('should return undefined for non-existing group', () => {
      const content = `
test-group: {
    service1,8080,80
}
`;
      const config = ConfigParser.parse(content);
      const group = ConfigParser.findGroup(config, 'non-existing');

      expect(group).toBeUndefined();
    });
  });

  describe('findServicesWithPrefix', () => {
    let group: Group;

    beforeEach(() => {
      group = {
        name: 'test-group',
        services: [
          { name: 'api-service', localPort: 8080, remotePort: 80 },
          { name: 'api-gateway', localPort: 8081, remotePort: 80 },
          { name: 'web-service', localPort: 8082, remotePort: 80 },
          { name: 'worker-service', localPort: 8083, remotePort: 80 }
        ]
      };
    });

    it('should return all services when no prefix is provided', () => {
      const services = ConfigParser.findServicesWithPrefix(group);

      expect(services).toHaveLength(4);
    });

    it('should return services matching the prefix', () => {
      const services = ConfigParser.findServicesWithPrefix(group, 'api');

      expect(services).toHaveLength(2);
      expect(services[0].name).toBe('api-service');
      expect(services[1].name).toBe('api-gateway');
    });

    it('should return empty array when no services match prefix', () => {
      const services = ConfigParser.findServicesWithPrefix(group, 'database');

      expect(services).toHaveLength(0);
    });

    it('should return single service for exact prefix match', () => {
      const services = ConfigParser.findServicesWithPrefix(group, 'web-service');

      expect(services).toHaveLength(1);
      expect(services[0].name).toBe('web-service');
    });

    it('should be case-sensitive', () => {
      const services = ConfigParser.findServicesWithPrefix(group, 'API');

      expect(services).toHaveLength(0);
    });

    it('should handle partial prefix matches', () => {
      const services = ConfigParser.findServicesWithPrefix(group, 'w');

      expect(services).toHaveLength(2);
      expect(services[0].name).toBe('web-service');
      expect(services[1].name).toBe('worker-service');
    });
  });
});
