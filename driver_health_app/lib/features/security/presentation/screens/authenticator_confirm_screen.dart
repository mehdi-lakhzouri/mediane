import 'dart:async';

import 'package:driver_health_app/app/router/app_routes.dart';
import 'package:driver_health_app/core/network/api_failure.dart';
import 'package:driver_health_app/core/presentation/widgets/auth_panel_layout.dart';
import 'package:driver_health_app/core/presentation/widgets/gradient_button.dart';
import 'package:driver_health_app/core/presentation/widgets/inline_message.dart';
import 'package:driver_health_app/core/presentation/widgets/otp_code_field.dart';
import 'package:driver_health_app/core/theme/app_colors.dart';
import 'package:driver_health_app/features/security/presentation/controllers/mfa_controllers.dart';
import 'package:driver_health_app/features/security/presentation/screens/recovery_codes_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

/// Screen 09 in setup mode: proves the new authenticator works.
class AuthenticatorConfirmScreen extends ConsumerStatefulWidget {
  const new({this.required = false, super.key});

  static const codeFieldKey = Key('authenticator-confirm.code');

  final bool required;

  @override
  ConsumerState<AuthenticatorConfirmScreen> createState() =>
      _AuthenticatorConfirmScreenState();
}

class _AuthenticatorConfirmScreenState
    extends ConsumerState<AuthenticatorConfirmScreen> {
  final _code = TextEditingController();
  final _focus = FocusNode();

  @override
  void dispose() {
    _code.dispose();
    _focus.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final code = _code.text;
    if (code.length != 6) return;
    final codes = await ref
        .read(authenticatorSetupControllerProvider.notifier)
        .confirm(code);
    if (!mounted) return;
    if (codes == null) {
      _code.clear();
      _focus.requestFocus();
      return;
    }
    context.go(
      widget.required
          ? AppRoutes.mfaSetupRecoveryCodes
          : AppRoutes.securityRecoveryCodes,
      extra: RecoveryCodesArgs(
        codes: codes,
        afterEnrollment: true,
        required: widget.required,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(authenticatorSetupControllerProvider);
    final failure = state.confirmFailure;

    return AuthPanelLayout(
      onBack: () => context.pop(),
      backgroundAlignment: const Alignment(-0.6, 0.1),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Center(
            child: Icon(
              Icons.phonelink_lock_rounded,
              color: AppColors.cyan,
              size: 64,
            ),
          ),
          const SizedBox(height: 16),
          const Text(
            'CONFIRM YOUR AUTHENTICATOR',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: AppColors.cyan,
              fontSize: 13,
              fontWeight: FontWeight.w700,
              letterSpacing: 2.5,
            ),
          ),
          const SizedBox(height: 8),
          Semantics(
            header: true,
            child: const Text(
              'Enter the new code',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: Colors.white,
                fontSize: 30,
                fontWeight: FontWeight.w900,
              ),
            ),
          ),
          const SizedBox(height: 10),
          const Text(
            'Type the six-digit code CabinGuard now shows in your '
            'authenticator app.',
            textAlign: TextAlign.center,
            style: TextStyle(color: AppColors.ice, fontSize: 15, height: 1.4),
          ),
          const SizedBox(height: 24),
          if (state.expired) ...[
            const InlineMessage(
              icon: Icons.timer_off_outlined,
              message:
                  'This setup expired before it was confirmed. Start again to '
                  'get a new setup key.',
            ),
            const SizedBox(height: 18),
            GradientButton(
              label: 'Start again',
              onPressed: () {
                context.pop();
                unawaited(
                  ref
                      .read(authenticatorSetupControllerProvider.notifier)
                      .start(),
                );
              },
            ),
          ] else ...[
            OtpCodeField(
              key: AuthenticatorConfirmScreen.codeFieldKey,
              controller: _code,
              focusNode: _focus,
              autofocus: true,
              enabled: !state.confirming,
              error: state.codeRejected,
              semanticLabel: 'Six-digit code from your authenticator',
              onChanged: (_) => ref
                  .read(authenticatorSetupControllerProvider.notifier)
                  .clearConfirmFailure(),
              onCompleted: (_) => unawaited(_submit()),
            ),
            const SizedBox(height: 14),
            if (state.codeRejected)
              const InlineMessage(
                message:
                    'That code didn’t match. Check that your phone’s time is '
                    'set automatically, then try the newest code.',
              )
            else if (failure != null)
              InlineMessage(message: _messageFor(failure)),
            const SizedBox(height: 20),
            GradientButton(
              label: 'Verify code',
              loading: state.confirming,
              onPressed: () => unawaited(_submit()),
            ),
          ],
        ],
      ),
    );
  }

  static String _messageFor(ApiFailure failure) => switch (failure.kind) {
    ApiFailureKind.rateLimited =>
      'Too many attempts. Wait a few minutes and try again.',
    ApiFailureKind.server || ApiFailureKind.protocol =>
      'Your code couldn’t be checked right now. Try again shortly.',
    _ => failure.message,
  };
}
