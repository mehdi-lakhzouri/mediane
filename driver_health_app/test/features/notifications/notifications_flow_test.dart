import 'package:driver_health_app/features/auth/presentation/screens/login_screen.dart';
import 'package:driver_health_app/features/family/presentation/screens/family_screen.dart';
import 'package:driver_health_app/features/notifications/presentation/screens/notification_center_screen.dart';
import 'package:driver_health_app/features/notifications/presentation/screens/notification_preferences_screen.dart';
import 'package:driver_health_app/features/security/presentation/screens/active_devices_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/fake_backend.dart';
import '../../helpers/family_fixtures.dart';
import '../../helpers/test_app.dart';

const _bell = Key('home.notifications');

Map<String, Object?> _notification({
  required String id,
  String category = 'FAMILY',
  String type = 'FAMILY_JOIN_REQUESTED',
  String title = 'New join request',
  String body = 'Nour Ben Salah asked to join your family.',
  String? link = '/family',
  bool critical = false,
  bool read = false,
  DateTime? createdAt,
}) => {
  'id': id,
  'category': category,
  'type': type,
  'title': title,
  'body': body,
  'link': link,
  'critical': critical,
  'readAt': read ? DateTime.now().toUtc().toIso8601String() : null,
  'createdAt': (createdAt ?? DateTime.now()).toUtc().toIso8601String(),
};

FakeResponse _paged(List<Map<String, Object?>> items) => FakeResponse(200, {
  'data': items,
  'meta': {
    'requestId': 'test',
    'timestamp': DateTime.now().toUtc().toIso8601String(),
    'pagination': {
      'page': 1,
      'pageSize': 30,
      'totalItems': items.length,
      'totalPages': 1,
    },
  },
  'error': null,
});

