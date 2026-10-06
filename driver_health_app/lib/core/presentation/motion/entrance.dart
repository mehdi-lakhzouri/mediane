import 'dart:math' as math;

import 'package:driver_health_app/core/presentation/motion/motion.dart';
import 'package:flutter/widgets.dart';

/// Plays a page's entrance once: its [Entrance] children fade in and rise in
/// a short stagger. Items built later (scrolled into view, or a list that
/// refreshes) appear at rest instead of replaying, which keeps lists calm.
///
/// Give it a new [key] to replay, e.g. when a screen goes from loading to
/// its content.
class EntranceScope extends StatefulWidget {
  const new({required this.child, super.key});

  final Widget child;

  /// Whole sequence: the last staggered item plus its own entrance.
  static Duration get totalDuration =>
      Motion.stagger * Motion.maxStaggeredItems + Motion.medium;

  @override
  State<EntranceScope> createState() => _EntranceScopeState();
}

class _EntranceScopeState extends State<EntranceScope>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: EntranceScope.totalDuration,
  );
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    if (Motion.reduced(context)) {
      _controller.value = 1;
    } else {
      _controller.forward();
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) =>
      _EntranceData(animation: _controller, child: widget.child);
}

class _EntranceData extends InheritedWidget {
  const new({required this.animation, required super.child});

  final Animation<double> animation;

  static Animation<double>? maybeOf(BuildContext context) =>
      context.dependOnInheritedWidgetOfExactType<_EntranceData>()?.animation;

  @override
  bool updateShouldNotify(_EntranceData oldWidget) =>
      animation != oldWidget.animation;
}

/// One element of a staggered entrance: fades in while rising [rise] pixels,
/// [index] steps after the first. Outside an [EntranceScope] it is inert.
class Entrance extends StatelessWidget {
  const new({
    required this.child,
    this.index = 0,
    this.rise = Motion.rise,
    super.key,
  });

  final Widget child;
  final int index;
  final double rise;

  @override
  Widget build(BuildContext context) {
    final parent = _EntranceData.maybeOf(context);
    if (parent == null) return child;

    final total = EntranceScope.totalDuration.inMilliseconds;
    final step = math.min(index, Motion.maxStaggeredItems);
    final start = Motion.stagger.inMilliseconds * step / total;
    final end = math.min(1, start + Motion.medium.inMilliseconds / total);
    // `drive` creates no listener until something listens: safe in build.
    final progress = parent.drive(
      CurveTween(
        curve: Interval(start, end.toDouble(), curve: Motion.emphasized),
      ),
    );

    return FadeTransition(
      opacity: progress,
      child: AnimatedBuilder(
        animation: progress,
        builder: (context, child) => Transform.translate(
          offset: Offset(0, rise * (1 - progress.value)),
          child: child,
        ),
        child: child,
      ),
    );
  }
}

/// Wraps each widget in an [Entrance] with increasing indexes, starting at
/// [from]. Spacers are passed through untouched so they do not use a step.
List<Widget> staggered(List<Widget> children, {int from = 0}) {
  var index = from;
  return [
    for (final child in children)
      if (child is SizedBox && child.child == null)
        child
      else
        Entrance(index: index++, child: child),
  ];
}
