import 'dart:math' as math;

import 'package:flutter/material.dart';

/// A ring that empties as [remaining] runs down from [total], with the
/// seconds left in the middle.
class CountdownRing extends StatelessWidget {
  const new({
    required this.remaining,
    required this.total,
    required this.color,
    this.size = 200,
    this.caption = 'seconds',
    super.key,
  });

  final Duration remaining;
  final Duration total;
  final Color color;
  final double size;
  final String caption;

  @override
  Widget build(BuildContext context) {
    final fraction = total.inMilliseconds <= 0
        ? 0.0
        : (remaining.inMilliseconds / total.inMilliseconds).clamp(0.0, 1.0);
    final seconds = (remaining.inMilliseconds / 1000).ceil();
    return Semantics(
      container: true,
      label: '$seconds seconds left',
      liveRegion: true,
      excludeSemantics: true,
      child: SizedBox.square(
        dimension: size,
        child: CustomPaint(
          painter: _RingPainter(fraction: fraction, color: color),
          child: Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  '$seconds',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: size * 0.32,
                    fontWeight: FontWeight.w900,
                    height: 1,
                    fontFeatures: const [FontFeature.tabularFigures()],
                  ),
                ),
                Text(
                  caption,
                  style: const TextStyle(color: Colors.white70, fontSize: 15),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _RingPainter extends CustomPainter {
  const new({required this.fraction, required this.color});

  final double fraction;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    const stroke = 12.0;
    final rect = Offset.zero & size;
    final arc = rect.deflate(stroke / 2);
    canvas
      ..drawArc(
        arc,
        0,
        math.pi * 2,
        false,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = stroke
          ..color = color.withValues(alpha: 0.2),
      )
      ..drawArc(
        arc,
        -math.pi / 2,
        math.pi * 2 * fraction,
        false,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = stroke
          ..strokeCap = StrokeCap.round
          ..color = color,
      );
  }

  @override
  bool shouldRepaint(_RingPainter old) =>
      old.fraction != fraction || old.color != color;
}
