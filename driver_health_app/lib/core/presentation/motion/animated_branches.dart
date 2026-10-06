import 'package:driver_health_app/core/presentation/motion/motion.dart';
import 'package:flutter/widgets.dart';

/// Tab switching for the bottom navigation: a Material "fade through" (the
/// new tab fades in while growing from 98%), with every tab kept alive in
/// an IndexedStack so scroll positions and state survive.
class AnimatedBranches extends StatefulWidget {
  const new({required this.currentIndex, required this.children, super.key});

  final int currentIndex;
  final List<Widget> children;

  @override
  State<AnimatedBranches> createState() => _AnimatedBranchesState();
}

class _AnimatedBranchesState extends State<AnimatedBranches>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: Motion.medium,
    value: 1,
  );
  late final Animation<double> _fade = CurvedAnimation(
    parent: _controller,
    curve: Motion.standard,
  );
  late final Animation<double> _scale = Tween<double>(
    begin: 0.98,
    end: 1,
  ).animate(CurvedAnimation(parent: _controller, curve: Motion.emphasized));

  @override
  void didUpdateWidget(AnimatedBranches oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.currentIndex != widget.currentIndex &&
        !Motion.reduced(context)) {
      _controller.forward(from: 0);
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: _fade,
      child: ScaleTransition(
        scale: _scale,
        child: IndexedStack(
          index: widget.currentIndex,
          sizing: StackFit.expand,
          children: [
            for (var i = 0; i < widget.children.length; i++)
              TickerMode(
                enabled: i == widget.currentIndex,
                child: widget.children[i],
              ),
          ],
        ),
      ),
    );
  }
}
