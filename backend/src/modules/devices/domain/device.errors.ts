import { AppError, ErrorKind } from '../../../common/errors';

export class DeviceNotFoundError extends AppError {
  readonly kind = ErrorKind.NOT_FOUND;

  constructor() {
    super('DEVICE_NOT_FOUND', 'This device does not exist.');
  }
}

export class DeviceSerialTakenError extends AppError {
  readonly kind = ErrorKind.CONFLICT;

  constructor() {
    super(
      'DEVICE_SERIAL_TAKEN',
      'A device with this serial number is already registered.',
    );
  }
}

export class DeviceRevokedError extends AppError {
  readonly kind = ErrorKind.BUSINESS_RULE;

  constructor() {
    super('DEVICE_REVOKED', 'This device has been revoked.');
  }
}

export class DriverAlreadyPairedError extends AppError {
  readonly kind = ErrorKind.CONFLICT;

  constructor() {
    super(
      'DRIVER_ALREADY_PAIRED',
      'This driver already has a device. Unpair it first.',
    );
  }
}

export class DevicePairingTargetError extends AppError {
  readonly kind = ErrorKind.BUSINESS_RULE;

  constructor() {
    super(
      'DEVICE_PAIRING_INVALID',
      'Devices can only be paired with an existing, non-suspended driver.',
    );
  }
}

/**
 * Unknown unit, bad signature, stale timestamp, replayed nonce or revoked
 * unit: one answer, so the endpoint is not an oracle.
 */
export class DeviceAuthenticationError extends AppError {
  readonly kind = ErrorKind.UNAUTHENTICATED;

  constructor() {
    super('DEVICE_AUTH_FAILED', 'Device authentication failed.');
  }
}

/** A verified unit without a driver cannot report events. */
export class DeviceNotPairedError extends AppError {
  readonly kind = ErrorKind.BUSINESS_RULE;

  constructor() {
    super('DEVICE_NOT_PAIRED', 'This device is not paired with a driver.');
  }
}
