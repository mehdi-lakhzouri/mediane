import 'package:driver_health_app/core/session/account_state.dart';

enum Gender {
  male('MALE', 'Male'),
  female('FEMALE', 'Female');

  new(this.wire, this.label);

  final String wire;
  final String label;

  static Gender? fromWire(Object? value) {
    for (final gender in values) {
      if (gender.wire == value) return gender;
    }
    return null;
  }
}

enum ContactRelationship {
  spouse('SPOUSE', 'Spouse'),
  parent('PARENT', 'Parent'),
  child('CHILD', 'Child'),
  sibling('SIBLING', 'Sibling'),
  relative('RELATIVE', 'Relative'),
  friend('FRIEND', 'Friend'),
  colleague('COLLEAGUE', 'Colleague'),
  other('OTHER', 'Other');

  new(this.wire, this.label);

  final String wire;
  final String label;

  static ContactRelationship fromWire(Object? value) {
    for (final relationship in values) {
      if (relationship.wire == value) return relationship;
    }
    return ContactRelationship.other;
  }
}

/// Someone to call after an incident. List order is call priority.
class EmergencyContact {
  const new({
    required this.fullName,
    required this.relationship,
    required this.phoneNumber,
  });

  factory fromJson(Map<String, Object?> json) => EmergencyContact(
    fullName: json['fullName'] as String? ?? '',
    relationship: ContactRelationship.fromWire(json['relationship']),
    phoneNumber: json['phoneNumber'] as String? ?? '',
  );

  final String fullName;
  final ContactRelationship relationship;

  /// E.164.
  final String phoneNumber;

  String get initials {
    final parts = fullName
        .trim()
        .split(RegExp(r'\s+'))
        .where((part) => part.isNotEmpty)
        .toList();
    if (parts.isEmpty) return '?';
    final first = parts.first.substring(0, 1);
    final last = parts.length > 1 ? parts.last.substring(0, 1) : '';
    return (first + last).toUpperCase();
  }

  Map<String, Object?> toJson() => {
    'fullName': fullName,
    'relationship': relationship.wire,
    'phoneNumber': phoneNumber,
  };
}

/// Signed, short-lived URL; reload the profile once it expires.
class ProfileAvatar {
  const new({required this.url, required this.expiresAt});

  /// Parses `{ url, expiresAt }`; `null` when absent or malformed.
  static ProfileAvatar? tryParse(Object? json) {
    if (json is! Map) return null;
    final url = Uri.tryParse(json['url'] as String? ?? '');
    final expiresAt = DateTime.tryParse(json['expiresAt'] as String? ?? '');
    if (url == null || expiresAt == null) return null;
    return ProfileAvatar(url: url, expiresAt: expiresAt);
  }

  final Uri url;
  final DateTime expiresAt;
}

class DriverProfile {
  const new({
    required this.phoneNumber,
    required this.dateOfBirth,
    required this.gender,
    required this.emergencyContacts,
    required this.avatar,
    required this.completedAt,
    required this.accountState,
  });

  final String? phoneNumber;

  /// Calendar date, no time zone.
  final DateTime? dateOfBirth;
  final Gender? gender;
  final List<EmergencyContact> emergencyContacts;
  final ProfileAvatar? avatar;
  final DateTime? completedAt;
  final AccountState accountState;
}

/// Everything `PUT /profile` replaces at once.
class ProfileDetails {
  const new({
    required this.phoneNumber,
    required this.dateOfBirth,
    required this.gender,
    required this.emergencyContacts,
  });

  final String phoneNumber;
  final DateTime dateOfBirth;
  final Gender gender;
  final List<EmergencyContact> emergencyContacts;

  Map<String, Object?> toJson() => {
    'phoneNumber': phoneNumber,
    'dateOfBirth': formatCalendarDate(dateOfBirth),
    'gender': gender.wire,
    'emergencyContacts': [
      for (final contact in emergencyContacts) contact.toJson(),
    ],
  };
}

String formatCalendarDate(DateTime date) =>
    '${date.year.toString().padLeft(4, '0')}-'
    '${date.month.toString().padLeft(2, '0')}-'
    '${date.day.toString().padLeft(2, '0')}';

DateTime? parseCalendarDate(Object? value) {
  if (value is! String) return null;
  final match = RegExp(r'^(\d{4})-(\d{2})-(\d{2})').firstMatch(value);
  if (match == null) return null;
  return DateTime(
    int.parse(match[1]!),
    int.parse(match[2]!),
    int.parse(match[3]!),
  );
}
