import { randomInt } from 'node:crypto';

export const FamilyRole = {
  OWNER: 'OWNER',
  MEMBER: 'MEMBER',
} as const;
export type FamilyRole = (typeof FamilyRole)[keyof typeof FamilyRole];

export const JoinRequestStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
  EXPIRED: 'EXPIRED',
} as const;
export type JoinRequestStatus =
  (typeof JoinRequestStatus)[keyof typeof JoinRequestStatus];

export const FamilyPolicy = {
  /** Counts the owner. */
  MAX_MEMBERS: 10,
  INVITE_CODE_TTL_MS: 7 * 24 * 60 * 60 * 1000,
  JOIN_REQUEST_TTL_MS: 7 * 24 * 60 * 60 * 1000,
  NAME_MAX_LENGTH: 80,
} as const;

/**
 * What a member chose to share with their family, beyond name and photo
 * (always visible). Off by default; each flag is the member's own consent.
 */
export interface FamilySharing {
  phone: boolean;
  incidents: boolean;
  health: boolean;
}

export const NO_SHARING: FamilySharing = {
  phone: false,
  incidents: false,
  health: false,
};

// Read aloud and typed by hand: no 0/O, 1/I/L.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 8;

/** ~40 bits; a code alone only lets someone ASK to join. */
export function generateInviteCode(): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return code;
}

/** Stored form: uppercase, no dash or spaces. */
export function normalizeInviteCode(input: string): string {
  return input.toUpperCase().replace(/[\s-]/g, '');
}

/** Display form: K7M4-QX9P. */
export function formatInviteCode(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

export function isWellFormedInviteCode(normalized: string): boolean {
  return new RegExp(`^[${CODE_ALPHABET}]{${CODE_LENGTH}}$`).test(normalized);
}
