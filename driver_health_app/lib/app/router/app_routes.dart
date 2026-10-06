abstract final class AppRoutes {
  static const splash = '/';
  static const onboarding = '/onboarding';
  static const login = '/login';
  static const loginVerify = '/login/verify';
  static const forgotPassword = '/forgot-password';
  static const forgotPasswordSent = '/forgot-password/sent';
  static const resetPassword = '/reset-password';
  static const resetPasswordSuccess = '/reset-password/success';
  static const acceptInvitation = '/accept-invitation';
  static const sessionEnded = '/session-ended';
  static const passwordChange = '/onboarding/secure-account';
  static const mfaSetup = '/onboarding/authenticator';
  static const profileSetup = '/onboarding/profile';
  static const profileContacts = '/onboarding/profile/contacts';
  static const profilePhoto = '/profile/photo';
  static const home = '/home';
  static const family = '/family';
  static const familyJoin = '/family/join';
  static const familyScan = '/family/scan';
  static const familyInvite = '/family/invite';
  static const familyRequests = '/family/requests';
  static const familySharing = '/family/sharing';
  static const familyMemberPattern = '/family/members/:userId';

  /// Shared invitation link: `/join-family#K7M4-QX9P`.
  static const joinFamilyLink = '/join-family';

  static String familyMember(String userId) => '/family/members/$userId';

  static String familyPreview(String code) =>
      Uri(path: familyJoin, queryParameters: {'code': code}).toString();
  static const history = '/history';
  static const historyEventPattern = '/history/events/:eventId';
  static const incidentPattern = '/incidents/:incidentId';
  static const sos = '/sos';

  static String historyEvent(String eventId) => '/history/events/$eventId';

  static String incident(String incidentId) => '/incidents/$incidentId';
  static const profile = '/profile';
  static const editProfile = '/profile/details';
  static const editContacts = '/profile/contacts';
  static const unlock = '/unlock';
  static const security = '/security';
  static const securityDevices = '/security/devices';
  static const notifications = '/notifications';
  static const notificationPreferences = '/notifications/preferences';
  static const securityAuthenticator = '/security/authenticator';
  static const securityAuthenticatorConfirm = '/security/authenticator/confirm';
  static const securityRecoveryCodes = '/security/recovery-codes';
  static const mfaSetupConfirm = '/onboarding/authenticator/confirm';
  static const mfaSetupRecoveryCodes =
      '/onboarding/authenticator/recovery-codes';
  static const maintenance = '/startup/maintenance';
  static const mandatoryUpdate = '/startup/update-required';
  static const offline = '/startup/offline';
  static const unavailable = '/startup/unavailable';
}
