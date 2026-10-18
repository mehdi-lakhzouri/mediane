import 'dart:async';

import 'package:driver_health_app/app/router/app_routes.dart';
import 'package:driver_health_app/core/navigation/link_token.dart';
import 'package:driver_health_app/core/network/api_failure.dart';
import 'package:driver_health_app/core/presentation/widgets/auth_panel_layout.dart';
import 'package:driver_health_app/core/presentation/widgets/cabinguard_text_field.dart';
import 'package:driver_health_app/core/presentation/widgets/gradient_button.dart';
import 'package:driver_health_app/core/presentation/widgets/inline_message.dart';
import 'package:driver_health_app/core/theme/app_colors.dart';
import 'package:driver_health_app/features/account_activation/presentation/controllers/account_activation_controller.dart';
import 'package:driver_health_app/features/password_recovery/presentation/widgets/recovery_hero.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

/// Screen 04, adapted to invitation-only provisioning: an administrator
/// creates the driver, and this screen accepts the emailed invitation.
/// Activation needs an explicit tap so opening a link never consumes it.
class ActivateAccountScreen extends ConsumerStatefulWidget {
  const new({this.token = '', super.key});

  static const linkFieldKey = Key('activate.link');

  /// Token from a deep link; empty when opened from the sign-in screen.
  final String token;

  @override
  ConsumerState<ActivateAccountScreen> createState() =>
      _ActivateAccountScreenState();
}

class _ActivateAccountScreenState extends ConsumerState<ActivateAccountScreen> {
  final _formKey = GlobalKey<FormState>();
  final _link = TextEditingController();

  bool get _fromLink => widget.token.isNotEmpty;

  @override
  void dispose() {
    _link.dispose();
    super.dispose();
  }

  Future<void> _activate() async {
    final String token;
    if (_fromLink) {
      token = widget.token;
    } else {
      if (!(_formKey.currentState?.validate() ?? false)) return;
      token = tokenFromPastedText(_link.text);
    }
    FocusScope.of(context).unfocus();
    await ref
        .read(accountActivationControllerProvider.notifier)
        .activate(token);
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(accountActivationControllerProvider);
    return AuthPanelLayout(
      onBack: () => context.go(AppRoutes.login),
      backgroundAlignment: const Alignment(-0.45, -0.2),
      child: state.activated ? const _Activated() : _buildRequest(state),
    );
  }

  Widget _buildRequest(AccountActivationState state) {
    return Form(
      key: _formKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const RecoveryHero(icon: Icons.how_to_reg_outlined),
          const SizedBox(height: 18),
          const _Eyebrow('INVITED DRIVER'),
          const SizedBox(height: 8),
          Semantics(
            header: true,
            child: const Text(
              'Activate your account',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: Colors.white,
                fontSize: 30,
                fontWeight: FontWeight.w900,
                letterSpacing: -0.6,
              ),
            ),
          ),
          const SizedBox(height: 10),
          Text(
            _fromLink
                ? 'Your fleet administrator invited you to CabinGuard. '
                      'Activate your account, then sign in with the temporary '
                      'password from your invitation email.'
                : 'Open your invitation email on this phone and tap the '
                      'activation link, or paste the link below.',
            textAlign: TextAlign.center,
            style: const TextStyle(
              color: AppColors.ice,
              fontSize: 16,
              height: 1.45,
            ),
          ),
          const SizedBox(height: 22),
          if (state.failure case final failure?) ...[
            InlineMessage(message: _messageFor(failure)),
            const SizedBox(height: 18),
          ],
          if (!_fromLink) ...[
            CabinGuardTextField(
              key: ActivateAccountScreen.linkFieldKey,
              label: 'Invitation link',
              controller: _link,
              hintText:
                  'https://app.vunlera.tn/mobile/accept-invitation#token=…',
              prefixIcon: Icons.link_rounded,
              keyboardType: TextInputType.url,
              textInputAction: TextInputAction.done,
              autocorrect: false,
              enabled: !state.submitting,
              onChanged: (_) => ref
                  .read(accountActivationControllerProvider.notifier)
                  .clearFailure(),
              onFieldSubmitted: (_) => unawaited(_activate()),
              validator: (value) => tokenFromPastedText(value ?? '').isEmpty
                  ? 'Paste the full link from your invitation email.'
                  : null,
            ),
            const SizedBox(height: 22),
          ],
          GradientButton(
            label: 'Activate account',
            loading: state.submitting,
            onPressed: () => unawaited(_activate()),
          ),
          const SizedBox(height: 10),
          TextButton(
            onPressed: state.submitting
                ? null
                : () => context.go(AppRoutes.login),
            child: const Text(
              'Already activated? Sign in',
              style: TextStyle(
                color: AppColors.cyan,
                fontSize: 16,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          const Divider(color: Color(0x4D9EB3CC), height: 28),
          const Text(
            'CabinGuard accounts are created by your fleet administrator. '
            'Invitation links work once and expire.',
            textAlign: TextAlign.center,
            style: TextStyle(color: AppColors.slate, height: 1.4),
          ),
        ],
      ),
    );
  }

  static String _messageFor(ApiFailure failure) {
    if (failure.code == 'INVITATION_INVALID') {
      return 'This invitation link is invalid, already used, or expired. Ask '
          'your fleet administrator to send a new invitation.';
    }
    return switch (failure.kind) {
      ApiFailureKind.rateLimited =>
        'Too many attempts. Wait a few minutes and try again.',
      ApiFailureKind.server || ApiFailureKind.protocol =>
        'Your account couldn’t be activated right now. Try again shortly.',
      _ => failure.message,
    };
  }
}

class _Activated extends StatelessWidget {
  const new();

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const RecoveryHero(
          icon: Icons.verified_user_outlined,
          badge: Icons.check_rounded,
        ),
        const SizedBox(height: 18),
        const _Eyebrow('ACCOUNT ACTIVATED', color: AppColors.mint),
        const SizedBox(height: 8),
        Semantics(
          header: true,
          liveRegion: true,
          child: const Text(
            'You’re all set',
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
          'Sign in with the temporary password from your invitation email. '
          'You’ll choose your own password right after.',
          textAlign: TextAlign.center,
          style: TextStyle(color: AppColors.ice, fontSize: 16, height: 1.45),
        ),
        const SizedBox(height: 24),
        GradientButton(
          label: 'Continue to sign in',
          onPressed: () => context.go(AppRoutes.login),
        ),
      ],
    );
  }
}

class _Eyebrow extends StatelessWidget {
  const new(this.text, {this.color = AppColors.cyan});

  final String text;
  final Color color;

  @override
  Widget build(BuildContext context) => Text(
    text,
    textAlign: TextAlign.center,
    style: TextStyle(
      color: color,
      fontSize: 13,
      fontWeight: FontWeight.w800,
      letterSpacing: 3,
    ),
  );
}
