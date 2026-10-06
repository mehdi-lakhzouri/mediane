import { Inject, Injectable, Logger } from '@nestjs/common';
import { safetyConfig, type SafetyConfig } from '../../../config';
import { type AuthenticatedDevice, DeviceStatus } from '../domain/device';
import { DeviceAuthenticationError } from '../domain/device.errors';
import { DeviceRepository } from '../domain/device.repository';
import {
  DeviceHeaders,
  isFreshTimestamp,
  isValidSignature,
  NONCE_PATTERN,
} from '../domain/device-signature';
import { DeviceSecretCipher } from '../infrastructure/device-secret.cipher';

export interface IncomingDeviceRequest {
  method: string;
  /** Path with query string, as signed by the unit. */
  path: string;
  header(name: string): string | undefined;
  /** Exact bytes received; empty for bodiless requests. */
  rawBody: Buffer;
}

/**
 * Verifies a signed device request: known active unit, fresh timestamp,
 * valid HMAC, nonce never seen before. Every failure looks the same to the
 * caller. The nonce is consumed only after the signature checks out, so
 * forged requests cannot burn a legitimate unit's nonces.
 */
@Injectable()
export class DeviceAuthenticator {
  private readonly logger = new Logger(DeviceAuthenticator.name);

  constructor(
    private readonly devices: DeviceRepository,
    private readonly cipher: DeviceSecretCipher,
    @Inject(safetyConfig.KEY) private readonly config: SafetyConfig,
  ) {}

  async authenticate(
    request: IncomingDeviceRequest,
    now = new Date(),
  ): Promise<AuthenticatedDevice> {
    const serial = request.header(DeviceHeaders.SERIAL);
    const timestamp = request.header(DeviceHeaders.TIMESTAMP);
    const nonce = request.header(DeviceHeaders.NONCE);
    const signature = request.header(DeviceHeaders.SIGNATURE)?.toLowerCase();

    if (
      !serial ||
      !timestamp ||
      !nonce ||
      !signature ||
      !NONCE_PATTERN.test(nonce) ||
      !isFreshTimestamp(timestamp, now, this.config.signatureWindowSeconds)
    ) {
      throw new DeviceAuthenticationError();
    }

    const device = await this.devices.findCredentials(serial);
    if (!device || device.status !== DeviceStatus.ACTIVE) {
      throw new DeviceAuthenticationError();
    }

    let secret: Buffer;
    try {
      secret = this.cipher.decrypt(device.secretEnc, device.id);
    } catch {
      // Key rotation mistake or tampering: never leak which.
      this.logger.error(`Device secret could not be decrypted (${device.id})`);
      throw new DeviceAuthenticationError();
    }

    const valid = isValidSignature(
      secret,
      {
        method: request.method,
        path: request.path,
        timestamp,
        nonce,
        body: request.rawBody,
      },
      signature,
    );
    if (!valid) throw new DeviceAuthenticationError();

    const expiresAt = new Date(
      now.getTime() + this.config.signatureWindowSeconds * 2 * 1000,
    );
    if (!(await this.devices.consumeNonce(device.id, nonce, expiresAt))) {
      throw new DeviceAuthenticationError();
    }

    return {
      id: device.id,
      serialNumber: device.serialNumber,
      pairedUserId: device.pairedUserId,
    };
  }
}
