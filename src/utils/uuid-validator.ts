/**
 * UUID validation utility to prevent database crashes
 * from invalid UUID inputs (e.g., "all", "undefined", malformed strings)
 */

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUUID(value: string | undefined | null): boolean {
  if (!value) return false;
  return UUID_REGEX.test(value);
}

export function validateUUID(value: string | undefined | null, fieldName: string = 'ID'): void {
  if (!isValidUUID(value)) {
    throw new Error(`Invalid ${fieldName} format: must be a valid UUID`);
  }
}
