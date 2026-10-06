import 'dart:async';

import 'package:driver_health_app/app/router/app_routes.dart';
import 'package:driver_health_app/core/network/api_failure.dart';
import 'package:driver_health_app/core/presentation/motion/motion.dart';
import 'package:driver_health_app/core/presentation/motion/state_switcher.dart';
import 'package:driver_health_app/core/presentation/widgets/cabinguard_background.dart';
import 'package:driver_health_app/core/presentation/widgets/confirm_dialog.dart';
import 'package:driver_health_app/core/presentation/widgets/gradient_button.dart';
import 'package:driver_health_app/core/presentation/widgets/inline_message.dart';
import 'package:driver_health_app/core/presentation/widgets/surface_card.dart';
import 'package:driver_health_app/core/theme/app_colors.dart';
import 'package:driver_health_app/features/safety/application/incident_controller.dart';
import 'package:driver_health_app/features/safety/domain/entities/incident.dart';
import 'package:driver_health_app/features/safety/presentation/safety_copy.dart';
import 'package:driver_health_app/features/safety/presentation/safety_links.dart';
import 'package:driver_health_app/features/safety/presentation/widgets/call_emergency_button.dart';
import 'package:driver_health_app/features/safety/presentation/widgets/countdown_ring.dart';
import 'package:driver_health_app/features/safety/presentation/widgets/event_tile.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

/// An alert from start to finish: the countdown with "I'm OK", then "help
/// is on the way" with who was alerted, then the summary. Stays in sync with
/// the server while open; the cabin button can answer it too.
class IncidentScreen extends ConsumerStatefulWidget {
  const new({required this.incidentId, super.key});

  final String incidentId;

  static const okKey = Key('incident.ok');
  static const helpNowKey = Key('incident.helpNow');
  static const doneKey = Key('incident.done');

  @override
  ConsumerState<IncidentScreen> createState() => _IncidentScreenState();
}

class _IncidentScreenState extends ConsumerState<IncidentScreen> {
  Timer? _ticker;
  int? _lastSecond;
  bool _busy = false;
  ApiFailure? _failure;

  @override
  void initState() {
    super.initState();
    _ticker = Timer.periodic(const Duration(milliseconds: 250), (_) => _tick());
  }

  @override
  void dispose() {
    _ticker?.cancel();
    super.dispose();
  }

  /// Redraws the countdown and pulses the phone once per second.
  void _tick() {
    if (!mounted) return;
    final detail = ref
        .read(incidentControllerProvider(widget.incidentId))
        .value;
    final remaining = detail?.remaining(DateTime.now());
    if (remaining == null) {
      _lastSecond = null;
      return;
    }
    final second = (remaining.inMilliseconds / 1000).ceil();
    if (second != _lastSecond && second > 0) {
      _lastSecond = second;
      HapticFeedback.heavyImpact().ignore();
      SystemSound.play(SystemSoundType.alert).ignore();
    }
    setState(() {});
  }

  Future<void> _run(Future<ApiFailure?> Function() action) async {
    if (_busy) return;
    setState(() {
      _busy = true;
      _failure = null;
    });
    final failure = await action();
    if (!mounted) return;
    setState(() {
      _busy = false;
      _failure = failure;
    });
  }

  IncidentController get _controller =>
      ref.read(incidentControllerProvider(widget.incidentId).notifier);

  Future<void> _imOk(Incident incident) async {
    if (incident.status == IncidentStatus.escalated) {
      final confirmed = await showConfirmDialog(
        context,
        title: 'Cancel the alert?',
        message:
            'Everyone who was alerted will be told you are OK. Only do this '
            'if you are safe.',
        confirmLabel: "I'm OK",
        cancelLabel: 'Keep help coming',
        destructive: false,
      );
      if (!confirmed || !mounted) return;
    }
    HapticFeedback.mediumImpact().ignore();
    await _run(_controller.acknowledge);
  }

  void _close() =>
      context.canPop() ? context.pop() : context.go(AppRoutes.home);

