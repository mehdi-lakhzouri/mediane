import 'package:driver_health_app/features/family/data/family_json.dart';
import 'package:driver_health_app/features/family/domain/entities/family.dart';
import 'package:driver_health_app/features/family/domain/family_code.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/family_fixtures.dart';

void main() {
  group('FamilyCode', () {
    test('normalizes case, spaces and dashes like the backend', () {
      expect(FamilyCode.normalize(' k7m4-qx9p '), 'K7M4QX9P');
      expect(FamilyCode.format('k7m4 qx9p'), 'K7M4-QX9P');
      expect(FamilyCode.isValid('K7M4QX9'), isFalse);
    });

    test('extracts the code from links, QR content or typed text', () {
      expect(
        FamilyCode.extract('https://cabinguard.app/join-family#K7M4-QX9P'),
        'K7M4-QX9P',
      );
      expect(FamilyCode.extract('k7m4qx9p'), 'K7M4-QX9P');
      expect(FamilyCode.extract('https://example.com/'), isNull);
      expect(FamilyCode.extract('hello'), isNull);
    });
  });

  group('FamilyJson', () {
    test('lists the owner first, then members by join date', () {
      final mine = FamilyJson.myFamily(
        myFamilyJson(
          members: [
            memberJson(
              userId: nourId,
              firstName: 'Nour',
              joinedAt: '2026-09-10T10:00:00Z',
            ),
            memberJson(
              userId: karimId,
              firstName: 'Karim',
              joinedAt: '2026-09-02T10:00:00Z',
            ),
            memberJson(userId: meId, firstName: 'Amira', role: 'OWNER'),
          ],
        ),
      );

      expect(mine.family?.members.map((m) => m.firstName), [
        'Amira',
        'Karim',
        'Nour',
      ]);
      expect(mine.family?.isOwner, isTrue);
      expect(mine.pendingRequest, isNull);
    });

    test('maps a pending request when not in a family', () {
      final mine = FamilyJson.myFamily(
        myFamilyJson(inFamily: false, pendingRequest: true),
      );
      expect(mine.family, isNull);
      expect(mine.pendingRequest?.familyName, 'Ben Salah');
    });
  });

  test('summarizes what a member shares', () {
    expect(const FamilySharing().summary, 'Shares name and photo only');
    expect(const FamilySharing(phone: true).summary, 'Phone shared');
    expect(
      const FamilySharing(phone: true, incidents: true, health: true).summary,
      'Phone, incidents and health shared',
    );
  });
}
