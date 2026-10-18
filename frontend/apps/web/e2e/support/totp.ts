import { createHmac } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

/** RFC 6238 authenticator, same algorithm as e2e/admin-console.check.mjs. */
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function decodeBase32(text: string): Buffer {
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of text.replace(/\s/g, "").toUpperCase()) {
    value = (value << 5) | ALPHABET.indexOf(char);
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

export function totp(secret: Buffer, step: number): string {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(step));
  const h = createHmac("sha1", secret).update(message).digest();
  const o = h[h.length - 1]! & 15;
  const n =
    ((h[o]! & 127) << 24) | (h[o + 1]! << 16) | (h[o + 2]! << 8) | h[o + 3]!;
  return String(n % 1_000_000).padStart(6, "0");
}

const stepNow = () => Math.floor(Date.now() / 30_000);

/**
 * The enrolled secret and the last step used, persisted next to the saved
 * session: the API never accepts a code twice, even across spec files.
 */
export const AUTHENTICATOR_FILE = "e2e/.auth/admin-totp.json";

interface AuthenticatorState {
  secret: string;
  usedStep: number;
}

export function saveAuthenticator(secret: string, usedStep: number): void {
  mkdirSync(dirname(AUTHENTICATOR_FILE), { recursive: true });
  const state: AuthenticatorState = { secret, usedStep };
  writeFileSync(AUTHENTICATOR_FILE, JSON.stringify(state));
}

/** Waits for a 30-second step that has not been used yet, then returns its code. */
export async function freshCode(): Promise<string> {
  const state = JSON.parse(
    readFileSync(AUTHENTICATOR_FILE, "utf8"),
  ) as AuthenticatorState;
  while (stepNow() <= state.usedStep) {
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  const step = stepNow();
  saveAuthenticator(state.secret, step);
  return totp(decodeBase32(state.secret), step);
}

export function currentStep(): number {
  return stepNow();
}
