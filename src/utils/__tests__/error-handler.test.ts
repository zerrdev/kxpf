import { describe, it, expect } from '@jest/globals';
import { 
  ensure, 
  validatePort, 
  validateServiceName, 
  validateGroupName, 
  validateContextName 
} from '../error-handler';

describe('error-handler utilities', () => {
  describe('ensure', () => {
    it('should return the value when it is not null or undefined', () => {
      expect(ensure('test', 'error')).toBe('test');
      expect(ensure(42, 'error')).toBe(42);
      expect(ensure(true, 'error')).toBe(true);
    });

    it('should throw an error when value is null', () => {
      expect(() => ensure(null, 'test error')).toThrow('test error');
    });

    it('should throw an error when value is undefined', () => {
      expect(() => ensure(undefined, 'test error')).toThrow('test error');
    });
  });

  describe('validatePort', () => {
    it('should accept valid port numbers', () => {
      expect(() => validatePort(80)).not.toThrow();
      expect(() => validatePort(443)).not.toThrow();
      expect(() => validatePort(8080)).not.toThrow();
      expect(() => validatePort(65535)).not.toThrow();
      expect(() => validatePort(1)).not.toThrow();
    });

    it('should reject invalid port numbers', () => {
      expect(() => validatePort(0)).toThrow('Invalid port number: 0');
      expect(() => validatePort(65536)).toThrow('Invalid port number: 65536');
      expect(() => validatePort(-1)).toThrow('Invalid port number: -1');
      expect(() => validatePort(3.14)).toThrow('Invalid port number: 3.14');
      expect(() => validatePort(NaN)).toThrow('Invalid port number: NaN');
      expect(() => validatePort(Infinity)).toThrow('Invalid port number: Infinity');
    });
  });

  describe('validateServiceName', () => {
    it('should accept valid service names', () => {
      expect(() => validateServiceName('my-service')).not.toThrow();
      expect(() => validateServiceName('service-name-123')).not.toThrow();
      expect(() => validateServiceName('my.service')).not.toThrow();
      expect(() => validateServiceName('api-v1')).not.toThrow();
    });

    it('should reject invalid service names', () => {
      expect(() => validateServiceName('')).toThrow('Service name cannot be empty');
      expect(() => validateServiceName(' ')).toThrow('Service name cannot be empty');
      expect(() => validateServiceName('MyService')).toThrow('Invalid service name');
      expect(() => validateServiceName('service_name')).toThrow('Invalid service name');
      expect(() => validateServiceName('service@domain')).toThrow('Invalid service name');
      expect(() => validateServiceName('service with spaces')).toThrow('Invalid service name');
      
      // Test with null and undefined
      expect(() => validateServiceName(null as any)).toThrow('Service name cannot be empty');
      expect(() => validateServiceName(undefined as any)).toThrow('Service name cannot be empty');
    });
  });

  describe('validateGroupName', () => {
    it('should accept valid group names', () => {
      expect(() => validateGroupName('my-group')).not.toThrow();
      expect(() => validateGroupName('group_name')).not.toThrow();
      expect(() => validateGroupName('group-123')).not.toThrow();
      expect(() => validateGroupName('development')).not.toThrow();
      expect(() => validateGroupName('prod')).not.toThrow();
    });

    it('should reject invalid group names', () => {
      expect(() => validateGroupName('')).toThrow('Group name cannot be empty');
      expect(() => validateGroupName(' ')).toThrow('Group name cannot be empty');
      expect(() => validateGroupName('group with spaces')).toThrow('Invalid group name');
      expect(() => validateGroupName('group@special')).toThrow('Invalid group name');
      expect(() => validateGroupName('group.name')).toThrow('Invalid group name');
      
      // Test with null and undefined
      expect(() => validateGroupName(null as any)).toThrow('Group name cannot be empty');
      expect(() => validateGroupName(undefined as any)).toThrow('Group name cannot be empty');
    });
  });

  describe('validateContextName', () => {
    it('should accept valid context names', () => {
      expect(() => validateContextName('minikube')).not.toThrow();
      expect(() => validateContextName('prod-cluster')).not.toThrow();
      expect(() => validateContextName('context123')).not.toThrow();
    });

    it('should reject invalid context names', () => {
      expect(() => validateContextName('')).toThrow('Context name cannot be empty');
      expect(() => validateContextName(' ')).toThrow('Context name cannot be empty');
      expect(() => validateContextName('context with spaces')).toThrow('Invalid context name');
      expect(() => validateContextName('context\twith\ttabs')).toThrow('Invalid context name');
      expect(() => validateContextName('context\nwith\nnewlines')).toThrow('Invalid context name');
      
      // Test with null and undefined
      expect(() => validateContextName(null as any)).toThrow('Context name cannot be empty');
      expect(() => validateContextName(undefined as any)).toThrow('Context name cannot be empty');
    });
  });
});