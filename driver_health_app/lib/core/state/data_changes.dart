import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Lets a feature announce that account data changed (profile, photo,
/// family, security) so summaries elsewhere, like the home dashboard, refresh
/// without the features importing each other.
final NotifierProvider<DataChanges, int> dataChangesProvider = NotifierProvider(
  DataChanges.new,
);

class DataChanges extends Notifier<int> {
  @override
  int build() => 0;

  void markChanged() => state++;
}
