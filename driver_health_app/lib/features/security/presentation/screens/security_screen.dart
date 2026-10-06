import 'dart:async';

import 'package:driver_health_app/app/router/app_routes.dart';
import 'package:driver_health_app/core/network/api_failure.dart';
import 'package:driver_health_app/core/presentation/widgets/auth_panel_layout.dart';
import 'package:driver_health_app/core/presentation/widgets/gradient_button.dart';
import 'package:driver_health_app/core/presentation/widgets/inline_message.dart';
import 'package:driver_health_app/core/security/biometric_authenticator.dart';
import 'package:driver_health_app/core/security/security_providers.dart';
import 'package:driver_health_app/core/session/auth_state.dart';
import 'package:driver_health_app/core/session/session_providers.dart';
import 'package:driver_health_app/core/state/data_changes.dart';
import 'package:driver_health_app/core/theme/app_colors.dart';
import 'package:driver_health_app/features/auth/presentation/controllers/auth_providers.dart';
import 'package:driver_health_app/features/security/domain/entities/mfa.dart';
import 'package:driver_health_app/features/security/presentation/controllers/mfa_controllers.dart';
import 'package:driver_health_app/features/security/presentation/screens/recovery_codes_screen.dart';
import 'package:driver_health_app/features/security/presentation/widgets/mfa_code_sheet.dart';
import 'package:driver_health_app/features/startup/presentation/controllers/startup_controller.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

/// Two-step verification, biometric unlock, and device sessions.
class SecurityScreen extends ConsumerWidget {
  const new({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final status = ref.watch(mfaStatusProvider);
    final biometricFeature =
        ref
            .watch(startupControllerProvider)
            .value
            ?.bootstrap
            .features
            .biometricUnlock ??
        true;

    return AuthPanelLayout(
      onBack: () =>
          context.canPop() ? context.pop() : context.go(AppRoutes.home),
      backgroundAlignment: const Alignment(0.2, -0.3),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Semantics(
            header: true,
            child: const Text(
              'Security',
              style: TextStyle(
                color: Colors.white,
                fontSize: 32,
                fontWeight: FontWeight.w900,
              ),
            ),
          ),
          const SizedBox(height: 6),
          const Text(
            'Protect your account and this device.',
            style: TextStyle(color: AppColors.slate, fontSize: 16),
          ),
          const SizedBox(height: 20),
          switch (status) {
            AsyncData(:final value) => _MfaSection(status: value),
            AsyncError(:final error) => Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                InlineMessage(message: ApiFailure.from(error).message),
                TextButton(
                  onPressed: () => ref.invalidate(mfaStatusProvider),
                  child: const Text(
                    'Try again',
                    style: TextStyle(color: AppColors.cyan),
                  ),
                ),
              ],
            ),
            _ => const Padding(
              padding: EdgeInsets.symmetric(vertical: 32),
              child: Center(
                child: CircularProgressIndicator(
                  color: AppColors.cyan,
                  semanticsLabel: 'Loading security settings',
                ),
              ),
            ),
          },
          if (biometricFeature) ...[
            const SizedBox(height: 14),
            const _BiometricSection(),
          ],
          const SizedBox(height: 14),
          const _SessionsSection(),
        ],
      ),
    );
  }
}

class _Section extends StatelessWidget {
  const new({
    required this.icon,
    required this.title,
    required this.children,
    this.trailing,
  });

  final IconData icon;
  final String title;
  final Widget? trailing;
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
                Icon(icon, color: AppColors.cyan),
                const SizedBox(width: 12),
                Expanded(
                  child: Semantics(
                    header: true,
                    child: Text(
                      title,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                ),
                ?trailing,
              ],
            ),
            const SizedBox(height: 10),
            ...children,
          ],
        ),
      ),
    );
  }
}

class _StatusChip extends StatelessWidget {
  const new({required this.on});

  final bool on;

  @override
  Widget build(BuildContext context) {
    final color = on ? AppColors.mint : AppColors.slate;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(99),
        border: Border.all(color: color),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
        child: Text(
          on ? 'On' : 'Off',
          style: TextStyle(color: color, fontWeight: FontWeight.w700),
        ),
      ),
    );
  }
}

class _MfaSection extends ConsumerWidget {
  const new({required this.status});

  final MfaStatus status;

