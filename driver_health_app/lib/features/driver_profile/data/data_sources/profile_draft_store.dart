import 'dart:convert';

import 'package:driver_health_app/features/driver_profile/domain/entities/driver_profile.dart';
import 'package:flutter/services.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Unsaved onboarding answers. Kept in the keystore because they include
/// personal data, scoped per user, and never containing passwords.
class ProfileDraft {
  const new({
    this.phoneNumber,
    this.dateOfBirth,
    this.gender,
    this.emergencyContacts = const [],
  });

  final String? phoneNumber;
  final DateTime? dateOfBirth;
  final Gender? gender;
  final List<EmergencyContact> emergencyContacts;
}

class ProfileDraftStore {
  const new(this._storage);

  final FlutterSecureStorage _storage;

  static String _key(String userId) => 'profileDraft.$userId';

  Future<ProfileDraft?> read(String userId) async {
    try {
      final raw = await _storage.read(key: _key(userId));
      if (raw == null) return null;
      final json = jsonDecode(raw);
      if (json is! Map) return null;
      final contacts = json['emergencyContacts'];
      return ProfileDraft(
        phoneNumber: json['phoneNumber'] as String?,
        dateOfBirth: parseCalendarDate(json['dateOfBirth']),
        gender: Gender.fromWire(json['gender']),
        emergencyContacts: [
          if (contacts is List)
            for (final contact in contacts.whereType<Map<Object?, Object?>>())
              EmergencyContact.fromJson(Map<String, Object?>.from(contact)),
        ],
      );
    } on Object {
      // A draft is a convenience; an unreadable one is simply dropped.
      await clear(userId);
      return null;
    }
  }

  Future<void> write(String userId, ProfileDraft draft) async {
    try {
      await _storage.write(
        key: _key(userId),
        value: jsonEncode({
          'phoneNumber': draft.phoneNumber,
          'dateOfBirth': draft.dateOfBirth == null
              ? null
              : formatCalendarDate(draft.dateOfBirth!),
          'gender': draft.gender?.wire,
          'emergencyContacts': [
            for (final contact in draft.emergencyContacts) contact.toJson(),
          ],
        }),
      );
    } on PlatformException {
      // Losing a draft must never block onboarding.
    }
  }

  Future<void> clear(String userId) async {
    try {
      await _storage.delete(key: _key(userId));
    } on PlatformException {
      // The next write replaces it.
    }
  }
}
