import 'package:driver_health_app/core/theme/app_colors.dart';
import 'package:driver_health_app/features/safety/domain/entities/incident.dart';
import 'package:driver_health_app/features/safety/domain/entities/medical_event.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

/// Amber for warnings, shared by safety widgets.
const safetyAmber = Color(0xFFFFC857);

/// How the app names, colors and dates safety data. One place, so the
/// history, detail, home and alert screens always agree.
abstract final class SafetyCopy {
  static String eventTitle(MedicalEventType type) => switch (type) {
    MedicalEventType.cardiacEmergency => 'Possible cardiac emergency',
    MedicalEventType.unknown => 'Safety alert',
    MedicalEventType.heartRhythm => 'Heart rhythm alert',
    MedicalEventType.drowsiness => 'Drowsiness detected',
    MedicalEventType.seizure => 'Possible seizure',
    MedicalEventType.stroke => 'Possible stroke',
    MedicalEventType.cardiacArrest => 'Possible cardiac arrest',
    MedicalEventType.sos => 'SOS alert',
  };

  static String filterLabel(MedicalEventType type) => switch (type) {
    MedicalEventType.cardiacEmergency => 'Cardiac emergency',
    MedicalEventType.unknown => 'Other alert',
    MedicalEventType.heartRhythm => 'Heart rhythm',
    MedicalEventType.drowsiness => 'Drowsiness',
    MedicalEventType.seizure => 'Seizure',
    MedicalEventType.stroke => 'Stroke',
    MedicalEventType.cardiacArrest => 'Cardiac arrest',
    MedicalEventType.sos => 'SOS',
  };

  static IconData eventIcon(MedicalEventType type) => switch (type) {
    MedicalEventType.cardiacEmergency => Icons.monitor_heart_rounded,
    MedicalEventType.unknown => Icons.warning_amber_rounded,
    MedicalEventType.heartRhythm => Icons.monitor_heart_rounded,
    MedicalEventType.drowsiness => Icons.bedtime_rounded,
    MedicalEventType.seizure => Icons.bolt_rounded,
    MedicalEventType.stroke => Icons.psychology_alt_rounded,
    MedicalEventType.cardiacArrest => Icons.favorite_rounded,
    MedicalEventType.sos => Icons.sos_rounded,
  };

  static Color severityColor(EventSeverity severity) => switch (severity) {
    EventSeverity.warning => safetyAmber,
    EventSeverity.urgent => const Color(0xFFFF9F43),
    EventSeverity.critical => AppColors.coral,
  };

  static String severityLabel(EventSeverity severity) => switch (severity) {
    EventSeverity.warning => 'Warning',
    EventSeverity.urgent => 'Urgent',
    EventSeverity.critical => 'Critical',
  };

  /// Status pill for an event, from the outcome of its incident.
  static (String, Color) outcome(
    EventSeverity severity,
    IncidentStatus? status,
  ) => switch (status) {
    null when severity == EventSeverity.warning => ('Warning', safetyAmber),
    null => ('Recorded', AppColors.slate),
    IncidentStatus.awaitingResponse => ('Waiting for you', AppColors.coral),
    IncidentStatus.escalated => ('Help called', AppColors.coral),
    IncidentStatus.falseAlarm => ('Resolved safely', AppColors.mint),
    IncidentStatus.resolved => ('Resolved', AppColors.mint),
  };

  /// One line explaining what happened next.
  static String outcomeDetail({
    required EventSeverity severity,
    required IncidentStatus? status,
    required bool contactsAlerted,
  }) {
    if (status == null) {
      return severity == EventSeverity.warning
          ? 'Take a break as soon as it is safe'
          : 'No answer was needed';
    }
    return switch (status) {
      IncidentStatus.awaitingResponse => 'Tell us you are OK',
      IncidentStatus.escalated => 'Your emergency contacts are being alerted',
      _ when contactsAlerted => 'Emergency contacts were notified',
      _ => 'Emergency contacts were not required',
    };
  }

  static String incidentHeadline(Incident incident) =>
      switch (incident.status) {
        IncidentStatus.awaitingResponse => 'Are you OK?',
        IncidentStatus.escalated => 'Help is on the way',
        IncidentStatus.falseAlarm => 'Alert cancelled',
        IncidentStatus.resolved =>
          incident.resolvedVia == IncidentChannel.system
              ? 'Alert closed'
              : 'You are safe',
      };

