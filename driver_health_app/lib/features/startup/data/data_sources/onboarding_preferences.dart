import 'package:shared_preferences/shared_preferences.dart';

class OnboardingPreferences {
  const new(this._preferences);

  static const _completedKey = 'startup.onboardingCompleted';

  final SharedPreferencesAsync _preferences;

  Future<bool> isCompleted() async {
    return await _preferences.getBool(_completedKey) ?? false;
  }

  Future<void> complete() => _preferences.setBool(_completedKey, true);
}
