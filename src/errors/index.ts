/**
 * Custom error classes for kxpf
 */

/**
 * Base error class for kxpf-specific errors
 */
export abstract class KxpfError extends Error {
  abstract readonly exitCode: number;
  abstract readonly code: string;

  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = this.constructor.name;
    
    // Ensure the error is properly captured in the stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Error thrown when kubectl is not found or unavailable
 */
export class KubectlNotFoundError extends KxpfError {
  readonly exitCode = 127;
  readonly code = 'KUBECTL_NOT_FOUND';

  constructor(cause?: Error) {
    super('kubectl not found. Please ensure kubectl is installed and in your PATH.', cause);
  }
}

/**
 * Error thrown when a configuration group is not found
 */
export class GroupNotFoundError extends KxpfError {
  readonly exitCode = 1;
  readonly code = 'GROUP_NOT_FOUND';

  constructor(groupName: string) {
    super(`Group "${groupName}" not found in config`);
  }
}

/**
 * Error thrown when a service is not found
 */
export class ServiceNotFoundError extends KxpfError {
  readonly exitCode = 1;
  readonly code = 'SERVICE_NOT_FOUND';

  constructor(serviceName: string, groupName?: string) {
    const context = groupName ? ` in group "${groupName}"` : '';
    super(`Service "${serviceName}" not found${context}`);
  }
}

/**
 * Error thrown when configuration parsing fails
 */
export class ConfigParseError extends KxpfError {
  readonly exitCode = 1;
  readonly code = 'CONFIG_PARSE_ERROR';

  constructor(message: string, public readonly file?: string, public readonly line?: number) {
    super(`Configuration parsing failed${file ? ` in ${file}` : ''}${line ? ` at line ${line}` : ''}: ${message}`);
  }
}

/**
 * Error thrown when a port-forward operation fails
 */
export class PortForwardError extends KxpfError {
  readonly exitCode = 1;
  readonly code = 'PORT_FORWARD_ERROR';

  constructor(serviceName: string, message: string, cause?: Error) {
    super(`Failed to start port-forward for ${serviceName}: ${message}`, cause);
  }
}

/**
 * Error thrown when a process operation fails
 */
export class ProcessError extends KxpfError {
  readonly exitCode = 1;
  readonly code = 'PROCESS_ERROR';

  constructor(operation: string, pid?: number, cause?: Error) {
    const pidStr = pid ? ` (PID: ${pid})` : '';
    super(`Failed to ${operation}${pidStr}`, cause);
  }
}

/**
 * Error thrown when input validation fails
 */
export class ValidationError extends KxpfError {
  readonly exitCode = 1;
  readonly code = 'VALIDATION_ERROR';

  constructor(field: string, message: string) {
    super(`Validation failed for ${field}: ${message}`);
  }
}