import 'package:driver_health_app/core/network/api_failure.dart';
import 'package:driver_health_app/features/password_recovery/presentation/controllers/password_recovery_providers.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class ForgotPasswordState {
  const new({this.submitting = false, this.failure});

  final bool submitting;
  final ApiFailure? failure;
}

final NotifierProvider<ForgotPasswordController, ForgotPasswordState>
forgotPasswordControllerProvider =
    NotifierProvider.autoDispose<ForgotPasswordController, ForgotPasswordState>(
      ForgotPasswordController.new,
    );

class ForgotPasswordController extends Notifier<ForgotPasswordState> {
  @override
  ForgotPasswordState build() => const ForgotPasswordState();

  Future<bool> request(String email) async {
    if (state.submitting) return false;
    state = const ForgotPasswordState(submitting: true);
    try {
      await ref
          .read(passwordRecoveryRepositoryProvider)
          .requestInstructions(email);
      if (ref.mounted) state = const ForgotPasswordState();
      return true;
    } on Object catch (error) {
      if (ref.mounted) {
        state = ForgotPasswordState(failure: ApiFailure.from(error));
      }
      return false;
    }
  }

  void clearFailure() {
    if (state.failure != null) state = const ForgotPasswordState();
  }
}
