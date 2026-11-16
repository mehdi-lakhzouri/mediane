import 'dart:async';

import 'package:driver_health_app/app/router/app_routes.dart';
import 'package:driver_health_app/core/network/api_failure.dart';
import 'package:driver_health_app/core/presentation/widgets/auth_panel_layout.dart';
import 'package:driver_health_app/core/presentation/widgets/cabinguard_text_field.dart';
import 'package:driver_health_app/core/presentation/widgets/gradient_button.dart';
import 'package:driver_health_app/core/presentation/widgets/inline_message.dart';
import 'package:driver_health_app/core/presentation/widgets/otp_code_field.dart';
import 'package:driver_health_app/core/theme/app_colors.dart';
import 'package:driver_health_app/features/auth/domain/entities/mfa_challenge.dart';
import 'package:driver_health_app/features/auth/presentation/controllers/mfa_verification_controller.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

/// Route payload for the second sign-in step. Kept in memory only.
class MfaVerificationArgs {
  const new({required this.challenge, required this.rememberDevice});

  final MfaChallenge challenge;
  final bool rememberDevice;
}

/// Screen 09 in authenticator mode: a six-digit TOTP or a recovery code.
class MfaVerificationScreen extends ConsumerStatefulWidget {
  const new({required this.args, this.clock = DateTime.now, super.key});

  static const codeFieldKey = Key('mfa.code');
  static const recoveryFieldKey = Key('mfa.recovery');

  final MfaVerificationArgs args;
  final DateTime Function() clock;

  @override
  ConsumerState<MfaVerificationScreen> createState() =>
      _MfaVerificationScreenState();
}

class _MfaVerificationScreenState extends ConsumerState<MfaVerificationScreen> {
  static final _recoveryPattern = RegExp(
    r'^[A-Za-z0-9]{5}[\s-]?[A-Za-z0-9]{5}$',
  );

  final _code = TextEditingController();
  final _codeFocus = FocusNode();
  final _recoveryFormKey = GlobalKey<FormState>();
  bool _recoveryMode = false;
  Timer? _ticker;
  late Duration _remaining;

  MfaChallenge get _challenge => widget.args.challenge;

