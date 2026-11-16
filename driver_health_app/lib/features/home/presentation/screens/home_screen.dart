import 'dart:async';

import 'package:driver_health_app/app/router/app_routes.dart';
import 'package:driver_health_app/core/network/api_failure.dart';
import 'package:driver_health_app/core/presentation/motion/entrance.dart';
import 'package:driver_health_app/core/presentation/motion/motion.dart';
import 'package:driver_health_app/core/presentation/widgets/cabinguard_background.dart';
import 'package:driver_health_app/core/presentation/widgets/cabinguard_brand.dart';
import 'package:driver_health_app/core/presentation/widgets/inline_message.dart';
import 'package:driver_health_app/core/presentation/widgets/surface_card.dart';
import 'package:driver_health_app/core/theme/app_colors.dart';
import 'package:driver_health_app/features/driver_profile/presentation/widgets/profile_avatar_view.dart';
import 'package:driver_health_app/features/home/domain/entities/dashboard.dart';
import 'package:driver_health_app/features/home/presentation/controllers/dashboard_providers.dart';
import 'package:driver_health_app/features/safety/application/safety_providers.dart';
import 'package:driver_health_app/features/safety/presentation/safety_copy.dart';
import 'package:driver_health_app/features/safety/presentation/widgets/active_alert_banner.dart';
import 'package:driver_health_app/features/safety/presentation/widgets/latest_event_card.dart';
import 'package:driver_health_app/features/safety/presentation/widgets/monitoring_card.dart';
import 'package:driver_health_app/features/safety/presentation/widgets/sos_hold_button.dart';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

/// Screen 12. Parts that depend on backend capabilities (medical events,
/// SOS, notifications) render only when the dashboard reports them as
/// available. While shown, it also brings a newly opened alert to the
/// screen: without push notifications, the dashboard poll is how it arrives.
class HomeScreen extends ConsumerWidget {
  const new({super.key});

  static const greetingKey = Key('home.greeting');
  static const latestEventKey = Key('home.latestEvent');

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dashboard = ref.watch(dashboardProvider);
    Future<void> refresh() => ref.refresh(dashboardProvider.future);
    ref.listen(
      dashboardProvider.select(
        (value) => value.value?.monitoring.activeIncident?.id,
      ),
      (previous, incidentId) {
        if (incidentId == null) return;
        final first = ref
            .read(presentedIncidentsProvider.notifier)
            .markPresented(incidentId);
        if (first) unawaited(context.push(AppRoutes.incident(incidentId)));
      },
    );

