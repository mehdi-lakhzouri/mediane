import 'dart:async';

import 'package:driver_health_app/app/router/app_routes.dart';
import 'package:driver_health_app/core/network/api_failure.dart';
import 'package:driver_health_app/core/presentation/widgets/auth_panel_layout.dart';
import 'package:driver_health_app/core/presentation/widgets/gradient_button.dart';
import 'package:driver_health_app/core/presentation/widgets/inline_message.dart';
import 'package:driver_health_app/core/security/secret_screen_guard.dart';
import 'package:driver_health_app/core/session/session_providers.dart';
import 'package:driver_health_app/core/theme/app_colors.dart';
import 'package:driver_health_app/features/security/domain/entities/mfa.dart';
import 'package:driver_health_app/features/security/presentation/controllers/mfa_controllers.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:url_launcher/url_launcher.dart';

/// Screen 17. In [required] mode it is the mandatory onboarding step (no
/// way back, only sign out); otherwise it is opened from Security.
class AuthenticatorSetupScreen extends ConsumerStatefulWidget {
  const new({this.required = false, this.currentCode, super.key});

  final bool required;

  /// A code from the authenticator being replaced, if any.
  final String? currentCode;

  @override
  ConsumerState<AuthenticatorSetupScreen> createState() =>
      _AuthenticatorSetupScreenState();
}

class _AuthenticatorSetupScreenState
    extends ConsumerState<AuthenticatorSetupScreen> {
  bool _showQr = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _start());
  }

  void _start() => unawaited(
    ref
        .read(authenticatorSetupControllerProvider.notifier)
        .start(currentCode: widget.currentCode),
  );

  Future<void> _openAuthenticator(TotpSetup setup) async {
    var opened = false;
    try {
      opened = await launchUrl(
        setup.otpauthUri,
        mode: LaunchMode.externalApplication,
      );
    } on Object {
      // No app registered for otpauth:// links.
    }
    if (!opened && mounted) {
      setState(() => _showQr = true);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'No authenticator app found. Install one, or enter the setup key.',
          ),
        ),
      );
    }
  }

  Future<void> _copyKey(TotpSetup setup) async {
    await Clipboard.setData(ClipboardData(text: setup.secret));
    if (!mounted) return;
    ScaffoldMessenger.of(context)
        .showSnackBar(const SnackBar(content: Text('Setup key copied.')));
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(authenticatorSetupControllerProvider);
    final setup = state.setup;

    return SecretScreenGuard(
      child: AuthPanelLayout(
        onBack: widget.required ? null : () => context.pop(),
        backgroundAlignment: const Alignment(0.3, -0.3),
        footer: widget.required
            ? TextButton(
                onPressed: () =>
                    unawaited(ref.read(sessionManagerProvider).signOut()),
                child: const Text(
                  'Sign out',
                  style: TextStyle(color: AppColors.cyan),
                ),
              )
            : null,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const _SetupProgress(step: 1),
            const SizedBox(height: 16),
            Semantics(
              header: true,
              child: const Text(
                'Set up authenticator',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 30,
                  fontWeight: FontWeight.w900,
                  letterSpacing: -0.6,
                ),
              ),
            ),
            const SizedBox(height: 6),
            const Text(
              'Add CabinGuard to your authenticator app.',
              style: TextStyle(color: AppColors.slate, fontSize: 16),
            ),
            const SizedBox(height: 20),
            if (state.loading || (setup == null && state.failure == null))
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 48),
                child: Center(
                  child: CircularProgressIndicator(
                    color: AppColors.cyan,
                    semanticsLabel: 'Preparing your setup key',
                  ),
                ),
              )
            else if (state.failure case final failure?) ...[
              InlineMessage(message: _messageFor(failure)),
              const SizedBox(height: 16),
              GradientButton(label: 'Try again', onPressed: _start),
            ] else if (setup != null)
              ..._setupContent(setup),
          ],
        ),
      ),
    );
  }

  List<Widget> _setupContent(TotpSetup setup) {
    final next = widget.required
        ? AppRoutes.mfaSetupConfirm
        : AppRoutes.securityAuthenticatorConfirm;
    return [
      _StepCard(
        number: 1,
        title: 'Open your authenticator app',
        children: [
          const Text(
            'On this phone, tap below to add CabinGuard to Google '
            'Authenticator, Microsoft Authenticator, 1Password or a similar '
            'app.',
            style: TextStyle(color: AppColors.ice, height: 1.4),
          ),
          const SizedBox(height: 14),
          GradientButton(
            label: 'Add to authenticator app',
            onPressed: () => unawaited(_openAuthenticator(setup)),
          ),
          const SizedBox(height: 4),
          TextButton(
            onPressed: () => setState(() => _showQr = !_showQr),
            child: Text(
              _showQr
                  ? 'Hide QR code'
                  : 'Authenticator on another device? Show QR code',
              textAlign: TextAlign.center,
              style: const TextStyle(color: AppColors.cyan),
            ),
          ),
          if (_showQr)
            Center(
              child: Semantics(
                label: 'QR code to add CabinGuard to an authenticator app',
                image: true,
                excludeSemantics: true,
                child: Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: QrImageView(
                    data: setup.otpauthUri.toString(),
                    size: 200,
                    padding: EdgeInsets.zero,
                  ),
                ),
              ),
            ),
        ],
      ),
      const SizedBox(height: 12),
      _StepCard(
        number: 2,
        title: 'Or enter this setup key',
        children: [
          Semantics(
            label: 'Setup key: ${setup.secret.split('').join(' ')}',
            excludeSemantics: true,
            child: DecoratedBox(
              decoration: BoxDecoration(
                color: AppColors.navy950.withValues(alpha: 0.5),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(
                  color: AppColors.slate.withValues(alpha: 0.3),
                ),
              ),
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 4, 8),
                child: Row(
                  children: [
                    Expanded(
                      child: SelectableText(
                        setup.groupedSecret,
                        style: const TextStyle(
                          color: Colors.white,
                          fontFamily: 'monospace',
                          fontFamilyFallback: ['Menlo', 'Courier'],
                          fontSize: 18,
                          letterSpacing: 2,
                        ),
                      ),
                    ),
                    IconButton(
                      tooltip: 'Copy setup key',
                      color: AppColors.ice,
                      onPressed: () => unawaited(_copyKey(setup)),
                      icon: const Icon(Icons.copy_rounded),
                    ),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(height: 10),
          _Detail(label: 'Account', value: setup.accountName),
          _Detail(label: 'Issuer', value: setup.issuer),
          _Detail(
            label: 'Type',
            value:
                'Time-based, ${setup.digits} digits, ${setup.algorithm}, '
                '${setup.period} s',
          ),
        ],
      ),
      const SizedBox(height: 12),
      _ExpiryNotice(
        deadline: setup.deadline,
        period: setup.period,
        onExpired: () => ref
            .read(authenticatorSetupControllerProvider.notifier)
            .markExpired(),
      ),
      const SizedBox(height: 18),
      GradientButton(
        label: 'I’ve added the account',
        onPressed: () => unawaited(context.push(next)),
      ),
    ];
  }

  static String _messageFor(ApiFailure failure) {
    if (failure.code == 'MFA_CODE_INVALID') {
      return 'The code from your current authenticator wasn’t accepted. Go '
          'back and try again.';
    }
    return switch (failure.kind) {
      ApiFailureKind.rateLimited =>
        'Too many attempts. Wait a few minutes and try again.',
      ApiFailureKind.server || ApiFailureKind.protocol =>
        'Your setup key couldn’t be created right now. Try again shortly.',
      _ => failure.message,
    };
  }
}

class _SetupProgress extends StatelessWidget {
  const new({required this.step});

  final int step;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: 'Security setup, step $step of 2',
      excludeSemantics: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Security setup · $step of 2',
            style: const TextStyle(color: AppColors.cyan, fontSize: 14),
          ),
          const SizedBox(height: 8),
          ClipRRect(
            borderRadius: BorderRadius.circular(99),
            child: LinearProgressIndicator(
              value: step / 2,
              minHeight: 6,
              color: AppColors.cobalt,
              backgroundColor: AppColors.slate.withValues(alpha: 0.2),
            ),
          ),
        ],
      ),
    );
  }
}

