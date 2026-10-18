import 'package:driver_health_app/app/router/app_routes.dart';
import 'package:driver_health_app/app/router/route_guard.dart';
import 'package:driver_health_app/core/navigation/app_link.dart';
import 'package:driver_health_app/core/navigation/link_token.dart';
import 'package:driver_health_app/core/navigation/pending_deep_link.dart';
import 'package:driver_health_app/core/presentation/motion/animated_branches.dart';
import 'package:driver_health_app/core/security/security_providers.dart';
import 'package:driver_health_app/core/session/session_providers.dart';
import 'package:driver_health_app/features/account_activation/presentation/screens/activate_account_screen.dart';
import 'package:driver_health_app/features/auth/presentation/screens/login_screen.dart';
import 'package:driver_health_app/features/auth/presentation/screens/mfa_verification_screen.dart';
import 'package:driver_health_app/features/auth/presentation/screens/secure_account_screen.dart';
import 'package:driver_health_app/features/driver_profile/presentation/screens/driver_profile_screen.dart';
import 'package:driver_health_app/features/driver_profile/presentation/screens/emergency_contacts_screen.dart';
import 'package:driver_health_app/features/driver_profile/presentation/screens/profile_photo_screen.dart';
import 'package:driver_health_app/features/family/family_routes.dart';
import 'package:driver_health_app/features/family/presentation/screens/family_screen.dart';
import 'package:driver_health_app/features/home/presentation/screens/home_screen.dart';
import 'package:driver_health_app/features/home/presentation/screens/home_shell.dart';
import 'package:driver_health_app/features/home/presentation/screens/profile_tab_screen.dart';
import 'package:driver_health_app/features/notifications/notifications_routes.dart';
import 'package:driver_health_app/features/password_recovery/presentation/screens/forgot_password_screen.dart';
import 'package:driver_health_app/features/password_recovery/presentation/screens/reset_email_sent_screen.dart';
import 'package:driver_health_app/features/password_recovery/presentation/screens/reset_password_screen.dart';
import 'package:driver_health_app/features/password_recovery/presentation/screens/reset_password_success_screen.dart';
import 'package:driver_health_app/features/safety/presentation/screens/event_history_screen.dart';
import 'package:driver_health_app/features/safety/safety_routes.dart';
import 'package:driver_health_app/features/security/presentation/screens/active_devices_screen.dart';
import 'package:driver_health_app/features/security/presentation/screens/authenticator_confirm_screen.dart';
import 'package:driver_health_app/features/security/presentation/screens/authenticator_setup_screen.dart';
import 'package:driver_health_app/features/security/presentation/screens/recovery_codes_screen.dart';
import 'package:driver_health_app/features/security/presentation/screens/security_screen.dart';
import 'package:driver_health_app/features/security/presentation/screens/unlock_screen.dart';
import 'package:driver_health_app/features/startup/domain/entities/startup_decision.dart';
import 'package:driver_health_app/features/startup/presentation/screens/onboarding_screen.dart';
import 'package:driver_health_app/features/startup/presentation/screens/splash_screen.dart';
import 'package:driver_health_app/features/startup/presentation/screens/startup_status_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

export 'package:driver_health_app/app/router/app_routes.dart';

