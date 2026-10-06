import 'package:driver_health_app/features/driver_profile/domain/entities/driver_profile.dart';

class AvatarUpload {
  const new({
    required this.bytes,
    required this.fileName,
    required this.mimeType,
  });

  final List<int> bytes;
  final String fileName;
  final String mimeType;
}

abstract interface class ProfileRepository {
  Future<DriverProfile> fetch();

  /// Full replacement. The first complete save finishes onboarding.
  Future<DriverProfile> save(ProfileDetails details);

  Future<DriverProfile> uploadAvatar(
    AvatarUpload upload, {
    void Function(double progress)? onProgress,
  });

  Future<DriverProfile> removeAvatar();
}
