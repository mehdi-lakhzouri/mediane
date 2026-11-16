import { randomBytes } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';
import {
  DeviceHeaders,
  signRequest,
} from '../../src/modules/devices/domain/device-signature';

export interface TestUnit {
  serialNumber: string;
  /** base64url, as returned once by the admin API. */
  secret: string;
}

export interface SignOptions {
  method?: 'GET' | 'POST';
  nonce?: string;
  /** Unix seconds. */
  timestamp?: number;
  /** Signs this body but sends `sentBody` (tamper tests). */
  sentBody?: string;
  /** Signs with this secret instead of the unit's. */
  secret?: string;
}

/** Sends a request exactly as an in-cabin unit would: signed raw JSON. */
export function deviceRequest(
  server: App,
  unit: TestUnit,
  path: string,
  payload?: unknown,
  options: SignOptions = {},
): request.Test {
  const body = payload === undefined ? '' : JSON.stringify(payload);
  const timestamp = String(options.timestamp ?? Math.floor(Date.now() / 1000));
  const nonce = options.nonce ?? randomBytes(16).toString('base64url');
  const signature = signRequest(
    Buffer.from(options.secret ?? unit.secret, 'base64url'),
    {
      method: options.method ?? 'POST',
      path,
      timestamp,
      nonce,
      body: Buffer.from(body),
    },
  );
  const req = request(server)
    [options.method === 'GET' ? 'get' : 'post'](path)
    .set(DeviceHeaders.SERIAL, unit.serialNumber)
    .set(DeviceHeaders.TIMESTAMP, timestamp)
    .set(DeviceHeaders.NONCE, nonce)
    .set(DeviceHeaders.SIGNATURE, signature);
  const sent = options.sentBody ?? body;
  return sent ? req.set('Content-Type', 'application/json').send(sent) : req;
}
