import 'package:driver_health_app/core/network/api_failure.dart';
import 'package:driver_health_app/core/session/session_providers.dart';
import 'package:driver_health_app/features/auth/domain/entities/mfa_challenge.dart';
import 'package:driver_health_app/features/auth/presentation/controllers/auth_providers.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class MfaVerificationState {
  const new({
    this.submitting = false,
    this.failure,
    this.challengeExpired = false,
  });

  final bool submitting;
  final ApiFailure? failure;

  /// The challenge timed out or ran out of attempts; only a new login helps.
  final bool challengeExpired;

  bool get codeRejected => failure?.code == 'MFA_CODE_INVALID';
}

final NotifierProvider<MfaVerificationController, MfaVerificationState>
mfaVerificationControllerProvider = NotifierProvider.autoDispose(
  MfaVerificationController.new,
);

class MfaVerificationController extends Notifier<MfaVerificationState> {
  @override
  MfaVerificationState build() => const MfaVerificationState();

  Future<bool> verify({
    required MfaChallenge challenge,
    required String code,
    required bool rememberDevice,
  }) async {
    if (state.submitting || state.challengeExpired) return false;
    state = const MfaVerificationState(submitting: true);

    try {
      final session = await ref
          .read(authRepositoryProvider)
          .completeMfaChallenge(mfaToken: challenge.token, code: code);
      await ref
          .read(sessionManagerProvider)
          .start(session, persist: rememberDevice);
      if (ref.mounted) state = const MfaVerificationState();
      return true;
    } on Object catch (error) {
      final failure = ApiFailure.from(error);
      if (ref.mounted) {
        state = failure.code == 'MFA_CHALLENGE_INVALID'
            ? const MfaVerificationState(challengeExpired: true)
            : MfaVerificationState(failure: failure);
      }
      return false;
    }
  }

  void markExpired() {
    if (!state.challengeExpired) {
      state = const MfaVerificationState(challengeExpired: true);
    }
  }

  void clearFailure() {
    if (state.failure != null) state = const MfaVerificationState();
  }
}