void main() {
  late FakeBackend backend;
  late int unread;

  Future<void> signIn(WidgetTester tester) async {
    await tester.enterText(
      find.descendant(
        of: find.byKey(LoginScreen.emailFieldKey),
        matching: find.byType(TextFormField),
      ),
      'amira@example.com',
    );
    await tester.enterText(
      find.descendant(
        of: find.byKey(LoginScreen.passwordFieldKey),
        matching: find.byType(TextFormField),
      ),
      'correct horse battery',
    );
    await tester.tap(find.text('Sign in'));
    await tester.pumpAndSettle();
  }

  setUp(() {
    unread = 2;
    backend = FakeBackend()
      ..on(
        'POST',
        'auth/mobile/login',
        (_) => FakeResponse.ok({'mfaRequired': false, ...sessionJson()}),
      )
      ..on(
        'GET',
        'mobile/dashboard',
        (_) => FakeResponse.ok(dashboardJson(unreadNotifications: unread)),
      );
  });

  testWidgets('the bell shows unread alerts and opens where they point', (
    tester,
  ) async {
    final items = [
      _notification(
        id: 'n-1',
        category: 'SAFETY',
        type: 'FAMILY_MEMBER_NEEDS_HELP',
        title: 'Karim may need help',
        body: "CabinGuard alerted Karim's emergency contacts.",
        critical: true,
      ),
      _notification(id: 'n-2'),
      _notification(
        id: 'n-3',
        category: 'SECURITY',
        type: 'NEW_SIGN_IN',
        title: 'New sign-in',
        body: 'Your account was used to sign in on Pixel 8 · Android 15.',
        link: '/security/devices',
        read: true,
        createdAt: DateTime.now().subtract(const Duration(days: 1)),
      ),
    ];
    backend
      ..on('GET', 'notifications', (_) => _paged(items))
      ..on('POST', 'notifications/n-2/read', (_) {
        unread = 1;
        return FakeResponse.ok(null);
      })
      ..on('POST', 'notifications/read-all', (_) {
        unread = 0;
        return FakeResponse.ok({'updated': 1});
      })
      ..on('GET', 'families/mine', (_) => FakeResponse.ok(myFamilyJson()));
    await pumpCabinGuard(tester, backend: backend);
    await signIn(tester);

    final bell = find.byKey(_bell);
    expect(find.descendant(of: bell, matching: find.text('2')), findsOneWidget);
    await tester.tap(bell);
    await tester.pumpAndSettle();

    expect(find.byType(NotificationCenterScreen), findsOneWidget);
    expect(find.text('Today'), findsOneWidget);
    expect(find.text('Yesterday'), findsOneWidget);
    expect(find.text('Karim may need help'), findsOneWidget);

    // Opening one marks it read and follows its link.
    await tester.tap(find.text('New join request'));
    await tester.pumpAndSettle();
    expect(backend.requestsTo('POST', 'notifications/n-2/read'), hasLength(1));
    expect(find.byType(FamilyScreen), findsOneWidget);
  });

  testWidgets('marks everything read', (tester) async {
    backend
      ..on('GET', 'notifications', (_) => _paged([_notification(id: 'n-2')]))
      ..on('POST', 'notifications/read-all', (_) {
        unread = 0;
        return FakeResponse.ok({'updated': 1});
      });
    await pumpCabinGuard(tester, backend: backend);
    await signIn(tester);
    await tester.tap(find.byKey(_bell));
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(NotificationCenterScreen.markAllKey));
    await tester.pumpAndSettle();
    expect(backend.requestsTo('POST', 'notifications/read-all'), hasLength(1));
    expect(find.byKey(NotificationCenterScreen.markAllKey), findsNothing);
  });

  testWidgets('settings save mutes but keep security always on', (
    tester,
  ) async {
    var prefs = <String, Object?>{
      'safety': true,
      'family': true,
      'account': true,
      'showNamesOnLockScreen': false,
      'security': true,
    };
    backend
      ..on('GET', 'notifications', (_) => _paged(const []))
      ..on('GET', 'notification-preferences', (_) => FakeResponse.ok(prefs))
      ..on('PUT', 'notification-preferences', (request) {
        prefs = {...(request.data as Map<String, Object?>), 'security': true};
        return FakeResponse.ok(prefs);
      });
    await pumpCabinGuard(tester, backend: backend);
    await signIn(tester);
    await tester.tap(find.byKey(_bell));
    await tester.pumpAndSettle();
    expect(find.text('You are all caught up'), findsOneWidget);

    await tester.tap(find.byKey(NotificationCenterScreen.settingsKey));
    await tester.pumpAndSettle();
    expect(find.byType(NotificationPreferencesScreen), findsOneWidget);

    final security = tester.widget<SwitchListTile>(
      find.widgetWithText(SwitchListTile, 'Security'),
    );
    expect(security.value, isTrue);
    expect(security.onChanged, isNull);

    await tester.tap(find.widgetWithText(SwitchListTile, 'Family activity'));
    await tester.pump();
    final save = find.byKey(NotificationPreferencesScreen.saveKey);
    await tester.scrollUntilVisible(
      save,
      300,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.pump();
    await tester.tap(save);
    await tester.pumpAndSettle();

    final sent =
        backend.requestsTo('PUT', 'notification-preferences').single.data
            as Map<String, Object?>;
    expect(sent, {
      'safety': true,
      'family': false,
      'account': true,
      'showNamesOnLockScreen': false,
    });
    expect(find.text('Notification settings saved.'), findsOneWidget);
  });

  testWidgets('active devices: sign out one, then all the others', (
    tester,
  ) async {
    var sessions = [
      {
        'id': 's-this',
        'channel': 'MOBILE',
        'device': {
          'label': 'Pixel 8 · Android 15',
          'platform': 'ANDROID',
          'app': true,
        },
        'ipAddress': '192.168.1.20',
        'signedInAt': DateTime.now().toUtc().toIso8601String(),
        'lastActiveAt': DateTime.now().toUtc().toIso8601String(),
        'current': true,
      },
      for (final (id, label, platform) in [
        ('s-tab', 'Galaxy Tab S9 · Android 14', 'ANDROID'),
        ('s-web', 'Chrome on Windows', 'WINDOWS'),
      ])
        {
          'id': id,
          'channel': 'MOBILE',
          'device': {'label': label, 'platform': platform, 'app': false},
          'ipAddress': null,
          'signedInAt': DateTime.now().toUtc().toIso8601String(),
          'lastActiveAt': DateTime.now().toUtc().toIso8601String(),
          'current': false,
        },
    ];
    backend
      ..on(
        'GET',
        'mfa/status',
        (_) => FakeResponse.ok({
          'enabled': false,
          'required': false,
          'recoveryCodesRemaining': 0,
          'recoveryCodesLow': false,
        }),
      )
      ..on('GET', 'auth/sessions', (_) => FakeResponse.ok(sessions))
      ..on('DELETE', 'auth/sessions/s-tab', (_) {
        sessions = sessions.where((s) => s['id'] != 's-tab').toList();
        return FakeResponse.ok(null);
      })
      ..on('POST', 'auth/sessions/revoke-others', (_) {
        sessions = sessions.where((s) => s['current'] == true).toList();
        return FakeResponse.ok({'revoked': 1});
      });
    await pumpCabinGuard(tester, backend: backend);
    await signIn(tester);

    await tester.tap(find.text('Profile').last);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Security'));
    await tester.pumpAndSettle();
    final devicesRow = find.text('Active devices');
    await tester.ensureVisible(devicesRow);
    await tester.pump();
    await tester.tap(devicesRow);
    await tester.pumpAndSettle();

    expect(find.byType(ActiveDevicesScreen), findsOneWidget);
    expect(find.text('This phone'), findsOneWidget);
    expect(find.byKey(ActiveDevicesScreen.revokeKey('s-this')), findsNothing);

    await tester.tap(find.byKey(ActiveDevicesScreen.revokeKey('s-tab')));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(TextButton, 'Sign out').last);
    await tester.pumpAndSettle();
    expect(backend.requestsTo('DELETE', 'auth/sessions/s-tab'), hasLength(1));
    expect(find.text('Galaxy Tab S9 · Android 14'), findsNothing);

    final others = find.byKey(ActiveDevicesScreen.revokeOthersKey);
    await tester.ensureVisible(others);
    await tester.pump();
    await tester.tap(others);
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(TextButton, 'Sign out others'));
    await tester.pumpAndSettle();
    expect(
      backend.requestsTo('POST', 'auth/sessions/revoke-others'),
      hasLength(1),
    );
    expect(
      find.text('Only this phone is signed in to your account.'),
      findsOneWidget,
    );
  });
}
