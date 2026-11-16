import 'dart:async';
import 'dart:io';

import 'package:driver_health_app/app/router/app_routes.dart';
import 'package:driver_health_app/core/presentation/widgets/auth_panel_layout.dart';
import 'package:driver_health_app/core/presentation/widgets/gradient_button.dart';
import 'package:driver_health_app/core/security/secret_screen_guard.dart';
import 'package:driver_health_app/core/session/session_providers.dart';
import 'package:driver_health_app/core/state/data_changes.dart';
import 'package:driver_health_app/core/theme/app_colors.dart';
import 'package:driver_health_app/features/security/domain/entities/mfa.dart';
import 'package:driver_health_app/features/security/presentation/controllers/mfa_controllers.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

/// Route payload. Recovery codes travel in memory only.
class RecoveryCodesArgs {
  const new({
    required this.codes,
    required this.afterEnrollment,
    this.required = false,
  });

  final RecoveryCodes codes;

  /// Shown as step 2 of the security setup rather than a regeneration.
  final bool afterEnrollment;

  /// Mandatory MFA onboarding: finishing moves to the next account step.
  final bool required;
}

/// Screen 18. The codes are shown once: they are never stored or logged,
/// hidden from screenshots and the app switcher, and the user must confirm
/// they saved them.
class RecoveryCodesScreen extends ConsumerStatefulWidget {
  const new({required this.args, super.key});

  final RecoveryCodesArgs args;

  @override
  ConsumerState<RecoveryCodesScreen> createState() =>
      _RecoveryCodesScreenState();
}

class _RecoveryCodesScreenState extends ConsumerState<RecoveryCodesScreen> {
  bool _saved = false;

  List<String> get _codes => widget.args.codes.codes;

  String get _asText => [
    'Mediane recovery codes',
    'Each code works once. Keep them somewhere safe.',
    '',
    ..._codes,
  ].join('\n');

