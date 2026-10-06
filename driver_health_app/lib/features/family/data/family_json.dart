import 'package:driver_health_app/features/driver_profile/domain/entities/driver_profile.dart';
import 'package:driver_health_app/features/family/domain/entities/family.dart';
import 'package:driver_health_app/features/family/domain/entities/family_invite.dart';

/// Maps family API payloads to domain entities. Kept apart from the
/// repository so the wire format is easy to test and evolve.
abstract final class FamilyJson {
  static MyFamily myFamily(Map<String, Object?> json) {
    final family = json['family'];
    final request = json['pendingRequest'];
    return MyFamily(
      family: family is Map ? _family(_cast(family)) : null,
      pendingRequest: request is Map ? _pendingRequest(_cast(request)) : null,
    );
  }

  static FamilyInvite invite(Map<String, Object?> json) => FamilyInvite(
    code: _string(json, 'code'),
    link: Uri.parse(_string(json, 'link')),
    expiresAt: _date(json, 'expiresAt'),
  );

  static FamilyInvitePreview preview(Map<String, Object?> json) =>
      FamilyInvitePreview(
        familyName: _string(json, 'familyName'),
        ownerFirstName: json['ownerFirstName'] as String?,
        memberCount: json['memberCount'] as int? ?? 0,
        maxMembers: json['maxMembers'] as int? ?? 0,
        full: json['full'] == true,
      );

  static IncomingJoinRequest joinRequest(Map<String, Object?> json) =>
      IncomingJoinRequest(
        id: _string(json, 'id'),
        userId: _string(json, 'userId'),
        firstName: json['firstName'] as String? ?? '',
        lastName: json['lastName'] as String? ?? '',
        avatar: ProfileAvatar.tryParse(json['avatar']),
        createdAt: _date(json, 'createdAt'),
        expiresAt: _date(json, 'expiresAt'),
      );

  static Family _family(Map<String, Object?> json) {
    final members = [
      for (final member
          in (json['members'] as List?)?.whereType<Map<Object?, Object?>>() ??
              const <Map<Object?, Object?>>[])
        _member(_cast(member)),
    ]..sort(_ownerFirst);
    return Family(
      id: _string(json, 'id'),
      name: _string(json, 'name'),
      myRole: _role(json['myRole']),
      mySharing: sharing(json['mySharing']),
      maxMembers: json['maxMembers'] as int? ?? members.length,
      members: members,
      pendingRequestCount: json['pendingRequestCount'] as int? ?? 0,
    );
  }

  static FamilyMember _member(Map<String, Object?> json) => FamilyMember(
    userId: _string(json, 'userId'),
    firstName: json['firstName'] as String? ?? '',
    lastName: json['lastName'] as String? ?? '',
    role: _role(json['role']),
    joinedAt: _date(json, 'joinedAt'),
    avatar: ProfileAvatar.tryParse(json['avatar']),
    phoneNumber: json['phoneNumber'] as String?,
    sharing: sharing(json['sharing']),
  );

  static PendingJoinRequest _pendingRequest(Map<String, Object?> json) =>
      PendingJoinRequest(
        id: _string(json, 'id'),
        familyName: _string(json, 'familyName'),
        createdAt: _date(json, 'createdAt'),
        expiresAt: _date(json, 'expiresAt'),
      );

  static FamilySharing sharing(Object? json) {
    if (json is! Map) return const FamilySharing();
    return FamilySharing(
      phone: json['phone'] == true,
      incidents: json['incidents'] == true,
      health: json['health'] == true,
    );
  }

  static Map<String, Object?> sharingToJson(FamilySharing sharing) => {
    'phone': sharing.phone,
    'incidents': sharing.incidents,
    'health': sharing.health,
  };

  static int _ownerFirst(FamilyMember a, FamilyMember b) {
    if (a.role != b.role) return a.role == FamilyRole.owner ? -1 : 1;
    return a.joinedAt.compareTo(b.joinedAt);
  }

  static FamilyRole _role(Object? value) =>
      value == 'OWNER' ? FamilyRole.owner : FamilyRole.member;

  static Map<String, Object?> _cast(Map<Object?, Object?> map) =>
      Map<String, Object?>.from(map);

  static String _string(Map<String, Object?> json, String key) {
    final value = json[key];
    if (value is String && value.isNotEmpty) return value;
    throw FormatException('Missing family field: $key');
  }

  static DateTime _date(Map<String, Object?> json, String key) {
    final value = DateTime.tryParse(json[key] as String? ?? '');
    if (value == null) throw FormatException('Invalid family date: $key');
    return value;
  }
}
