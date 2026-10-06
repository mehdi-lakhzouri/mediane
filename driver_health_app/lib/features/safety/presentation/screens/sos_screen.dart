import 'dart:async';

import 'package:driver_health_app/app/router/app_routes.dart';
import 'package:driver_health_app/core/presentation/motion/motion.dart';
import 'package:driver_health_app/core/presentation/motion/state_switcher.dart';
import 'package:driver_health_app/core/presentation/widgets/inline_message.dart';
import 'package:driver_health_app/core/theme/app_colors.dart';
import 'package:driver_health_app/features/safety/application/safety_providers.dart';
import 'package:driver_health_app/features/safety/application/sos_controller.dart';
import 'package:driver_health_app/features/safety/presentation/widgets/call_emergency_button.dart';
import 'package:driver_health_app/features/safety/presentation/widgets/countdown_ring.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

/// Opened by the SOS hold. Counts down [sosCancelWindow] seconds with a big
/// Cancel, then calls for help and hands over to the incident screen.
class SosScreen extends ConsumerStatefulWidget {
  const new({super.key});

  static const cancelKey = Key('sos.cancel');
  static const sendNowKey = Key('sos.sendNow');
  static const retryKey = Key('sos.retry');

  @override
  ConsumerState<SosScreen> createState() => _SosScreenState();
}

class _SosScreenState extends ConsumerState<SosScreen> {
  @override
  void initState() {
    super.initState();
    // The hold already happened on the previous screen.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) ref.read(sosControllerProvider.notifier).arm();
    });
  }

  void _cancel() {
    ref.read(sosControllerProvider.notifier).cancel();
    context.canPop() ? context.pop() : context.go(AppRoutes.home);
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(sosControllerProvider);
    final controller = ref.read(sosControllerProvider.notifier);
    ref.listen(sosControllerProvider, (previous, next) {
      switch (next) {
        case SosCountdown():
          HapticFeedback.heavyImpact().ignore();
        case SosSent(:final incident):
          ref
              .read(presentedIncidentsProvider.notifier)
              .markPresented(incident.id);
          context.replace(AppRoutes.incident(incident.id));
        case SosFailed():
          HapticFeedback.vibrate().ignore();
        case SosIdle() || SosSending():
          break;
      }
    });

    return PopScope(
      // Leaving during the countdown means "cancel".
      canPop: state is! SosSending,
      onPopInvokedWithResult: (didPop, _) {
        if (didPop) controller.cancel();
      },
      child: Scaffold(
        backgroundColor: const Color(0xFF3D0A14),
        body: SafeArea(
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 520),
              child: ListView(
                padding: const EdgeInsets.fromLTRB(24, 48, 24, 24),
                children: switchedItems(
                  switch (state) {
                    SosIdle() || SosCountdown() => SosCountdown,
                    SosSending() || SosSent() => SosSending,
                    SosFailed() => SosFailed,
                  },
                  switch (state) {
                    SosIdle() || SosCountdown() => _countdown(
                      state is SosCountdown
                          ? state.secondsLeft
                          : sosCancelWindow,
                      controller,
                    ),
                    SosSending() || SosSent() => const [
                      SizedBox(height: 80),
                      Center(
                        child: CircularProgressIndicator(color: Colors.white),
                      ),
                      SizedBox(height: 24),
                      Text(
                        'Calling for help…',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 24,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ],
                    SosFailed(:final failure) => [
                      const Icon(
                        Icons.wifi_off_rounded,
                        color: Colors.white,
                        size: 56,
                      ),
                      const SizedBox(height: 16),
                      const Text(
                        'Help could not be called',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 26,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      const SizedBox(height: 12),
                      InlineMessage(message: failure.message),
                      const SizedBox(height: 20),
                      FilledButton(
                        key: SosScreen.retryKey,
                        onPressed: () => unawaited(controller.retry()),
                        style: _primary,
                        child: const Text('Try again', style: _primaryLabel),
                      ),
                      const SizedBox(height: 12),
                      const CallEmergencyButton(),
                      TextButton(
                        onPressed: _cancel,
                        child: const Text(
                          'Close',
                          style: TextStyle(color: AppColors.ice),
                        ),
                      ),
                    ],
                  },
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  List<Widget> _countdown(int secondsLeft, SosController controller) => [
    Semantics(
      header: true,
      liveRegion: true,
      child: const Text(
        'Calling for help',
        textAlign: TextAlign.center,
        style: TextStyle(
          color: Colors.white,
          fontSize: 32,
          fontWeight: FontWeight.w900,
        ),
      ),
    ),
    const SizedBox(height: 8),
    const Text(
      'Your emergency contacts and family will be alerted.',
      textAlign: TextAlign.center,
      style: TextStyle(color: AppColors.ice, fontSize: 16),
    ),
    const SizedBox(height: 32),
    Center(
      child: Motion.reduced(context)
          ? _ring(secondsLeft)
          : _ring(secondsLeft)
                .animate()
                .fadeIn(duration: Motion.medium)
                .scale(
                  begin: const Offset(0.8, 0.8),
                  duration: Motion.long,
                  curve: Curves.easeOutBack,
                ),
    ),
    const SizedBox(height: 40),
    FilledButton(
      key: SosScreen.cancelKey,
      onPressed: _cancel,
      style: _primary,
      child: const Text('Cancel', style: _primaryLabel),
    ),
    const SizedBox(height: 12),
    TextButton(
      key: SosScreen.sendNowKey,
      onPressed: () => unawaited(controller.sendNow()),
      child: const Text(
        'Send now',
        style: TextStyle(
          color: Colors.white,
          fontSize: 17,
          fontWeight: FontWeight.w700,
        ),
      ),
    ),
  ];

  static Widget _ring(int secondsLeft) => CountdownRing(
    remaining: Duration(seconds: secondsLeft),
    total: const Duration(seconds: sosCancelWindow),
    color: Colors.white,
    size: 190,
  );

  static final ButtonStyle _primary = FilledButton.styleFrom(
    backgroundColor: Colors.white,
    foregroundColor: AppColors.navy950,
    minimumSize: const Size.fromHeight(64),
    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
  );

  static const _primaryLabel = TextStyle(
    fontSize: 22,
    fontWeight: FontWeight.w900,
  );
}
