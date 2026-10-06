import 'package:driver_health_app/features/family/domain/entities/family.dart';
import 'package:driver_health_app/features/family/domain/entities/family_invite.dart';

/// Family operations for the signed-in driver. Every mutation returns the
/// driver's updated [MyFamily] when the backend provides it, so callers
/// never have to guess the resulting state.
abstract interface class FamilyRepository {
  Future<MyFamily> mine();

  Future<MyFamily> create(String name);

  Future<MyFamily> rename(String name);

  Future<void> dissolve();

  Future<MyFamily> leave();

  Future<FamilyInvite> invite();

  Future<FamilyInvite> rotateInvite();

  Future<FamilyInvitePreview> preview(String code);

  Future<MyFamily> requestToJoin(String code);

  Future<void> cancelJoinRequest();

  Future<List<IncomingJoinRequest>> joinRequests();

  Future<MyFamily> approve(String requestId);

  Future<void> reject(String requestId);

  Future<MyFamily> removeMember(String userId);

  Future<MyFamily> transferOwnership(String userId);

  /// Only the flags given are changed.
  Future<MyFamily> updateSharing(FamilySharing sharing);
}
