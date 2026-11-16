import 'dart:async';

import 'package:driver_health_app/core/presentation/widgets/auth_panel_layout.dart';
import 'package:driver_health_app/core/presentation/widgets/gradient_button.dart';
import 'package:driver_health_app/core/presentation/widgets/inline_message.dart';
import 'package:driver_health_app/core/security/biometric_authenticator.dart';
import 'package:driver_health_app/core/security/security_providers.dart';
import 'package:driver_health_app/core/session/session_providers.dart';
import 'package:driver_health_app/core/theme/app_colors.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Shown while a saved session waits for biometric unlock. Unlocking only
/// opens the session already on this phone; the router guard moves on.
class UnlockScreen extends ConsumerStatefulWidget {
  const new({super.key});

  @override
  ConsumerState<UnlockScreen> createState() => _UnlockScreenState();
}

class _UnlockScreenState extends ConsumerState<UnlockScreen> {
  bool _busy = false;
  String? _problem;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => unawaited(_unlock()));
  }

  Future<void> _unlock() async {
    if (_busy) return;
    setState(() {
      _busy = true;
      _problem = null;
    });
    final result = await ref.read(appLockProvider).unlock();
    if (!mounted) return;
    setState(() {
      _busy = false;
      _problem = switch (result) {
        BiometricResult.success || BiometricResult.cancelled => null,
        BiometricResult.lockedOut =>
          'Too many attempts. Unlock your phone with its passcode, then try '
              'again, or sign in with your password.',
        BiometricResult.unavailable =>
          'Biometric unlock isn’t available right now. Sign in with your '
              'password instead.',
      };
    });
  }

  @override
  Widget build(BuildContext context) {
    return AuthPanelLayout(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Center(
            child: Icon(
              Icons.fingerprint_rounded,
              color: AppColors.cyan,
              size: 72,
            ),
          ),
          const SizedBox(height: 16),
          Semantics(
            header: true,
            child: const Text(
              'Unlock Mediane',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: Colors.white,
                fontSize: 30,
                fontWeight: FontWeight.w900,
              ),
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            'Confirm it’s you to open your saved session.',
            textAlign: TextAlign.center,
            style: TextStyle(color: AppColors.ice, fontSize: 16),
          ),
          if (_problem case final problem?) ...[
            const SizedBox(height: 18),
            InlineMessage(message: problem),
          ],
          const SizedBox(height: 24),
          GradientButton(
            label: 'Unlock',
            loading: _busy,
            onPressed: () => unawaited(_unlock()),
          ),
          const SizedBox(height: 8),
          TextButton(
            onPressed: _busy
                ? null
                : () => unawaited(ref.read(sessionManagerProvider).signOut()),
            child: const Text(
              'Sign in with your password instead',
              style: TextStyle(color: AppColors.cyan),
            ),
          ),
        ],
      ),
    );
  }
}
