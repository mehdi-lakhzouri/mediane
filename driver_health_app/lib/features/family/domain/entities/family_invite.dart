import 'package:driver_health_app/features/driver_profile/domain/entities/driver_profile.dart';

/// The owner's shareable join code (screen 21).
class FamilyInvite {
  const new({required this.code, required this.link, required this.expiresAt});

  /// Display form, e.g. K7M4-QX9P.
  final String code;
  final Uri link;
  final DateTime expiresAt;
}

/// What a code leads to, shown before asking to join (screen 10, adapted).
class FamilyInvitePreview {
  const new({
    required this.familyName,
    required this.ownerFirstName,
    required this.memberCount,
    required this.maxMembers,
    required this.full,
  });

  final String familyName;
  final String? ownerFirstName;
  final int memberCount;
  final int maxMembers;
  final bool full;
}

/// A request waiting for the owner's decision (screen 23).
class IncomingJoinRequest {
  const new({
    required this.id,
    required this.userId,
    required this.firstName,
    required this.lastName,
    required this.avatar,
    required this.createdAt,
    required this.expiresAt,
  });

  final String id;
  final String userId;
  final String firstName;
  final String lastName;
  final ProfileAvatar? avatar;
  final DateTime createdAt;
  final DateTime expiresAt;

  String get fullName => '$firstName $lastName'.trim();
}
