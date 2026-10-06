import 'package:dio/dio.dart';
import 'package:driver_health_app/core/network/api_envelope.dart';
import 'package:driver_health_app/features/family/data/family_json.dart';
import 'package:driver_health_app/features/family/domain/entities/family.dart';
import 'package:driver_health_app/features/family/domain/entities/family_invite.dart';
import 'package:driver_health_app/features/family/domain/family_code.dart';
import 'package:driver_health_app/features/family/domain/repositories/family_repository.dart';

class RemoteFamilyRepository implements FamilyRepository {
  const new(this._dio);

  final Dio _dio;

  @override
  Future<MyFamily> mine() => _myFamily(_dio.get<Object?>('families/mine'));

  @override
  Future<MyFamily> create(String name) =>
      _myFamily(_dio.post<Object?>('families', data: {'name': name.trim()}));

  @override
  Future<MyFamily> rename(String name) => _myFamily(
    _dio.patch<Object?>('families/mine', data: {'name': name.trim()}),
  );

  @override
  Future<void> dissolve() => _empty(_dio.delete<Object?>('families/mine'));

  @override
  Future<MyFamily> leave() =>
      _myFamily(_dio.post<Object?>('families/mine/leave'));

  @override
  Future<FamilyInvite> invite() async {
    final response = await _dio.get<Object?>('families/mine/invite');
    return FamilyJson.invite(ApiEnvelope.data(response.data));
  }

  @override
  Future<FamilyInvite> rotateInvite() async {
    final response = await _dio.post<Object?>('families/mine/invite/rotate');
    return FamilyJson.invite(ApiEnvelope.data(response.data));
  }

  @override
  Future<FamilyInvitePreview> preview(String code) async {
    final response = await _dio.get<Object?>(
      'families/invites/${Uri.encodeComponent(FamilyCode.normalize(code))}',
    );
    return FamilyJson.preview(ApiEnvelope.data(response.data));
  }

  @override
  Future<MyFamily> requestToJoin(String code) => _myFamily(
    _dio.post<Object?>(
      'families/join',
      data: {'code': FamilyCode.format(code)},
    ),
  );

  @override
  Future<void> cancelJoinRequest() =>
      _empty(_dio.delete<Object?>('families/join-request'));

  @override
  Future<List<IncomingJoinRequest>> joinRequests() async {
    final response = await _dio.get<Object?>('families/mine/join-requests');
    final payload = response.data;
    ApiEnvelope.empty(payload);
    final data = (payload is Map ? payload['data'] : null) as List? ?? const [];
    return [
      for (final item in data.whereType<Map<Object?, Object?>>())
        FamilyJson.joinRequest(Map<String, Object?>.from(item)),
    ];
  }

  @override
  Future<MyFamily> approve(String requestId) => _myFamily(
    _dio.post<Object?>('families/mine/join-requests/$requestId/approve'),
  );

  @override
  Future<void> reject(String requestId) => _empty(
    _dio.post<Object?>('families/mine/join-requests/$requestId/reject'),
  );

  @override
  Future<MyFamily> removeMember(String userId) =>
      _myFamily(_dio.delete<Object?>('families/mine/members/$userId'));

  @override
  Future<MyFamily> transferOwnership(String userId) => _myFamily(
    _dio.post<Object?>('families/mine/owner', data: {'userId': userId}),
  );

  @override
  Future<MyFamily> updateSharing(FamilySharing sharing) => _myFamily(
    _dio.put<Object?>(
      'families/mine/sharing',
      data: FamilyJson.sharingToJson(sharing),
    ),
  );

  static Future<MyFamily> _myFamily(Future<Response<Object?>> request) async {
    final response = await request;
    return FamilyJson.myFamily(ApiEnvelope.data(response.data));
  }

  static Future<void> _empty(Future<Response<Object?>> request) async {
    final response = await request;
    ApiEnvelope.empty(response.data);
  }
}
