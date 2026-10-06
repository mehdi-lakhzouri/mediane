import 'package:driver_health_app/core/network/api_failure.dart';
import 'package:driver_health_app/core/session/auth_state.dart';
import 'package:driver_health_app/core/session/session_providers.dart';
import 'package:driver_health_app/features/password_recovery/presentation/controllers/password_recovery_providers.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

enum ResetLinkStatus { checking, valid, invalid, unavailable }

class ResetPasswordState {
  const new({
    this.status = ResetLinkStatus.checking,
    this.expiresAt,
    this.submitting = false,
    this.failure,
  });

  final ResetLinkStatus status;
  final DateTime? expiresAt;
  final bool submitting;
  final ApiFailure? failure;
}

final NotifierProvider<ResetPasswordController, ResetPasswordState>
resetPasswordControllerProvider =
    NotifierProvider.autoDispose<ResetPasswordController, ResetPasswordState>(
      ResetPasswordController.new,
    );

class ResetPasswordController extends Notifier<ResetPasswordState> {
  @override
  ResetPasswordState build() => const ResetPasswordState();

  Future<void> validate(String token) async {
    state = const ResetPasswordState();
    if (token.isEmpty) {
      state = const ResetPasswordState(status: ResetLinkStatus.invalid);
      return;
    }
    try {
      final link = await ref
          .read(passwordRecoveryRepositoryProvider)
          .validateLink(token);
      if (ref.mounted) {
        state = ResetPasswordState(
          status: ResetLinkStatus.valid,
          expiresAt: link.expiresAt,
        );
      }
    } on Object catch (error) {
      final failure = ApiFailure.from(error);
      if (!ref.mounted) return;
      state = ResetPasswordState(
        status: failure.isConnectivity
            ? ResetLinkStatus.unavailable
            : ResetLinkStatus.invalid,
        failure: failure,
      );
    }
  }

  Future<bool> submit({
    required String token,
    required String newPassword,
  }) async {
    if (state.submitting || state.status != ResetLinkStatus.valid) return false;
    state = ResetPasswordState(
      status: state.status,
      expiresAt: state.expiresAt,
      submitting: true,
    );
    try {
      await ref
          .read(passwordRecoveryRepositoryProvider)
          .resetPassword(token: token, newPassword: newPassword);
      // The server revoked every session as part of the reset. Clear any
      // session that happened to be active on this device as well.
      await ref
          .read(sessionManagerProvider)
          .endSession(reason: SignOutReason.userInitiated);
      if (ref.mounted) {
        state = ResetPasswordState(
          status: ResetLinkStatus.valid,
          expiresAt: state.expiresAt,
        );
      }
      return true;
    } on Object catch (error) {
      final failure = ApiFailure.from(error);
      if (!ref.mounted) return false;
      state = ResetPasswordState(
        status: failure.code == 'PASSWORD_RESET_TOKEN_INVALID'
            ? ResetLinkStatus.invalid
            : ResetLinkStatus.valid,
        expiresAt: state.expiresAt,
        failure: failure,
      );
      return false;
    }
  }

  void clearFailure() {
    if (state.failure == null) return;
    state = ResetPasswordState(
      status: state.status,
      expiresAt: state.expiresAt,
    );
  }
}
