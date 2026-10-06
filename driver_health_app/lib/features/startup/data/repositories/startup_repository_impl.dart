import 'package:driver_health_app/core/security/app_lock.dart';
import 'package:driver_health_app/core/session/auth_state.dart';
import 'package:driver_health_app/core/session/session_manager.dart';
import 'package:driver_health_app/features/startup/data/data_sources/onboarding_preferences.dart';
import 'package:driver_health_app/features/startup/data/data_sources/startup_remote_data_source.dart';
import 'package:driver_health_app/features/startup/domain/entities/mobile_bootstrap.dart';
import 'package:driver_health_app/features/startup/domain/entities/session_restoration.dart';
import 'package:driver_health_app/features/startup/domain/repositories/startup_repository.dart';
import 'package:package_info_plus/package_info_plus.dart';

class StartupRepositoryImpl implements StartupRepository {
  new(
    this._remote,
    this._sessions,
    this._onboarding, {
    this._appLock,
    Future<String> Function()? appVersion,
  }) : _appVersion = appVersion ?? _installedVersion;

  final StartupRemoteDataSource _remote;
  final SessionManager _sessions;
  final OnboardingPreferences _onboarding;
  final AppLock? _appLock;
  final Future<String> Function() _appVersion;

  static Future<String> _installedVersion() async {
    return (await PackageInfo.fromPlatform()).version;
  }

  @override
  Future<MobileBootstrap> fetchBootstrap() async {
    return (await _remote.fetchBootstrap()).toDomain();
  }

  @override
  Future<String> currentAppVersion() => _appVersion();

  @override
  Future<SessionRestoration> restoreSession() async {
    final result = await _sessions.restore();
    final state = _sessions.state;
    return switch (result) {
      SessionRestoreResult.none => const NoStoredSession(),
      SessionRestoreResult.ended => const StoredSessionEnded(),
      SessionRestoreResult.restored when state is AuthSignedIn =>
        SessionRestored(state.accountState),
      SessionRestoreResult.restored => const StoredSessionEnded(),
    };
  }

  @override
  Future<void> applyAppLock({required bool featureAvailable}) async {
    final state = _sessions.state;
    final lock = _appLock;
    if (lock == null || state is! AuthSignedIn) return;
    await lock.lockIfEnabled(state.userId, featureAvailable: featureAvailable);
  }

  @override
  Future<bool> hasCompletedOnboarding() => _onboarding.isCompleted();

  @override
  Future<void> completeOnboarding() => _onboarding.complete();
}
