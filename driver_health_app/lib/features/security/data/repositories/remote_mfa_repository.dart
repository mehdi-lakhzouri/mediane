import 'package:dio/dio.dart';
import 'package:driver_health_app/core/network/api_envelope.dart';
import 'package:driver_health_app/core/session/account_state.dart';
import 'package:driver_health_app/features/security/domain/entities/mfa.dart';
import 'package:driver_health_app/features/security/domain/repositories/mfa_repository.dart';

class RemoteMfaRepository implements MfaRepository {
  new(this._dio, {DateTime Function()? clock}) : _clock = clock ?? DateTime.now;

  /// Used when the server omits a usable expiry.
  static const _fallbackSetupLifetime = Duration(minutes: 15);

  final Dio _dio;
  final DateTime Function() _clock;

  @override
  Future<MfaStatus> status() async {
    final response = await _dio.get<Object?>('auth/mfa');
    return _status(ApiEnvelope.data(response.data));
  }

  @override
  Future<TotpSetup> startSetup({String? currentCode}) async {
    final response = await _dio.post<Object?>(
      'auth/mfa/totp/setup',
      data: <String, Object?>{
        if (currentCode != null && currentCode.trim().isNotEmpty)
          'code': currentCode.trim(),
      },
    );
    final data = ApiEnvelope.data(response.data);
    final expiresAt = DateTime.tryParse(data['expiresAt'] as String? ?? '');
    final serverNow = ApiEnvelope.serverTime(response.data);
    final lifetime = expiresAt != null && serverNow != null
        ? expiresAt.difference(serverNow)
        : _fallbackSetupLifetime;

    return TotpSetup(
      secret: _string(data, 'secret'),
      otpauthUri: Uri.parse(_string(data, 'otpauthUri')),
      issuer: _string(data, 'issuer'),
      accountName: _string(data, 'accountName'),
      algorithm: data['algorithm'] as String? ?? 'SHA1',
      digits: data['digits'] as int? ?? 6,
      period: data['period'] as int? ?? 30,
      validFor: lifetime.isNegative ? Duration.zero : lifetime,
      receivedAt: _clock(),
    );
  }

  @override
  Future<RecoveryCodes> confirmSetup(String code) async {
    final response = await _dio.post<Object?>(
      'auth/mfa/totp/confirm',
      data: <String, Object?>{'code': code.trim()},
    );
    return _codes(ApiEnvelope.data(response.data));
  }

  @override
  Future<RecoveryCodes> regenerateRecoveryCodes(String code) async {
    final response = await _dio.post<Object?>(
      'auth/mfa/recovery-codes',
      data: <String, Object?>{'code': code.trim()},
    );
    return _codes(ApiEnvelope.data(response.data));
  }

  @override
  Future<MfaStatus> disable(String code) async {
    final response = await _dio.post<Object?>(
      'auth/mfa/totp/disable',
      data: <String, Object?>{'code': code.trim()},
    );
    return _status(ApiEnvelope.data(response.data));
  }

  static MfaStatus _status(Map<String, Object?> json) => MfaStatus(
    enabled: json['enabled'] == true,
    enabledAt: DateTime.tryParse(json['enabledAt'] as String? ?? ''),
    required: json['required'] == true,
    recoveryCodesRemaining: json['recoveryCodesRemaining'] as int? ?? 0,
    recoveryCodesLow: json['recoveryCodesLow'] == true,
  );

  static RecoveryCodes _codes(Map<String, Object?> json) {
    final codes = json['recoveryCodes'];
    if (codes is! List || codes.isEmpty) {
      throw const FormatException('Missing recovery codes');
    }
    return RecoveryCodes(
      codes: codes.whereType<String>().toList(growable: false),
      accountState: AccountState.fromWireValue(_string(json, 'accountState')),
    );
  }

  static String _string(Map<String, Object?> json, String key) {
    final value = json[key];
    if (value is String && value.isNotEmpty) return value;
    throw FormatException('Missing field: $key');
  }
}
