import 'package:driver_health_app/core/network/api_failure.dart';
import 'package:driver_health_app/core/session/session_providers.dart';
import 'package:driver_health_app/features/auth/domain/entities/login_result.dart';
import 'package:driver_health_app/features/auth/presentation/controllers/auth_providers.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class LoginState {
  const new({this.submitting = false, this.failure});

  final bool submitting;
  final ApiFailure? failure;
}

final NotifierProvider<LoginController, LoginState> loginControllerProvider =
    NotifierProvider.autoDispose(LoginController.new);

class LoginController extends Notifier<LoginState> {
  @override
  LoginState build() => const LoginState();

  /// Signs in and adopts the session, or returns the MFA challenge to answer.
  /// Returns `null` when the attempt failed; [LoginState.failure] says why.
  Future<LoginResult?> submit({
    required String email,
    required String password,
    required bool rememberDevice,
  }) async {
    if (state.submitting) return null;
    state = const LoginState(submitting: true);

    try {
      final result = await ref
          .read(authRepositoryProvider)
          .login(email: email, password: password);
      if (result is LoginSucceeded) {
        await ref
            .read(sessionManagerProvider)
            .start(result.session, persist: rememberDevice);
      }
      if (ref.mounted) state = const LoginState();
      return result;
    } on Object catch (error) {
      if (ref.mounted) state = LoginState(failure: ApiFailure.from(error));
      return null;
    }
  }

  void clearFailure() {
    if (state.failure != null) state = const LoginState();
  }
}
