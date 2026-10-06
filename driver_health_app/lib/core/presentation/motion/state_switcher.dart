import 'package:driver_health_app/core/presentation/motion/motion.dart';
import 'package:flutter/widgets.dart';

/// Swaps content when a screen changes state (waiting, help on the way,
/// done): the old state fades out while the new one fades in and rises a
/// little. Give each state's child a distinct key.
class StateSwitcher extends StatelessWidget {
  const new({required this.child, super.key});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    if (Motion.reduced(context)) return child;
    return AnimatedSwitcher(
      duration: Motion.medium,
      switchInCurve: Motion.emphasized,
      switchOutCurve: Motion.standard,
      // Top-aligned so the incoming state does not jump while sizes differ.
      layoutBuilder: (current, previous) => Stack(
        alignment: Alignment.topCenter,
        children: [...previous, ?current],
      ),
      transitionBuilder: (child, animation) => FadeTransition(
        opacity: animation,
        child: SlideTransition(
          position: Tween<Offset>(
            begin: const Offset(0, 0.03),
            end: Offset.zero,
          ).animate(animation),
          child: child,
        ),
      ),
      child: child,
    );
  }
}

/// [StateSwitcher] applied item by item, for content placed in a list: each
/// item keeps its own accessibility node (a screen reader still moves from
/// the countdown to the message to the buttons) while the whole state swaps.
List<Widget> switchedItems(Object state, List<Widget> items) => [
  for (final (index, item) in items.indexed)
    StateSwitcher(
      child: KeyedSubtree(key: ValueKey((state, index)), child: item),
    ),
];
