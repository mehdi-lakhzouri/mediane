import 'dart:async';
import 'dart:io';
import 'dart:ui' as ui;

import 'package:driver_health_app/app/app.dart';
import 'package:driver_health_app/features/startup/data/data_sources/onboarding_preferences.dart';
import 'package:driver_health_app/features/startup/presentation/controllers/startup_controller.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../../helpers/fake_backend.dart';
import '../../../helpers/test_app.dart';

void main() {
  testWidgets('Continue visits all three pages before completing onboarding', (
    tester,
  ) async {
    final container = await pumpCabinGuard(
      tester,
      backend: FakeBackend(),
      onboardingCompleted: false,
    );
    final preferences = container.read(onboardingPreferencesProvider);
    expect(await preferences.isCompleted(), isFalse);
    expect(find.text('Protection on\nevery journey'), findsOneWidget);

    await tester.tap(find.text('Continue'));
    await tester.pumpAndSettle();
    expect(find.text('Help when every\nsecond matters'), findsOneWidget);
    expect(await preferences.isCompleted(), isFalse);

    await tester.tap(find.text('Continue'));
    await tester.pumpAndSettle();
    expect(find.text('Your trusted circle,\nwithin reach'), findsOneWidget);
    expect(find.text('Get started'), findsOneWidget);
    expect(await preferences.isCompleted(), isFalse);

    await tester.tap(find.text('Get started'));
    await tester.pumpAndSettle();
    expect(find.text('Welcome back'), findsOneWidget);
    expect(await preferences.isCompleted(), isTrue);
  });

  testWidgets('swipes and progress dots move forward and back', (tester) async {
    await pumpCabinGuard(
      tester,
      backend: FakeBackend(),
      onboardingCompleted: false,
    );
    await tester.drag(
      find.byKey(const ValueKey('onboarding-pages')),
      const Offset(-350, 0),
    );
    await tester.pumpAndSettle();
    expect(find.text('Help when every\nsecond matters'), findsOneWidget);

    await tester.tap(find.byKey(const ValueKey('onboarding-page-3')));
    await tester.pumpAndSettle();
    expect(find.text('Get started'), findsOneWidget);

    await tester.tap(find.byKey(const ValueKey('onboarding-page-1')));
    await tester.pumpAndSettle();
    expect(find.text('Protection on\nevery journey'), findsOneWidget);
    expect(find.text('Continue'), findsOneWidget);
  });

  testWidgets('short screens and large fonts keep navigation reachable', (
    tester,
  ) async {
    await pumpCabinGuard(
      tester,
      backend: FakeBackend(),
      onboardingCompleted: false,
    );
    tester.view.physicalSize = const Size(960, 1704);
    tester.platformDispatcher.textScaleFactorTestValue = 2;
    addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
    tester.platformDispatcher.accessibilityFeaturesTestValue =
        const FakeAccessibilityFeatures(disableAnimations: true);
    addTearDown(tester.platformDispatcher.clearAccessibilityFeaturesTestValue);
    await tester.pumpAndSettle();

    for (var page = 0; page < 2; page++) {
      expect(tester.takeException(), isNull);
      await tester.tap(find.byKey(const ValueKey('onboarding-continue')));
      await tester.pumpAndSettle();
    }
    expect(find.text('Get started'), findsOneWidget);
    expect(tester.takeException(), isNull);
    await tester.tap(find.byKey(const ValueKey('onboarding-skip')));
    await tester.pumpAndSettle();
    expect(find.text('Welcome back'), findsOneWidget);
  });

  testWidgets('saving is single-flight and a failed save can be retried', (
    tester,
  ) async {
    final pending = Completer<void>();
    var calls = 0;
    final preferences = _ControlledPreferences(() async {
      calls++;
      if (calls == 1) await pending.future;
    });
    await pumpCabinGuard(
      tester,
      backend: FakeBackend(),
      onboardingCompleted: false,
      onboardingPreferences: preferences,
    );

    await tester.tap(find.text('Skip'));
    await tester.pump();
    expect(find.byType(CircularProgressIndicator), findsOneWidget);
    expect(
      tester
          .widget<TextButton>(find.byKey(const ValueKey('onboarding-skip')))
          .onPressed,
      isNull,
    );
    expect(
      tester
          .widget<FilledButton>(
            find.byKey(const ValueKey('onboarding-continue')),
          )
          .onPressed,
      isNull,
    );
    expect(calls, 1);

    pending.completeError(StateError('Preferences unavailable'));
    await tester.pumpAndSettle();
    expect(
      find.text('Unable to save your preference. Try again.'),
      findsOneWidget,
    );
    expect(find.text('Protection on\nevery journey'), findsOneWidget);
    expect(preferences.completed, isFalse);

    await tester.tap(find.text('Skip'));
    await tester.pumpAndSettle();
    expect(calls, 2);
    expect(preferences.completed, isTrue);
    expect(find.text('Welcome back'), findsOneWidget);
  });

  // Opt-in captures use the real app and loaded fonts, not a separate mock UI.
  final captureDirectory =
      Platform.environment['CABINGUARD_ONBOARDING_CAPTURE_DIR'];
  if (captureDirectory != null) {
    testWidgets('capture the three implemented onboarding screens', (
      tester,
    ) async {
      await tester.runAsync(() async {
        final artifacts = File(Platform.resolvedExecutable)
            .parent
            .parent
            .parent;
        final roboto = FontLoader('Roboto')
          ..addFont(
            File('${artifacts.path}/material_fonts/roboto-regular.ttf')
                .readAsBytes()
                .then(ByteData.sublistView),
          );
        await roboto.load();
        final icons = FontLoader('MaterialIcons')
          ..addFont(rootBundle.load('fonts/MaterialIcons-Regular.otf'));
        await icons.load();
      });

      final container = await pumpCabinGuard(
        tester,
        backend: FakeBackend(),
        onboardingCompleted: false,
      );
      final captureKey = GlobalKey();
      await tester.pumpWidget(
        UncontrolledProviderScope(
          container: container,
          child: RepaintBoundary(key: captureKey, child: const CabinGuardApp()),
        ),
      );
      await tester.pumpAndSettle();
      for (var page = 1; page <= 3; page++) {
        // Decode the current photo before capturing.
        final photo = tester.widget<Image>(find.byType(Image).first);
        final context = tester.element(find.byType(Image).first);
        await tester.runAsync(() => precacheImage(photo.image, context));
        await tester.pumpAndSettle();
        final boundary =
            captureKey.currentContext!.findRenderObject()!
                as RenderRepaintBoundary;
        await tester.runAsync(() async {
          final directory = Directory(captureDirectory);
          await directory.create(recursive: true);
          final image = await boundary.toImage(pixelRatio: 3);
          final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
          await File('${directory.path}/0$page.png')
              .writeAsBytes(bytes!.buffer.asUint8List());
          image.dispose();
        });
        if (page < 3) {
          await tester.tap(find.text('Continue'));
          await tester.pumpAndSettle();
        }
      }
    });
  }
}

class _ControlledPreferences implements OnboardingPreferences {
  new(this.onSave);

  final Future<void> Function() onSave;
  bool completed = false;

  @override
  Future<bool> isCompleted() async => completed;

  @override
  Future<void> complete() async {
    await onSave();
    completed = true;
  }
}