  @override
  Widget build(BuildContext context) {
    final detail = ref.watch(incidentControllerProvider(widget.incidentId));
    ref.listen(
      incidentControllerProvider(widget.incidentId)
          .select((value) => value.value?.incident.status),
      (previous, next) {
        if (previous == IncidentStatus.awaitingResponse &&
            next == IncidentStatus.escalated) {
          HapticFeedback.vibrate().ignore();
        }
      },
    );
    final incident = detail.value?.incident;
    final active = incident?.isActive ?? false;

    final content = SafeArea(
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 560),
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 28),
            children: [
              Align(
                alignment: Alignment.centerLeft,
                child: IconButton(
                  tooltip: 'Close',
                  onPressed: _close,
                  color: AppColors.ice,
                  icon: const Icon(Icons.close_rounded, size: 28),
                ),
              ),
              ...switch (detail) {
                AsyncData(:final value) => _body(value),
                AsyncError(:final error) => [
                  const SizedBox(height: 40),
                  InlineMessage(message: ApiFailure.from(error).message),
                  TextButton(
                    onPressed: () => ref.invalidate(
                      incidentControllerProvider(widget.incidentId),
                    ),
                    child: const Text(
                      'Try again',
                      style: TextStyle(color: AppColors.cyan),
                    ),
                  ),
                  const CallEmergencyButton(),
                ],
                _ => const [
                  SizedBox(height: 120),
                  Center(
                    child: CircularProgressIndicator(color: AppColors.cyan),
                  ),
                ],
              },
            ],
          ),
        ),
      ),
    );

    return PopScope(
      child: Scaffold(
        backgroundColor: AppColors.navy950,
        body: active
            ? DecoratedBox(
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [Color(0xFF4A0D18), AppColors.navy950],
                  ),
                ),
                child: content,
              )
            : CabinGuardBackground(overlayStrength: 0.55, child: content),
      ),
    );
  }

  List<Widget> _body(IncidentDetail detail) {
    final incident = detail.incident;
    return [
      StateSwitcher(
        child: Semantics(
          key: ValueKey(incident.status),
          header: true,
          liveRegion: true,
          child: Text(
            SafetyCopy.incidentHeadline(incident),
            textAlign: TextAlign.center,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 34,
              fontWeight: FontWeight.w900,
              letterSpacing: -0.6,
            ),
          ),
        ),
      ),
      const SizedBox(height: 8),
      Text(
        '${SafetyCopy.eventTitle(incident.triggerType)} · '
        '${SafetyCopy.when(incident.openedAt)}',
        textAlign: TextAlign.center,
        style: const TextStyle(color: AppColors.ice, fontSize: 16),
      ),
      const SizedBox(height: 24),
      ...switchedItems(incident.status, switch (incident.status) {
        IncidentStatus.awaitingResponse => _awaiting(detail),
        IncidentStatus.escalated => _escalated(detail),
        IncidentStatus.falseAlarm ||
        IncidentStatus.resolved => _summary(detail),
      }),
    ];
  }

  List<Widget> _awaiting(IncidentDetail detail) {
    final incident = detail.incident;
    final remaining = detail.remaining(DateTime.now()) ?? Duration.zero;
    final total = incident.respondBy!.difference(incident.openedAt);
    return [
      Center(
        child: _AlertHalo(
          child: CountdownRing(
            remaining: remaining,
            total: total,
            color: AppColors.coral,
            size: 210,
          ),
        ),
      ),
      const SizedBox(height: 20),
      Text(
        remaining == Duration.zero
            ? 'Calling for help…'
            : SafetyCopy.incidentSummary(incident),
        textAlign: TextAlign.center,
        style: const TextStyle(color: AppColors.ice, fontSize: 16, height: 1.4),
      ),
      const SizedBox(height: 28),
      SizedBox(
        height: 64,
        child: FilledButton(
          key: IncidentScreen.okKey,
          onPressed: _busy ? null : () => unawaited(_imOk(incident)),
          style: FilledButton.styleFrom(
            backgroundColor: Colors.white,
            foregroundColor: AppColors.navy950,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(20),
            ),
          ),
          child: _busy
              ? const SizedBox.square(
                  dimension: 26,
                  child: CircularProgressIndicator(strokeWidth: 3),
                )
              : const Text(
                  "I'm OK",
                  style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900),
                ),
        ),
      ),
      const SizedBox(height: 12),
      OutlinedButton.icon(
        key: IncidentScreen.helpNowKey,
        onPressed: _busy
            ? null
            : () => unawaited(_run(_controller.escalateNow)),
        icon: const Icon(Icons.sos_rounded),
        label: const Text('Get help now'),
        style: OutlinedButton.styleFrom(
          foregroundColor: Colors.white,
          minimumSize: const Size.fromHeight(54),
          side: const BorderSide(color: AppColors.coral, width: 1.5),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(18),
          ),
        ),
      ),
      ..._failureMessage(),
      const SizedBox(height: 16),
      const Text(
        'You can also press the button on your cabin unit.',
        textAlign: TextAlign.center,
        style: TextStyle(color: AppColors.slate),
      ),
    ];
  }

  List<Widget> _escalated(IncidentDetail detail) {
    final incident = detail.incident;
    final alerts = detail.alerts;
    return [
      Text(
        SafetyCopy.incidentSummary(incident),
        textAlign: TextAlign.center,
        style: const TextStyle(color: AppColors.ice, fontSize: 16, height: 1.4),
      ),
      const SizedBox(height: 20),
      _ContactsCard(attempts: alerts, pending: alerts.isEmpty),
      if (incident.location case final location?) ...[
        const SizedBox(height: 12),
        SurfaceCard(
          onTap: () => unawaited(openInMaps(location)),
          child: const Row(
            children: [
              Icon(Icons.place_rounded, color: AppColors.cyan),
              SizedBox(width: 12),
              Expanded(
                child: Text(
                  'Your location is shared with the people alerted until '
                  'the alert ends.',
                  style: TextStyle(color: AppColors.ice, height: 1.35),
                ),
              ),
              Icon(Icons.open_in_new_rounded, color: AppColors.slate),
            ],
          ),
        ),
      ],
      const SizedBox(height: 20),
      const CallEmergencyButton(),
      const SizedBox(height: 12),
      GradientButton(
        key: IncidentScreen.okKey,
        label: "I'm OK, cancel the alert",
        loading: _busy,
        onPressed: () => unawaited(_imOk(incident)),
      ),
      ..._failureMessage(),
    ];
  }

  List<Widget> _summary(IncidentDetail detail) {
    final incident = detail.incident;
    final resolved = incident.status == IncidentStatus.resolved;
    return [
      Center(
        child: _PopIn(
          child: Icon(
            Icons.verified_rounded,
            color: AppColors.mint,
            size: 72,
            semanticLabel: resolved ? 'Resolved' : 'Cancelled',
          ),
        ),
      ),
      const SizedBox(height: 12),
      Text(
        SafetyCopy.incidentSummary(incident),
        textAlign: TextAlign.center,
        style: const TextStyle(color: AppColors.ice, fontSize: 16, height: 1.4),
      ),
      if (detail.alerts.isNotEmpty) ...[
        const SizedBox(height: 20),
        _ContactsCard(attempts: detail.alerts, pending: false),
      ],
      if (detail.timeline.isNotEmpty) ...[
        const SizedBox(height: 12),
        _TimelineCard(entries: detail.timeline),
      ],
      if (detail.events.isNotEmpty) ...[
        const SizedBox(height: 20),
        Semantics(
          header: true,
          child: const Text(
            'Detections',
            style: TextStyle(
              color: Colors.white,
              fontSize: 18,
              fontWeight: FontWeight.w800,
            ),
          ),
        ),
        const SizedBox(height: 10),
        for (final event in detail.events)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: EventTile(
              event: event,
              onTap: () =>
                  unawaited(context.push(AppRoutes.historyEvent(event.id))),
            ),
          ),
      ],
      const SizedBox(height: 20),
      GradientButton(
        key: IncidentScreen.doneKey,
        label: 'Done',
        onPressed: _close,
      ),
    ];
  }

  List<Widget> _failureMessage() => [
    if (_failure case final failure?) ...[
      const SizedBox(height: 12),
      InlineMessage(message: failure.message),
    ],
  ];
}

