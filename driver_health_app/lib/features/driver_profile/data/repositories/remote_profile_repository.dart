import 'package:dio/dio.dart';
import 'package:driver_health_app/core/network/api_envelope.dart';
import 'package:driver_health_app/core/session/account_state.dart';
import 'package:driver_health_app/features/driver_profile/domain/entities/driver_profile.dart';
import 'package:driver_health_app/features/driver_profile/domain/repositories/profile_repository.dart';

class RemoteProfileRepository implements ProfileRepository {
  const new(this._dio);

  final Dio _dio;

  @override
  Future<DriverProfile> fetch() async {
    final response = await _dio.get<Object?>('profile');
    return _profile(ApiEnvelope.data(response.data));
  }

  @override
  Future<DriverProfile> save(ProfileDetails details) async {
    final response = await _dio.put<Object?>('profile', data: details.toJson());
    return _profile(ApiEnvelope.data(response.data));
  }

  @override
  Future<DriverProfile> uploadAvatar(
    AvatarUpload upload, {
    void Function(double progress)? onProgress,
  }) async {
    final form = FormData.fromMap({
      'avatar': MultipartFile.fromBytes(
        upload.bytes,
        filename: upload.fileName,
        contentType: DioMediaType.parse(upload.mimeType),
      ),
    });
    final response = await _dio.put<Object?>(
      'profile/avatar',
      data: form,
      options: Options(contentType: Headers.multipartFormDataContentType),
      onSendProgress: onProgress == null
          ? null
          : (sent, total) {
              if (total > 0) onProgress(sent / total);
            },
    );
    return _profile(ApiEnvelope.data(response.data));
  }

  @override
  Future<DriverProfile> removeAvatar() async {
    final response = await _dio.delete<Object?>('profile/avatar');
    return _profile(ApiEnvelope.data(response.data));
  }

  static DriverProfile _profile(Map<String, Object?> json) {
    final avatar = json['avatar'];
    final contacts = json['emergencyContacts'];
    final state = json['accountState'];
    if (state is! String) throw const FormatException('Missing accountState');

    return DriverProfile(
      phoneNumber: json['phoneNumber'] as String?,
      dateOfBirth: parseCalendarDate(json['dateOfBirth']),
      gender: Gender.fromWire(json['gender']),
      emergencyContacts: [
        if (contacts is List)
          for (final contact in contacts.whereType<Map<Object?, Object?>>())
            EmergencyContact.fromJson(Map<String, Object?>.from(contact)),
      ],
      avatar: ProfileAvatar.tryParse(avatar),
      completedAt: DateTime.tryParse(json['completedAt'] as String? ?? ''),
      accountState: AccountState.fromWireValue(state),
    );
  }
}
