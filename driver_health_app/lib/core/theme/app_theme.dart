import 'package:animations/animations.dart';
import 'package:driver_health_app/core/theme/app_colors.dart';
import 'package:flutter/cupertino.dart' show CupertinoPageTransitionsBuilder;
import 'package:flutter/material.dart';

abstract final class AppTheme {
  static ThemeData get dark => _theme(Brightness.dark);
  static ThemeData get light => _theme(Brightness.light);

  static ThemeData _theme(Brightness brightness) {
    final isDark = brightness == Brightness.dark;
    final scheme = ColorScheme.fromSeed(
      seedColor: AppColors.cobalt,
      brightness: brightness,
      primary: AppColors.cobalt,
      secondary: AppColors.cyan,
      error: AppColors.coral,
      surface: isDark ? AppColors.navy900 : const Color(0xFFF6F9FD),
    );
    final textTheme = Typography.material2021().white.apply(
      bodyColor: isDark ? AppColors.ice : AppColors.navy950,
      displayColor: isDark ? Colors.white : AppColors.navy950,
    );

    return ThemeData(
      useMaterial3: true,
      // Material motion: screens slide along a shared horizontal axis while
      // cross-fading (forward and back read as moving through the app).
      // iOS keeps its native transition and its swipe-back gesture.
      pageTransitionsTheme: PageTransitionsTheme(
        builders: {
          TargetPlatform.android: SharedAxisPageTransitionsBuilder(
            transitionType: SharedAxisTransitionType.horizontal,
            fillColor: isDark ? AppColors.navy950 : const Color(0xFFF4F8FC),
          ),
          TargetPlatform.iOS: const CupertinoPageTransitionsBuilder(),
          TargetPlatform.macOS: const CupertinoPageTransitionsBuilder(),
        },
      ),
      brightness: brightness,
      colorScheme: scheme,
      scaffoldBackgroundColor: isDark
          ? AppColors.navy950
          : const Color(0xFFF4F8FC),
      textTheme: textTheme,
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: isDark
            ? AppColors.navy800.withValues(alpha: 0.72)
            : Colors.white,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide(color: scheme.outlineVariant),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide(color: scheme.outlineVariant),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: AppColors.cyan, width: 1.5),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size.fromHeight(54),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
          // Derived from the theme so the button keeps its font family.
          textStyle: textTheme.labelLarge?.copyWith(
            fontSize: 16,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
    );
  }
}
