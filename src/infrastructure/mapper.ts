function isDateTimeField(key: string): boolean {
  const lowerKey = key.toLowerCase();
  return (
    lowerKey.endsWith('_at') ||
    lowerKey.endsWith('_time') ||
    lowerKey.includes('timestamp') ||
    lowerKey.includes('_at_') ||
    lowerKey.includes('_time_') ||
    lowerKey === 'timestamp'
  );
}

export function toSnakeCase(obj: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    result[snakeKey] = value;
  }
  return result;
}

export function toCamelCase(obj: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    
    if (isDateTimeField(key) && typeof value === 'string') {
      result[camelKey] = new Date(value);
    } else {
      result[camelKey] = value;
    }
  }
  return result;
}

export function toSnakeCaseArray(arr: Record<string, any>[]): Record<string, any>[] {
  return arr.map(toSnakeCase);
}

export function toCamelCaseArray(arr: Record<string, any>[]): Record<string, any>[] {
  return arr.map(toCamelCase);
}
