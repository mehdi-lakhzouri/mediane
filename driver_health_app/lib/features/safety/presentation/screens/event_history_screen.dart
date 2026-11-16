import 'dart:async';

import 'package:collection/collection.dart';
import 'package:driver_health_app/app/router/app_routes.dart';
import 'package:driver_health_app/core/network/api_failure.dart';
import 'package:driver_health_app/core/presentation/widgets/content_page.dart';
import 'package:driver_health_app/core/presentation/widgets/inline_message.dart';
import 'package:driver_health_app/core/presentation/widgets/surface_card.dart';
import 'package:driver_health_app/core/theme/app_colors.dart';
import 'package:driver_health_app/features/safety/application/event_history_controller.dart';
import 'package:driver_health_app/features/safety/domain/entities/medical_event.dart';
import 'package:driver_health_app/features/safety/presentation/safety_copy.dart';
import 'package:driver_health_app/features/safety/presentation/widgets/event_tile.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

/// History tab: every detection and SOS, newest first, grouped by day.
class EventHistoryScreen extends ConsumerWidget {
  const new({super.key});

  static const loadMoreKey = Key('history.loadMore');

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final history = ref.watch(eventHistoryControllerProvider);
    final controller = ref.read(eventHistoryControllerProvider.notifier);
    final filter = history.value?.filter;

    return Scaffold(
      backgroundColor: Colors.transparent,
      body: ContentPage(
        title: 'History',
        entranceKey: history.hasValue,
        subtitle: 'Detections from your cabin unit and your SOS alerts.',
        onRefresh: controller.refresh,
        children: [
          _Filters(
            selected: filter,
            onSelected: (type) => unawaited(controller.setFilter(type)),
          ),
          const SizedBox(height: 16),
          ...switch (history) {
            AsyncData(:final value) => _list(context, value, controller),
            AsyncError(:final error) => [
              InlineMessage(message: ApiFailure.from(error).message),
              const SizedBox(height: 8),
              TextButton(
                onPressed: () => unawaited(controller.refresh()),
                child: const Text(
                  'Try again',
                  style: TextStyle(color: AppColors.cyan),
                ),
              ),
            ],
            _ => const [
              Center(
                child: Padding(
                  padding: EdgeInsets.all(32),
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
    EventHistoryState state,
    EventHistoryController controller,
  ) {
    if (state.events.isEmpty) {
      return [_Empty(filtered: state.filter != null)];
    }
    final byDay = groupBy(
      state.events,
      (event) => DateUtils.dateOnly(event.detectedAt.toLocal()),
    );
    return [
      for (final MapEntry(key: day, value: events) in byDay.entries) ...[
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
        for (final event in events)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: EventTile(
              event: event,
              onTap: () =>
                  unawaited(context.push(AppRoutes.historyEvent(event.id))),
            ),
          ),
      ],
      if (state.loadMoreFailure case final failure?) ...[
        InlineMessage(message: failure.message),
        const SizedBox(height: 8),
      ],
      if (state.hasMore)
        Center(
          child: state.loadingMore
              ? const Padding(
                  padding: EdgeInsets.all(12),
                  child: CircularProgressIndicator(color: AppColors.cyan),
                )
              : TextButton(
                  key: loadMoreKey,
                  onPressed: () => unawaited(controller.loadMore()),
                  child: const Text(
                    'Show older events',
                    style: TextStyle(color: AppColors.cyan),
                  ),
                ),
        ),
      const SizedBox(height: 12),
      const Text(
        'Event details are kept for 90 days.',
        textAlign: TextAlign.center,
        style: TextStyle(color: AppColors.slate, fontSize: 13),
      ),
    ];
  }
}

class _Filters extends StatelessWidget {
  const new({required this.selected, required this.onSelected});

  final MedicalEventType? selected;
  final ValueChanged<MedicalEventType?> onSelected;

  @override
  Widget build(BuildContext context) {
    Widget chip(String label, MedicalEventType? type) => Padding(
      padding: const EdgeInsets.only(right: 8),
      child: ChoiceChip(
        label: Text(label),
        selected: selected == type,
        onSelected: (_) => onSelected(type),
        showCheckmark: false,
        labelStyle: TextStyle(
          color: selected == type ? AppColors.navy950 : AppColors.ice,
          fontWeight: FontWeight.w700,
        ),
        selectedColor: AppColors.cyan,
        backgroundColor: AppColors.navy900,
        side: BorderSide(color: AppColors.cyan.withValues(alpha: 0.3)),
      ),
    );
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          chip('All', null),
          for (final type in MedicalEventType.values.where(
            (type) => type != MedicalEventType.unknown,
          ))
            chip(SafetyCopy.filterLabel(type), type),
        ],
      ),
    );
  }
}

class _Empty extends StatelessWidget {
  const new({required this.filtered});

  final bool filtered;

  @override
  Widget build(BuildContext context) {
    return SurfaceCard(
      padding: const EdgeInsets.all(24),
      child: Column(
        children: [
          const Icon(
            Icons.verified_user_rounded,
            color: AppColors.mint,
            size: 44,
          ),
          const SizedBox(height: 12),
          Text(
            filtered ? 'No events of this kind' : 'No events yet',
            style: const TextStyle(
              color: Colors.white,
              fontSize: 18,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 6),
          const Text(
            'When your cabin unit detects something, or you use SOS, '
            'it appears here.',
            textAlign: TextAlign.center,
            style: TextStyle(color: AppColors.slate, height: 1.4),
          ),
        ],
      ),
    );
  }
}
