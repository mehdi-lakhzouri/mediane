import 'dart:async';

import 'package:driver_health_app/core/network/api_failure.dart';
import 'package:driver_health_app/core/presentation/widgets/auth_panel_layout.dart';
import 'package:driver_health_app/core/presentation/widgets/cabinguard_text_field.dart';
import 'package:driver_health_app/core/presentation/widgets/gradient_button.dart';
import 'package:driver_health_app/core/presentation/widgets/inline_message.dart';
import 'package:driver_health_app/core/presentation/widgets/password_strength_panel.dart';
import 'package:driver_health_app/core/session/session_providers.dart';
import 'package:driver_health_app/core/theme/app_colors.dart';
import 'package:driver_health_app/features/auth/presentation/controllers/secure_account_controller.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Screen 13: mandatory replacement of the temporary password.
class SecureAccountScreen extends ConsumerStatefulWidget {
  const new({super.key});

  static const currentFieldKey = Key('secure.current');
  static const newFieldKey = Key('secure.new');
  static const confirmFieldKey = Key('secure.confirm');
  static const mfaFieldKey = Key('secure.mfa');

  @override
  ConsumerState<SecureAccountScreen> createState() =>
      _SecureAccountScreenState();
}

class _SecureAccountScreenState extends ConsumerState<SecureAccountScreen> {
  final _formKey = GlobalKey<FormState>();
  final _current = TextEditingController();
  final _new = TextEditingController();
  final _confirm = TextEditingController();
  final _mfa = TextEditingController();
  final _newFocus = FocusNode();
  final _confirmFocus = FocusNode();
  final _visible = <String>{};

  @override
  void dispose() {
    for (final controller in [_current, _new, _confirm, _mfa]) {
      controller.dispose();
    }
    _newFocus.dispose();
    _confirmFocus.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    FocusScope.of(context).unfocus();
    TextInput.finishAutofillContext();
    final changed = await ref
        .read(secureAccountControllerProvider.notifier)
        .submit(
          currentPassword: _current.text,
          newPassword: _new.text,
          mfaCode: _mfa.text,
        );
    // The router guard moves on from the new session's account state.
    if (changed) {
      for (final controller in [_current, _new, _confirm, _mfa]) {
        controller.clear();
      }
    }
  }

  void _changed() {
    ref.read(secureAccountControllerProvider.notifier).clearFailure();
    setState(() {});
  }

