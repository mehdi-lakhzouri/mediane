import 'package:driver_health_app/core/theme/app_colors.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// Hold time before an SOS starts, so a brush against the screen never
/// calls for help.
const sosHoldDuration = Duration(seconds: 2);

/// The round SOS button of screen 12. Pressing fills a ring; releasing early
/// resets it; holding for [sosHoldDuration] calls [onActivated]. Screen
/// readers trigger it with their long-press gesture.
class SosHoldButton extends StatefulWidget {
  const new({required this.onActivated, this.size = 150, super.key});

  static const buttonKey = Key('sos.hold');

  final VoidCallback onActivated;
  final double size;

  @override
  State<SosHoldButton> createState() => _SosHoldButtonState();
}

class _SosHoldButtonState extends State<SosHoldButton>
    with SingleTickerProviderStateMixin {
  late final AnimationController _hold = AnimationController(
    vsync: this,
    duration: sosHoldDuration,
  )..addStatusListener(_onStatus);

  @override
  void dispose() {
    _hold.dispose();
    super.dispose();
  }

  void _onStatus(AnimationStatus status) {
    if (status != AnimationStatus.completed) return;
    _hold.reset();
    _activate();
  }

  void _activate() {
    HapticFeedback.heavyImpact().ignore();
    widget.onActivated();
  }

  void _press() {
    HapticFeedback.selectionClick().ignore();
    _hold.forward(from: 0);
  }

  void _release() {
    // A full ring counts even if the completing frame has not run yet.
    if (_hold.value >= 1) {
      _hold.reset();
      _activate();
    } else if (_hold.isAnimating) {
      _hold.reverse();
    }
  }

  @override
  Widget build(BuildContext context) {
    final size = widget.size;
    return Semantics(
      button: true,
      label: 'SOS',
      hint: 'Press and hold for two seconds to call for help',
      onLongPress: _activate,
      excludeSemantics: true,
      child: Listener(
        key: SosHoldButton.buttonKey,
        onPointerDown: (_) => _press(),
        onPointerUp: (_) => _release(),
        onPointerCancel: (_) => _release(),
        child: AnimatedBuilder(
          animation: _hold,
          builder: (context, child) => SizedBox.square(
            dimension: size + 36,
            child: Stack(
              alignment: Alignment.center,
              children: [
                // Soft halo, stronger while holding.
                Container(
                  width: size + 36,
                  height: size + 36,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: AppColors.coral.withValues(
                      alpha: 0.10 + 0.15 * _hold.value,
                    ),
                  ),
                ),
                SizedBox.square(
                  dimension: size + 16,
                  child: CircularProgressIndicator(
                    value: _hold.value,
                    strokeWidth: 6,
                    color: Colors.white,
                    backgroundColor: AppColors.coral.withValues(alpha: 0.25),
                  ),
                ),
                Transform.scale(scale: 1 - 0.04 * _hold.value, child: child),
              ],
            ),
          ),
          child: Container(
            width: size,
            height: size,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: const RadialGradient(
                colors: [Color(0xFFFF7A80), AppColors.coral],
              ),
              boxShadow: [
                BoxShadow(
                  color: AppColors.coral.withValues(alpha: 0.45),
                  blurRadius: 28,
                  spreadRadius: 2,
                ),
              ],
            ),
            child: const Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  Icons.phone_in_talk_rounded,
                  color: Colors.white,
                  size: 40,
                ),
                SizedBox(height: 4),
                Text(
                  'SOS',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 32,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 1,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
