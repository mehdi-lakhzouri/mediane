export const DevicePlatform = {
  ANDROID: 'ANDROID',
  IOS: 'IOS',
  WINDOWS: 'WINDOWS',
  MACOS: 'MACOS',
  LINUX: 'LINUX',
  UNKNOWN: 'UNKNOWN',
} as const;
export type DevicePlatform =
  (typeof DevicePlatform)[keyof typeof DevicePlatform];

export interface DeviceDescription {
  /** Human label, e.g. "Pixel 8 · Android 15" or "Chrome on Windows". */
  label: string;
  platform: DevicePlatform;
  /** The Mediane mobile app rather than a browser. */
  app: boolean;
}

/** `Mediane/1.2.0 (Android 15; Pixel 8)`, sent by the mobile app. */
// Recognize installed builds from before the rename as well as Mediane builds.
const APP_AGENT = /^(?:Mediane|CabinGuard)\/[\w.+-]+ \(([^;)]+);\s*([^)]+)\)/;

function platformOf(text: string): DevicePlatform {
  if (/android/i.test(text)) return DevicePlatform.ANDROID;
  if (/iphone|ipad|ios/i.test(text)) return DevicePlatform.IOS;
  if (/windows/i.test(text)) return DevicePlatform.WINDOWS;
  if (/mac os x|macintosh|macos/i.test(text)) return DevicePlatform.MACOS;
  if (/linux|x11/i.test(text)) return DevicePlatform.LINUX;
  return DevicePlatform.UNKNOWN;
}

const PLATFORM_NAMES: Record<DevicePlatform, string> = {
  ANDROID: 'Android',
  IOS: 'iOS',
  WINDOWS: 'Windows',
  MACOS: 'macOS',
  LINUX: 'Linux',
  UNKNOWN: 'an unknown device',
};

function browserOf(agent: string): string | null {
  if (/Edg\//.test(agent)) return 'Edge';
  if (/OPR\//.test(agent)) return 'Opera';
  if (/Firefox\//.test(agent)) return 'Firefox';
  if (/Chrome\//.test(agent)) return 'Chrome';
  if (/Version\/[\d.]+.*Safari\//.test(agent)) return 'Safari';
  return null;
}

/**
 * Names a session's device from its user agent, for the "active devices"
 * list. Best effort: user agents are client-supplied and only ever shown back
 * to their own account, never trusted for decisions.
 */
export function describeUserAgent(userAgent: string | null): DeviceDescription {
  const agent = userAgent?.trim() ?? '';
  const app = APP_AGENT.exec(agent);
  if (app) {
    const [, os, model] = app;
    return {
      label: `${model.trim()} · ${os.trim()}`,
      platform: platformOf(os),
      app: true,
    };
  }
  // Older app builds identify as the Dart HTTP client.
  if (/^Dart\//.test(agent)) {
    return {
      label: 'Mediane app',
      platform: DevicePlatform.UNKNOWN,
      app: true,
    };
  }
  const platform = platformOf(agent);
  const browser = browserOf(agent);
  return {
    label: browser
      ? `${browser} on ${PLATFORM_NAMES[platform]}`
      : platform === DevicePlatform.UNKNOWN
        ? 'Unknown device'
        : PLATFORM_NAMES[platform],
    platform,
    app: false,
  };
}
