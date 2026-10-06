import 'package:driver_health_app/core/presentation/motion/animated_branches.dart';
import 'package:driver_health_app/core/presentation/motion/entrance.dart';
import 'package:driver_health_app/core/presentation/motion/motion.dart';
import 'package:driver_health_app/core/presentation/motion/pressable.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

/// No MaterialApp: its route transitions would add unrelated fades.
Widget _app(Widget child, {bool reduceMotion = false}) => MediaQuery(
  data: MediaQueryData(disableAnimations: reduceMotion),
  child: Directionality(textDirection: TextDirection.ltr, child: child),
);

double _opacityOf(WidgetTester tester, Key key) => tester
    .widget<FadeTransition>(
      find.ancestor(of: find.byKey(key), matching: find.byType(FadeTransition)),
    )
    .opacity
    .value;

void main() {
  group('Entrance', () {
    testWidgets('fades in with a stagger and settles fully', (tester) async {
      await tester.pumpWidget(
        _app(
          EntranceScope(
            child: Column(
              children: staggered([
                const Text('first', key: Key('a')),
                const SizedBox(height: 8),
                const Text('second', key: Key('b')),
              ]),
            ),
          ),
        ),
      );

      await tester.pump(const Duration(milliseconds: 60));
      final first = _opacityOf(tester, const Key('a'));
      final second = _opacityOf(tester, const Key('b'));
      expect(first, greaterThan(0));
      expect(second, lessThan(first), reason: 'later items start later');

      await tester.pump(EntranceScope.totalDuration);
      expect(_opacityOf(tester, const Key('a')), 1);
      expect(_opacityOf(tester, const Key('b')), 1);
    });

    testWidgets('plays once: items built afterwards appear at rest', (
      tester,
    ) async {
      var showLate = false;
      late StateSetter setState;
      await tester.pumpWidget(
        _app(
          EntranceScope(
            child: StatefulBuilder(
              builder: (context, set) {
                setState = set;
                return Column(
                  children: staggered([
                    const Text('first'),
                    if (showLate) const Text('late', key: Key('late')),
                  ]),
                );
              },
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      setState(() => showLate = true);
      await tester.pump();
      expect(_opacityOf(tester, const Key('late')), 1);
    });

    testWidgets('shows the final state at once when motion is reduced', (
      tester,
    ) async {
      await tester.pumpWidget(
        _app(
          const EntranceScope(
            child: Entrance(index: 5, child: Text('x', key: Key('x'))),
          ),
          reduceMotion: true,
        ),
      );
      expect(_opacityOf(tester, const Key('x')), 1);
    });

    testWidgets('is inert outside a scope', (tester) async {
      await tester.pumpWidget(
        _app(const Entrance(child: Text('x', key: Key('x')))),
      );
      expect(
        find.ancestor(
          of: find.byKey(const Key('x')),
          matching: find.byType(FadeTransition),
        ),
        findsNothing,
      );
    });
  });

  group('Pressable', () {
    double scaleOf(WidgetTester tester) =>
        tester.widget<AnimatedScale>(find.byType(AnimatedScale)).scale;

    testWidgets('settles while pressed and springs back', (tester) async {
      await tester.pumpWidget(
        _app(
          const Center(
            child: Pressable(
              child: ColoredBox(
                color: Color(0xFF000000),
                child: SizedBox.square(dimension: 80),
              ),
            ),
          ),
        ),
      );
      final gesture = await tester.startGesture(
        tester.getCenter(find.byType(ColoredBox)),
      );
      await tester.pump();
      expect(scaleOf(tester), 0.97);
      await gesture.up();
      await tester.pump();
      expect(scaleOf(tester), 1);
    });

    testWidgets('does nothing when disabled or motion is reduced', (
      tester,
    ) async {
      await tester.pumpWidget(
        _app(const Pressable(enabled: false, child: Text('off'))),
      );
      expect(find.byType(AnimatedScale), findsNothing);

      await tester.pumpWidget(
        _app(const Pressable(child: Text('calm')), reduceMotion: true),
      );
      expect(find.byType(AnimatedScale), findsNothing);
    });
  });

  testWidgets('AnimatedBranches keeps every tab alive and fades through', (
    tester,
  ) async {
    var index = 0;
    late StateSetter setState;
    await tester.pumpWidget(
      _app(
        StatefulBuilder(
          builder: (context, set) {
            setState = set;
            return AnimatedBranches(
              currentIndex: index,
              children: const [
                _Counter(key: Key('tab0')),
                Text('tab 1'),
              ],
            );
          },
        ),
      ),
    );
    await tester.tap(find.byKey(const Key('tab0')));
    await tester.pump();
    expect(find.text('1'), findsOneWidget);

    setState(() => index = 1);
    await tester.pump();
    await tester.pump(Motion.medium ~/ 4);
    final fade = tester.widget<FadeTransition>(
      find.byType(FadeTransition).first,
    );
    expect(fade.opacity.value, lessThan(1));
    await tester.pumpAndSettle();

    setState(() => index = 0);
    await tester.pumpAndSettle();
    expect(find.text('1'), findsOneWidget, reason: 'state survived');
  });
}

class _Counter extends StatefulWidget {
  const new({super.key});

  @override
  State<_Counter> createState() => _CounterState();
}

class _CounterState extends State<_Counter> {
  int _count = 0;

  @override
  Widget build(BuildContext context) => GestureDetector(
    onTap: () => setState(() => _count++),
    child: Text('$_count'),
  );
}