  Widget _visibility(String field, String label) {
    final visible = _visible.contains(field);
    return IconButton(
      tooltip: visible ? 'Hide $label' : 'Show $label',
      color: AppColors.ice,
      onPressed: () => setState(
        () => visible ? _visible.remove(field) : _visible.add(field),
      ),
      icon: Icon(
        visible ? Icons.visibility_off_outlined : Icons.visibility_outlined,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(secureAccountControllerProvider);
    final generalFailure =
        state.failure != null &&
            state.fieldError('currentPassword') == null &&
            state.fieldError('newPassword') == null &&
            state.fieldError('mfaCode') == null
        ? state.failure
        : null;

    return AuthPanelLayout(
      backgroundAlignment: const Alignment(0.2, -0.4),
      footer: TextButton(
        onPressed: state.submitting
            ? null
            : () => unawaited(ref.read(sessionManagerProvider).signOut()),
        child: const Text(
          'Sign out',
          style: TextStyle(color: AppColors.cyan, fontWeight: FontWeight.w600),
        ),
      ),
      child: AutofillGroup(
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text(
                'FIRST SIGN-IN',
                style: TextStyle(
                  color: AppColors.cyan,
                  fontSize: 13,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 3,
                ),
              ),
              const SizedBox(height: 8),
              Semantics(
                header: true,
                child: const Text(
                  'Secure your account',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 32,
                    fontWeight: FontWeight.w900,
                    letterSpacing: -0.7,
                  ),
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'Replace your temporary password before continuing.',
                style: TextStyle(
                  color: AppColors.slate,
                  fontSize: 17,
                  height: 1.4,
                ),
              ),
              const SizedBox(height: 22),
              if (generalFailure != null) ...[
                InlineMessage(message: _messageFor(generalFailure)),
                const SizedBox(height: 16),
              ],
              CabinGuardTextField(
                key: SecureAccountScreen.currentFieldKey,
                label: 'Temporary password',
                controller: _current,
                prefixIcon: Icons.key_rounded,
                obscureText: !_visible.contains('current'),
                autofillHints: const [AutofillHints.password],
                textInputAction: TextInputAction.next,
                enabled: !state.submitting,
                errorText: state.fieldError('currentPassword'),
                onChanged: (_) => _changed(),
                onFieldSubmitted: (_) => _newFocus.requestFocus(),
                validator: (value) => (value ?? '').isEmpty
                    ? 'Enter the temporary password from your invitation.'
                    : null,
                suffix: _visibility('current', 'temporary password'),
              ),
              const SizedBox(height: 16),
              CabinGuardTextField(
                key: SecureAccountScreen.newFieldKey,
                label: 'New password',
                controller: _new,
                focusNode: _newFocus,
                prefixIcon: Icons.lock_outline_rounded,
                obscureText: !_visible.contains('new'),
                autofillHints: const [AutofillHints.newPassword],
                textInputAction: TextInputAction.next,
                enabled: !state.submitting,
                errorText: state.fieldError('newPassword'),
                onChanged: (_) => _changed(),
                onFieldSubmitted: (_) => _confirmFocus.requestFocus(),
                validator: (value) {
                  final error = PasswordRules.validateNew(value);
                  if (error != null) return error;
                  if (value == _current.text) {
                    return 'Choose a password different from the temporary '
                        'one.';
                  }
                  return null;
                },
                suffix: _visibility('new', 'new password'),
              ),
              const SizedBox(height: 16),
              CabinGuardTextField(
                key: SecureAccountScreen.confirmFieldKey,
                label: 'Confirm new password',
                controller: _confirm,
                focusNode: _confirmFocus,
                prefixIcon: Icons.lock_outline_rounded,
                obscureText: !_visible.contains('confirm'),
                autofillHints: const [AutofillHints.newPassword],
                textInputAction: state.mfaCodeRequired
                    ? TextInputAction.next
                    : TextInputAction.done,
                enabled: !state.submitting,
                onChanged: (_) => _changed(),
                onFieldSubmitted: (_) {
                  if (!state.mfaCodeRequired) unawaited(_submit());
                },
                validator: (value) => value != _new.text
                    ? 'Enter the same password again.'
                    : null,
                suffix: _visibility('confirm', 'password confirmation'),
              ),
              if (state.mfaCodeRequired) ...[
                const SizedBox(height: 16),
                CabinGuardTextField(
                  key: SecureAccountScreen.mfaFieldKey,
                  label: 'Authenticator or recovery code',
                  controller: _mfa,
                  prefixIcon: Icons.phonelink_lock_rounded,
                  keyboardType: TextInputType.visiblePassword,
                  autofillHints: const [AutofillHints.oneTimeCode],
                  autocorrect: false,
                  enabled: !state.submitting,
                  errorText: state.fieldError('mfaCode'),
                  onChanged: (_) => _changed(),
                  onFieldSubmitted: (_) => unawaited(_submit()),
                  validator: (value) => (value ?? '').trim().isEmpty
                      ? 'Enter a code to confirm this change.'
                      : null,
                ),
              ],
              const SizedBox(height: 18),
              PasswordStrengthPanel(
                password: _new.text,
                confirmation: _confirm.text,
              ),
              const SizedBox(height: 22),
              GradientButton(
                label: 'Update password',
                loading: state.submitting,
                onPressed: () => unawaited(_submit()),
              ),
              const SizedBox(height: 14),
              const Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    Icons.verified_user_outlined,
                    color: AppColors.slate,
                    size: 18,
                  ),
                  SizedBox(width: 8),
                  Flexible(
                    child: Text(
                      'For your security, other sessions will be signed out.',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: AppColors.slate, fontSize: 13),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  static String _messageFor(ApiFailure failure) => switch (failure.kind) {
    ApiFailureKind.rateLimited =>
      'Too many attempts. Wait a few minutes and try again.',
    ApiFailureKind.server || ApiFailureKind.protocol =>
      'Your password couldn’t be updated right now. Try again shortly.',
    _ => failure.message,
  };
}
