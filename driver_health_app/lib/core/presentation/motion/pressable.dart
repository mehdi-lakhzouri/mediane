import 'package:driver_health_app/core/presentation/motion/motion.dart';
import 'package:flutter/widgets.dart';

/// Tactile press feedback: the child settles slightly while a finger is on
/// it and springs back on release. Purely visual; taps are handled by the
/// child (InkWell, button). Disabled targets do not react.
class Pressable extends StatefulWidget {
  const new({
    required this.child,
    this.enabled = true,
    this.scale = 0.97,
    super.key,
  });

  final Widget child;
  final bool enabled;

  /// Size while pressed, relative to rest.
  final double scale;

  @override
  State<Pressable> createState() => _PressableState();
}

class _PressableState extends State<Pressable> {
  bool _pressed = false;

  void _set(bool pressed) {
    if (_pressed != pressed && mounted) setState(() => _pressed = pressed);
  }

  @override
  Widget build(BuildContext context) {
    if (!widget.enabled || Motion.reduced(context)) return widget.child;
    return Listener(
      onPointerDown: (_) => _set(true),
      onPointerUp: (_) => _set(false),
      onPointerCancel: (_) => _set(false),
      child: AnimatedScale(
        scale: _pressed ? widget.scale : 1,
        duration: Motion.short,
        curve: Motion.standard,
        child: widget.child,
      ),
    );
  }
}