  @override
  void initState() {
    super.initState();
    _remaining = _computeRemaining();
    _ticker = Timer.periodic(const Duration(seconds: 1), (_) => _tick());
    if (_remaining == Duration.zero) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _expire());
    }
  }

  @override
  void dispose() {
    _ticker?.cancel();
    _code.dispose();
    _codeFocus.dispose();
    super.dispose();
  }

  Duration _computeRemaining() {
    final remaining = _challenge.deadline.difference(widget.clock());
    return remaining.isNegative ? Duration.zero : remaining;
  }

  void _tick() {
    final remaining = _computeRemaining();
    setState(() => _remaining = remaining);
    if (remaining == Duration.zero) _expire();
  }

  void _expire() {
    _ticker?.cancel();
    ref.read(mfaVerificationControllerProvider.notifier).markExpired();
  }

  void _toggleMode() {
    _code.clear();
    ref.read(mfaVerificationControllerProvider.notifier).clearFailure();
    setState(() => _recoveryMode = !_recoveryMode);
    _codeFocus.requestFocus();
  }

  Future<void> _submit() async {
    final code = _code.text.trim();
    if (_recoveryMode) {
      if (!(_recoveryFormKey.currentState?.validate() ?? false)) return;
    } else if (code.length != 6) {
      return;
    }

    final verified = await ref
        .read(mfaVerificationControllerProvider.notifier)
        .verify(
          challenge: _challenge,
          code: code,
          rememberDevice: widget.args.rememberDevice,
        );
    if (!mounted) return;
    if (verified) {
      _ticker?.cancel();
      // The router guard moves on from the server's account state.
      return;
    }
    if (!_recoveryMode) _code.clear();
    _codeFocus.requestFocus();
  }

  void _backToLogin() => context.go(AppRoutes.login);

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(mfaVerificationControllerProvider);

    return AuthPanelLayout(
      onBack: _backToLogin,
      backgroundAlignment: const Alignment(-0.6, 0.1),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _Badge(recoveryMode: _recoveryMode),
          const SizedBox(height: 18),
          const Text(
            'TWO-STEP VERIFICATION',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: AppColors.cyan,
              fontSize: 13,
              fontWeight: FontWeight.w700,
              letterSpacing: 3,
            ),
          ),
          const SizedBox(height: 8),
          Semantics(
            header: true,
            child: Text(
              _recoveryMode ? 'Use a recovery code' : 'Enter your code',
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 30,
                fontWeight: FontWeight.w900,
                letterSpacing: -0.6,
              ),
            ),
          ),
          const SizedBox(height: 10),
          Text(
            _recoveryMode
                ? 'Enter one of the recovery codes you saved when you turned '
                      'on two-step verification. Each code works once.'
                : 'Open your authenticator app and enter the six-digit code '
                      'for Mediane.',
            textAlign: TextAlign.center,
            style: const TextStyle(
              color: AppColors.ice,
              fontSize: 15,
              height: 1.4,
            ),
          ),
          const SizedBox(height: 24),
          if (state.challengeExpired)
            ..._expiredContent()
          else
            ..._entryContent(state),
          const SizedBox(height: 22),
          const _SingleUseNotice(),
        ],
      ),
    );
  }

  List<Widget> _entryContent(MfaVerificationState state) {
    final failure = state.failure;
    return [
      if (_recoveryMode)
        Form(
          key: _recoveryFormKey,
          child: CabinGuardTextField(
            key: MfaVerificationScreen.recoveryFieldKey,
            label: 'Recovery code',
            controller: _code,
            focusNode: _codeFocus,
            hintText: 'XXXXX-XXXXX',
            prefixIcon: Icons.key_rounded,
            autocorrect: false,
            enabled: !state.submitting,
            textCapitalization: TextCapitalization.characters,
            textInputAction: TextInputAction.done,
            inputFormatters: [
              FilteringTextInputFormatter.allow(RegExp(r'[A-Za-z0-9\s-]')),
              LengthLimitingTextInputFormatter(11),
            ],
            errorText: state.codeRejected
                ? 'That recovery code isn’t valid or was already used.'
                : null,
            onChanged: (_) => ref
                .read(mfaVerificationControllerProvider.notifier)
                .clearFailure(),
            onFieldSubmitted: (_) => unawaited(_submit()),
            validator: (value) => _recoveryPattern.hasMatch(value?.trim() ?? '')
                ? null
                : 'Recovery codes have 10 letters and numbers.',
          ),
        )
      else
        OtpCodeField(
          key: MfaVerificationScreen.codeFieldKey,
          controller: _code,
          focusNode: _codeFocus,
          autofocus: true,
          enabled: !state.submitting,
          error: state.codeRejected,
          semanticLabel: 'Six-digit verification code',
          onChanged: (_) => ref
              .read(mfaVerificationControllerProvider.notifier)
              .clearFailure(),
          onCompleted: (_) => unawaited(_submit()),
        ),
      const SizedBox(height: 14),
      if (state.codeRejected && !_recoveryMode)
        const _CodeError(message: 'That code is invalid. Try again.')
      else if (failure != null && !state.codeRejected)
        InlineMessage(message: _messageFor(failure)),
      const SizedBox(height: 10),
      Semantics(
        liveRegion: _remaining.inSeconds % 60 == 0,
        child: Text(
          'This sign-in attempt expires in ${_format(_remaining)}',
          textAlign: TextAlign.center,
          style: const TextStyle(color: AppColors.slate, fontSize: 14),
        ),
      ),
      const SizedBox(height: 20),
      GradientButton(
        label: 'Verify code',
        loading: state.submitting,
        onPressed: () => unawaited(_submit()),
      ),
      const SizedBox(height: 12),
      TextButton(
        onPressed: state.submitting ? null : _toggleMode,
        child: Text(
          _recoveryMode ? 'Use your authenticator app' : 'Use a recovery code',
          style: const TextStyle(
            color: AppColors.cyan,
            fontSize: 16,
            fontWeight: FontWeight.w700,
            decoration: TextDecoration.underline,
            decorationColor: AppColors.cyan,
          ),
        ),
      ),
    ];
  }

  List<Widget> _expiredContent() {
    return [
      const InlineMessage(
        icon: Icons.timer_off_outlined,
        message:
            'This sign-in attempt has expired. For your security, sign in '
            'again to get a new verification step.',
      ),
      const SizedBox(height: 20),
      GradientButton(label: 'Sign in again', onPressed: _backToLogin),
    ];
  }

  static String _messageFor(ApiFailure failure) {
    return switch (failure.kind) {
      ApiFailureKind.rateLimited =>
        'Too many verification attempts. Wait a few minutes and try again.',
      ApiFailureKind.server || ApiFailureKind.protocol =>
        'Mediane couldn’t verify your code right now. Try again shortly.',
      _ => failure.message,
    };
  }

  static String _format(Duration value) {
    final minutes = value.inMinutes.toString().padLeft(2, '0');
    final seconds = (value.inSeconds % 60).toString().padLeft(2, '0');
    return '$minutes:$seconds';
  }
}

class _CodeError extends StatelessWidget {
  const new({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      liveRegion: true,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(
            Icons.error_outline_rounded,
            color: AppColors.coral,
            size: 22,
          ),
          const SizedBox(width: 8),
          Flexible(
            child: Text(
              message,
              style: const TextStyle(color: AppColors.coral, fontSize: 15),
            ),
          ),
        ],
      ),
    );
  }
}

class _Badge extends StatelessWidget {
  const new({required this.recoveryMode});

  final bool recoveryMode;

  @override
  Widget build(BuildContext context) {
    return ExcludeSemantics(
      child: Center(
        child: Container(
          width: 96,
          height: 96,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: AppColors.navy950.withValues(alpha: 0.6),
            border: Border.all(color: AppColors.cyan, width: 3),
            boxShadow: [
              BoxShadow(
                color: AppColors.cyan.withValues(alpha: 0.35),
                blurRadius: 24,
              ),
            ],
          ),
          child: Icon(
            recoveryMode ? Icons.key_rounded : Icons.phonelink_lock_rounded,
            color: Colors.white,
            size: 44,
          ),
        ),
      ),
    );
  }
}

class _SingleUseNotice extends StatelessWidget {
  const new();

  @override
  Widget build(BuildContext context) {
    final line = Expanded(
      child: Divider(color: AppColors.slate.withValues(alpha: 0.35)),
    );
    return Column(
      children: [
        Row(
          children: [
            line,
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 12),
              child: Icon(
                Icons.shield_outlined,
                color: AppColors.slate,
                size: 20,
              ),
            ),
            line,
          ],
        ),
        const SizedBox(height: 8),
        const Text(
          'Codes are single-use and securely verified.',
          textAlign: TextAlign.center,
          style: TextStyle(color: AppColors.slate, fontSize: 13),
        ),
      ],
    );
  }
}
