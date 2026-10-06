import 'package:driver_health_app/app/router/app_routes.dart';
import 'package:driver_health_app/core/navigation/pending_deep_link.dart';
import 'package:driver_health_app/core/session/account_state.dart';
import 'package:driver_health_app/core/session/auth_state.dart';

/// Where a signed-in user must be, decided only by the server's account state.
String routeForAccountState(AccountState accountState) {
  return switch (accountState) {
    AccountState.passwordChangeRequired => AppRoutes.passwordChange,
    AccountState.mfaSetupRequired => AppRoutes.mfaSetup,
    AccountState.profileSetupRequired => AppRoutes.profileSetup,
    AccountState.active => AppRoutes.home,
  };
}

/// Startup policy screens are reachable in every auth state.
const Set<String> _startupRoutes = {
  AppRoutes.splash,
  AppRoutes.maintenance,
  AppRoutes.mandatoryUpdate,
  AppRoutes.offline,
  AppRoutes.unavailable,
};

/// Emailed links must remain usable even when another account session exists
/// on the device. Completing a reset clears that now-revoked local session.
const Set<String> _publicLinkRoutes = {
  AppRoutes.resetPassword,
  AppRoutes.resetPasswordSuccess,
  AppRoutes.acceptInvitation,
};

/// Screens for people who are not signed in.
const Set<String> _signedOutRoutes = {
  AppRoutes.onboarding,
  AppRoutes.login,
  AppRoutes.loginVerify,
  AppRoutes.forgotPassword,
  AppRoutes.forgotPasswordSent,
  AppRoutes.resetPassword,
  AppRoutes.resetPasswordSuccess,
  AppRoutes.acceptInvitation,
  AppRoutes.sessionEnded,
};

/// Returns the location to redirect to, or `null` to allow [location].
/// [locked] means a restored session waits for biometric unlock.
String? authRedirect({
  required String location,
  required AuthState auth,
  bool locked = false,
}) {
  if (_startupRoutes.contains(location) ||
      _publicLinkRoutes.contains(location)) {
    return null;
  }
  if (auth is AuthSignedIn) {
    if (locked) return location == AppRoutes.unlock ? null : AppRoutes.unlock;
    if (location == AppRoutes.unlock) {
      return routeForAccountState(auth.accountState);
    }
  } else if (location == AppRoutes.unlock) {
    return AppRoutes.login;
  }
  final signedOutRoute = _signedOutRoutes.contains(location);

  switch (auth) {
    case AuthUnknown():
      // Deep links wait for startup to restore the session first.
      return signedOutRoute ? null : AppRoutes.splash;
    case AuthSignedOut(:final reason):
      if (signedOutRoute) return null;
      return reason == SignOutReason.sessionEnded
          ? AppRoutes.sessionEnded
          : AppRoutes.login;
    case AuthSignedIn(:final accountState):
      final required = routeForAccountState(accountState);
      // The optional photo can be managed during and after profile setup.
      if (location == AppRoutes.profilePhoto &&
          (accountState == AccountState.active ||
              accountState == AccountState.profileSetupRequired)) {
        return null;
      }
      if (accountState == AccountState.active) {
        final onboardingStep = location.startsWith('/onboarding/');
        return signedOutRoute || onboardingStep ? required : null;
      }
      // A required step may span sub-screens, e.g. profile then contacts.
      final withinStep =
          location == required || location.startsWith('$required/');
      return withinStep ? null : required;
  }
}

/// Links that may be opened before the driver can see them and are resumed
/// after sign-in. Kept narrow on purpose: only shareable entry points.
const Set<String> _resumableLinks = {
  AppRoutes.joinFamilyLink,
  AppRoutes.familyJoin,
};

/// Applies [authRedirect] and resumes a link the driver opened while signed
/// out, starting up, or locked. The link is remembered when the guard sends
/// the driver elsewhere and is opened the first time they would reach home,
/// that is, signed in, active, and unlocked.
String? resolveRedirect({
  required Uri uri,
  required String location,
  required AuthState auth,
  required bool locked,
  required PendingDeepLink pending,
}) {
  final target = authRedirect(location: location, auth: auth, locked: locked);
  if (target != null &&
      target != location &&
      _resumableLinks.contains(location)) {
    pending.value = uri;
  }
  final arrivingHome = (target ?? location) == AppRoutes.home;
  if (arrivingHome &&
      !locked &&
      auth is AuthSignedIn &&
      auth.accountState == AccountState.active &&
      pending.value != null) {
    return pending.take().toString();
  }
  return target;
}
