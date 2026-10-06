import 'dart:async';

import 'package:driver_health_app/app/router/app_routes.dart';
import 'package:driver_health_app/core/presentation/widgets/auth_panel_layout.dart';
import 'package:driver_health_app/core/presentation/widgets/gradient_button.dart';
import 'package:driver_health_app/core/theme/app_colors.dart';
import 'package:driver_health_app/features/password_recovery/presentation/widgets/recovery_hero.dart';
import 'package:driver_health_app/features/startup/presentation/controllers/startup_controller.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

class ResetPasswordSuccessScreen extends ConsumerWidget {
  const new({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final supportUrl = ref
        .watch(startupControllerProvider)
        .value
        ?.bootstrap
        .supportUrl;
    return AuthPanelLayout(
      backgroundAlignment: const Alignment(0, -0.15),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const RecoveryHero(
            icon: Icons.verified_user_outlined,
            badge: Icons.check_rounded,
          ),
          const SizedBox(height: 18),
          const Text(
            'PASSWORD UPDATED',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: AppColors.mint,
              fontSize: 13,
              fontWeight: FontWeight.w800,
              letterSpacing: 3,
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            'You’re ready to sign in',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: Colors.white,
              fontSize: 31,
              fontWeight: FontWeight.w900,
              letterSpacing: -0.7,
            ),
          ),
          const SizedBox(height: 12),
          const Text(
            'Your new password is active and all previous sessions have been '
            'securely signed out.',
            textAlign: TextAlign.center,
            style: TextStyle(color: AppColors.ice, fontSize: 16, height: 1.45),
          ),
          const SizedBox(height: 22),
          DecoratedBox(
            decoration: BoxDecoration(
              color: AppColors.navy950.withValues(alpha: 0.35),
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: AppColors.cyan.withValues(alpha: 0.45)),
            ),
            child: const Padding(
              padding: EdgeInsets.symmetric(horizontal: 16, vertical: 15),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.shield_outlined, color: AppColors.cyan),
                  SizedBox(width: 10),
                  Flexible(
                    child: Text(
                      'Your account is protected',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 22),
          GradientButton(
            label: 'Return to login',
            onPressed: () => context.go(AppRoutes.login),
          ),
          if (supportUrl != null) ...[
            const SizedBox(height: 10),
            TextButton(
              onPressed: () => unawaited(_openSupport(context, supportUrl)),
              child: const Text(
                'Need help? Contact support',
                style: TextStyle(
                  color: AppColors.cyan,
                  decoration: TextDecoration.underline,
                  decorationColor: AppColors.cyan,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Future<void> _openSupport(BuildContext context, Uri supportUrl) async {
    var opened = false;
    try {
      opened = await launchUrl(
        supportUrl,
        mode: LaunchMode.externalApplication,
      );
    } on Object {
      // The fallback below gives the user a useful result.
    }
    if (!opened && context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Support could not be opened.')),
      );
    }
  }
}