  Future<void> _replace(BuildContext context) async {
    final code = await showMfaCodeSheet<String>(
      context,
      title: 'Replace authenticator',
      message:
          'Enter a code from your current authenticator, or a recovery code. '
          'The current one keeps working until the new one is confirmed.',
      actionLabel: 'Continue',
      onSubmit: (code) async => code,
    );
    if (code != null && context.mounted) {
      unawaited(context.push(AppRoutes.securityAuthenticator, extra: code));
    }
  }

  Future<void> _regenerate(BuildContext context, WidgetRef ref) async {
    final codes = await showMfaCodeSheet<RecoveryCodes>(
      context,
      title: 'New recovery codes',
      message:
          'Your current recovery codes stop working as soon as new ones are '
          'created. Enter a code to continue.',
      actionLabel: 'Create new codes',
      onSubmit: (code) =>
          ref.read(mfaRepositoryProvider).regenerateRecoveryCodes(code),
    );
    if (codes != null && context.mounted) {
      context.go(
        AppRoutes.securityRecoveryCodes,
        extra: RecoveryCodesArgs(codes: codes, afterEnrollment: false),
      );
    }
  }

  Future<void> _disable(BuildContext context, WidgetRef ref) async {
    final disabled = await showMfaCodeSheet<MfaStatus>(
      context,
      title: 'Turn off two-step verification?',
      message:
          'Signing in will only need your password. Your authenticator and '
          'recovery codes stop working.',
      actionLabel: 'Turn off',
      destructive: true,
      onSubmit: (code) => ref.read(mfaRepositoryProvider).disable(code),
    );
    if (disabled != null) {
      ref.invalidate(mfaStatusProvider);
      ref.read(dataChangesProvider.notifier).markChanged();
    }
  }

  static String _description(MfaStatus status) {
    if (!status.enabled) {
      return 'Add a second step to sign-in with an authenticator app. '
          'Recommended for every driver.';
    }
    final enabledAt = status.enabledAt;
    final since = enabledAt == null
        ? ''
        : ' (on since ${DateFormat.yMMMd().format(enabledAt.toLocal())})';
    return 'A code from your authenticator is needed when you sign in$since.';
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return _Section(
      icon: Icons.phonelink_lock_rounded,
      title: 'Two-step verification',
      trailing: _StatusChip(on: status.enabled),
      children: [
        Text(
          _description(status),
          style: const TextStyle(color: AppColors.ice, height: 1.4),
        ),
        if (status.enabled) ...[
          const SizedBox(height: 10),
          Text(
            '${status.recoveryCodesRemaining} recovery '
            '${status.recoveryCodesRemaining == 1 ? 'code' : 'codes'} left',
            style: TextStyle(
              color: status.recoveryCodesLow
                  ? const Color(0xFFFFC857)
                  : AppColors.slate,
              fontWeight: FontWeight.w600,
            ),
          ),
          if (status.recoveryCodesLow) ...[
            const SizedBox(height: 8),
            const InlineMessage(
              message:
                  'You’re running low on recovery codes. Create new ones so '
                  'you can still sign in if you lose your phone.',
            ),
          ],
          const SizedBox(height: 12),
          _ActionRow(
            icon: Icons.key_rounded,
            label: 'Create new recovery codes',
            onTap: () => unawaited(_regenerate(context, ref)),
          ),
          _ActionRow(
            icon: Icons.swap_horiz_rounded,
            label: 'Replace authenticator',
            onTap: () => unawaited(_replace(context)),
          ),
          if (!status.required)
            _ActionRow(
              icon: Icons.no_encryption_gmailerrorred_outlined,
              label: 'Turn off two-step verification',
              destructive: true,
              onTap: () => unawaited(_disable(context, ref)),
            ),
        ] else ...[
          const SizedBox(height: 14),
          GradientButton(
            label: 'Set up authenticator',
            onPressed: () =>
                unawaited(context.push(AppRoutes.securityAuthenticator)),
          ),
        ],
      ],
    );
  }
}

class _BiometricSection extends ConsumerStatefulWidget {
  const new();

  @override
  ConsumerState<_BiometricSection> createState() => _BiometricSectionState();
}

class _BiometricSectionState extends ConsumerState<_BiometricSection> {
  late final Future<bool> _available = ref.read(appLockProvider).isAvailable();
  bool _busy = false;
  String? _problem;

