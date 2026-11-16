import 'dart:async';

import 'package:driver_health_app/app/router/app_routes.dart';
import 'package:driver_health_app/core/network/api_failure.dart';
import 'package:driver_health_app/core/presentation/widgets/auth_panel_layout.dart';
import 'package:driver_health_app/core/presentation/widgets/cabinguard_text_field.dart';
import 'package:driver_health_app/core/presentation/widgets/gradient_button.dart';
import 'package:driver_health_app/core/presentation/widgets/inline_message.dart';
import 'package:driver_health_app/core/theme/app_colors.dart';
import 'package:driver_health_app/features/auth/domain/entities/login_result.dart';
import 'package:driver_health_app/features/auth/presentation/controllers/login_controller.dart';
import 'package:driver_health_app/features/auth/presentation/screens/mfa_verification_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const new({super.key});

  static const emailFieldKey = Key('login.email');
  static const passwordFieldKey = Key('login.password');

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  static final _emailPattern = RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$');

  final _formKey = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _passwordFocus = FocusNode();
  bool _passwordVisible = false;
  bool _rememberDevice = true;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    _passwordFocus.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    FocusScope.of(context).unfocus();
    TextInput.finishAutofillContext();

    final result = await ref
        .read(loginControllerProvider.notifier)
        .submit(
          email: _email.text,
          password: _password.text,
          rememberDevice: _rememberDevice,
        );
    if (!mounted) return;

    switch (result) {
      case LoginRequiresMfa(:final challenge):
        _password.clear();
        unawaited(
          context.push(
            AppRoutes.loginVerify,
            extra: MfaVerificationArgs(
              challenge: challenge,
              rememberDevice: _rememberDevice,
            ),
          ),
        );
      case LoginSucceeded():
        // The router guard routes from the server's account state.
        _password.clear();
      case null:
        break;
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(loginControllerProvider);

    return AuthPanelLayout(
      footer: const _SecurityFooter(),
      child: AutofillGroup(
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Semantics(
                header: true,
                child: const Text(
                  'Welcome back',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 34,
                    fontWeight: FontWeight.w900,
                    letterSpacing: -0.8,
                  ),
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'Sign in to continue your safer journey.',
                textAlign: TextAlign.center,
                style: TextStyle(color: AppColors.ice, fontSize: 16),
              ),
              const SizedBox(height: 24),
              if (state.failure case final failure?) ...[
                InlineMessage(message: _messageFor(failure)),
                const SizedBox(height: 18),
              ],
              CabinGuardTextField(
                key: LoginScreen.emailFieldKey,
                label: 'Email',
                controller: _email,
                hintText: 'you@company.com',
                prefixIcon: Icons.mail_outline_rounded,
                keyboardType: TextInputType.emailAddress,
                textInputAction: TextInputAction.next,
                autofillHints: const [
                  AutofillHints.email,
                  AutofillHints.username,
                ],
                autocorrect: false,
                enabled: !state.submitting,
                onChanged: (_) =>
                    ref.read(loginControllerProvider.notifier).clearFailure(),
                onFieldSubmitted: (_) => _passwordFocus.requestFocus(),
                validator: (value) {
                  final email = value?.trim() ?? '';
                  if (email.isEmpty) return 'Enter your email address.';
                  if (!_emailPattern.hasMatch(email)) {
                    return 'Enter a valid email address.';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 18),
              CabinGuardTextField(
                key: LoginScreen.passwordFieldKey,
                label: 'Password',
                controller: _password,
                focusNode: _passwordFocus,
                prefixIcon: Icons.lock_outline_rounded,
                obscureText: !_passwordVisible,
                textInputAction: TextInputAction.done,
                autofillHints: const [AutofillHints.password],
                enabled: !state.submitting,
                onChanged: (_) =>
                    ref.read(loginControllerProvider.notifier).clearFailure(),
                onFieldSubmitted: (_) => unawaited(_submit()),
                validator: (value) =>
                    (value ?? '').isEmpty ? 'Enter your password.' : null,
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
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                    flex: 3,
                    child: MergeSemantics(
                      child: Row(
                        children: [
                          Checkbox(
                            value: _rememberDevice,
                            visualDensity: VisualDensity.compact,
                            activeColor: AppColors.cyan,
                            checkColor: AppColors.navy950,
                            side: const BorderSide(color: AppColors.slate),
                            onChanged: state.submitting
                                ? null
                                : (value) => setState(
                                    () => _rememberDevice = value ?? false,
                                  ),
                          ),
                          Expanded(
                            child: GestureDetector(
                              onTap: state.submitting
                                  ? null
                                  : () => setState(
                                      () => _rememberDevice = !_rememberDevice,
                                    ),
                              child: const Text(
                                'Remember this device',
                                style: TextStyle(
                                  color: AppColors.ice,
                                  fontSize: 14,
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  Flexible(
                    flex: 2,
                    child: TextButton(
                      style: TextButton.styleFrom(
                        padding: const EdgeInsets.symmetric(horizontal: 6),
                      ),
                      onPressed: state.submitting
                          ? null
                          : () => context.push(AppRoutes.forgotPassword),
                      child: const Text(
                        'Forgot password?',
                        textAlign: TextAlign.end,
                        style: TextStyle(
                          color: AppColors.cyan,
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              GradientButton(
                label: 'Sign in',
                loading: state.submitting,
                onPressed: () => unawaited(_submit()),
              ),
              const SizedBox(height: 22),
              // Accounts are provisioned by invitation. Self-registration
              // would ship behind the bootstrap `selfRegistration` flag.
              Wrap(
                alignment: WrapAlignment.center,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: [
                  const Text(
                    'Invited by your fleet?',
                    style: TextStyle(color: AppColors.slate),
                  ),
                  TextButton(
                    onPressed: state.submitting
                        ? null
                        : () => context.push(AppRoutes.acceptInvitation),
                    child: const Text(
                      'Activate your account',
                      style: TextStyle(
                        color: AppColors.cyan,
                        fontWeight: FontWeight.w700,
                      ),
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

  static String _messageFor(ApiFailure failure) {
    return switch (failure.kind) {
      ApiFailureKind.rateLimited =>
        'Too many sign-in attempts. Wait a few minutes and try again.',
      ApiFailureKind.server || ApiFailureKind.protocol =>
        'Mediane couldn’t sign you in right now. Try again shortly.',
      _ => failure.message,
    };
  }
}

class _SecurityFooter extends StatelessWidget {
  const new();

  @override
  Widget build(BuildContext context) {
    return const Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Icon(Icons.verified_user_outlined, color: AppColors.slate, size: 18),
        SizedBox(width: 8),
        Flexible(
          child: Text(
            'Your session is securely encrypted.',
            textAlign: TextAlign.center,
            style: TextStyle(color: AppColors.slate, fontSize: 13),
          ),
        ),
      ],
    );
  }
}
