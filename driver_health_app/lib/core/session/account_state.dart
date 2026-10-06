enum AccountState {
  passwordChangeRequired,
  mfaSetupRequired,
  profileSetupRequired,
  active;

  factory fromWireValue(String value) {
    return switch (value) {
      'PASSWORD_CHANGE_REQUIRED' => AccountState.passwordChangeRequired,
      'MFA_SETUP_REQUIRED' => AccountState.mfaSetupRequired,
      'PROFILE_SETUP_REQUIRED' => AccountState.profileSetupRequired,
      'ACTIVE' => AccountState.active,
      _ => throw FormatException('Unsupported account state: $value'),
    };
  }
}
