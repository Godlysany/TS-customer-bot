"use strict";
/**
 * UUID validation utility to prevent database crashes
 * from invalid UUID inputs (e.g., "all", "undefined", malformed strings)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isValidUUID = isValidUUID;
exports.validateUUID = validateUUID;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidUUID(value) {
    if (!value)
        return false;
    return UUID_REGEX.test(value);
}
function validateUUID(value, fieldName = 'ID') {
    if (!isValidUUID(value)) {
        throw new Error(`Invalid ${fieldName} format: must be a valid UUID`);
    }
}
