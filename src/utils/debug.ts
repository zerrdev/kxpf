let debugEnabled = false;

/**
 * Sets the debug mode
 */
export function setDebug(value: boolean): void {
  debugEnabled = value;
}

/**
 * Gets the current debug mode
 */
export function isDebugEnabled(): boolean {
  return debugEnabled;
}

/**
 * Logs a debug message if debug mode is enabled
 */
export function debugLog(message: string): void {
  if (debugEnabled) {
    console.log(`[DEBUG] ${message}`);
  }
}

/**
 * Logs an object in debug mode if debug mode is enabled
 */
export function debugLogObject(obj: any, label?: string): void {
  if (debugEnabled) {
    const labelStr = label ? `[${label}] ` : '';
    console.log(`[DEBUG] ${labelStr}${JSON.stringify(obj, null, 2)}`);
  }
}