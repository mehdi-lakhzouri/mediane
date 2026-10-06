import 'package:driver_health_app/core/session/account_state.dart';

class MfaStatus {
  const new({
    required this.enabled,
    required this.enabledAt,
    required this.required,
    required this.recoveryCodesRemaining,
    required this.recoveryCodesLow,
  });

  final bool enabled;
  final DateTime? enabledAt;

  /// The server forbids turning it off for this account.
  final bool required;
  final int recoveryCodesRemaining;
  final bool recoveryCodesLow;
}

/// A pending authenticator enrollment. The secret is shown, never stored.
class TotpSetup {
  const new({
    required this.secret,
    required this.otpauthUri,
    required this.issuer,
    required this.accountName,
    required this.algorithm,
    required this.digits,
    required this.period,
    required this.validFor,
    required this.receivedAt,
  });

  /// Base32 key for manual entry.
  final String secret;
  final Uri otpauthUri;
  final String issuer;
  final String accountName;
  final String algorithm;
  final int digits;

  /// Seconds per code.
  final int period;

  /// Lifetime measured against the server clock.
  final Duration validFor;
  final DateTime receivedAt;

  DateTime get deadline => receivedAt.add(validFor);

  /// The key in groups of four, easier to read aloud or type.
  String get groupedSecret =>
      RegExp('.{1,4}')
          .allMatches(secret.replaceAll(' ', ''))
          .map((match) => match.group(0))
          .join(' ');
}

/// One-time recovery codes. Kept in memory only and never logged.
class RecoveryCodes {
  const new({required this.codes, required this.accountState});

  final List<String> codes;
  final AccountState accountState;
}
