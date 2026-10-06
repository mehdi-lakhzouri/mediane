import 'package:driver_health_app/core/session/account_state.dart';
import 'package:driver_health_app/features/startup/application/app_version.dart';
import 'package:driver_health_app/features/startup/domain/entities/session_restoration.dart';
import 'package:driver_health_app/features/startup/domain/entities/startup_decision.dart';
import 'package:driver_health_app/features/startup/domain/repositories/startup_repository.dart';

class ResolveStartup {
  const new(this._repository);

  final StartupRepository _repository;

  Future<StartupDecision> call() async {
    final bootstrap = await _repository.fetchBootstrap();

    if (bootstrap.maintenance) {
      return StartupDecision(
        destination: StartupDestination.maintenance,
        bootstrap: bootstrap,
      );
    }

    final installedVersion = AppVersion.parse(
      await _repository.currentAppVersion(),
    );
    final minimumVersion = AppVersion.parse(bootstrap.minimumSupportedVersion);
    if (installedVersion.compareTo(minimumVersion) < 0) {
      return StartupDecision(
        destination: StartupDestination.mandatoryUpdate,
        bootstrap: bootstrap,
      );
    }

    switch (await _repository.restoreSession()) {
      case SessionRestored(:final accountState):
        await _repository.applyAppLock(
          featureAvailable: bootstrap.features.biometricUnlock,
        );
        return StartupDecision(
          destination: _destinationFor(accountState),
          bootstrap: bootstrap,
        );
      case StoredSessionEnded():
        return StartupDecision(
          destination: StartupDestination.sessionEnded,
          bootstrap: bootstrap,
        );
      case NoStoredSession():
        break;
    }

    final completedOnboarding = await _repository.hasCompletedOnboarding();
    return StartupDecision(
      destination: completedOnboarding
          ? StartupDestination.login
          : StartupDestination.onboarding,
      bootstrap: bootstrap,
    );
  }

  StartupDestination _destinationFor(AccountState accountState) {
    return switch (accountState) {
      AccountState.passwordChangeRequired => StartupDestination.passwordChange,
      AccountState.mfaSetupRequired => StartupDestination.mfaSetup,
      AccountState.profileSetupRequired => StartupDestination.profileSetup,
      AccountState.active => StartupDestination.home,
    };
  }
}
