/// Second sign-in step issued after a correct password.
class MfaChallenge {
  const new({
    required this.token,
    required this.validFor,
    required this.receivedAt,
  });

  /// Single-use token sent back with the code. Never persisted or logged.
  final String token;

  /// Lifetime measured against the server clock, so device skew is ignored.
  final Duration validFor;

  /// Device time when the challenge arrived.
  final DateTime receivedAt;

  DateTime get deadline => receivedAt.add(validFor);
}