  Future<void> _toggle({required bool enabled}) async {
    setState(() {
      _busy = true;
      _problem = null;
    });
    final result = await ref.read(appLockProvider).setEnabled(enabled: enabled);
    if (!mounted) return;
    setState(() {
      _busy = false;
      _problem = switch (result) {
        BiometricResult.success || BiometricResult.cancelled => null,
        BiometricResult.lockedOut =>
          'Biometrics are locked after too many attempts. Unlock your phone '
              'with its passcode, then try again.',
        BiometricResult.unavailable =>
          'Biometric unlock isn’t available on this device.',
      };
    });
  }

  @override
  Widget build(BuildContext context) {
    final lock = ref.watch(appLockProvider);
    return ListenableBuilder(
      listenable: lock,
      builder: (context, _) => FutureBuilder<bool>(
        future: _available,
        builder: (context, snapshot) {
          final available = snapshot.data ?? false;
          return _Section(
            icon: Icons.fingerprint_rounded,
            title: 'Biometric unlock',
            trailing: Switch(
              value: lock.enabled,
              activeThumbColor: AppColors.cyan,
              onChanged: available && !_busy
                  ? (value) => unawaited(_toggle(enabled: value))
                  : null,
            ),
            children: [
              Text(
                available
                    ? 'Use Face ID, fingerprint or your device passcode to '
                          'open CabinGuard when your session is saved on this '
                          'phone. Your password is still needed to sign in.'
                    : 'Set up Face ID or a fingerprint on this phone to use '
                          'biometric unlock.',
                style: const TextStyle(color: AppColors.ice, height: 1.4),
              ),
              if (_problem case final problem?) ...[
                const SizedBox(height: 10),
                InlineMessage(message: problem),
              ],
            ],
          );
        },
      ),
    );
  }
}

class _SessionsSection extends ConsumerStatefulWidget {
  const new();

  @override
  ConsumerState<_SessionsSection> createState() => _SessionsSectionState();
}

class _SessionsSectionState extends ConsumerState<_SessionsSection> {
  bool _busy = false;

  Future<void> _signOutEverywhere() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: AppColors.navy900,
        title: const Text('Sign out of all devices?'),
        content: const Text(
          'Every phone and browser signed in to your account will need to '
          'sign in again, including this one.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text(
              'Sign out everywhere',
              style: TextStyle(color: AppColors.coral),
            ),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    setState(() => _busy = true);
    try {
      await ref.read(authRepositoryProvider).logoutAllDevices();
      await ref
          .read(sessionManagerProvider)
          .endSession(reason: SignOutReason.userInitiated);
    } on Object catch (error) {
      if (!mounted) return;
      setState(() => _busy = false);
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(ApiFailure.from(error).message)));
    }
  }

  @override
  Widget build(BuildContext context) {
    return _Section(
      icon: Icons.devices_rounded,
      title: 'Sessions',
      children: [
        _ActionRow(
          icon: Icons.devices_rounded,
          label: 'Active devices',
          onTap: () => unawaited(context.push(AppRoutes.securityDevices)),
        ),
        _ActionRow(
          icon: Icons.logout_rounded,
          label: 'Sign out of this device',
          onTap: _busy
              ? null
              : () => unawaited(ref.read(sessionManagerProvider).signOut()),
        ),
        _ActionRow(
          icon: Icons.phonelink_erase_rounded,
          label: 'Sign out of all devices',
          destructive: true,
          onTap: _busy ? null : () => unawaited(_signOutEverywhere()),
        ),
      ],
    );
  }
}

class _ActionRow extends StatelessWidget {
  const new({
    required this.icon,
    required this.label,
    required this.onTap,
    this.destructive = false,
  });

  final IconData icon;
  final String label;
  final VoidCallback? onTap;
  final bool destructive;

  @override
  Widget build(BuildContext context) {
    final color = destructive ? AppColors.coral : AppColors.ice;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 48),
        child: Row(
          children: [
            Icon(icon, color: color, size: 22),
            const SizedBox(width: 12),
            Expanded(
              child: Text(label, style: TextStyle(color: color, fontSize: 16)),
            ),
            Icon(
              Icons.chevron_right_rounded,
              color: color.withValues(alpha: 0.7),
            ),
          ],
        ),
      ),
    );
  }
}