  static String incidentSummary(Incident incident) => switch (incident.status) {
    IncidentStatus.awaitingResponse =>
      'If you do not answer, your emergency contacts will be alerted.',
    IncidentStatus.escalated =>
      'Your emergency contacts and family have been alerted.',
    IncidentStatus.falseAlarm => 'You answered in time. Nobody was contacted.',
    IncidentStatus.resolved =>
      incident.resolvedVia == IncidentChannel.system
          ? 'Closed automatically after 24 hours.'
          : 'Everyone who was alerted has been told you are OK.',
  };

  static String channelLabel(IncidentChannel? channel) => switch (channel) {
    IncidentChannel.app => 'from the app',
    IncidentChannel.device => 'from the cabin button',
    IncidentChannel.system => 'automatically',
    null => '',
  };

  static String timelineLabel(TimelineEntry entry) {
    final detail = entry.detail;
    return switch (entry.kind) {
      TimelineKind.opened => 'Alert started',
      TimelineKind.eventAdded => 'New detection added',
      TimelineKind.acknowledged =>
        'You said you are OK ${switch (detail['via']) {
          'DEVICE' => 'from the cabin button',
          _ => 'from the app',
        }}',
      TimelineKind.escalated =>
        detail['reason'] == 'SOS'
            ? 'SOS: help called right away'
            : 'No answer: help called',
      TimelineKind.notified => _notifiedLabel(detail),
      TimelineKind.resolved => switch (detail['outcome']) {
        'FALSE_ALARM' => 'Alert cancelled',
        _ when detail['via'] == 'SYSTEM' => 'Closed automatically',
        _ => 'Alert resolved',
      },
    };
  }

  static String _notifiedLabel(Map<String, Object?> detail) {
    final contacts = detail['contacts'] as int? ?? 0;
    final family = detail['family'] as int? ?? 0;
    final allClear = detail['kind'] == 'ALL_CLEAR';
    final people = contacts + family;
    if (people == 0) {
      return allClear ? 'Nobody to update' : 'Nobody could be alerted';
    }
    final noun = people == 1 ? 'person' : 'people';
    return allClear ? '$people $noun told you are OK' : '$people $noun alerted';
  }

  static String rhythmLabel(HeartRhythm rhythm) => switch (rhythm) {
    HeartRhythm.normal => 'Normal',
    HeartRhythm.atrialFibrillation => 'Atrial fibrillation',
    HeartRhythm.bradycardia => 'Slow (bradycardia)',
    HeartRhythm.tachycardia => 'Fast (tachycardia)',
    HeartRhythm.ventricularTachycardia => 'Ventricular tachycardia',
    HeartRhythm.ventricularFibrillation => 'Ventricular fibrillation',
    HeartRhythm.asystole => 'No rhythm detected',
    HeartRhythm.irregular => 'Irregular',
  };

  /// How sure the detector was, in words a driver understands.
  static String confidenceLabel(double confidence) {
    final percent = (confidence * 100).round();
    final level = confidence >= 0.85
        ? 'High'
        : confidence >= 0.6
        ? 'Medium'
        : 'Low';
    return '$level confidence · $percent%';
  }

  /// "Today · 08:42", "Yesterday · 21:05", "Mon 28 Sep · 14:10".
  static String when(DateTime value, {DateTime? now}) {
    final local = value.toLocal();
    final today = DateUtils.dateOnly(now ?? DateTime.now());
    final day = DateUtils.dateOnly(local);
    final time = DateFormat.Hm().format(local);
    final difference = today.difference(day).inDays;
    if (difference == 0) return 'Today · $time';
    if (difference == 1) return 'Yesterday · $time';
    return '${DateFormat('EEE d MMM').format(local)} · $time';
  }

  /// [when] inside a sentence: "today · 08:42", but "Fri 2 Oct · 14:10".
  static String whenInSentence(DateTime value, {DateTime? now}) {
    final text = when(value, now: now);
    return text.startsWith('Today') || text.startsWith('Yesterday')
        ? text.replaceFirstMapped(RegExp('^.'), (m) => m[0]!.toLowerCase())
        : text;
  }

  /// Section header for a day in the history list.
  static String day(DateTime value, {DateTime? now}) {
    final local = value.toLocal();
    final today = DateUtils.dateOnly(now ?? DateTime.now());
    final difference = today.difference(DateUtils.dateOnly(local)).inDays;
    if (difference == 0) return 'Today';
    if (difference == 1) return 'Yesterday';
    return DateFormat('EEEE d MMMM').format(local);
  }
}
