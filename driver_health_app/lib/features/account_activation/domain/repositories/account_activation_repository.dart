abstract interface class AccountActivationRepository {
  /// Consumes the single-use invitation token emailed by an administrator.
  /// Afterwards the driver signs in with the temporary password.
  Future<void> acceptInvitation(String token);
}
