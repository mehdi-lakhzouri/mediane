import 'package:driver_health_app/core/theme/app_colors.dart';
import 'package:flutter/material.dart';

/// Server policy: 12–128 characters, not containing the email address.
abstract final class PasswordRules {
  static const minLength = 12;
  static const maxLength = 128;

  static String? validateNew(String? value) {
    final length = value?.length ?? 0;
    if (length < minLength) return 'Use at least $minLength characters.';
    if (length > maxLength) return 'Use no more than $maxLength characters.';
    return null;
  }

  /// Guidance only (0–3). The server enforces length, not composition.
  static int strength(String value) {
    if (value.length < minLength) return 0;
    var score = 1;
    final mixedCase =
        RegExp('[A-Z]').hasMatch(value) && RegExp('[a-z]').hasMatch(value);
    final digitOrSymbol = RegExp('[^A-Za-z]').hasMatch(value);
    if (mixedCase || value.length >= 20) score++;
    if (digitOrSymbol || value.length >= 24) score++;
    return score;
  }
}

/// Strength meter and checklist for a new password, as in screen 13.
class PasswordStrengthPanel extends StatelessWidget {
  const new({required this.password, required this.confirmation, super.key});

  final String password;
  final String confirmation;

  @override
  Widget build(BuildContext context) {
    final score = PasswordRules.strength(password);
    final (label, color) = switch (score) {
      0 => ('Too short', AppColors.slate),
      1 => ('Fair', const Color(0xFFFFC857)),
      2 => ('Good', AppColors.cyan),
      _ => ('Strong', AppColors.mint),
    };
    final lengthMet = password.length >= PasswordRules.minLength;
    final mixedCase =
        RegExp('[A-Z]').hasMatch(password) &&
        RegExp('[a-z]').hasMatch(password);
    final digitOrSymbol = RegExp('[^A-Za-z]').hasMatch(password);
    final matches = password.isNotEmpty && password == confirmation;

    return Semantics(
      container: true,
      label: 'Password strength: $label',
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: AppColors.navy950.withValues(alpha: 0.38),
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: AppColors.slate.withValues(alpha: 0.3)),
        ),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  ExcludeSemantics(
                    child: Text(
                      label,
                      style: TextStyle(
                        color: color,
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                  const SizedBox(width: 16),
                  for (var i = 0; i < 3; i++) ...[
                    if (i > 0) const SizedBox(width: 4),
                    Expanded(
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 200),
                        height: 6,
                        decoration: BoxDecoration(
                          color: i < score
                              ? color
                              : AppColors.slate.withValues(alpha: 0.25),
                          borderRadius: BorderRadius.circular(99),
                        ),
                      ),
                    ),
                  ],
                ],
              ),
              const SizedBox(height: 12),
              _Check(
                label: '${PasswordRules.minLength}+ characters (required)',
                met: lengthMet,
              ),
              _Check(label: 'Uppercase & lowercase', met: mixedCase),
              _Check(label: 'Number or symbol', met: digitOrSymbol),
              _Check(label: 'Passwords match', met: matches),
            ],
          ),
        ),
      ),
    );
  }
}

class _Check extends StatelessWidget {
  const new({required this.label, required this.met});

  final String label;
  final bool met;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: '$label, ${met ? 'met' : 'not met'}',
      excludeSemantics: true,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 3),
        child: Row(
          children: [
            Icon(
              met ? Icons.check_circle_rounded : Icons.circle_outlined,
              color: met ? AppColors.mint : AppColors.slate,
              size: 20,
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                label,
                style: TextStyle(color: met ? AppColors.ice : AppColors.slate),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