  Future<void> _copy() async {
    await Clipboard.setData(ClipboardData(text: _codes.join('\n')));
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text(
          'Codes copied. Paste them into your password manager, then copy '
          'something else to clear your clipboard.',
        ),
      ),
    );
  }

  Future<void> _saveFile() async {
    final directory = await getTemporaryDirectory();
    final file = File('${directory.path}/mediane-recovery-codes.txt');
    try {
      await file.writeAsString(_asText, flush: true);
      await SharePlus.instance.share(
        ShareParams(
          files: [XFile(file.path, mimeType: 'text/plain')],
          subject: 'Mediane recovery codes',
        ),
      );
    } finally {
      // The share sheet has its own copy; never leave the codes on disk.
      if (file.existsSync()) await file.delete();
    }
  }

  void _finish() {
    if (widget.args.required) {
      ref
          .read(sessionManagerProvider)
          .syncAccountState(widget.args.codes.accountState);
      return;
    }
    ref.invalidate(mfaStatusProvider);
    ref.read(dataChangesProvider.notifier).markChanged();
    context.go(AppRoutes.security);
  }

  Future<bool> _confirmLeave() async {
    final leave = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: AppColors.navy900,
        title: const Text('Leave without saving?'),
        content: const Text(
          'These codes won’t be shown again. Without them you could lose '
          'access if you lose your phone.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Stay'),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text(
              'Leave',
              style: TextStyle(color: AppColors.coral),
            ),
          ),
        ],
      ),
    );
    return leave ?? false;
  }

  @override
  Widget build(BuildContext context) {
    final half = (_codes.length / 2).ceil();
    return PopScope(
      canPop: _saved,
      onPopInvokedWithResult: (didPop, _) async {
        if (didPop) return;
        if (await _confirmLeave() && context.mounted) _finish();
      },
      child: SecretScreenGuard(
        child: AuthPanelLayout(
          backgroundAlignment: const Alignment(-0.2, 0.3),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                widget.args.afterEnrollment
                    ? 'Security setup · 2 of 2'
                    : 'New recovery codes',
                textAlign: TextAlign.center,
                style: const TextStyle(color: AppColors.slate),
              ),
              const SizedBox(height: 14),
              const Center(
                child: Icon(
                  Icons.verified_user_outlined,
                  color: AppColors.mint,
                  size: 56,
                ),
              ),
              const SizedBox(height: 12),
              Semantics(
                header: true,
                child: const Text(
                  'Save your recovery codes',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 28,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'Use one if you lose access to your authenticator. Each code '
                'works once.',
                textAlign: TextAlign.center,
                style: TextStyle(color: AppColors.slate, height: 1.4),
              ),
              const SizedBox(height: 16),
              DecoratedBox(
                decoration: BoxDecoration(
                  color: const Color(0x26FFC857),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: const Color(0x80FFC857)),
                ),
                child: const Padding(
                  padding: EdgeInsets.all(12),
                  child: Row(
                    children: [
                      Icon(
                        Icons.error_outline_rounded,
                        color: Color(0xFFFFC857),
                      ),
                      SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          'These codes are shown only once.',
                          style: TextStyle(color: Color(0xFFFFE3A3)),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 14),
              Semantics(
                label: 'Recovery codes: ${_codes.join(', ')}',
                excludeSemantics: true,
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    color: AppColors.navy950.withValues(alpha: 0.5),
                    borderRadius: BorderRadius.circular(18),
                    border: Border.all(
                      color: AppColors.slate.withValues(alpha: 0.3),
                    ),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    child: Row(
                      children: [
                        Expanded(child: _CodeColumn(_codes.take(half))),
                        SizedBox(
                          height: half * 30,
                          child: VerticalDivider(
                            color: AppColors.slate.withValues(alpha: 0.3),
                          ),
                        ),
                        Expanded(child: _CodeColumn(_codes.skip(half))),
                      ],
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: _ActionButton(
                      icon: Icons.copy_rounded,
                      label: 'Copy codes',
                      onPressed: () => unawaited(_copy()),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _ActionButton(
                      icon: Icons.download_rounded,
                      label: 'Save as file',
                      onPressed: () => unawaited(_saveFile()),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              MergeSemantics(
                child: Row(
                  children: [
                    Checkbox(
                      value: _saved,
                      activeColor: AppColors.cobalt,
                      side: const BorderSide(color: AppColors.slate),
                      onChanged: (value) =>
                          setState(() => _saved = value ?? false),
                    ),
                    Expanded(
                      child: GestureDetector(
                        onTap: () => setState(() => _saved = !_saved),
                        child: const Text(
                          'I saved these codes somewhere safe',
                          style: TextStyle(color: AppColors.ice),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 14),
              GradientButton(
                label: widget.args.afterEnrollment
                    ? 'Finish security setup'
                    : 'Done',
                onPressed: _saved ? _finish : null,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _CodeColumn extends StatelessWidget {
  const new(this.codes);

  final Iterable<String> codes;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        for (final code in codes)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 4),
            child: FittedBox(
              fit: BoxFit.scaleDown,
              child: Text(
                code,
                style: const TextStyle(
                  color: Colors.white,
                  fontFamily: 'monospace',
                  fontFamilyFallback: ['Menlo', 'Courier'],
                  fontSize: 17,
                  letterSpacing: 1.5,
                ),
              ),
            ),
          ),
      ],
    );
  }
}

class _ActionButton extends StatelessWidget {
  const new({required this.icon, required this.label, required this.onPressed});

  final IconData icon;
  final String label;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return OutlinedButton.icon(
      onPressed: onPressed,
      icon: Icon(icon),
      label: Text(label, maxLines: 1, overflow: TextOverflow.ellipsis),
      style: OutlinedButton.styleFrom(
        foregroundColor: Colors.white,
        backgroundColor: AppColors.navy950.withValues(alpha: 0.35),
        minimumSize: const Size.fromHeight(54),
        side: BorderSide(color: AppColors.slate.withValues(alpha: 0.4)),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        textStyle: Theme.of(context).textTheme.labelLarge
            ?.copyWith(fontSize: 15, fontWeight: FontWeight.w700),
      ),
    );
  }
}
