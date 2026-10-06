import { randomBytes } from 'node:crypto';
import { Command, CommandRunner, Option } from 'nest-commander';
import { API_BASE_PATH } from '../../config';
import {
  DeviceHeaders,
  signRequest,
} from '../../modules/devices/domain/device-signature';
import { MedicalEventType } from '../../modules/safety/domain/safety';

type Action = 'heartbeat' | 'event' | 'acknowledge';

interface SimulateOptions {
  api: string;
  serial?: string;
  action: Action;
  type?: MedicalEventType;
  confidence?: number;
  heartRate?: number;
  latitude?: number;
  longitude?: number;
}

const EVENT_TYPES = Object.values(MedicalEventType);
const SECRET_ENV = 'CABINGUARD_DEVICE_SECRET';

/** Sample readings per event type, so demos look like a real detector. */
const SAMPLE_VITALS: Partial<Record<MedicalEventType, object>> = {
  HEART_RHYTHM: { heartRateBpm: 148, rhythm: 'ATRIAL_FIBRILLATION' },
  CARDIAC_ARREST: { heartRateBpm: 0, rhythm: 'VENTRICULAR_FIBRILLATION' },
  DROWSINESS: { eyeClosurePercent: 38, heartRateBpm: 58 },
  SEIZURE: { heartRateBpm: 132 },
  STROKE: { heartRateBpm: 96, spo2Percent: 93 },
};

async function readSecret(): Promise<string> {
  const fromEnv = process.env[SECRET_ENV];
  if (fromEnv) return fromEnv.trim();
  if (process.stdin.isTTY) {
    throw new Error(
      `Provide the unit secret on stdin or in ${SECRET_ENV} (never as an argument).`,
    );
  }
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }
  return Buffer.concat(chunks).toString('utf8').trim();
}

/**
 * Plays an in-cabin unit against a running API, signing requests exactly
 * like the firmware must:
 *
 *   echo "$SECRET" | npm run cli -- device:simulate --serial CG-0001 --action event --type STROKE
 *   npm run cli -- device:simulate --serial CG-0001 --action acknowledge   (with CABINGUARD_DEVICE_SECRET set)
 *
 * The secret is read from stdin or the environment, never from arguments.
 */
@Command({
  name: 'device:simulate',
  description:
    'Send a signed heartbeat, event or "I\'m OK" as an in-cabin unit',
})
export class SimulateDeviceCommand extends CommandRunner {
  async run(_params: string[], options: SimulateOptions): Promise<void> {
    if (!options.serial) {
      this.fail('--serial is required.');
      return;
    }
    if (options.action === 'event' && !options.type) {
      this.fail(`--type is required for events (${EVENT_TYPES.join(', ')}).`);
      return;
    }
    const secret = Buffer.from(await readSecret(), 'base64url');
    const { path, payload } = this.request(options);
    const body = payload ? JSON.stringify(payload) : '';
    const timestamp = String(Math.floor(Date.now() / 1000));
    const nonce = randomBytes(16).toString('base64url');
    const signature = signRequest(secret, {
      method: 'POST',
      path,
      timestamp,
      nonce,
      body: Buffer.from(body),
    });

    const response = await fetch(new URL(path, options.api), {
      method: 'POST',
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        [DeviceHeaders.SERIAL]: options.serial,
        [DeviceHeaders.TIMESTAMP]: timestamp,
        [DeviceHeaders.NONCE]: nonce,
        [DeviceHeaders.SIGNATURE]: signature,
      },
      body: body || undefined,
    });
    const text = await response.text();
    console.log(`${response.status} ${response.statusText}`);
    try {
      console.log(JSON.stringify(JSON.parse(text), null, 2));
    } catch {
      console.log(text);
    }
    if (!response.ok) process.exitCode = 1;
  }

  private request(options: SimulateOptions): {
    path: string;
    payload: object | null;
  } {
    switch (options.action) {
      case 'heartbeat':
        return {
          path: `${API_BASE_PATH}/device/heartbeat`,
          payload: { firmwareVersion: 'sim-1.0.0' },
        };
      case 'acknowledge':
        return { path: `${API_BASE_PATH}/device/acknowledge`, payload: null };
      case 'event': {
        const type = options.type!;
        const location =
          options.latitude !== undefined && options.longitude !== undefined
            ? {
                latitude: options.latitude,
                longitude: options.longitude,
                accuracyM: 10,
              }
            : undefined;
        const vitals = {
          ...SAMPLE_VITALS[type],
          ...(options.heartRate !== undefined
            ? { heartRateBpm: options.heartRate }
            : {}),
        };
        return {
          path: `${API_BASE_PATH}/device/events`,
          payload: {
            clientEventId: `sim-${randomBytes(9).toString('base64url')}`,
            type,
            detectedAt: new Date().toISOString(),
            ...(type === MedicalEventType.SOS
              ? {}
              : { confidence: options.confidence ?? 0.9, vitals }),
            ...(location ? { location } : {}),
          },
        };
      }
    }
  }

  @Option({
    flags: '--api <url>',
    description: 'API origin',
    defaultValue: 'http://localhost:3000',
  })
  parseApi(value: string): string {
    return value;
  }

  @Option({ flags: '--serial <serial>', description: 'Unit serial number' })
  parseSerial(value: string): string {
    return value.trim();
  }

  @Option({
    flags: '--action <action>',
    description: 'heartbeat | event | acknowledge',
    defaultValue: 'event',
  })
  parseAction(value: string): Action {
    if (value === 'heartbeat' || value === 'event' || value === 'acknowledge') {
      return value;
    }
    throw new Error('--action must be heartbeat, event or acknowledge');
  }

  @Option({ flags: '--type <type>', description: EVENT_TYPES.join(' | ') })
  parseType(value: string): MedicalEventType {
    const type = value.toUpperCase() as MedicalEventType;
    if (!EVENT_TYPES.includes(type)) {
      throw new Error(`--type must be one of ${EVENT_TYPES.join(', ')}`);
    }
    return type;
  }

  @Option({
    flags: '--confidence <n>',
    description: 'Detector confidence 0..1',
  })
  parseConfidence(value: string): number {
    return Number(value);
  }

  @Option({ flags: '--heart-rate <bpm>', description: 'Override heart rate' })
  parseHeartRate(value: string): number {
    return Number(value);
  }

  @Option({ flags: '--latitude <deg>', description: 'Attach a location' })
  parseLatitude(value: string): number {
    return Number(value);
  }

  @Option({ flags: '--longitude <deg>', description: 'Attach a location' })
  parseLongitude(value: string): number {
    return Number(value);
  }

  private fail(message: string): void {
    console.error(message);
    process.exitCode = 1;
  }
}