class _ContactsCard extends StatelessWidget {
  const new({required this.attempts, required this.pending});

  final List<NotificationAttempt> attempts;

  /// Escalated, but deliveries are not recorded yet.
  final bool pending;

  @override
  Widget build(BuildContext context) {
    return SurfaceCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Semantics(
            header: true,
            child: const Text(
              'People alerted',
              style: TextStyle(
                color: Colors.white,
                fontSize: 16,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
          const SizedBox(height: 10),
          if (pending)
            const Row(
              children: [
                SizedBox.square(
                  dimension: 18,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: AppColors.cyan,
                  ),
                ),
                SizedBox(width: 12),
                Expanded(
                  child: Text(
                    'Contacting your emergency contacts…',
                    style: TextStyle(color: AppColors.ice),
                  ),
                ),
              ],
            )
          else if (attempts.isEmpty)
            const Text(
              'Nobody could be alerted. Add emergency contacts in your '
              'profile.',
              style: TextStyle(color: AppColors.ice),
            )
          else
            for (final (index, attempt) in attempts.indexed)
              _AttemptRow(attempt: attempt).arriving(context, index),
        ],
      ),
    );
  }
}

class _AttemptRow extends StatelessWidget {
  const new({required this.attempt});

  final NotificationAttempt attempt;

