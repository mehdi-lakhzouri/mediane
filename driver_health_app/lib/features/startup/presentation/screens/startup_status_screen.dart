import 'dart:async';

import 'package:driver_health_app/core/presentation/motion/entrance.dart';
import 'package:driver_health_app/core/presentation/widgets/cabinguard_background.dart';
import 'package:driver_health_app/core/presentation/widgets/cabinguard_brand.dart';
import 'package:driver_health_app/core/presentation/widgets/glass_panel.dart';
import 'package:driver_health_app/core/presentation/widgets/gradient_button.dart';
import 'package:driver_health_app/core/theme/app_colors.dart';
import 'package:driver_health_app/features/startup/domain/entities/startup_decision.dart';
import 'package:driver_health_app/features/startup/presentation/controllers/startup_controller.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class StartupStatusScreen extends ConsumerWidget {
  const new({required this.destination, super.key});

  final StartupDestination destination;

  Future<void> _retry(BuildContext context, WidgetRef ref) async {
    final retry = ref.read(startupControllerProvider.notifier).retry();
    context.go('/');
    await retry;
  }

  void _act(BuildContext context, WidgetRef ref) {
    if (destination == StartupDestination.sessionEnded) {
      context.goNamed(StartupDestination.login.name);
      return;
    }
    unawaited(_retry(context, ref));
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final bootstrap = ref.watch(startupControllerProvider).value?.bootstrap;
    final content = switch (destination) {
      StartupDestination.maintenance => (
        icon: Icons.construction_rounded,
        title: 'A quick safety update',
        message:
            bootstrap?.maintenanceMessage ??
            'Mediane is receiving an update. Please try again shortly.',
        action: 'Check again',
      ),
      StartupDestination.mandatoryUpdate => (
        icon: Icons.system_update_alt_rounded,
        title: 'Update Mediane',
        message:
            'Version ${bootstrap?.minimumSupportedVersion ?? ''} or newer is '
            'required to keep safety features working correctly.',
        action: 'Check again',
      ),
      StartupDestination.unavailable => (
        icon: Icons.cloud_sync_rounded,
        title: 'We’ll be right back',
        message:
            'Mediane can’t reach its secure services right now. Your '
            'account and safety settings are unchanged.',
        action: 'Try again',
      ),
      StartupDestination.sessionEnded => (
        icon: Icons.lock_clock_outlined,
        title: 'Please sign in again',
        message:
            'For your security, your previous session has ended. Sign in to '
            'continue protecting your journeys.',
        action: 'Sign in',
      ),
      _ => (
        icon: Icons.cloud_off_rounded,
        title: 'You’re offline',
        message:
            'Reconnect to the internet so Mediane can verify your safety '
            'settings and secure session.',
        action: 'Try again',
      ),
    };

    return Scaffold(
      body: CabinGuardBackground(
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 480),
                child: EntranceScope(
                  child: Column(
                    children: [
                      const Entrance(
                        rise: 0,
                        child: CabinGuardBrand(compact: true),
                      ),
                      const SizedBox(height: 64),
                      Entrance(
                        index: 2,
                        rise: 32,
                        child: GlassPanel(
                          child: Column(
                            children: [
                              Container(
                                width: 78,
                                height: 78,
                                decoration: BoxDecoration(
                                  color: AppColors.cobalt.withValues(
                                    alpha: 0.2,
                                  ),
                                  shape: BoxShape.circle,
                                  border: Border.all(
                                    color: AppColors.cyan.withValues(
                                      alpha: 0.45,
                                    ),
                                  ),
                                ),
                                child: Icon(
                                  content.icon,
                                  size: 38,
                                  color: AppColors.cyan,
                                ),
                              ),
                              const SizedBox(height: 24),
                              Text(
                                content.title,
                                textAlign: TextAlign.center,
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 28,
                                  fontWeight: FontWeight.w900,
                                  letterSpacing: -0.8,
                                ),
                              ),
                              const SizedBox(height: 12),
                              Text(
                                content.message,
                                textAlign: TextAlign.center,
                                style: const TextStyle(
                                  color: AppColors.slate,
                                  fontSize: 15,
                                  height: 1.5,
                                ),
                              ),
                              const SizedBox(height: 28),
                              GradientButton(
                                label: content.action,
                                onPressed: () => _act(context, ref),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
