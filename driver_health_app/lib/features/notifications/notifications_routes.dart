import 'package:driver_health_app/app/router/app_routes.dart';
import 'package:driver_health_app/features/notifications/presentation/screens/notification_center_screen.dart';
import 'package:driver_health_app/features/notifications/presentation/screens/notification_preferences_screen.dart';
import 'package:go_router/go_router.dart';

final List<RouteBase> notificationsRoutes = [
  GoRoute(
    path: AppRoutes.notifications,
    name: 'notifications',
    builder: (context, state) => const NotificationCenterScreen(),
  ),
  GoRoute(
    path: AppRoutes.notificationPreferences,
    name: 'notificationPreferences',
    builder: (context, state) => const NotificationPreferencesScreen(),
  ),
];
