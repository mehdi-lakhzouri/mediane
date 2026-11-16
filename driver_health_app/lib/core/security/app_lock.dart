import 'package:driver_health_app/core/security/biometric_authenticator.dart';
import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Per-user opt-in for biometric unlock, kept in the keystore.
class BiometricPreferenceStore {
  const new(this._storage);

  final FlutterSecureStorage _storage;

  static String _key(String userId) => 'biometricUnlock.$userId';

  Future<bool> isEnabled(String userId) async {
    try {
      return await _storage.read(key: _key(userId)) == 'true';
    } on PlatformException {
      return false;
    }
  }

  Future<void> setEnabled(String userId, {required bool enabled}) async {
    if (enabled) {
      await _storage.write(key: _key(userId), value: 'true');
    } else {
      await _storage.delete(key: _key(userId));
    }
  }
}

/// Gates a restored session behind device biometrics once the user opted in.
/// Locks at startup and again after the app spent [relockAfter] in the
/// background. Listeners drive the router guard.
class AppLock extends ChangeNotifier with WidgetsBindingObserver {
  new({
    required this._preferences,
    required this._authenticator,
    this.relockAfter = const Duration(minutes: 2),
    DateTime Function()? clock,
  }) : _clock = clock ?? DateTime.now;

  final BiometricPreferenceStore _preferences;
  final BiometricAuthenticator _authenticator;
  final Duration relockAfter;
  final DateTime Function() _clock;

  String? _userId;
  bool _enabled = false;
  bool _featureAvailable = true;
  bool _locked = false;
  DateTime? _backgroundedAt;

  bool get locked => _locked;

  /// Whether the signed-in user opted in and the server allows the feature.
  bool get enabled => _enabled && _featureAvailable;

  /// Tracks the signed-in user without locking: they just authenticated.
  Future<void> attachUser(String userId) async {
    if (_userId == userId) return;
    _userId = userId;
    _enabled = await _preferences.isEnabled(userId);
  }

  /// Called by startup after the stored session was restored.
  Future<void> lockIfEnabled(
    String userId, {
    required bool featureAvailable,
  }) async {
    _featureAvailable = featureAvailable;
    _userId = userId;
    _enabled = await _preferences.isEnabled(userId);
    if (enabled) _setLocked(locked: true);
  }

  Future<BiometricResult> unlock() async {
    final result = await _authenticator.authenticate(
      'Unlock your saved Mediane session',
    );
    if (result == BiometricResult.success) _setLocked(locked: false);
    return result;
  }

  Future<bool> isAvailable() => _authenticator.isAvailable();

  /// Turning it on proves the user can unlock before relying on it.
  Future<BiometricResult> setEnabled({required bool enabled}) async {
    final userId = _userId;
    if (userId == null) return BiometricResult.unavailable;
    if (enabled) {
      final result = await _authenticator.authenticate(
        'Confirm it’s you to turn on biometric unlock',
      );
      if (result != BiometricResult.success) return result;
    }
    await _preferences.setEnabled(userId, enabled: enabled);
    _enabled = enabled;
    notifyListeners();
    return BiometricResult.success;
  }

  /// The session ended: nothing left to protect.
  void reset() {
    _userId = null;
    _enabled = false;
    _backgroundedAt = null;
    _setLocked(locked: false);
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    switch (state) {
      case AppLifecycleState.hidden:
      case AppLifecycleState.paused:
        _backgroundedAt ??= _clock();
      case AppLifecycleState.resumed:
        final since = _backgroundedAt;
        _backgroundedAt = null;
        if (since != null &&
            enabled &&
            _userId != null &&
            _clock().difference(since) >= relockAfter) {
          _setLocked(locked: true);
        }
      case AppLifecycleState.inactive:
      case AppLifecycleState.detached:
        break;
    }
  }

  void _setLocked({required bool locked}) {
    if (_locked == locked) return;
    _locked = locked;
    notifyListeners();
  }
}
