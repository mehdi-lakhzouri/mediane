import 'dart:async';

import 'package:driver_health_app/app/router/app_routes.dart';
import 'package:driver_health_app/core/presentation/widgets/auth_panel_layout.dart';
import 'package:driver_health_app/core/presentation/widgets/gradient_button.dart';
import 'package:driver_health_app/core/presentation/widgets/inline_message.dart';
import 'package:driver_health_app/core/theme/app_colors.dart';
import 'package:driver_health_app/features/password_recovery/presentation/controllers/forgot_password_controller.dart';
import 'package:driver_health_app/features/password_recovery/presentation/widgets/recovery_hero.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

class ResetEmailSentScreen extends ConsumerStatefulWidget {
  const new({required this.email, super.key});

  final String email;

  @override
  ConsumerState<ResetEmailSentScreen> createState() =>
      _ResetEmailSentScreenState();
}

class _ResetEmailSentScreenState extends ConsumerState<ResetEmailSentScreen> {
  static const _cooldown = 60;
  Timer? _timer;
  int _remaining = _cooldown;

  @override
  void initState() {
    super.initState();
    _startCooldown();
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  void _startCooldown() {
    _timer?.cancel();
    setState(() => _remaining = _cooldown);
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) return;
      if (_remaining <= 1) {
        timer.cancel();
        setState(() => _remaining = 0);
      } else {
        setState(() => _remaining--);
      }
    });
  }

  Future<void> _resend() async {
    final sent = await ref
        .read(forgotPasswordControllerProvider.notifier)
        .request(widget.email);
    if (sent && mounted) {
      _startCooldown();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Reset instructions sent again.')),
      );
    }
  }

  Future<void> _openEmail() async {
    var opened = false;
    try {
      opened = await launchUrl(
        Uri(scheme: 'mailto'),
        mode: LaunchMode.externalApplication,
      );
    } on Object {
      // Some devices have no registered email client.
    }
    if (!opened && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('No email app is available on this device.'),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(forgotPasswordControllerProvider);
    return AuthPanelLayout(
      onBack: () => context.go(AppRoutes.forgotPassword),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const RecoveryHero(
            icon: Icons.mail_outline_rounded,
            badge: Icons.check_rounded,
          ),
          const SizedBox(height: 18),
          const _Eyebrow('RESET LINK SENT'),
          const SizedBox(height: 8),
          const Text(
            'Check your inbox',
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
            'If an account matches this email, secure reset instructions are '
            'on the way.',
            textAlign: TextAlign.center,
            style: TextStyle(color: AppColors.ice, fontSize: 16, height: 1.45),
          ),
          const SizedBox(height: 18),
          DecoratedBox(
            decoration: BoxDecoration(
              color: AppColors.navy950.withValues(alpha: 0.38),
              borderRadius: BorderRadius.circular(18),
              border: Border.all(
                color: AppColors.slate.withValues(alpha: 0.35),
              ),
            ),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.mail_outline, color: AppColors.ice),
                  const SizedBox(width: 10),
                  Flexible(
                    child: Text(
                      widget.email,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          if (state.failure case final failure?) ...[
            const SizedBox(height: 16),
            InlineMessage(message: failure.message),
          ],
          const SizedBox(height: 20),
          GradientButton(
            label: 'Open email app',
            onPressed: () => unawaited(_openEmail()),
          ),
          const SizedBox(height: 14),
          OutlinedButton(
            onPressed: _remaining == 0 && !state.submitting
                ? () => unawaited(_resend())
                : null,
            style: OutlinedButton.styleFrom(
              foregroundColor: Colors.white,
              disabledForegroundColor: AppColors.slate,
              minimumSize: const Size.fromHeight(56),
              side: BorderSide(
                color: _remaining == 0 ? AppColors.cyan : AppColors.slate,
              ),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(18),
              ),
            ),
            child: state.submitting
                ? const SizedBox.square(
                    dimension: 22,
                    child: CircularProgressIndicator(strokeWidth: 2.5),
                  )
                : const Text(
                    'Resend instructions',
                    style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800),
                  ),
          ),
          const SizedBox(height: 8),
          Text(
            _remaining == 0
                ? 'You can request another email now.'
                : 'Available again in '
                      '00:${_remaining.toString().padLeft(2, '0')}',
            textAlign: TextAlign.center,
            style: const TextStyle(color: AppColors.slate),
          ),
          TextButton(
            onPressed: state.submitting
                ? null
                : () => context.go(AppRoutes.forgotPassword),
            child: const Text(
              'Use a different email',
              style: TextStyle(
                color: AppColors.cyan,
                fontSize: 16,
                decoration: TextDecoration.underline,
                decorationColor: AppColors.cyan,
              ),
            ),
          ),
          const Divider(color: Color(0x4D9EB3CC), height: 24),
          const Text(
            'For your privacy, we show this confirmation for every request.',
            textAlign: TextAlign.center,
            style: TextStyle(color: AppColors.slate, height: 1.4),
          ),
        ],
      ),
    );
  }
}

class _Eyebrow extends StatelessWidget {
  const new(this.text);

  final String text;

  @override
  Widget build(BuildContext context) => Text(
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
