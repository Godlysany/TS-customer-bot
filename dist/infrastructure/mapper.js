"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toSnakeCase = toSnakeCase;
exports.toCamelCase = toCamelCase;
exports.toSnakeCaseArray = toSnakeCaseArray;
exports.toCamelCaseArray = toCamelCaseArray;
function isDateTimeField(key) {
    const lowerKey = key.toLowerCase();
    return (lowerKey.endsWith('_at') ||
        lowerKey.endsWith('_time') ||
        lowerKey.includes('timestamp') ||
        lowerKey.includes('_at_') ||
        lowerKey.includes('_time_') ||
        lowerKey === 'timestamp');
}
function toSnakeCase(obj) {
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
        const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
        result[snakeKey] = value;
    }
    return result;
}
function toCamelCase(obj) {
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
        const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
        if (isDateTimeField(key) && typeof value === 'string') {
            result[camelKey] = new Date(value);
        }
        else {
            result[camelKey] = value;
        }
    }
    return result;
}
function toSnakeCaseArray(arr) {
    return arr.map(toSnakeCase);
}
function toCamelCaseArray(arr) {
    return arr.map(toCamelCase);
}
