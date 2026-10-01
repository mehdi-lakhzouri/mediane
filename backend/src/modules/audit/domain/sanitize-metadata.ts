import type { JsonObject, JsonValue } from '../../../common/domain/json';
import { isSensitiveKey } from '../../../common/security/sensitive-data';

const MAX_DEPTH = 4;
const MAX_STRING_LENGTH = 500;
const MAX_ARRAY_LENGTH = 50;

function sanitizeValue(value: unknown, depth: number): JsonValue | undefined {
  if (value === null) return null;
  if (typeof value === 'string') return value.slice(0, MAX_STRING_LENGTH);
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'boolean') return value;
  if (value instanceof Date) return value.toISOString();
  if (depth >= MAX_DEPTH) return undefined;
  if (Array.isArray(value)) {
    return value
      .slice(0, MAX_ARRAY_LENGTH)
      .map((item) => sanitizeValue(item, depth + 1))
      .filter((item): item is JsonValue => item !== undefined);
  }
  if (typeof value === 'object') {
    return sanitizeObject(value as Record<string, unknown>, depth + 1);
  }
  return undefined; // functions, symbols, bigint...
}

function sanitizeObject(
  input: Record<string, unknown>,
  depth: number,
): JsonObject {
  const output: JsonObject = {};
  for (const [key, value] of Object.entries(input)) {
    if (isSensitiveKey(key)) continue;
    const sanitized = sanitizeValue(value, depth);
    if (sanitized !== undefined) output[key] = sanitized;
  }
  return output;
}

/**
 * Last line of defense: callers must not pass secrets, but if they do, keys that
 * look like passwords/tokens/secrets are dropped (not masked) before persistence.
 */
export function sanitizeAuditMetadata(
  metadata: Record<string, unknown> | undefined,
): JsonObject | null {
  if (!metadata) return null;
  const sanitized = sanitizeObject(metadata, 0);
  return Object.keys(sanitized).length ? sanitized : null;
}
