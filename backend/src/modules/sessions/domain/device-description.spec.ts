import { describeUserAgent } from './device-description';

describe('describeUserAgent', () => {
  it.each([
    [
      'CabinGuard/1.0.0 (Android 15; Pixel 8)',
      { label: 'Pixel 8 · Android 15', platform: 'ANDROID', app: true },
    ],
    [
      'CabinGuard/1.2.3+4 (iOS 18.1; iPhone15,2)',
      { label: 'iPhone15,2 · iOS 18.1', platform: 'IOS', app: true },
    ],
    [
      'Dart/3.13 (dart:io)',
      { label: 'CabinGuard app', platform: 'UNKNOWN', app: true },
    ],
    [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36',
      { label: 'Chrome on Windows', platform: 'WINDOWS', app: false },
    ],
    [
      'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/140.0 Safari/537.36 Edg/140.0',
      { label: 'Edge on Windows', platform: 'WINDOWS', app: false },
    ],
    [
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
      { label: 'Safari on macOS', platform: 'MACOS', app: false },
    ],
    [
      'Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0',
      { label: 'Firefox on Linux', platform: 'LINUX', app: false },
    ],
    [null, { label: 'Unknown device', platform: 'UNKNOWN', app: false }],
    ['curl/8.0', { label: 'Unknown device', platform: 'UNKNOWN', app: false }],
  ])('%s', (agent, expected) => {
    expect(describeUserAgent(agent)).toEqual(expected);
  });
});
