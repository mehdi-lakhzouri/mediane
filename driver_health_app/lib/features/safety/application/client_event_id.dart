import 'dart:math';

final _random = Random.secure();
const _alphabet =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/// Idempotency key for a request that must happen at most once (an SOS):
/// generated once per intent and reused on every retry.
String newClientEventId(String prefix) {
  final suffix = List.generate(
    20,
    (_) => _alphabet[_random.nextInt(_alphabet.length)],
  ).join();
  return '$prefix-$suffix';
}
