import 'dart:async';
import 'dart:convert';

import 'package:driver_health_app/app/router/app_router.dart';
import 'package:driver_health_app/core/presentation/widgets/phone_number_field.dart';
import 'package:driver_health_app/core/storage/secure_session_store.dart';
import 'package:driver_health_app/features/auth/presentation/screens/login_screen.dart';
import 'package:driver_health_app/features/auth/presentation/screens/secure_account_screen.dart';
import 'package:driver_health_app/features/driver_profile/data/data_sources/avatar_picker.dart';
import 'package:driver_health_app/features/driver_profile/domain/entities/driver_profile.dart';
import 'package:driver_health_app/features/driver_profile/domain/repositories/profile_repository.dart';
import 'package:driver_health_app/features/driver_profile/presentation/controllers/profile_photo_controller.dart';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/fake_backend.dart';
import '../../helpers/test_app.dart';

const _userId = '7b0b8f8e-2f7a-4d6b-9a52-111111111111';
const _onePixelPng =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwAD'
    'hgGAWjR9awAAAABJRU5ErkJggg==';

Map<String, Object?> profileJson({
  String accountState = 'PROFILE_SETUP_REQUIRED',
  Map<String, Object?>? avatar,
  Map<String, Object?>? saved,
}) {
  return {
    'phoneNumber': saved?['phoneNumber'],
    'dateOfBirth': saved?['dateOfBirth'],
    'gender': saved?['gender'],
    'emergencyContacts': [
      for (final (index, contact)
          in ((saved?['emergencyContacts'] as List?) ?? const []).indexed)
        {...(contact as Map).cast<String, Object?>(), 'priority': index + 1},
    ],
    'avatar': avatar,
    'completedAt': saved == null ? null : DateTime.now().toIso8601String(),
    'accountState': accountState,
  };
}

class _FakePicker implements AvatarPicker {
  new({this.side = 256, this.denied = false});

  final int side;
  final bool denied;

  @override
  Future<PickedAvatar?> pick(AvatarSource source) async {
    if (denied) throw AvatarPickDenied(source);
    return PickedAvatar(
      upload: AvatarUpload(
        bytes: base64Decode(_onePixelPng),
        fileName: 'avatar.png',
        mimeType: 'image/png',
      ),
      width: side,
      height: side,
    );
  }
}

