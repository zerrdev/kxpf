import { KxpfError } from '../errors';

/**
 * Handles errors consistently across the application
 */
export function handleError(error: unknown): never {
  // Skip common Commander.js events
  if (error === '(outputHelp)' || error === '(version)') {
    process.exit(0);
  }
  
  if (typeof error === 'string' && (error.includes('1.1.3') || error.includes('version'))) {
    process.exit(0);
  }
  
  if (error instanceof KxpfError) {
    console.error(`Error (${error.code}): ${error.message}`);
    if (error._cause) {
      console.error(`Caused by: ${error._cause.message}`);
    }
    process.exit(error.exitCode);
  } else if (error instanceof Error) {
    console.error(`Unexpected error: ${error.message}`);
    process.exit(1);
  } else {
    console.error('Unknown error occurred');
    process.exit(1);
  }
}

/**
 * Validates that a value is not null or undefined
 */
export function ensure<T>(value: T | null | undefined, message: string): T {
  if (value === null || value === undefined) {
    throw new Error(message);
  }
  return value;
}

/**
 * Validates port number
 */
export function validatePort(port: number): void {
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid port number: ${port}. Must be an integer between 1 and 65535.`);
  }
}

/**
 * Validates service name format
 */
export function validateServiceName(name: string): void {
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    throw new Error('Service name cannot be empty');
  }
  
  // Kubernetes service name validation (RFC 1123 DNS labels)
  const validNameRegex = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*$/;
  if (!validNameRegex.test(name)) {
    throw new Error(`Invalid service name: "${name}". Service names must follow RFC 1123 DNS label format.`);
  }
}

/**
 * Validates group name format
 */
export function validateGroupName(name: string): void {
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    throw new Error('Group name cannot be empty');
  }
  
  // Allow alphanumeric, hyphens, and underscores for group names
  const validNameRegex = /^[a-zA-Z0-9-_]+$/;
  if (!validNameRegex.test(name)) {
    throw new Error(`Invalid group name: "${name}". Group names can only contain letters, numbers, hyphens, and underscores.`);
  }
}

/**
 * Validates context name format
 */
export function validateContextName(name: string): void {
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    throw new Error('Context name cannot be empty');
  }
  
  // Kubernetes context name validation
  if (name.includes(' ') || name.includes('\t') || name.includes('\n')) {
    throw new Error(`Invalid context name: "${name}". Context names cannot contain whitespace.`);
  }
}