import 'package:driver_health_app/features/startup/domain/entities/mobile_bootstrap.dart';
import 'package:driver_health_app/features/startup/domain/entities/session_restoration.dart';

abstract interface class StartupRepository {
  Future<MobileBootstrap> fetchBootstrap();

  Future<String> currentAppVersion();

  Future<SessionRestoration> restoreSession();

  /// Locks the restored session behind biometrics when the user opted in.
  Future<void> applyAppLock({required bool featureAvailable});

  Future<bool> hasCompletedOnboarding();

  Future<void> completeOnboarding();
}
