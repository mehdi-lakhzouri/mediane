import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Whether summaries refresh themselves on a timer (dashboard, open
/// incidents, family alerts). Until push notifications exist this is how
/// server-side changes reach the screen. Widget tests turn it off unless
/// they exercise it, so no timer outlives a test.
final pollingEnabledProvider = Provider<bool>((ref) => true);
