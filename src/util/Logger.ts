/** Centralized logging so verbosity/formatting can be controlled in one place. */
export function log(message: string): void {
  console.warn(`[Phlodgate] ${message}`);
}
