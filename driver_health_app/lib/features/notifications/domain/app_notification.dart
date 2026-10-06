import 'package:flutter/foundation.dart' show immutable;

enum NotificationCategory { safety, family, security, account }

/// One entry of the notification center. Written by the server for this
/// driver; never carries medical details.
class AppNotification {
  const new({
    required this.id,
    required this.category,
    required this.type,
    required this.title,
    required this.body,
    required this.createdAt,
    this.link,
    this.critical = false,
    this.readAt,
  });

  final String id;
  final NotificationCategory category;
  final String type;
  final String title;
  final String body;

  /// In-app route to open, e.g. `/incidents/<id>`.
  final String? link;

  /// A family emergency: cannot be muted.
  final bool critical;
  final DateTime? readAt;
  final DateTime createdAt;

  bool get unread => readAt == null;

  AppNotification markedRead(DateTime at) => AppNotification(
    id: id,
    category: category,
    type: type,
    title: title,
    body: body,
    createdAt: createdAt,
    link: link,
    critical: critical,
    readAt: readAt ?? at,
  );
}

/// Mute switches. Security cannot be muted, and family emergencies always
/// arrive whatever [safety] says.
@immutable
class NotificationPreferences {
  const new({
    this.safety = true,
    this.family = true,
    this.account = true,
    this.showNamesOnLockScreen = false,
  });

  final bool safety;
  final bool family;
  final bool account;

  /// Lock-screen previews may name people (applies to push).
  final bool showNamesOnLockScreen;

  NotificationPreferences copyWith({
    bool? safety,
    bool? family,
    bool? account,
    bool? showNamesOnLockScreen,
  }) => NotificationPreferences(
    safety: safety ?? this.safety,
    family: family ?? this.family,
    account: account ?? this.account,
    showNamesOnLockScreen: showNamesOnLockScreen ?? this.showNamesOnLockScreen,
  );

  @override
  bool operator ==(Object other) =>
      other is NotificationPreferences &&
      other.safety == safety &&
      other.family == family &&
      other.account == account &&
      other.showNamesOnLockScreen == showNamesOnLockScreen;

  @override
  int get hashCode =>
      Object.hash(safety, family, account, showNamesOnLockScreen);
}