class _StepCard extends StatelessWidget {
  const new({
    required this.number,
    required this.title,
    required this.children,
  });

  final int number;
  final String title;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: AppColors.navy800.withValues(alpha: 0.45),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.cyan.withValues(alpha: 0.2)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                ExcludeSemantics(
                  child: CircleAvatar(
                    radius: 18,
                    backgroundColor: AppColors.cobalt,
                    child: Text(
                      '$number',
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Semantics(
                    header: true,
                    child: Text(
                      title,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 17,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            ...children,
          ],
        ),
      ),
    );
  }
}

class _Detail extends StatelessWidget {
  const new({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Text.rich(
        TextSpan(
          children: [
            TextSpan(
              text: '$label: ',
              style: const TextStyle(color: AppColors.slate),
            ),
            TextSpan(
              text: value,
              style: const TextStyle(color: AppColors.ice),
            ),
          ],
        ),
      ),
    );
  }
}

/// Counts down to the setup expiry and reports it once.
class _ExpiryNotice extends StatefulWidget {
  const new({
    required this.deadline,
    required this.period,
    required this.onExpired,
  });

  final DateTime deadline;
  final int period;
  final VoidCallback onExpired;

  @override
  State<_ExpiryNotice> createState() => _ExpiryNoticeState();
}

class _ExpiryNoticeState extends State<_ExpiryNotice> {
  Timer? _timer;

  Duration get _remaining {
    final remaining = widget.deadline.difference(DateTime.now());
    return remaining.isNegative ? Duration.zero : remaining;
  }

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (_remaining == Duration.zero) {
        _timer?.cancel();
        widget.onExpired();
      }
      setState(() {});
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final remaining = _remaining;
    final minutes = remaining.inMinutes.toString().padLeft(2, '0');
    final seconds = (remaining.inSeconds % 60).toString().padLeft(2, '0');
    return DecoratedBox(
      decoration: BoxDecoration(
        color: AppColors.navy800.withValues(alpha: 0.35),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.slate.withValues(alpha: 0.25)),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        child: Row(
          children: [
            const Icon(Icons.schedule_rounded, color: AppColors.cyan),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                'Codes refresh every ${widget.period} seconds. Finish within '
                '$minutes:$seconds.',
                style: const TextStyle(color: AppColors.slate),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