final appRouterProvider = Provider<GoRouter>((ref) {
  final sessions = ref.watch(sessionManagerProvider);
  final appLock = ref.watch(appLockProvider);
  final pendingLink = PendingDeepLink();

  final router = GoRouter(
    initialLocation: AppRoutes.splash,
    refreshListenable: Listenable.merge([sessions, appLock]),
    // An app link (/mobile/...) first becomes its in-app route, which the
    // usual guard then checks.
    redirect: (context, state) =>
        appLinkLocation(state.uri) ??
        resolveRedirect(
          uri: state.uri,
          location: state.matchedLocation,
          auth: sessions.state,
          locked: appLock.locked,
          pending: pendingLink,
        ),
    routes: [
      GoRoute(
        path: AppRoutes.splash,
        name: 'splash',
        builder: (context, state) => const SplashScreen(),
      ),
      GoRoute(
        path: AppRoutes.onboarding,
        name: StartupDestination.onboarding.name,
        builder: (context, state) => const OnboardingScreen(),
      ),
      GoRoute(
        path: AppRoutes.login,
        name: StartupDestination.login.name,
        builder: (context, state) => const LoginScreen(),
      ),
      GoRoute(
        path: AppRoutes.loginVerify,
        name: 'loginVerify',
        // The challenge lives only in memory; without it, start over.
        redirect: (context, state) =>
            state.extra is MfaVerificationArgs ? null : AppRoutes.login,
        builder: (context, state) =>
            MfaVerificationScreen(args: state.extra! as MfaVerificationArgs),
      ),
      GoRoute(
        path: AppRoutes.forgotPassword,
        name: 'forgotPassword',
        builder: (context, state) => const ForgotPasswordScreen(),
      ),
      GoRoute(
        path: AppRoutes.forgotPasswordSent,
        name: 'forgotPasswordSent',
        redirect: (context, state) =>
            state.extra is String ? null : AppRoutes.forgotPassword,
        builder: (context, state) =>
            ResetEmailSentScreen(email: state.extra! as String),
      ),
      GoRoute(
        path: AppRoutes.resetPassword,
        name: 'resetPassword',
        builder: (context, state) =>
            ResetPasswordScreen(token: linkToken(state.uri)),
      ),
      GoRoute(
        path: AppRoutes.resetPasswordSuccess,
        name: 'resetPasswordSuccess',
        builder: (context, state) => const ResetPasswordSuccessScreen(),
      ),
      GoRoute(
        path: AppRoutes.acceptInvitation,
        name: 'acceptInvitation',
        builder: (context, state) =>
            ActivateAccountScreen(token: linkToken(state.uri)),
      ),
      GoRoute(
        path: AppRoutes.sessionEnded,
        name: StartupDestination.sessionEnded.name,
        builder: (context, state) => const StartupStatusScreen(
          destination: StartupDestination.sessionEnded,
        ),
      ),
      GoRoute(
        path: AppRoutes.passwordChange,
        name: StartupDestination.passwordChange.name,
        builder: (context, state) => const SecureAccountScreen(),
      ),
      GoRoute(
        path: AppRoutes.mfaSetup,
        name: StartupDestination.mfaSetup.name,
        builder: (context, state) =>
            const AuthenticatorSetupScreen(required: true),
      ),
      GoRoute(
        path: AppRoutes.mfaSetupConfirm,
        name: 'mfaSetupConfirm',
        builder: (context, state) =>
            const AuthenticatorConfirmScreen(required: true),
      ),
      GoRoute(
        path: AppRoutes.mfaSetupRecoveryCodes,
        name: 'mfaSetupRecoveryCodes',
        redirect: (context, state) =>
            state.extra is RecoveryCodesArgs ? null : AppRoutes.mfaSetup,
        builder: (context, state) =>
            RecoveryCodesScreen(args: state.extra! as RecoveryCodesArgs),
      ),
      GoRoute(
        path: AppRoutes.profileSetup,
        name: StartupDestination.profileSetup.name,
        builder: (context, state) => const DriverProfileScreen(),
      ),
      GoRoute(
        path: AppRoutes.profileContacts,
        name: 'profileContacts',
        builder: (context, state) => const EmergencyContactsScreen(),
      ),
      GoRoute(
        path: AppRoutes.profilePhoto,
        name: 'profilePhoto',
        builder: (context, state) => const ProfilePhotoScreen(),
      ),
      GoRoute(
        path: AppRoutes.unlock,
        name: 'unlock',
        builder: (context, state) => const UnlockScreen(),
      ),
      GoRoute(
        path: AppRoutes.security,
        name: 'security',
        builder: (context, state) => const SecurityScreen(),
      ),
      GoRoute(
        path: AppRoutes.securityDevices,
        name: 'securityDevices',
        builder: (context, state) => const ActiveDevicesScreen(),
      ),
      GoRoute(
        path: AppRoutes.securityAuthenticator,
        name: 'securityAuthenticator',
        builder: (context, state) =>
            AuthenticatorSetupScreen(currentCode: state.extra as String?),
      ),
      GoRoute(
        path: AppRoutes.securityAuthenticatorConfirm,
        name: 'securityAuthenticatorConfirm',
        builder: (context, state) => const AuthenticatorConfirmScreen(),
      ),
      GoRoute(
        path: AppRoutes.securityRecoveryCodes,
        name: 'securityRecoveryCodes',
        redirect: (context, state) =>
            state.extra is RecoveryCodesArgs ? null : AppRoutes.security,
        builder: (context, state) =>
            RecoveryCodesScreen(args: state.extra! as RecoveryCodesArgs),
      ),
      StatefulShellRoute(
        builder: (context, state, shell) => HomeShell(shell: shell),
        navigatorContainerBuilder: (context, shell, children) =>
            AnimatedBranches(
              currentIndex: shell.currentIndex,
              children: children,
            ),
        branches: [
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoutes.home,
                name: StartupDestination.home.name,
                builder: (context, state) => const HomeScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoutes.history,
                name: 'history',
                builder: (context, state) => const EventHistoryScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoutes.family,
                name: 'family',
                builder: (context, state) => const FamilyScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoutes.profile,
                name: 'profile',
                builder: (context, state) => const ProfileTabScreen(),
              ),
            ],
          ),
        ],
      ),
      ...familyRoutes,
      ...safetyRoutes,
      ...notificationsRoutes,
      GoRoute(
        path: AppRoutes.editProfile,
        name: 'editProfile',
        builder: (context, state) => const DriverProfileScreen(editing: true),
      ),
      GoRoute(
        path: AppRoutes.editContacts,
        name: 'editContacts',
        builder: (context, state) =>
            const EmergencyContactsScreen(editing: true),
      ),
      GoRoute(
        path: AppRoutes.maintenance,
        name: StartupDestination.maintenance.name,
        builder: (context, state) => const StartupStatusScreen(
          destination: StartupDestination.maintenance,
        ),
      ),
      GoRoute(
        path: AppRoutes.mandatoryUpdate,
        name: StartupDestination.mandatoryUpdate.name,
        builder: (context, state) => const StartupStatusScreen(
          destination: StartupDestination.mandatoryUpdate,
        ),
      ),
      GoRoute(
        path: AppRoutes.offline,
        name: StartupDestination.offline.name,
        builder: (context, state) =>
            const StartupStatusScreen(destination: StartupDestination.offline),
      ),
      GoRoute(
        path: AppRoutes.unavailable,
        name: StartupDestination.unavailable.name,
        builder: (context, state) => const StartupStatusScreen(
          destination: StartupDestination.unavailable,
        ),
      ),
    ],
  );

  ref.onDispose(router.dispose);
  return router;
});
