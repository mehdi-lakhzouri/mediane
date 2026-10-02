import { randomInt } from 'node:crypto';

export const RECOVERY_CODE_COUNT = 10;
/** Below this many unused codes, clients should suggest regenerating. */
export const RECOVERY_CODES_LOW_WATERMARK = 3;

// No 0/O, 1/I/L: codes are read from paper and typed by hand.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const GROUP = 5;

/** 10 characters from a 31-symbol alphabet: ~49 bits each, shown as XXXXX-XXXXX. */
export function generateRecoveryCodes(
  count: number = RECOVERY_CODE_COUNT,
): string[] {
  return Array.from({ length: count }, () => {
    let raw = '';
    for (let i = 0; i < GROUP * 2; i++)
      raw += ALPHABET[randomInt(ALPHABET.length)];
    return `${raw.slice(0, GROUP)}-${raw.slice(GROUP)}`;
  });
}

/** Tolerates lowercase, spaces and missing/extra dashes. */
export function normalizeRecoveryCode(input: string): string {
  return input.toUpperCase().replace(/[\s-]/g, '');
}

export function looksLikeRecoveryCode(input: string): boolean {
  return /^[A-Z0-9]{10}$/.test(normalizeRecoveryCode(input));
}
