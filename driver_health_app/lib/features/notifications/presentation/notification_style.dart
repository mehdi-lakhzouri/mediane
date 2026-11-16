import 'dart:async';

import 'package:driver_health_app/app/router/app_routes.dart';
import 'package:driver_health_app/core/theme/app_colors.dart';
import 'package:driver_health_app/features/notifications/domain/app_notification.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

abstract final class NotificationStyle {
  static IconData icon(AppNotification notification) =>
      switch (notification.category) {
        NotificationCategory.safety =>
          notification.critical
              ? Icons.crisis_alert_rounded
              : Icons.health_and_safety_rounded,
        NotificationCategory.family => Icons.groups_rounded,
        NotificationCategory.security => Icons.shield_rounded,
        NotificationCategory.account => Icons.campaign_rounded,
      };

  static Color color(AppNotification notification) =>
      switch (notification.category) {
        NotificationCategory.safety =>
          notification.critical ? AppColors.coral : const Color(0xFFFF9F43),
        NotificationCategory.family => AppColors.cyan,
        NotificationCategory.security => const Color(0xFFFFC857),
        NotificationCategory.account => AppColors.mint,
      };

  static String categoryLabel(NotificationCategory category) =>
      switch (category) {
        NotificationCategory.safety => 'Safety',
        NotificationCategory.family => 'Family',
        NotificationCategory.security => 'Security',
        NotificationCategory.account => 'Mediane',
      };
}

/// Tabs are switched to; every other destination is pushed on top.
const Set<String> _tabRoutes = {
  AppRoutes.home,
  AppRoutes.history,
  AppRoutes.family,
  AppRoutes.profile,
};

/// Opens the in-app route a notification points to. Only app paths are
/// accepted: a link is never a web address.
void openNotificationLink(BuildContext context, String? link) {
  if (link == null || !link.startsWith('/')) return;
  if (_tabRoutes.contains(link)) {
    context.go(link);
  } else {
    unawaited(context.push(link));
  }
}