  @override
  Widget build(BuildContext context) {
    final sent = attempt.status == NotificationStatus.sent;
    final role = attempt.recipientType == RecipientType.familyMember
        ? 'Family'
        : 'Contact #${attempt.priority ?? '-'}';
    final via = switch (attempt.channel) {
      NotificationChannel.email => ' by email',
      NotificationChannel.sms => ' by SMS',
      NotificationChannel.voice => ' by phone call',
      NotificationChannel.push => ' in the app',
      NotificationChannel.log => '',
    };
    return Semantics(
      label:
          '${attempt.recipientName}, $role, '
          '${sent ? 'alerted$via' : 'could not be reached'}',
      excludeSemantics: true,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Row(
          children: [
            Icon(
              sent ? Icons.check_circle_rounded : Icons.error_rounded,
              color: sent ? AppColors.mint : AppColors.coral,
              size: 22,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    attempt.recipientName,
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  Text(
                    sent ? '$role · alerted$via' : '$role · not reached',
                    style: const TextStyle(
                      color: AppColors.slate,
                      fontSize: 13,
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

class _TimelineCard extends StatelessWidget {
  const new({required this.entries});

  final List<TimelineEntry> entries;

  @override
  Widget build(BuildContext context) {
    return SurfaceCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Semantics(
            header: true,
            child: const Text(
              'What happened',
              style: TextStyle(
                color: Colors.white,
                fontSize: 16,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
          const SizedBox(height: 10),
          for (final entry in entries)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 5),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SizedBox(
                    width: 56,
                    child: Text(
                      DateFormat.Hm().format(entry.at.toLocal()),
                      style: const TextStyle(
                        color: AppColors.slate,
                        fontFeatures: [FontFeature.tabularFigures()],
                      ),
                    ),
                  ),
                  Expanded(
                    child: Text(
                      SafetyCopy.timelineLabel(entry),
                      style: const TextStyle(color: AppColors.ice),
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

/// Slow breathing glow behind the countdown: urgency without flashing.
class _AlertHalo extends StatelessWidget {
  const new({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    final ring = child
        .animate()
        .fadeIn(duration: Motion.medium)
        .scale(
          begin: const Offset(0.85, 0.85),
          duration: Motion.long,
          curve: Curves.easeOutBack,
        );
    if (Motion.reduced(context)) return child;
    return Stack(
      alignment: Alignment.center,
      children: [
        Container(
              width: 250,
              height: 250,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: [
                    AppColors.coral.withValues(alpha: 0.28),
                    AppColors.coral.withValues(alpha: 0),
                  ],
                ),
              ),
            )
            .animate(onPlay: (controller) => controller.repeat(reverse: true))
            .scaleXY(
              begin: 0.9,
              end: 1.08,
              duration: 1200.ms,
              curve: Curves.easeInOut,
            ),
        ring,
      ],
    );
  }
}

/// A completion mark that lands with a small overshoot.
class _PopIn extends StatelessWidget {
  const new({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    if (Motion.reduced(context)) return child;
    return child
        .animate()
        .fadeIn(duration: Motion.short)
        .scale(
          begin: const Offset(0.4, 0.4),
          duration: Motion.long,
          curve: Curves.easeOutBack,
        );
  }
}

extension on Widget {
  /// Rows that appear one after another, e.g. contacts as they are reached.
  Widget arriving(BuildContext context, int index) => Motion.reduced(context)
      ? this
      : animate(delay: (70 * index).ms)
            .fadeIn(duration: Motion.medium)
            .slideX(begin: 0.06, end: 0, curve: Motion.emphasized);
}
