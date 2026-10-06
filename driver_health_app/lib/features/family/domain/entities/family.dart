import 'package:driver_health_app/features/driver_profile/domain/entities/driver_profile.dart';

enum FamilyRole { owner, member }

/// What a member chose to share beyond name and photo. Off by default.
class FamilySharing {
  const new({this.phone = false, this.incidents = false, this.health = false});

  final bool phone;
  final bool incidents;
  final bool health;

  bool get sharesAnything => phone || incidents || health;

  FamilySharing copyWith({bool? phone, bool? incidents, bool? health}) {
    return FamilySharing(
      phone: phone ?? this.phone,
      incidents: incidents ?? this.incidents,
      health: health ?? this.health,
    );
  }

  /// Human summary such as “Phone and incidents shared”.
  String get summary {
    final items = [
      if (phone) 'phone',
      if (incidents) 'incidents',
      if (health) 'health',
    ];
    if (items.isEmpty) return 'Shares name and photo only';
    final joined = items.length == 1
        ? items.first
        : '${items.sublist(0, items.length - 1).join(', ')} and ${items.last}';
    return '${joined[0].toUpperCase()}${joined.substring(1)} shared';
  }
}

class FamilyMember {
  const new({
    required this.userId,
    required this.firstName,
    required this.lastName,
    required this.role,
    required this.joinedAt,
    required this.avatar,
    required this.phoneNumber,
    required this.sharing,
  });

  final String userId;
  final String firstName;
  final String lastName;
  final FamilyRole role;
  final DateTime joinedAt;
  final ProfileAvatar? avatar;

  /// Present only when this member shares their phone with the family.
  final String? phoneNumber;
  final FamilySharing sharing;

  String get fullName => '$firstName $lastName'.trim();

  String get initials {
    final first = firstName.isEmpty ? '' : firstName[0];
    final last = lastName.isEmpty ? '' : lastName[0];
    final value = (first + last).toUpperCase();
    return value.isEmpty ? '?' : value;
  }
}

class Family {
  const new({
    required this.id,
    required this.name,
    required this.myRole,
    required this.mySharing,
    required this.maxMembers,
    required this.members,
    required this.pendingRequestCount,
  });

  final String id;
  final String name;
  final FamilyRole myRole;
  final FamilySharing mySharing;
  final int maxMembers;

  /// Owner first, then by join date.
  final List<FamilyMember> members;

  /// Owners only; zero for members.
  final int pendingRequestCount;

  bool get isOwner => myRole == FamilyRole.owner;
  bool get isFull => members.length >= maxMembers;
}

/// The driver's own request, waiting for an owner's answer.
class PendingJoinRequest {
  const new({
    required this.id,
    required this.familyName,
    required this.createdAt,
    required this.expiresAt,
  });

  final String id;
  final String familyName;
  final DateTime createdAt;
  final DateTime expiresAt;
}

/// Where the driver stands: in a family, waiting to join one, or neither.
class MyFamily {
  const new({this.family, this.pendingRequest});

  final Family? family;
  final PendingJoinRequest? pendingRequest;
}
