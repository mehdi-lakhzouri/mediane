import 'package:driver_health_app/app/router/app_routes.dart';
import 'package:driver_health_app/app/router/route_guard.dart';
import 'package:driver_health_app/core/navigation/pending_deep_link.dart';
import 'package:driver_health_app/core/session/account_state.dart';
import 'package:driver_health_app/core/session/auth_state.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  const signedOut = AuthSignedOut();
  const ended = AuthSignedOut(reason: SignOutReason.sessionEnded);
  AuthSignedIn signedIn(AccountState state) =>
      AuthSignedIn(userId: 'user-1', accountState: state);

  String? redirect(String location, AuthState auth) =>
      authRedirect(location: location, auth: auth);

  test('startup policy screens are always reachable', () {
    for (final auth in [const AuthUnknown(), signedOut, ended]) {
      expect(redirect(AppRoutes.maintenance, auth), isNull);
      expect(redirect(AppRoutes.offline, auth), isNull);
    }
    expect(redirect(AppRoutes.splash, signedIn(AccountState.active)), isNull);
  });

  test('deep links wait for startup before opening protected screens', () {
    expect(redirect(AppRoutes.home, const AuthUnknown()), AppRoutes.splash);
    expect(redirect(AppRoutes.login, const AuthUnknown()), isNull);
  });

  test('password-reset deep links remain reachable with an active session', () {
    final active = signedIn(AccountState.active);
    expect(redirect(AppRoutes.resetPassword, active), isNull);
    expect(redirect(AppRoutes.resetPasswordSuccess, active), isNull);
  });

  test('signed-out users only see signed-out screens', () {
    expect(redirect(AppRoutes.login, signedOut), isNull);
    expect(redirect(AppRoutes.home, signedOut), AppRoutes.login);
    expect(redirect(AppRoutes.profileSetup, signedOut), AppRoutes.login);
  });

  test('an ended session explains why before asking to sign in', () {
    expect(redirect(AppRoutes.home, ended), AppRoutes.sessionEnded);
    expect(redirect(AppRoutes.sessionEnded, ended), isNull);
  });

  test('onboarding accounts are held on the step the server requires', () {
    final auth = signedIn(AccountState.passwordChangeRequired);
    expect(redirect(AppRoutes.home, auth), AppRoutes.passwordChange);
    expect(redirect(AppRoutes.login, auth), AppRoutes.passwordChange);
    expect(redirect(AppRoutes.profileSetup, auth), AppRoutes.passwordChange);
    expect(redirect(AppRoutes.passwordChange, auth), isNull);
  });

  test('active accounts leave sign-in and onboarding for home', () {
    final auth = signedIn(AccountState.active);
    expect(redirect(AppRoutes.login, auth), AppRoutes.home);
    expect(redirect(AppRoutes.loginVerify, auth), AppRoutes.home);
    expect(redirect(AppRoutes.profileSetup, auth), AppRoutes.home);
    expect(redirect(AppRoutes.home, auth), isNull);
  });

  test('a required step includes its sub-screens and the optional photo', () {
    final auth = signedIn(AccountState.profileSetupRequired);
    expect(redirect(AppRoutes.profileContacts, auth), isNull);
    expect(redirect(AppRoutes.profilePhoto, auth), isNull);
    expect(redirect(AppRoutes.home, auth), AppRoutes.profileSetup);
    expect(
      redirect(
        AppRoutes.profilePhoto,
        signedIn(AccountState.passwordChangeRequired),
      ),
      AppRoutes.passwordChange,
    );
  });

  test('active accounts cannot reopen onboarding sub-screens', () {
    final auth = signedIn(AccountState.active);
    expect(redirect(AppRoutes.profileContacts, auth), AppRoutes.home);
    expect(redirect(AppRoutes.profilePhoto, auth), isNull);
  });

  test('a locked session only reaches the unlock screen', () {
    final auth = signedIn(AccountState.active);
    String? locked(String location) =>
        authRedirect(location: location, auth: auth, locked: true);
    expect(locked(AppRoutes.home), AppRoutes.unlock);
    expect(locked(AppRoutes.security), AppRoutes.unlock);
    expect(locked(AppRoutes.unlock), isNull);
    expect(locked(AppRoutes.resetPassword), isNull);
    expect(redirect(AppRoutes.unlock, auth), AppRoutes.home);
    expect(redirect(AppRoutes.unlock, signedOut), AppRoutes.login);
  });

  test('authenticator setup sub-screens belong to the required step', () {
    final auth = signedIn(AccountState.mfaSetupRequired);
    expect(redirect(AppRoutes.mfaSetupConfirm, auth), isNull);
    expect(redirect(AppRoutes.mfaSetupRecoveryCodes, auth), isNull);
    expect(redirect(AppRoutes.security, auth), AppRoutes.mfaSetup);
  });

  group('resuming a link opened before sign-in', () {
    final link = Uri.parse('/join-family#K7M4-QX9P');
    String? resolve(
      String location,
      AuthState auth,
      PendingDeepLink pending, {
      bool locked = false,
      Uri? uri,
    }) => resolveRedirect(
      uri: uri ?? Uri.parse(location),
      location: location,
      auth: auth,
      locked: locked,
      pending: pending,
    );

    test('remembers the link and opens it on the way home', () {
      final pending = PendingDeepLink();
      expect(
        resolve(AppRoutes.joinFamilyLink, signedOut, pending, uri: link),
        AppRoutes.login,
      );
      expect(
        resolve(AppRoutes.login, signedIn(AccountState.active), pending),
        '/join-family#K7M4-QX9P',
      );
      expect(pending.value, isNull);
      expect(
        resolve(AppRoutes.login, signedIn(AccountState.active), pending),
        AppRoutes.home,
      );
    });

    test('waits for onboarding and unlock before opening it', () {
      final pending = PendingDeepLink()..value = link;
      expect(
        resolve(
          AppRoutes.login,
          signedIn(AccountState.passwordChangeRequired),
          pending,
        ),
        AppRoutes.passwordChange,
      );
      expect(
        resolve(
          AppRoutes.home,
          signedIn(AccountState.active),
          pending,
          locked: true,
        ),
        AppRoutes.unlock,
      );
      expect(
        resolve(AppRoutes.unlock, signedIn(AccountState.active), pending),
        '/join-family#K7M4-QX9P',
      );
    });

    test('also survives a cold start through the splash screen', () {
      final pending = PendingDeepLink();
      expect(
        resolve(
          AppRoutes.joinFamilyLink,
          const AuthUnknown(),
          pending,
          uri: link,
        ),
        AppRoutes.splash,
      );
      expect(
        resolve(AppRoutes.home, signedIn(AccountState.active), pending),
        '/join-family#K7M4-QX9P',
      );
    });

    test('ignores routes that are not shareable links', () {
      final pending = PendingDeepLink();
      resolve(AppRoutes.security, signedOut, pending);
      expect(pending.value, isNull);
    });
  });
}
