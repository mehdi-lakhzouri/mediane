import 'dart:async';

import 'package:collection/collection.dart';
import 'package:driver_health_app/app/router/app_routes.dart';
import 'package:driver_health_app/core/network/api_failure.dart';
import 'package:driver_health_app/core/presentation/widgets/content_page.dart';
import 'package:driver_health_app/core/presentation/widgets/inline_message.dart';
import 'package:driver_health_app/core/presentation/widgets/surface_card.dart';
import 'package:driver_health_app/core/theme/app_colors.dart';
import 'package:driver_health_app/features/notifications/application/notifications_controller.dart';
import 'package:driver_health_app/features/notifications/domain/app_notification.dart';
import 'package:driver_health_app/features/notifications/presentation/notification_style.dart';
import 'package:driver_health_app/features/safety/presentation/safety_copy.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

/// Notification center: newest first, grouped by day. Opening one marks it
/// read and goes where it points.
class NotificationCenterScreen extends ConsumerWidget {
  const new({super.key});

  static const markAllKey = Key('notifications.markAll');
  static const settingsKey = Key('notifications.settings');

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final notifications = ref.watch(notificationsControllerProvider);
    final controller = ref.read(notificationsControllerProvider.notifier);
    final hasUnread = notifications.value?.hasUnread ?? false;

    Future<void> markAll() async {
      final failure = await controller.markAllRead();
      if (failure != null && context.mounted) {
        ScaffoldMessenger.of(context)
          ..hideCurrentSnackBar()
          ..showSnackBar(SnackBar(content: Text(failure.message)));
      }
    }

    return Scaffold(
      backgroundColor: Colors.transparent,
      body: ContentPage(
        title: 'Notifications',
        entranceKey: notifications.hasValue,
        onBack: () =>
            context.canPop() ? context.pop() : context.go(AppRoutes.home),
        onRefresh: controller.refresh,
        trailing: IconButton(
          key: settingsKey,
          tooltip: 'Notification settings',
          color: AppColors.ice,
          onPressed: () =>
              unawaited(context.push(AppRoutes.notificationPreferences)),
          icon: const Icon(Icons.tune_rounded),
        ),
        children: [
          if (hasUnread)
            Align(
              alignment: Alignment.centerRight,
              child: TextButton.icon(
                key: markAllKey,
                onPressed: () => unawaited(markAll()),
                icon: const Icon(Icons.done_all_rounded, color: AppColors.cyan),
                label: const Text(
                  'Mark all as read',
                  style: TextStyle(color: AppColors.cyan),
                ),
              ),
            ),
          ...switch (notifications) {
            AsyncData(:final value) => _list(context, value, controller),
            AsyncError(:final error) => [
              InlineMessage(message: ApiFailure.from(error).message),
              TextButton(
                onPressed: () => unawaited(controller.refresh()),
                child: const Text(
                  'Try again',
                  style: TextStyle(color: AppColors.cyan),
                ),
              ),
            ],
            _ => const [
              Padding(
                padding: EdgeInsets.all(32),
                child: Center(
                  child: CircularProgressIndicator(color: AppColors.cyan),
                ),
              ),
            ],
          },
        ],
      ),
    );
  }

  List<Widget> _list(
    BuildContext context,
    NotificationsState state,
    NotificationsController controller,
  ) {
    if (state.items.isEmpty) return const [_Empty()];
    final byDay = groupBy(
      state.items,
      (n) => DateUtils.dateOnly(n.createdAt.toLocal()),
    );
    return [
      for (final MapEntry(key: day, value: items) in byDay.entries) ...[
        Padding(
          padding: const EdgeInsets.only(top: 8, bottom: 10),
          child: Semantics(
            header: true,
            child: Text(
              SafetyCopy.day(day),
              style: const TextStyle(
                color: AppColors.ice,
                fontSize: 15,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ),
        for (final notification in items)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: _NotificationTile(
              notification: notification,
              onTap: () {
                unawaited(controller.markRead(notification.id));
                openNotificationLink(context, notification.link);
              },
            ),
          ),
      ],
      if (state.hasMore)
        Center(
          child: state.loadingMore
              ? const Padding(
                  padding: EdgeInsets.all(12),
                  child: CircularProgressIndicator(color: AppColors.cyan),
                )
              : TextButton(
                  onPressed: () => unawaited(controller.loadMore()),
                  child: const Text(
                    'Show older notifications',
                    style: TextStyle(color: AppColors.cyan),
                  ),
                ),
        ),
      const SizedBox(height: 8),
      const Text(
        'Notifications are kept for 90 days.',
        textAlign: TextAlign.center,
        style: TextStyle(color: AppColors.slate, fontSize: 13),
      ),
    ];
  }
}

class _NotificationTile extends StatelessWidget {
  const new({required this.notification, required this.onTap});

  final AppNotification notification;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final color = NotificationStyle.color(notification);
    final time = DateFormat.Hm().format(notification.createdAt.toLocal());
    final unread = notification.unread;
    return Semantics(
      button: notification.link != null,
      label:
          '${unread ? 'Unread. ' : ''}${notification.title}. '
          '${notification.body}',
      excludeSemantics: true,
      child: SurfaceCard(
        highlighted: unread && notification.critical,
        onTap: onTap,
        padding: const EdgeInsets.all(14),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            CircleAvatar(
              radius: 22,
              backgroundColor: color.withValues(alpha: 0.16),
              child: Icon(NotificationStyle.icon(notification), color: color),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          notification.title,
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 16,
                            fontWeight: unread
                                ? FontWeight.w800
                                : FontWeight.w600,
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        time,
                        style: const TextStyle(
                          color: AppColors.slate,
                          fontSize: 13,
                        ),
                      ),
                      if (unread) ...[
                        const SizedBox(width: 8),
                        Container(
                          width: 9,
                          height: 9,
                          decoration: const BoxDecoration(
                            color: AppColors.cyan,
                            shape: BoxShape.circle,
                          ),
                        ),
                      ],
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    notification.body,
                    style: TextStyle(
                      color: unread ? AppColors.ice : AppColors.slate,
                      height: 1.35,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    NotificationStyle.categoryLabel(notification.category),
                    style: TextStyle(
                      color: color,
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Empty extends StatelessWidget {
  const new();

  @override
  Widget build(BuildContext context) {
    return const SurfaceCard(
      padding: EdgeInsets.all(24),
      child: Column(
        children: [
          Icon(
            Icons.notifications_none_rounded,
            color: AppColors.cyan,
            size: 44,
          ),
          SizedBox(height: 12),
          Text(
            'You are all caught up',
            style: TextStyle(
              color: Colors.white,
              fontSize: 18,
              fontWeight: FontWeight.w800,
            ),
          ),
          SizedBox(height: 6),
          Text(
            'Alerts, family news and security updates appear here.',
            textAlign: TextAlign.center,
            style: TextStyle(color: AppColors.slate, height: 1.4),
          ),
        ],
      ),
    );
  }
}
