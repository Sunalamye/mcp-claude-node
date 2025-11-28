/**
 * Log to stderr with timestamp (HH:mm:ss.fff format)
 */
export function log(message: string): void {
  const now = new Date();
  const timestamp =
    now.toTimeString().split(' ')[0] + '.' + String(now.getMilliseconds()).padStart(3, '0');
  process.stderr.write(`[${timestamp}] ${message}\n`);
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
