/// Family API payloads for flow tests. The signed-in driver is
/// [meId], as in `sessionJson`.
const meId = '7b0b8f8e-2f7a-4d6b-9a52-111111111111';
const karimId = '7b0b8f8e-2f7a-4d6b-9a52-222222222222';
const nourId = '7b0b8f8e-2f7a-4d6b-9a52-333333333333';

Map<String, Object?> memberJson({
  required String userId,
  required String firstName,
  String lastName = 'Ben Salah',
  String role = 'MEMBER',
  String joinedAt = '2026-09-01T10:00:00Z',
  bool sharesPhone = false,
}) {
  return {
    'userId': userId,
    'firstName': firstName,
    'lastName': lastName,
    'role': role,
    'joinedAt': joinedAt,
    'avatar': null,
    'phoneNumber': sharesPhone ? '+21655111222' : null,
    'sharing': {'phone': sharesPhone, 'incidents': false, 'health': false},
  };
}

/// `{ family, pendingRequest }` as returned by `GET /families/mine`.
Map<String, Object?> myFamilyJson({
  bool inFamily = true,
  bool owner = true,
  int pendingRequestCount = 0,
  List<Map<String, Object?>>? members,
  Map<String, Object?> mySharing = const {
    'phone': false,
    'incidents': false,
    'health': false,
  },
  bool pendingRequest = false,
}) {
  return {
    'family': inFamily
        ? {
            'id': 'family-1',
            'name': 'Ben Salah',
            'myRole': owner ? 'OWNER' : 'MEMBER',
            'mySharing': mySharing,
            'maxMembers': 10,
            'members':
                members ??
                [
                  memberJson(
                    userId: karimId,
                    firstName: 'Karim',
                    joinedAt: '2026-09-05T10:00:00Z',
                    role: owner ? 'MEMBER' : 'OWNER',
                    sharesPhone: true,
                  ),
                  memberJson(
                    userId: meId,
                    firstName: 'Amira',
                    lastName: 'Haddad',
                    role: owner ? 'OWNER' : 'MEMBER',
                  ),
                ],
            'pendingRequestCount': owner ? pendingRequestCount : null,
          }
        : null,
    'pendingRequest': pendingRequest
        ? {
            'id': 'request-1',
            'familyName': 'Ben Salah',
            'status': 'PENDING',
            'createdAt': '2026-10-02T10:00:00Z',
            'expiresAt': '2026-10-09T10:00:00Z',
          }
        : null,
  };
}

const noFamilyJson = {'family': null, 'pendingRequest': null};
