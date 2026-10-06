import 'package:driver_health_app/core/network/api_failure.dart';
import 'package:driver_health_app/core/state/data_changes.dart';
import 'package:driver_health_app/features/safety/application/safety_providers.dart';
import 'package:driver_health_app/features/safety/domain/entities/medical_event.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class EventHistoryState {
  const new({
    required this.events,
    required this.page,
    required this.hasMore,
    this.filter,
    this.loadingMore = false,
    this.loadMoreFailure,
  });

  final List<MedicalEvent> events;
  final int page;
  final bool hasMore;

  /// Only this type, or everything when `null`.
  final MedicalEventType? filter;
  final bool loadingMore;
  final ApiFailure? loadMoreFailure;

  EventHistoryState copyWith({
    List<MedicalEvent>? events,
    int? page,
    bool? hasMore,
    bool? loadingMore,
    ApiFailure? loadMoreFailure,
  }) => EventHistoryState(
    events: events ?? this.events,
    page: page ?? this.page,
    hasMore: hasMore ?? this.hasMore,
    filter: filter,
    loadingMore: loadingMore ?? this.loadingMore,
    loadMoreFailure: loadMoreFailure,
  );
}

/// History tab: the driver's events, newest first, one page at a time.
final AsyncNotifierProvider<EventHistoryController, EventHistoryState>
eventHistoryControllerProvider = AsyncNotifierProvider.autoDispose(
  EventHistoryController.new,
);

class EventHistoryController extends AsyncNotifier<EventHistoryState> {
  MedicalEventType? _filter;

  @override
  Future<EventHistoryState> build() async {
    // New events arrive with incidents and dashboard refreshes.
    ref.watch(dataChangesProvider);
    return await _firstPage(_filter);
  }

  Future<void> setFilter(MedicalEventType? type) async {
    if (type == _filter && state.hasValue) return;
    _filter = type;
    state = const AsyncLoading();
    state = await AsyncValue.guard(() => _firstPage(type));
  }

  Future<void> refresh() async {
    state = await AsyncValue.guard(() => _firstPage(_filter));
  }

  Future<void> loadMore() async {
    final current = state.value;
    if (current == null || !current.hasMore || current.loadingMore) return;
    state = AsyncData(current.copyWith(loadingMore: true));
    try {
      final next = await ref
          .read(safetyRepositoryProvider)
          .events(page: current.page + 1, type: current.filter);
      if (!ref.mounted || state.value?.filter != current.filter) return;
      final known = {for (final event in current.events) event.id};
      state = AsyncData(
        current.copyWith(
          events: [
            ...current.events,
            for (final event in next.items)
              if (!known.contains(event.id)) event,
          ],
          page: next.page.page,
          hasMore: next.page.hasMore,
          loadingMore: false,
        ),
      );
    } on Object catch (error) {
      if (!ref.mounted) return;
      state = AsyncData(
        current.copyWith(
          loadingMore: false,
          loadMoreFailure: ApiFailure.from(error),
        ),
      );
    }
  }

  Future<EventHistoryState> _firstPage(MedicalEventType? type) async {
    final first = await ref
        .read(safetyRepositoryProvider)
        .events(page: 1, type: type);
    return EventHistoryState(
      events: first.items,
      page: first.page.page,
      hasMore: first.page.hasMore,
      filter: type,
    );
  }
}
