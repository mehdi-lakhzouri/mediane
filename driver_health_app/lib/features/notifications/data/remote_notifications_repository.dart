import 'package:dio/dio.dart';
import 'package:driver_health_app/core/network/api_envelope.dart';
import 'package:driver_health_app/features/notifications/domain/app_notification.dart';

class NotificationPage {
  const new({required this.items, required this.page});

  final List<AppNotification> items;
  final PageInfo page;
}

class RemoteNotificationsRepository {
  const new(this._dio);

  static const pageSize = 30;

  final Dio _dio;

  Future<NotificationPage> list({required int page}) async {
    final response = await _dio.get<Object?>(
      'notifications',
      queryParameters: {'page': page, 'pageSize': pageSize},
    );
    final items = [
      for (final item in ApiEnvelope.list(response.data)) notification(item),
    ];
    return NotificationPage(
      items: items,
      page:
          ApiEnvelope.page(response.data) ??
          PageInfo(page: page, totalPages: page, totalItems: items.length),
    );
  }

  Future<void> markRead(String notificationId) async {
    final response = await _dio.post<Object?>(
      'notifications/${Uri.encodeComponent(notificationId)}/read',
    );
    ApiEnvelope.empty(response.data);
  }

  Future<void> markAllRead() async {
    final response = await _dio.post<Object?>('notifications/read-all');
    ApiEnvelope.data(response.data);
  }

  Future<NotificationPreferences> preferences() async {
    final response = await _dio.get<Object?>('notification-preferences');
    return _preferences(ApiEnvelope.data(response.data));
  }

  Future<NotificationPreferences> savePreferences(
    NotificationPreferences preferences,
  ) async {
    final response = await _dio.put<Object?>(
      'notification-preferences',
      data: {
        'safety': preferences.safety,
        'family': preferences.family,
        'account': preferences.account,
        'showNamesOnLockScreen': preferences.showNamesOnLockScreen,
      },
    );
    return _preferences(ApiEnvelope.data(response.data));
  }

  static AppNotification notification(Map<String, Object?> json) {
    final createdAt = DateTime.tryParse(json['createdAt'] as String? ?? '');
    final id = json['id'];
    if (id is! String || createdAt == null) {
      throw const FormatException('Invalid notification');
    }
    return AppNotification(
      id: id,
      category: switch (json['category']) {
        'SAFETY' => NotificationCategory.safety,
        'FAMILY' => NotificationCategory.family,
        'SECURITY' => NotificationCategory.security,
        _ => NotificationCategory.account,
      },
      type: json['type'] as String? ?? '',
      title: json['title'] as String? ?? '',
      body: json['body'] as String? ?? '',
      link: json['link'] as String?,
      critical: json['critical'] == true,
      readAt: DateTime.tryParse(json['readAt'] as String? ?? ''),
      createdAt: createdAt,
    );
  }

  static NotificationPreferences _preferences(Map<String, Object?> json) =>
      NotificationPreferences(
        safety: json['safety'] != false,
        family: json['family'] != false,
        account: json['account'] != false,
        showNamesOnLockScreen: json['showNamesOnLockScreen'] == true,
      );
}
