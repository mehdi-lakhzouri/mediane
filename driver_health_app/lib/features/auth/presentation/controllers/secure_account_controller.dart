import 'package:driver_health_app/core/network/api_failure.dart';
import 'package:driver_health_app/core/session/session_providers.dart';
import 'package:driver_health_app/features/auth/presentation/controllers/auth_providers.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class SecureAccountState {
  const new({
    this.submitting = false,
    this.failure,
    this.mfaCodeRequired = false,
  });

  final bool submitting;
  final ApiFailure? failure;

  /// The account has MFA enabled, so the server asked for a code as well.
  final bool mfaCodeRequired;

  /// Field-level message from the server for `currentPassword`,
  /// `newPassword` (also reported as `password`), or `mfaCode`.
  String? fieldError(String field) {
    final aliases = field == 'newPassword' ? {field, 'password'} : {field};
    for (final detail in failure?.details ?? const <ApiFieldError>[]) {
      if (aliases.contains(detail.field)) return _sentence(detail.message);
    }
    return null;
  }

  static String _sentence(String message) =>
      'This ${message.endsWith('.') ? message : '$message.'}';
}

final NotifierProvider<SecureAccountController, SecureAccountState>
secureAccountControllerProvider = NotifierProvider.autoDispose(
  SecureAccountController.new,
);

/// Screen 13: replaces the temporary password and adopts the new session the
/// server returns after revoking every other one.
class SecureAccountController extends Notifier<SecureAccountState> {
  @override
  SecureAccountState build() => const SecureAccountState();

  Future<bool> submit({
    required String currentPassword,
    required String newPassword,
    String? mfaCode,
  }) async {
    if (state.submitting) return false;
    final mfaCodeRequired = state.mfaCodeRequired;
    state = SecureAccountState(
      submitting: true,
      mfaCodeRequired: mfaCodeRequired,
    );
    try {
      final session = await ref
          .read(authRepositoryProvider)
          .changePassword(
            currentPassword: currentPassword,
            newPassword: newPassword,
            mfaCode: mfaCode,
          );
      final sessions = ref.read(sessionManagerProvider);
      await sessions.start(session, persist: sessions.remembersDevice);
      if (ref.mounted) state = const SecureAccountState();
      return true;
    } on Object catch (error) {
      final failure = ApiFailure.from(error);
      if (ref.mounted) {
        state = SecureAccountState(
          failure: failure,
          mfaCodeRequired:
              mfaCodeRequired ||
              failure.code == 'MFA_CODE_REQUIRED' ||
              failure.code == 'MFA_CODE_INVALID',
        );
      }
      return false;
    }
  }

  void clearFailure() {
    if (state.failure == null) return;
    state = SecureAccountState(mfaCodeRequired: state.mfaCodeRequired);
  }
}
