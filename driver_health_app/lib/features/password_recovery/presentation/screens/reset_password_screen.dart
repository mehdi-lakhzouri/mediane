import 'dart:async';

import 'package:driver_health_app/app/router/app_routes.dart';
import 'package:driver_health_app/core/network/api_failure.dart';
import 'package:driver_health_app/core/presentation/widgets/auth_panel_layout.dart';
import 'package:driver_health_app/core/presentation/widgets/cabinguard_text_field.dart';
import 'package:driver_health_app/core/presentation/widgets/gradient_button.dart';
import 'package:driver_health_app/core/presentation/widgets/inline_message.dart';
import 'package:driver_health_app/core/theme/app_colors.dart';
import 'package:driver_health_app/features/password_recovery/presentation/controllers/reset_password_controller.dart';
import 'package:driver_health_app/features/password_recovery/presentation/widgets/recovery_hero.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class ResetPasswordScreen extends ConsumerStatefulWidget {
  const new({required this.token, super.key});

  static const passwordFieldKey = Key('reset-password.password');
  static const confirmationFieldKey = Key('reset-password.confirmation');

  final String token;

  @override
  ConsumerState<ResetPasswordScreen> createState() =>
      _ResetPasswordScreenState();
}

class _ResetPasswordScreenState extends ConsumerState<ResetPasswordScreen> {
  final _formKey = GlobalKey<FormState>();
  final _password = TextEditingController();
  final _confirmation = TextEditingController();
  final _confirmationFocus = FocusNode();
  bool _passwordVisible = false;
  bool _confirmationVisible = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      unawaited(
        ref
            .read(resetPasswordControllerProvider.notifier)
            .validate(widget.token),
      );
    });
  }

  @override
  void dispose() {
    _password.dispose();
    _confirmation.dispose();
    _confirmationFocus.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    FocusScope.of(context).unfocus();
    TextInput.finishAutofillContext();
    final completed = await ref
        .read(resetPasswordControllerProvider.notifier)
        .submit(token: widget.token, newPassword: _password.text);
    if (completed && mounted) {
      _password.clear();
      _confirmation.clear();
      context.go(AppRoutes.resetPasswordSuccess);
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(resetPasswordControllerProvider);
    return AuthPanelLayout(
      onBack: () => context.go(AppRoutes.login),
      child: switch (state.status) {
        ResetLinkStatus.checking => const _CheckingLink(),
        ResetLinkStatus.invalid => _InvalidLink(failure: state.failure),
        ResetLinkStatus.unavailable => _UnavailableLink(
          failure: state.failure,
          onRetry: () => ref
              .read(resetPasswordControllerProvider.notifier)
              .validate(widget.token),
        ),
        ResetLinkStatus.valid => _buildForm(state),
      },
    );
  }

  Widget _buildForm(ResetPasswordState state) {
    final password = _password.text;
    final confirmation = _confirmation.text;
    final hasLength = password.length >= 12 && password.length <= 128;
    final strong = _strengthOf(password) >= 3;
    final matches = password.isNotEmpty && password == confirmation;
    String? fieldError;
    for (final detail in state.failure?.details ?? const <ApiFieldError>[]) {
      if (detail.field == 'password' || detail.field == 'newPassword') {
        fieldError = detail.message;
        break;
      }
    }

    return AutofillGroup(
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const RecoveryHero(icon: Icons.lock_person_outlined),
            const SizedBox(height: 16),
            const Text(
              'SECURE RECOVERY',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: AppColors.cyan,
                fontSize: 13,
                fontWeight: FontWeight.w800,
                letterSpacing: 3,
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              'Choose a new password',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: Colors.white,
                fontSize: 30,
                fontWeight: FontWeight.w900,
                letterSpacing: -0.6,
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              'Use a memorable passphrase with at least 12 characters.',
              textAlign: TextAlign.center,
              style: TextStyle(color: AppColors.ice, fontSize: 16, height: 1.4),
            ),
            const SizedBox(height: 16),
            const _VerifiedLinkChip(),
            if (state.failure case final failure?) ...[
              const SizedBox(height: 16),
              InlineMessage(message: _messageFor(failure)),
            ],
            const SizedBox(height: 20),
            CabinGuardTextField(
              key: ResetPasswordScreen.passwordFieldKey,
              label: 'New password',
              controller: _password,
              prefixIcon: Icons.lock_outline_rounded,
              obscureText: !_passwordVisible,
              enabled: !state.submitting,
              errorText: fieldError,
              textInputAction: TextInputAction.next,
              autofillHints: const [AutofillHints.newPassword],
              onChanged: (_) {
                ref
                    .read(resetPasswordControllerProvider.notifier)
                    .clearFailure();
                setState(() {});
              },
              onFieldSubmitted: (_) => _confirmationFocus.requestFocus(),
              validator: (value) {
                final length = value?.length ?? 0;
                if (length < 12) {
                  return 'Use at least 12 characters.';
                }
                if (length > 128) {
                  return 'Use no more than 128 characters.';
                }
                return null;
              },
              suffix: IconButton(
                tooltip: _passwordVisible ? 'Hide password' : 'Show password',
                color: AppColors.ice,
                onPressed: () =>
                    setState(() => _passwordVisible = !_passwordVisible),
                icon: Icon(
                  _passwordVisible
                      ? Icons.visibility_off_outlined
                      : Icons.visibility_outlined,
                ),
              ),
            ),
            const SizedBox(height: 16),
            CabinGuardTextField(
              key: ResetPasswordScreen.confirmationFieldKey,
              label: 'Confirm password',
              controller: _confirmation,
              focusNode: _confirmationFocus,
              prefixIcon: matches
                  ? Icons.check_circle_outline_rounded
                  : Icons.lock_outline_rounded,
              obscureText: !_confirmationVisible,
              enabled: !state.submitting,
              textInputAction: TextInputAction.done,
              autofillHints: const [AutofillHints.newPassword],
              onChanged: (_) => setState(() {}),
              onFieldSubmitted: (_) => unawaited(_submit()),
              validator: (value) => value != _password.text
                  ? 'Enter the same password again.'
                  : null,
              suffix: IconButton(
                tooltip: _confirmationVisible
                    ? 'Hide password confirmation'
                    : 'Show password confirmation',
                color: AppColors.ice,
                onPressed: () => setState(
                  () => _confirmationVisible = !_confirmationVisible,
                ),
                icon: Icon(
                  _confirmationVisible
                      ? Icons.visibility_off_outlined
                      : Icons.visibility_outlined,
                ),
              ),
            ),
            const SizedBox(height: 14),
            Wrap(
              spacing: 12,
              runSpacing: 8,
              alignment: WrapAlignment.center,
              children: [
                _Requirement(label: '12+ characters', met: hasLength),
                _Requirement(label: 'Strong', met: strong),
                _Requirement(label: 'Passwords match', met: matches),
              ],
            ),
            const SizedBox(height: 22),
            GradientButton(
              label: 'Reset password',
              loading: state.submitting,
              onPressed: () => unawaited(_submit()),
            ),
            const SizedBox(height: 8),
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
            const Divider(color: Color(0x4D9EB3CC), height: 24),
            const Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.shield_outlined, color: AppColors.slate, size: 20),
                SizedBox(width: 8),
                Flexible(
                  child: Text(
                    'All existing sessions will be securely signed out.',
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

  static int _strengthOf(String value) {
    if (value.length < 12) return 0;
    var score = 1;
    if (value.length >= 16) score++;
    if (RegExp('[A-Z]').hasMatch(value) && RegExp('[a-z]').hasMatch(value)) {
      score++;
    }
    if (RegExp(r'\d').hasMatch(value) ||
        RegExp('[^A-Za-z0-9]').hasMatch(value)) {
      score++;
    }
    return score;
  }

  static String _messageFor(ApiFailure failure) => switch (failure.kind) {
    ApiFailureKind.rateLimited =>
      'Too many reset attempts. Wait a few minutes and try again.',
    ApiFailureKind.server || ApiFailureKind.protocol =>
      'Your password could not be reset right now. Try again shortly.',
    _ => failure.message,
  };
}

class _VerifiedLinkChip extends StatelessWidget {
  const new();

  @override
  Widget build(BuildContext context) => Center(
    child: DecoratedBox(
      decoration: BoxDecoration(
        color: AppColors.mint.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(99),
        border: Border.all(color: AppColors.mint),
      ),
      child: const Padding(
        padding: EdgeInsets.symmetric(horizontal: 16, vertical: 9),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.check_circle_rounded, color: AppColors.mint, size: 20),
            SizedBox(width: 8),
            Flexible(
              child: Text(
                'Reset link verified',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: AppColors.mint,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ],
        ),
      ),
    ),
  );
}

class _Requirement extends StatelessWidget {
  const new({required this.label, required this.met});

  final String label;
  final bool met;

  @override
  Widget build(BuildContext context) => Row(
    mainAxisSize: MainAxisSize.min,
    children: [
      Icon(
        met ? Icons.check_circle_rounded : Icons.circle_outlined,
        color: met ? AppColors.mint : AppColors.slate,
        size: 18,
      ),
      const SizedBox(width: 6),
      Text(
        label,
        style: TextStyle(color: met ? AppColors.ice : AppColors.slate),
      ),
    ],
  );
}

class _CheckingLink extends StatelessWidget {
  const new();

  @override
  Widget build(BuildContext context) => const Padding(
    padding: EdgeInsets.symmetric(vertical: 48),
    child: Column(
      children: [
        CircularProgressIndicator(color: AppColors.cyan),
        SizedBox(height: 22),
        Text(
          'Checking your secure reset link…',
          textAlign: TextAlign.center,
          style: TextStyle(color: AppColors.ice, fontSize: 17),
        ),
      ],
    ),
  );
}

class _InvalidLink extends StatelessWidget {
  const new({this.failure});

  final ApiFailure? failure;

  @override
  Widget build(BuildContext context) => _LinkProblem(
    icon: Icons.link_off_rounded,
    title: 'This link has expired',
    message:
        failure?.message ?? 'Request a new secure link to reset your password.',
    actionLabel: 'Request a new link',
    onAction: () => context.go(AppRoutes.forgotPassword),
  );
}

class _UnavailableLink extends StatelessWidget {
  const new({required this.onRetry, this.failure});

  final ApiFailure? failure;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) => _LinkProblem(
    icon: Icons.cloud_off_outlined,
    title: 'Link check unavailable',
    message: failure?.message ?? 'Check your connection and try again.',
    actionLabel: 'Try again',
    onAction: onRetry,
  );
}

class _LinkProblem extends StatelessWidget {
  const new({
    required this.icon,
    required this.title,
    required this.message,
    required this.actionLabel,
    required this.onAction,
  });

  final IconData icon;
  final String title;
  final String message;
  final String actionLabel;
  final VoidCallback onAction;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      RecoveryHero(icon: icon, badgeColor: AppColors.coral),
      const SizedBox(height: 18),
      Text(
        title,
        textAlign: TextAlign.center,
        style: const TextStyle(
          color: Colors.white,
          fontSize: 28,
          fontWeight: FontWeight.w900,
        ),
      ),
      const SizedBox(height: 10),
      Text(
        message,
        textAlign: TextAlign.center,
        style: const TextStyle(color: AppColors.ice, fontSize: 16, height: 1.4),
      ),
      const SizedBox(height: 24),
      GradientButton(label: actionLabel, onPressed: onAction),
      TextButton(
        onPressed: () => context.go(AppRoutes.login),
        child: const Text(
          'Back to sign in',
          style: TextStyle(color: AppColors.cyan),
        ),
      ),
    ],
  );
}