    return Scaffold(
      backgroundColor: Colors.transparent,
      body: CabinGuardBackground(
        alignment: const Alignment(0.6, -0.6),
        overlayStrength: 0.25,
        child: SafeArea(
          bottom: false,
          child: RefreshIndicator(
            color: AppColors.cyan,
            backgroundColor: AppColors.navy900,
            onRefresh: refresh,
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 600),
                // Replays when the dashboard first arrives, not on polls.
                child: EntranceScope(
                  key: ValueKey(dashboard.hasValue),
                  child: ListView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                    children: staggered(switch (dashboard) {
                      AsyncData(:final value) => _content(context, value),
                      AsyncError(:final error) => [
                        const _Header(initials: null, notifications: null),
                        const SizedBox(height: 40),
                        InlineMessage(message: ApiFailure.from(error).message),
                        const SizedBox(height: 8),
                        TextButton(
                          onPressed: () => unawaited(refresh()),
                          child: const Text(
                            'Try again',
                            style: TextStyle(color: AppColors.cyan),
                          ),
                        ),
                      ],
                      _ => const [
                        _Header(initials: null, notifications: null),
                        SizedBox(height: 24),
                        _Skeleton(),
                      ],
                    }),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  List<Widget> _content(BuildContext context, Dashboard dashboard) {
    final safetyFeatures = dashboard.features.medicalEvents;
    final monitoring = dashboard.monitoring;
    return [
      _Header(
        initials: dashboard.initials,
        notifications: dashboard.features.notifications
            ? dashboard.unreadNotifications
            : null,
      ),
      if (monitoring.activeIncident case final incident?) ...[
        const SizedBox(height: 16),
        ActiveAlertBanner(
          status: incident.status,
          triggerType: incident.triggerType,
          onTap: () => unawaited(context.push(AppRoutes.incident(incident.id))),
        ),
      ],
      const SizedBox(height: 20),
      _Greeting(dashboard: dashboard),
      const SizedBox(height: 20),
      _DriverCard(dashboard: dashboard),
      if (monitoring.devicePaired) ...[
        const SizedBox(height: 14),
        MonitoringCard(status: monitoring.runtimeStatus),
      ],
      const SizedBox(height: 14),
      _FamilyBanner(family: dashboard.family),
      for (final recommendation in dashboard.recommendations)
        if (recommendation != SafetyRecommendation.joinFamily) ...[
          const SizedBox(height: 12),
          _RecommendationCard(recommendation: recommendation),
        ],
      if (safetyFeatures) ...[
        const SizedBox(height: 24),
        _SectionHeader(
          title: 'Latest medical event',
          onTap: () => context.go(AppRoutes.history),
        ),
        const SizedBox(height: 12),
        if (monitoring.latestEvent case final event?)
          LatestEventCard(
            key: latestEventKey,
            type: event.type,
            severity: event.severity,
            detectedAt: event.detectedAt,
            incidentStatus: event.incidentStatus,
            contactsAlerted: event.contactsAlerted,
            processingMode: event.processingMode,
            onTap: () =>
                unawaited(context.push(AppRoutes.historyEvent(event.id))),
          )
        else
          const _NoEventsCard(),
      ],
      const SizedBox(height: 24),
      Semantics(
        header: true,
        child: const Text(
          'Quick access',
          style: TextStyle(
            color: Colors.white,
            fontSize: 22,
            fontWeight: FontWeight.w800,
          ),
        ),
      ),
      const SizedBox(height: 12),
      _QuickAccess(withHistory: safetyFeatures),
      if (dashboard.features.emergencyAlerts) ...[
        const SizedBox(height: 28),
        Center(
          child: SosHoldButton(
            onActivated: () => unawaited(context.push(AppRoutes.sos)),
          ),
        ),
        const SizedBox(height: 4),
        const Text(
          'Emergency',
          textAlign: TextAlign.center,
          style: TextStyle(
            color: Colors.white,
            fontSize: 20,
            fontWeight: FontWeight.w800,
          ),
        ),
        const Text(
          'Press and hold for help',
          textAlign: TextAlign.center,
          style: TextStyle(color: AppColors.ice),
        ),
      ],
    ];
  }
}

class _SectionHeader extends StatelessWidget {
  const new({required this.title, required this.onTap});

  final String title;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      header: true,
      button: true,
      label: title,
      excludeSemantics: true,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Row(
          children: [
            Expanded(
              child: Text(
                title,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 22,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
            const Icon(Icons.chevron_right_rounded, color: AppColors.ice),
          ],
        ),
      ),
    );
  }
}

class _NoEventsCard extends StatelessWidget {
  const new();

  @override
  Widget build(BuildContext context) {
    return const SurfaceCard(
      child: Row(
        children: [
          Icon(Icons.verified_user_rounded, color: AppColors.mint, size: 30),
          SizedBox(width: 14),
          Expanded(
            child: Text(
              'No medical events yet. Your cabin unit reports detections '
              'here.',
              style: TextStyle(color: AppColors.ice, height: 1.35),
            ),
          ),
        ],
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const new({required this.initials, required this.notifications});

  static const bellKey = Key('home.notifications');

  final String? initials;

  /// Unread count for the bell; `null` hides it.
  final int? notifications;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        const Flexible(
          child: Align(
            alignment: Alignment.centerLeft,
            child: CabinGuardBrand(compact: true),
          ),
        ),
        const SizedBox(width: 12),
        if (notifications case final unread?)
          IconButton(
            key: bellKey,
            tooltip: unread == 0
                ? 'Notifications'
                : 'Notifications, $unread unread',
            onPressed: () => unawaited(context.push(AppRoutes.notifications)),
            color: Colors.white,
            icon: Badge(
              isLabelVisible: unread > 0,
              backgroundColor: AppColors.coral,
              label: Text(unread > 99 ? '99+' : '$unread')
                  .animate(key: ValueKey(unread))
                  .scale(
                    begin: const Offset(0.4, 0.4),
                    duration: Motion.medium,
                    curve: Curves.easeOutBack,
                  ),
              child: const Icon(Icons.notifications_none_rounded, size: 28),
            ),
          ),
        if (initials case final value?)
          Semantics(
            button: true,
            label: 'Your profile',
            excludeSemantics: true,
            child: InkWell(
              customBorder: const CircleBorder(),
              onTap: () => context.go(AppRoutes.profile),
              child: CircleAvatar(
                radius: 26,
                backgroundColor: AppColors.cyan.withValues(alpha: 0.6),
                child: CircleAvatar(
                  radius: 24,
                  backgroundColor: AppColors.navy800,
                  child: Text(
                    value,
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }
}

class _Greeting extends StatelessWidget {
  const new({required this.dashboard});

  final Dashboard dashboard;

  static String _partOfDay(DateTime now) {
    if (now.hour < 12) return 'Good morning';
    if (now.hour < 18) return 'Good afternoon';
    return 'Good evening';
  }

  @override
  Widget build(BuildContext context) {
    final name = dashboard.firstName.isEmpty ? 'driver' : dashboard.firstName;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Semantics(
          header: true,
          child: Text.rich(
            key: HomeScreen.greetingKey,
            TextSpan(
              children: [
                TextSpan(text: '${_partOfDay(DateTime.now())}, '),
                TextSpan(
                  text: name,
                  style: const TextStyle(color: AppColors.cyan),
                ),
              ],
            ),
            style: const TextStyle(
              color: Colors.white,
              fontSize: 30,
              fontWeight: FontWeight.w900,
              letterSpacing: -0.6,
            ),
          ),
        ),
        const SizedBox(height: 4),
        Text(
          !dashboard.safetyReady
              ? 'Finish your safety plan to stay protected'
              : 'Your safety plan is ready',
          style: const TextStyle(color: AppColors.ice, fontSize: 16),
        ),
      ],
    );
  }
}

class _DriverCard extends StatelessWidget {
  const new({required this.dashboard});

  final Dashboard dashboard;

  static const _amber = Color(0xFFFFC857);

  /// Status line and its color: the safety plan first, then the unit.
  static (String, Color) _status(Dashboard dashboard) {
    final monitoring = dashboard.monitoring;
    if (!dashboard.safetyReady) return ('Needs attention', _amber);
    if (!dashboard.features.medicalEvents) {
      return ('Safety plan ready', AppColors.mint);
    }
    if (monitoring.deviceOnline) {
      return monitoring.runtimeStatus == 'READY'
          ? ('Monitoring enabled', AppColors.mint)
          : ('Monitoring limited', _amber);
    }
    if (monitoring.devicePaired) return ('Cabin unit offline', _amber);
    return ('Safety plan ready', AppColors.mint);
  }

  /// Second line: the vehicle unit when monitoring exists, else contacts.
  static (IconData, String) _detail(Dashboard dashboard) {
    final contacts = dashboard.emergencyContactCount;
    final contactLabel =
        '$contacts emergency '
        '${contacts == 1 ? 'contact' : 'contacts'}';
    final monitoring = dashboard.monitoring;
    if (!dashboard.features.medicalEvents) {
      return (Icons.contact_phone_outlined, contactLabel);
    }
    if (monitoring.deviceOnline) {
      return (Icons.directions_car_rounded, 'Mediane vehicle connected');
    }
    if (monitoring.devicePaired) {
      final seen = monitoring.deviceLastSeenAt;
      return (
        Icons.directions_car_rounded,
        seen == null
            ? 'Not connected yet'
            : 'Last seen ${SafetyCopy.whenInSentence(seen)}',
      );
    }
    return (Icons.directions_car_outlined, 'No cabin unit paired');
  }

  @override
  Widget build(BuildContext context) {
    final (status, statusColor) = _status(dashboard);
    final (detailIcon, detail) = _detail(dashboard);
    return Semantics(
      button: true,
      label: '${dashboard.fullName}, driver. $status. $detail.',
      excludeSemantics: true,
      child: SurfaceCard(
        onTap: () => context.go(AppRoutes.profile),
        child: Row(
          children: [
            ProfileAvatarView(
              size: 84,
              avatar: dashboard.avatar,
              showBadge: false,
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    dashboard.fullName,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 20,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 6),
                  DecoratedBox(
                    decoration: BoxDecoration(
                      color: AppColors.cobalt.withValues(alpha: 0.25),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Padding(
                      padding: EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 3,
                      ),
                      child: Text(
                        'Driver',
                        style: TextStyle(color: AppColors.ice, fontSize: 13),
                      ),
                    ),
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Icon(Icons.circle, size: 12, color: statusColor),
                      const SizedBox(width: 8),
                      Flexible(
                        child: Text(
                          status,
                          style: TextStyle(
                            color: statusColor,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      Icon(detailIcon, size: 18, color: AppColors.slate),
                      const SizedBox(width: 6),
                      Flexible(
                        child: Text(
                          detail,
                          style: const TextStyle(color: AppColors.slate),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const Icon(Icons.chevron_right_rounded, color: AppColors.ice),
          ],
        ),
      ),
    );
  }
}

class _FamilyBanner extends StatelessWidget {
  const new({required this.family});

  final DashboardFamily family;

  @override
  Widget build(BuildContext context) {
    final pending = family.pendingJoinRequests;
    final members = family.memberCount ?? 1;
    final (
      String text,
      String? action,
      bool highlighted,
    ) = switch (family.status) {
      FamilyStatus.owner when pending > 0 => (
        pending == 1
            ? '1 join request is waiting for you'
            : '$pending join requests are waiting for you',
        'Review',
        true,
      ),
      FamilyStatus.requestPending => (
        'Request sent to ${family.pendingRequestFamily ?? 'a family'}. '
            'Waiting for approval.',
        null,
        false,
      ),
      FamilyStatus.none => (
        'Keep your family informed: create or join a family',
        'Set up',
        true,
      ),
      FamilyStatus.owner || FamilyStatus.member => (
        '${family.name ?? 'Your family'} · $members '
            '${members == 1 ? 'member' : 'members'}',
        null,
        false,
      ),
    };

    return SurfaceCard(
      highlighted: highlighted,
      onTap: () => context.go(AppRoutes.family),
      child: Row(
        children: [
          const Icon(Icons.groups_rounded, color: AppColors.cyan, size: 30),
          const SizedBox(width: 14),
          Expanded(
            child: Text(
              text,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 16,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          const SizedBox(width: 8),
          if (action != null)
            ExcludeSemantics(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [AppColors.cyan, AppColors.cobalt],
                  ),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 14,
                    vertical: 8,
                  ),
                  child: Text(
                    action,
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
              ),
            )
          else
            const Icon(Icons.chevron_right_rounded, color: AppColors.ice),
        ],
      ),
    );
  }
}

class _RecommendationCard extends StatelessWidget {
  const new({required this.recommendation});

  final SafetyRecommendation recommendation;

  @override
  Widget build(BuildContext context) {
    final (icon, title, message) = switch (recommendation) {
      SafetyRecommendation.enableTwoStep => (
        Icons.phonelink_lock_rounded,
        'Protect your sign-in',
        'Turn on two-step verification in Security.',
      ),
      SafetyRecommendation.regenerateRecoveryCodes => (
        Icons.key_rounded,
        'Running low on recovery codes',
        'Create new ones so you can still sign in if you lose your phone.',
      ),
      SafetyRecommendation.joinFamily => (
        Icons.groups_rounded,
        'Join a family',
        'Create or join a family.',
      ),
    };
    return SurfaceCard(
      onTap: () => unawaited(context.push(AppRoutes.security)),
      child: Row(
        children: [
          Icon(icon, color: const Color(0xFFFFC857)),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 2),
                Text(message, style: const TextStyle(color: AppColors.slate)),
              ],
            ),
          ),
          const Icon(Icons.chevron_right_rounded, color: AppColors.ice),
        ],
      ),
    );
  }
}

class _QuickAccess extends StatelessWidget {
  const new({required this.withHistory});

  /// Event history replaces Security (still in Profile) once events exist.
  final bool withHistory;

  @override
  Widget build(BuildContext context) {
    final tiles = <Widget>[
      if (withHistory)
        _Tile(
          icon: Icons.history_rounded,
          label: 'Event history',
          onTap: () => context.go(AppRoutes.history),
        ),
      _Tile(
        icon: Icons.contact_phone_outlined,
        label: 'Emergency contacts',
        onTap: () => unawaited(context.push(AppRoutes.editContacts)),
      ),
      _Tile(
        icon: Icons.groups_rounded,
        label: 'Family',
        onTap: () => context.go(AppRoutes.family),
      ),
      if (!withHistory)
        _Tile(
          icon: Icons.shield_outlined,
          label: 'Security',
          onTap: () => unawaited(context.push(AppRoutes.security)),
        ),
    ];
    // Three across on phones; stacked when text is scaled up a lot.
    if (MediaQuery.textScalerOf(context).scale(1) > 1.6) {
      return Column(
        children: [
          for (final tile in tiles)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: SizedBox(width: double.infinity, child: tile),
            ),
        ],
      );
    }
    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (var i = 0; i < tiles.length; i++) ...[
            if (i > 0) const SizedBox(width: 10),
            Expanded(child: tiles[i]),
          ],
        ],
      ),
    );
  }
}

class _Tile extends StatelessWidget {
  const new({required this.icon, required this.label, required this.onTap});

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: label,
      excludeSemantics: true,
      child: SurfaceCard(
        onTap: onTap,
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 96),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Icon(icon, color: AppColors.cyan, size: 30),
              const SizedBox(height: 12),
              Text(
                label,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Skeleton extends StatelessWidget {
  const new();

  @override
  Widget build(BuildContext context) {
    final reduced = Motion.reduced(context);
    Widget block(double height) {
      final shape = Container(
        height: height,
        margin: const EdgeInsets.only(bottom: 14),
        decoration: BoxDecoration(
          color: AppColors.navy800.withValues(alpha: 0.6),
          borderRadius: BorderRadius.circular(20),
        ),
      );
      return reduced
          ? shape
          : shape
                .animate(onPlay: (c) => c.repeat())
                .shimmer(
                  duration: 1400.ms,
                  color: AppColors.ice.withValues(alpha: 0.08),
                );
    }

    return Semantics(
      label: 'Loading your dashboard',
      liveRegion: true,
      child: ExcludeSemantics(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            FractionallySizedBox(widthFactor: 0.7, child: block(36)),
            block(116),
            block(72),
            block(96),
          ],
        ),
      ),
    );
  }
}
