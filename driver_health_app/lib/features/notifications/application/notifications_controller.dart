import 'package:driver_health_app/core/network/api_failure.dart';
import 'package:driver_health_app/core/network/network_providers.dart';
import 'package:driver_health_app/core/state/data_changes.dart';
import 'package:driver_health_app/features/notifications/data/remote_notifications_repository.dart';
import 'package:driver_health_app/features/notifications/domain/app_notification.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final notificationsRepositoryProvider = Provider<RemoteNotificationsRepository>(
  (ref) => RemoteNotificationsRepository(ref.watch(dioProvider)),
);

class NotificationsState {
  const new({
    required this.items,
    required this.page,
    required this.hasMore,
    this.loadingMore = false,
  });

  final List<AppNotification> items;
  final int page;
  final bool hasMore;
  final bool loadingMore;

  bool get hasUnread => items.any((n) => n.unread);

  NotificationsState copyWith({
    List<AppNotification>? items,
    int? page,
    bool? hasMore,
    bool? loadingMore,
  }) => NotificationsState(
    items: items ?? this.items,
    page: page ?? this.page,
    hasMore: hasMore ?? this.hasMore,
    loadingMore: loadingMore ?? this.loadingMore,
  );
}

/// The notification center. Reading is optimistic: the dot disappears at
/// once and the server catches up; the home badge refreshes through
/// [dataChangesProvider].
final AsyncNotifierProvider<NotificationsController, NotificationsState>
notificationsControllerProvider = AsyncNotifierProvider.autoDispose(
  NotificationsController.new,
);

class NotificationsController extends AsyncNotifier<NotificationsState> {
  RemoteNotificationsRepository get _repository =>
      ref.read(notificationsRepositoryProvider);

  @override
  Future<NotificationsState> build() => _firstPage();

  Future<void> refresh() async {
    state = await AsyncValue.guard(_firstPage);
  }

  Future<void> loadMore() async {
    final current = state.value;
    if (current == null || !current.hasMore || current.loadingMore) return;
    state = AsyncData(current.copyWith(loadingMore: true));
    try {
      final next = await _repository.list(page: current.page + 1);
      if (!ref.mounted) return;
      final known = {for (final n in current.items) n.id};
      state = AsyncData(
        current.copyWith(
          items: [
            ...current.items,
            for (final n in next.items)
              if (!known.contains(n.id)) n,
          ],
          page: next.page.page,
          hasMore: next.page.hasMore,
          loadingMore: false,
        ),
      );
    } on Object {
      if (ref.mounted) state = AsyncData(current.copyWith(loadingMore: false));
    }
  }

  /// Marks one as read; failures are silent (it stays unread on the server
  /// and shows again on the next refresh).
  Future<void> markRead(String notificationId) async {
    final current = state.value;
    if (current == null) return;
    final target = current.items.where((n) => n.id == notificationId);
    if (target.isEmpty || !target.first.unread) return;
    _apply(current, (n) => n.id == notificationId);
    try {
      await _repository.markRead(notificationId);
      ref.read(dataChangesProvider.notifier).markChanged();
    } on Object {
      // Kept as read locally; the next refresh shows the server's truth.
    }
  }

  Future<ApiFailure?> markAllRead() async {
    final current = state.value;
    if (current == null || !current.hasUnread) return null;
    try {
      await _repository.markAllRead();
      if (ref.mounted) _apply(current, (_) => true);
      ref.read(dataChangesProvider.notifier).markChanged();
      return null;
    } on Object catch (error) {
      return ApiFailure.from(error);
    }
  }

  void _apply(
    NotificationsState current,
    bool Function(AppNotification n) matches,
  ) {
    final now = DateTime.now();
    state = AsyncData(
      current.copyWith(
        items: [
          for (final n in current.items)
            if (matches(n)) n.markedRead(now) else n,
        ],
      ),
    );
  }

  Future<NotificationsState> _firstPage() async {
    final first = await ref.read(notificationsRepositoryProvider).list(page: 1);
    return NotificationsState(
      items: first.items,
      page: first.page.page,
      hasMore: first.page.hasMore,
    );
  }
}

/// Mute settings, saved as a whole.
final AsyncNotifierProvider<
  NotificationPreferencesController,
  NotificationPreferences
>
notificationPreferencesProvider = AsyncNotifierProvider.autoDispose(
  NotificationPreferencesController.new,
);

class NotificationPreferencesController
    extends AsyncNotifier<NotificationPreferences> {
  @override
  Future<NotificationPreferences> build() =>
      ref.read(notificationsRepositoryProvider).preferences();

  /// Returns the failure to show, or `null` once saved.
  Future<ApiFailure?> save(NotificationPreferences preferences) async {
    try {
      final saved = await ref
          .read(notificationsRepositoryProvider)
          .savePreferences(preferences);
      if (ref.mounted) state = AsyncData(saved);
      return null;
    } on Object catch (error) {
      return ApiFailure.from(error);
    }
  }
}
