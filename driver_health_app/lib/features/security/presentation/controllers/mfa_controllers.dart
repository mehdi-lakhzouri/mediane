import 'package:driver_health_app/core/network/api_failure.dart';
import 'package:driver_health_app/core/network/network_providers.dart';
import 'package:driver_health_app/core/state/data_changes.dart';
import 'package:driver_health_app/features/security/data/repositories/remote_mfa_repository.dart';
import 'package:driver_health_app/features/security/domain/entities/mfa.dart';
import 'package:driver_health_app/features/security/domain/repositories/mfa_repository.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final mfaRepositoryProvider = Provider<MfaRepository>(
  (ref) => RemoteMfaRepository(ref.watch(dioProvider)),
);

final FutureProvider<MfaStatus> mfaStatusProvider = FutureProvider.autoDispose(
  (ref) => ref.watch(mfaRepositoryProvider).status(),
);

class AuthenticatorSetupState {
  const new({
    this.setup,
    this.loading = false,
    this.failure,
    this.confirming = false,
    this.confirmFailure,
    this.expired = false,
  });

  final TotpSetup? setup;
  final bool loading;
  final ApiFailure? failure;
  final bool confirming;
  final ApiFailure? confirmFailure;

  /// The pending setup timed out; a new one must be started.
  final bool expired;

  bool get codeRejected => confirmFailure?.code == 'MFA_CODE_INVALID';
}

/// Screens 17 and 09 (setup mode). Both screens stay in the navigation stack
/// during the flow, which keeps this state alive; the secret is dropped as
/// soon as they close.
final NotifierProvider<AuthenticatorSetupController, AuthenticatorSetupState>
authenticatorSetupControllerProvider = NotifierProvider.autoDispose(
  AuthenticatorSetupController.new,
);

class AuthenticatorSetupController extends Notifier<AuthenticatorSetupState> {
  @override
  AuthenticatorSetupState build() => const AuthenticatorSetupState();

  Future<void> start({String? currentCode}) async {
    state = const AuthenticatorSetupState(loading: true);
    try {
      final setup = await ref
          .read(mfaRepositoryProvider)
          .startSetup(currentCode: currentCode);
      if (ref.mounted) state = AuthenticatorSetupState(setup: setup);
    } on Object catch (error) {
      if (ref.mounted) {
        state = AuthenticatorSetupState(failure: ApiFailure.from(error));
      }
    }
  }

  /// Returns the recovery codes, or `null` when the code was not accepted.
  Future<RecoveryCodes?> confirm(String code) async {
    final setup = state.setup;
    if (setup == null || state.confirming || state.expired) return null;
    state = AuthenticatorSetupState(setup: setup, confirming: true);
    try {
      final codes = await ref.read(mfaRepositoryProvider).confirmSetup(code);
      if (ref.mounted) state = const AuthenticatorSetupState();
      ref.invalidate(mfaStatusProvider);
      ref.read(dataChangesProvider.notifier).markChanged();
      return codes;
    } on Object catch (error) {
      final failure = ApiFailure.from(error);
      if (ref.mounted) {
        state = failure.code == 'MFA_SETUP_NOT_STARTED'
            ? const AuthenticatorSetupState(expired: true)
            : AuthenticatorSetupState(setup: setup, confirmFailure: failure);
      }
      return null;
    }
  }

  void markExpired() {
    if (!state.expired) {
      state = const AuthenticatorSetupState(expired: true);
    }
  }

  void clearConfirmFailure() {
    final setup = state.setup;
    if (state.confirmFailure != null && setup != null) {
      state = AuthenticatorSetupState(setup: setup);
    }
  }
}
