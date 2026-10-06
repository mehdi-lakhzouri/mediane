import 'package:flutter/widgets.dart';

/// Motion tokens. One place for durations and curves so every screen moves
/// the same way: quick to respond, calm to settle, never in the way.
abstract final class Motion {
  /// Press feedback, small state flips.
  static const short = Duration(milliseconds: 140);

  /// Entrances, tab changes, content swaps.
  static const medium = Duration(milliseconds: 320);

  /// Larger elements (alert headers, success marks).
  static const long = Duration(milliseconds: 480);

  /// Delay between consecutive items of a staggered entrance.
  static const stagger = Duration(milliseconds: 45);

  /// Items after this one enter together: long lists must not make the last
  /// visible item wait.
  static const maxStaggeredItems = 8;

  /// Material 3 "emphasized decelerate": fast start, gentle landing.
  static const Curve emphasized = Cubic(0.05, 0.7, 0.1, 1);

  static const Curve standard = Curves.easeOutCubic;

  /// Distance, in logical pixels, an entering element rises.
  static const double rise = 18;

  /// True when the user asked the OS to remove animations: every effect in
  /// the app then shows its final state immediately.
  static bool reduced(BuildContext context) =>
      MediaQuery.maybeDisableAnimationsOf(context) ?? false;
}