void main() {
  late FakeBackend backend;
  const store = SecureSessionStore(FlutterSecureStorage());

  Future<void> tapVisible(WidgetTester tester, Finder finder) async {
    await tester.ensureVisible(finder);
    await tester.tap(finder);
    await tester.pumpAndSettle();
  }

  Future<void> enterField(WidgetTester tester, Key key, String text) {
    return tester.enterText(
      find.descendant(
        of: find.byKey(key),
        matching: find.byType(TextFormField),
      ),
      text,
    );
  }

  Future<void> signInAs(WidgetTester tester, String accountState) async {
    backend.on(
      'POST',
      'auth/mobile/login',
      (_) => FakeResponse.ok({
        'mfaRequired': false,
        ...sessionJson(accountState: accountState),
      }),
    );
    await enterField(tester, LoginScreen.emailFieldKey, 'amira@example.com');
    await enterField(tester, LoginScreen.passwordFieldKey, 'Temporary-1234');
    await tester.tap(find.text('Sign in'));
    await tester.pumpAndSettle();
  }

  setUp(() {
    backend = FakeBackend()
      ..on('GET', 'profile', (_) => FakeResponse.ok(profileJson()))
      ..on(
        'GET',
        'auth/me',
        (_) => FakeResponse.ok({
          'userId': _userId,
          'accountState': 'ACTIVE',
          'email': 'amira@example.com',
          'firstName': 'Amira',
          'lastName': 'Haddad',
        }),
      );
  });

  group('secure account', () {
    testWidgets('replaces the temporary password and adopts the new session', (
      tester,
    ) async {
      backend.on(
        'POST',
        'auth/mobile/password/change',
        (_) => FakeResponse.ok(
          sessionJson(
            accessToken: 'access-after-change',
            refreshToken: 'refresh-after-change-0000000000000000000000000',
            accountState: 'PROFILE_SETUP_REQUIRED',
          ),
        ),
      );
      await pumpCabinGuard(tester, backend: backend);
      await signInAs(tester, 'PASSWORD_CHANGE_REQUIRED');
      expect(find.text('Secure your account'), findsOneWidget);

      await enterField(
        tester,
        SecureAccountScreen.currentFieldKey,
        'Temporary-1234',
      );
      await enterField(
        tester,
        SecureAccountScreen.newFieldKey,
        'My own strong passphrase 7',
      );
      await enterField(
        tester,
        SecureAccountScreen.confirmFieldKey,
        'My own strong passphrase 7',
      );
      expect(find.text('Strong'), findsOneWidget);
      await tapVisible(tester, find.text('Update password'));

      expect(find.text('Complete your profile'), findsOneWidget);
      expect(
        bodyOf(
          backend.requestsTo('POST', 'auth/mobile/password/change').single,
        ),
        {
          'currentPassword': 'Temporary-1234',
          'newPassword': 'My own strong passphrase 7',
        },
      );
      expect(
        (await store.read())?.refreshToken,
        'refresh-after-change-0000000000000000000000000',
      );
      expect(
        bearerOf(backend.requestsTo('GET', 'profile').single),
        'access-after-change',
      );
    });

    testWidgets('shows server errors on the matching field', (tester) async {
      backend.on(
        'POST',
        'auth/mobile/password/change',
        (_) => const FakeResponse(400, {
          'data': null,
          'meta': {'requestId': 'r', 'timestamp': '2026-10-03T10:00:00Z'},
          'error': {
            'code': 'INVALID_CURRENT_PASSWORD',
            'message': 'The current password is incorrect.',
            'details': [
              {'field': 'currentPassword', 'message': 'is incorrect'},
            ],
          },
        }),
      );
      await pumpCabinGuard(tester, backend: backend);
      await signInAs(tester, 'PASSWORD_CHANGE_REQUIRED');

      await enterField(tester, SecureAccountScreen.currentFieldKey, 'wrong');
      await enterField(
        tester,
        SecureAccountScreen.newFieldKey,
        'My own strong passphrase 7',
      );
      await enterField(
        tester,
        SecureAccountScreen.confirmFieldKey,
        'My own strong passphrase 7',
      );
      await tapVisible(tester, find.text('Update password'));

      expect(find.text('This is incorrect.'), findsOneWidget);
      expect(find.text('Secure your account'), findsOneWidget);
    });

    testWidgets('asks for a code when two-step verification is on', (
      tester,
    ) async {
      backend.on('POST', 'auth/mobile/password/change', (request) {
        return bodyOf(request).containsKey('mfaCode')
            ? FakeResponse.ok(sessionJson())
            : FakeResponse.error(
                400,
                'MFA_CODE_REQUIRED',
                'Enter a code from your authenticator app to confirm.',
              );
      });
      await pumpCabinGuard(tester, backend: backend);
      await signInAs(tester, 'PASSWORD_CHANGE_REQUIRED');

      await enterField(tester, SecureAccountScreen.currentFieldKey, 'Temp-1');
      await enterField(
        tester,
        SecureAccountScreen.newFieldKey,
        'My own strong passphrase 7',
      );
      await enterField(
        tester,
        SecureAccountScreen.confirmFieldKey,
        'My own strong passphrase 7',
      );
      await tapVisible(tester, find.text('Update password'));
      expect(find.byKey(SecureAccountScreen.mfaFieldKey), findsOneWidget);

      await enterField(tester, SecureAccountScreen.mfaFieldKey, '123456');
      await tapVisible(tester, find.text('Update password'));

      expect(homeGreeting, findsOneWidget);
    });
  });

  group('driver profile', () {
    Future<void> fillDetails(WidgetTester tester) async {
      await tester.enterText(
        find.descendant(
          of: find.byType(PhoneNumberField),
          matching: find.byType(TextFormField),
        ),
        '+216 12 345 678',
      );
      await tapVisible(tester, find.text('Select a date'));
      await tester.tap(find.text('OK'));
      await tester.pumpAndSettle();
      await tapVisible(tester, find.text('Male'));
    }

    Future<void> addContact(
      WidgetTester tester, {
      required String name,
      required String phone,
    }) async {
      await tapVisible(tester, find.text('Add emergency contact'));
      final sheet = find.byType(BottomSheet);
      final fields = find.descendant(
        of: sheet,
        matching: find.byType(TextFormField),
      );
      await tester.enterText(fields.at(0), name);
      final dropdown = find.byType(
        DropdownButtonFormField<ContactRelationship>,
      );
      await tester.ensureVisible(dropdown);
      await tester.tap(dropdown);
      await tester.pumpAndSettle();
      await tester.tap(find.text('Spouse').last);
      await tester.pumpAndSettle();
      await tester.enterText(fields.at(1), phone);
      await tapVisible(tester, find.text('Add contact'));
    }

    testWidgets('completes onboarding and routes from the returned state', (
      tester,
    ) async {
      Map<String, Object?>? saved;
      backend.on('PUT', 'profile', (request) {
        saved = bodyOf(request);
        return FakeResponse.ok(
          profileJson(accountState: 'ACTIVE', saved: saved),
        );
      });
      await pumpCabinGuard(tester, backend: backend);
      await signInAs(tester, 'PROFILE_SETUP_REQUIRED');

      await tapVisible(tester, find.text('Continue'));
      expect(find.text('Enter a phone number.'), findsOneWidget);
      expect(find.text('Choose your date of birth.'), findsOneWidget);
      expect(find.text('Choose an option.'), findsOneWidget);

      await fillDetails(tester);
      await tapVisible(tester, find.text('Continue'));
      expect(find.text('Emergency contacts'), findsOneWidget);

      await tapVisible(tester, find.text('Add emergency contact'));
      final fields = find.descendant(
        of: find.byType(BottomSheet),
        matching: find.byType(TextFormField),
      );
      await tester.enterText(fields.at(1), '+21612345678');
      await tapVisible(tester, find.text('Add contact'));
      expect(
        find.text('Use someone else’s number, not your own.'),
        findsOneWidget,
      );
      await tester.tapAt(const Offset(20, 20));
      await tester.pumpAndSettle();

      await addContact(tester, name: 'Karim Ben Salah', phone: '+21655111222');
      await addContact(tester, name: 'Amira Ben Salah', phone: '+21698765432');
      expect(find.text('1 · First to call'), findsOneWidget);

      final finish = find.widgetWithText(InkWell, 'Finish setup');
      await tapVisible(tester, finish);
      expect(backend.requestsTo('PUT', 'profile'), isEmpty);

      await tapVisible(tester, find.textContaining('I confirm these contacts'));
      await tapVisible(tester, finish);

      expect(homeGreeting, findsOneWidget);
      expect(saved?['phoneNumber'], '+21612345678');
      expect(saved?['gender'], 'MALE');
      expect(saved?['dateOfBirth'], matches(RegExp(r'^\d{4}-01-01$')));
      expect(
        (saved?['emergencyContacts'] as List?)?.map(
          (contact) => (contact as Map)['phoneNumber'],
        ),
        ['+21655111222', '+21698765432'],
      );
      expect(
        await const FlutterSecureStorage().read(key: 'profileDraft.$_userId'),
        isNull,
      );
    });

    testWidgets('resumes from the encrypted draft and shows contact errors', (
      tester,
    ) async {
      backend.on(
        'PUT',
        'profile',
        (_) => const FakeResponse(400, {
          'data': null,
          'meta': {'requestId': 'r', 'timestamp': '2026-10-03T10:00:00Z'},
          'error': {
            'code': 'PROFILE_INVALID',
            'message': 'Some profile information is invalid.',
            'details': [
              {
                'field': 'emergencyContacts.0.phoneNumber',
                'message': 'is already used by another contact',
              },
            ],
          },
        }),
      );
      await pumpCabinGuard(tester, backend: backend);
      await const FlutterSecureStorage().write(
        key: 'profileDraft.$_userId',
        value: jsonEncode({
          'phoneNumber': '+21612345678',
          'dateOfBirth': '1990-05-17',
          'gender': 'FEMALE',
          'emergencyContacts': [
            {
              'fullName': 'Karim Ben Salah',
              'relationship': 'SIBLING',
              'phoneNumber': '+21655111222',
            },
          ],
        }),
      );
      await signInAs(tester, 'PROFILE_SETUP_REQUIRED');

      expect(find.text('12345678'), findsOneWidget);
      await tapVisible(tester, find.text('Continue'));
      expect(find.text('Karim Ben Salah'), findsOneWidget);

      await tapVisible(tester, find.textContaining('I confirm these contacts'));
      await tapVisible(tester, find.widgetWithText(InkWell, 'Finish setup'));

      expect(
        find.text('This number is already used by another contact.'),
        findsOneWidget,
      );
    });

    testWidgets('enforces the contact limit published by the server', (
      tester,
    ) async {
      await pumpCabinGuard(tester, backend: backend, maxEmergencyContacts: 1);
      await signInAs(tester, 'PROFILE_SETUP_REQUIRED');
      await fillDetails(tester);
      await tapVisible(tester, find.text('Continue'));

      expect(find.textContaining('(up to 1)'), findsOneWidget);
      await addContact(tester, name: 'Karim Ben Salah', phone: '+21655111222');
      expect(find.text('Maximum of 1 contact reached'), findsOneWidget);
    });
  });

  group('profile photo', () {
    testWidgets('validates, uploads, and shows the saved photo', (
      tester,
    ) async {
      backend.on(
        'PUT',
        'profile/avatar',
        (_) => FakeResponse.ok(
          profileJson(
            avatar: {
              'url': 'https://storage.cabinguard.test/avatar.webp',
              'expiresAt': DateTime.now()
                  .add(const Duration(minutes: 10))
                  .toIso8601String(),
            },
          ),
        ),
      );
      var picker = _FakePicker(side: 64);
      final container = await pumpCabinGuard(
        tester,
        backend: backend,
        overrides: [avatarPickerProvider.overrideWith((_) => picker)],
      );
      await signInAs(tester, 'PROFILE_SETUP_REQUIRED');
      unawaited(container.read(appRouterProvider).push(AppRoutes.profilePhoto));
      await tester.pumpAndSettle();

      await tapVisible(tester, find.text('Choose from library'));
      expect(find.textContaining('too small'), findsOneWidget);
      expect(backend.requestsTo('PUT', 'profile/avatar'), isEmpty);

      picker = _FakePicker();
      container.invalidate(avatarPickerProvider);
      await tapVisible(tester, find.text('Take a photo'));
      await tapVisible(tester, find.text('Save photo'));

      expect(backend.requestsTo('PUT', 'profile/avatar'), hasLength(1));
      expect(find.text('Profile photo saved.'), findsOneWidget);
      expect(find.text('Change photo'), findsOneWidget);
    });

    testWidgets('offers Settings when photo access is refused', (tester) async {
      final container = await pumpCabinGuard(
        tester,
        backend: backend,
        overrides: [
          avatarPickerProvider.overrideWithValue(_FakePicker(denied: true)),
        ],
      );
      await signInAs(tester, 'PROFILE_SETUP_REQUIRED');
      unawaited(container.read(appRouterProvider).push(AppRoutes.profilePhoto));
      await tester.pumpAndSettle();

      await tapVisible(tester, find.text('Take a photo'));

      expect(find.textContaining('Camera access is off'), findsOneWidget);
      expect(find.text('Open Settings'), findsOneWidget);
    });
  });
}
