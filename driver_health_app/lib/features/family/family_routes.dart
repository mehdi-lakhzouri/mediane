import 'package:driver_health_app/app/router/app_routes.dart';
import 'package:driver_health_app/core/navigation/link_token.dart';
import 'package:driver_health_app/features/family/presentation/screens/family_preview_screen.dart';
import 'package:driver_health_app/features/family/presentation/screens/family_sharing_screen.dart';
import 'package:driver_health_app/features/family/presentation/screens/invite_code_screen.dart';
import 'package:driver_health_app/features/family/presentation/screens/join_requests_screen.dart';
import 'package:driver_health_app/features/family/presentation/screens/member_detail_screen.dart';
import 'package:driver_health_app/features/family/presentation/screens/scan_invite_screen.dart';
import 'package:go_router/go_router.dart';

/// Screens pushed above the tab shell. The Family tab itself
/// ([AppRoutes.family]) lives in the shell's branches.
final List<RouteBase> familyRoutes = [
  GoRoute(
    path: AppRoutes.familyJoin,
    name: 'familyJoin',
    builder: (context, state) =>
        FamilyPreviewScreen(code: state.uri.queryParameters['code'] ?? ''),
  ),
  GoRoute(
    path: AppRoutes.joinFamilyLink,
    name: 'joinFamilyLink',
    // Shared links carry the code in the fragment: /join-family#K7M4-QX9P.
    builder: (context, state) =>
        FamilyPreviewScreen(code: linkToken(state.uri)),
  ),
  GoRoute(
    path: AppRoutes.familyScan,
    name: 'familyScan',
    builder: (context, state) => const ScanInviteScreen(),
  ),
  GoRoute(
    path: AppRoutes.familyInvite,
    name: 'familyInvite',
    builder: (context, state) => const InviteCodeScreen(),
  ),
  GoRoute(
    path: AppRoutes.familyRequests,
    name: 'familyRequests',
    builder: (context, state) => const JoinRequestsScreen(),
  ),
  GoRoute(
    path: AppRoutes.familySharing,
    name: 'familySharing',
    builder: (context, state) => const FamilySharingScreen(),
  ),
  GoRoute(
    path: AppRoutes.familyMemberPattern,
    name: 'familyMember',
    builder: (context, state) =>
        MemberDetailScreen(userId: state.pathParameters['userId'] ?? ''),
  ),
];
