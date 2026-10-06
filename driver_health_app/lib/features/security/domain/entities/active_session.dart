enum SessionPlatform { android, ios, windows, macos, linux, unknown }

/// A device signed in to the driver's account.
class ActiveSession {
  const new({
    required this.id,
    required this.label,
    required this.platform,
    required this.app,
    required this.signedInAt,
    required this.lastActiveAt,
    required this.current,
    this.ipAddress,
  });

  final String id;

  /// e.g. "Pixel 8 · Android 15" or "Chrome on Windows".
  final String label;
  final SessionPlatform platform;

  /// The CabinGuard app rather than a browser.
  final bool app;
  final String? ipAddress;
  final DateTime signedInAt;
  final DateTime lastActiveAt;

  /// The device making the request (this phone).
  final bool current;
}
