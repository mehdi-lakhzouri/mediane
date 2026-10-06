import 'dart:async';

import 'package:driver_health_app/core/network/api_failure.dart';
import 'package:driver_health_app/core/presentation/widgets/cabinguard_background.dart';
import 'package:driver_health_app/core/presentation/widgets/cabinguard_brand.dart';
import 'package:driver_health_app/core/theme/app_colors.dart';
import 'package:driver_health_app/features/startup/domain/entities/startup_decision.dart';
import 'package:driver_health_app/features/startup/presentation/controllers/startup_controller.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class SplashScreen extends ConsumerStatefulWidget {
  const new({super.key});

  @override
  ConsumerState<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends ConsumerState<SplashScreen>
    with SingleTickerProviderStateMixin {
  late final Future<void> _minimumVisible;
  late final AnimationController _animation;
  bool _navigated = false;

  @override
  void initState() {
    super.initState();
    _minimumVisible = Future<void>.delayed(
      ref.read(minimumSplashDurationProvider),
    );
    _animation = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    )..forward();
  }

  @override
  void dispose() {
    _animation.dispose();
    super.dispose();
  }

  Future<void> _navigate(StartupDestination destination) async {
    if (_navigated) return;
    _navigated = true;
    await _minimumVisible;
    if (!mounted) return;
    context.goNamed(destination.name);
  }

  void _scheduleNavigation(StartupDestination destination) {
    if (_navigated) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      unawaited(_navigate(destination));
    });
  }

  @override
  Widget build(BuildContext context) {
    final startup = ref.watch(startupControllerProvider);
    switch (startup) {
      case AsyncData(:final value):
        _scheduleNavigation(value.destination);
      case AsyncError(:final error):
        _scheduleNavigation(
          ApiFailure.from(error).isConnectivity
              ? StartupDestination.offline
              : StartupDestination.unavailable,
        );
      case AsyncLoading():
        break;
    }

    return Scaffold(
      body: CabinGuardBackground(
        alignment: const Alignment(-0.72, 0),
        overlayStrength: 0.48,
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24),
            child: Column(
              children: [
                const Spacer(flex: 4),
                FadeTransition(
                  opacity: CurvedAnimation(
                    parent: _animation,
                    curve: Curves.easeOut,
                  ),
                  child: ScaleTransition(
                    scale: Tween<double>(begin: 0.88, end: 1).animate(
                      CurvedAnimation(
                        parent: _animation,
                        curve: Curves.easeOutBack,
                      ),
                    ),
                    child: const CabinGuardBrand(showTagline: true),
                  ),
                ),
                const Spacer(flex: 7),
                const SizedBox(
                  width: 42,
                  height: 42,
                  child: CircularProgressIndicator(
                    strokeWidth: 4,
                    color: AppColors.cyan,
                    backgroundColor: Color(0x55497199),
                  ),
                ),
                const SizedBox(height: 18),
                const Text(
                  'Securing your journey…',
                  style: TextStyle(
                    color: AppColors.ice,
                    fontSize: 17,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const Spacer(flex: 2),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
