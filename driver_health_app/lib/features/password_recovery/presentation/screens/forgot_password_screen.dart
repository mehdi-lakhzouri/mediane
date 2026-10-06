import 'dart:async';

import 'package:driver_health_app/app/router/app_routes.dart';
import 'package:driver_health_app/core/network/api_failure.dart';
import 'package:driver_health_app/core/presentation/widgets/auth_panel_layout.dart';
import 'package:driver_health_app/core/presentation/widgets/cabinguard_text_field.dart';
import 'package:driver_health_app/core/presentation/widgets/gradient_button.dart';
import 'package:driver_health_app/core/presentation/widgets/inline_message.dart';
import 'package:driver_health_app/core/theme/app_colors.dart';
import 'package:driver_health_app/features/password_recovery/presentation/controllers/forgot_password_controller.dart';
import 'package:driver_health_app/features/password_recovery/presentation/widgets/recovery_hero.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class ForgotPasswordScreen extends ConsumerStatefulWidget {
  const new({super.key});

  static const emailFieldKey = Key('forgot-password.email');

  @override
  ConsumerState<ForgotPasswordScreen> createState() =>
      _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends ConsumerState<ForgotPasswordScreen> {
  static final _emailPattern = RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$');

  final _formKey = GlobalKey<FormState>();
  final _email = TextEditingController();

  @override
  void dispose() {
    _email.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    FocusScope.of(context).unfocus();
    final email = _email.text.trim();
    final sent = await ref
        .read(forgotPasswordControllerProvider.notifier)
        .request(email);
    if (sent && mounted) {
      unawaited(context.push(AppRoutes.forgotPasswordSent, extra: email));
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(forgotPasswordControllerProvider);
    return AuthPanelLayout(
      onBack: () => context.go(AppRoutes.login),
      backgroundAlignment: const Alignment(-0.5, -0.25),
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const RecoveryHero(icon: Icons.mark_email_unread_outlined),
            const SizedBox(height: 18),
            const _Eyebrow('ACCOUNT RECOVERY'),
            const SizedBox(height: 8),
            const Text(
              'Reset your password',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: Colors.white,
                fontSize: 32,
                fontWeight: FontWeight.w900,
                letterSpacing: -0.7,
              ),
            ),
            const SizedBox(height: 10),
            const Text(
              'Enter the email linked to your CabinGuard account. We’ll send '
              'secure reset instructions.',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: AppColors.ice,
                fontSize: 16,
                height: 1.45,
              ),
            ),
            const SizedBox(height: 24),
            if (state.failure case final failure?) ...[
              InlineMessage(message: _messageFor(failure)),
              const SizedBox(height: 18),
            ],
            CabinGuardTextField(
              key: ForgotPasswordScreen.emailFieldKey,
              label: 'Email address',
              controller: _email,
              hintText: 'you@company.com',
              prefixIcon: Icons.mail_outline_rounded,
              keyboardType: TextInputType.emailAddress,
              textInputAction: TextInputAction.done,
              autofillHints: const [AutofillHints.email],
              autocorrect: false,
              enabled: !state.submitting,
              onChanged: (_) => ref
                  .read(forgotPasswordControllerProvider.notifier)
                  .clearFailure(),
              onFieldSubmitted: (_) => unawaited(_submit()),
              validator: (value) {
                final email = value?.trim() ?? '';
                if (email.isEmpty) return 'Enter your email address.';
                if (!_emailPattern.hasMatch(email)) {
                  return 'Enter a valid email address.';
                }
                return null;
              },
            ),
            const SizedBox(height: 22),
            GradientButton(
              label: 'Send reset instructions',
              loading: state.submitting,
              onPressed: () => unawaited(_submit()),
            ),
            const SizedBox(height: 10),
            TextButton(
              onPressed: state.submitting
                  ? null
                  : () => context.go(AppRoutes.login),
              child: const Text(
                'Back to sign in',
                style: TextStyle(
                  color: AppColors.cyan,
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
            const Divider(color: Color(0x4D9EB3CC), height: 28),
            const Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.verified_user_outlined, color: AppColors.slate),
                SizedBox(width: 10),
                Flexible(
                  child: Text(
                    'Your recovery request stays private.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: AppColors.slate),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  static String _messageFor(ApiFailure failure) {
    return switch (failure.kind) {
      ApiFailureKind.rateLimited =>
        'Too many requests. Wait a few minutes before trying again.',
      ApiFailureKind.server || ApiFailureKind.protocol =>
        'Recovery is temporarily unavailable. Try again shortly.',
      _ => failure.message,
    };
  }
}

class _Eyebrow extends StatelessWidget {
  const new(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      textAlign: TextAlign.center,
      style: const TextStyle(
        color: AppColors.cyan,
        fontSize: 13,
        fontWeight: FontWeight.w800,
        letterSpacing: 3,
      ),
    );
  }
}
