import 'package:driver_health_app/core/presentation/motion/entrance.dart';
import 'package:driver_health_app/core/presentation/widgets/cabinguard_background.dart';
import 'package:driver_health_app/core/presentation/widgets/cabinguard_brand.dart';
import 'package:driver_health_app/core/presentation/widgets/glass_panel.dart';
import 'package:driver_health_app/core/theme/app_colors.dart';
import 'package:flutter/material.dart';

/// Brand header over the road artwork with a glass panel anchored low, as in
/// the sign-in and verification mockups. Scrolls when the keyboard is open or
/// text is scaled up. The brand fades in, then the panel rises into place.
class AuthPanelLayout extends StatelessWidget {
  const new({
    required this.child,
    this.onBack,
    this.footer,
    this.backgroundAlignment = const Alignment(-0.7, -0.35),
    super.key,
  });

  final Widget child;
  final VoidCallback? onBack;
  final Widget? footer;
  final Alignment backgroundAlignment;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: CabinGuardBackground(
        alignment: backgroundAlignment,
        overlayStrength: 0.3,
        child: EntranceScope(
          child: SafeArea(
            child: LayoutBuilder(
              builder: (context, constraints) {
                final compact = constraints.maxHeight < 720;
                final vertical = compact ? 8.0 : 16.0;
                return SingleChildScrollView(
                  keyboardDismissBehavior:
                      ScrollViewKeyboardDismissBehavior.onDrag,
                  padding: EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: vertical,
                  ),
                  child: Center(
                    child: ConstrainedBox(
                      constraints: BoxConstraints(
                        maxWidth: 480,
                        minHeight: constraints.maxHeight - vertical * 2,
                      ),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Entrance(
                            rise: 0,
                            child: _Header(onBack: onBack, compact: compact),
                          ),
                          SizedBox(height: compact ? 20 : 48),
                          Column(
                            children: [
                              Entrance(
                                index: 2,
                                rise: 32,
                                child: GlassPanel(
                                  padding: EdgeInsets.fromLTRB(
                                    compact ? 18 : 24,
                                    compact ? 20 : 28,
                                    compact ? 18 : 24,
                                    compact ? 18 : 24,
                                  ),
                                  child: child,
                                ),
                              ),
                              if (footer != null) ...[
                                const SizedBox(height: 16),
                                Entrance(index: 4, child: footer!),
                              ],
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
        ),
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const new({required this.onBack, required this.compact});

  final VoidCallback? onBack;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: compact ? 64 : 88,
      child: Stack(
        alignment: Alignment.center,
        children: [
          const CabinGuardBrand(compact: true),
          if (onBack != null)
            Align(
              alignment: Alignment.centerLeft,
              child: IconButton(
                onPressed: onBack,
                tooltip: 'Back',
                iconSize: 30,
                color: AppColors.ice,
                icon: const Icon(Icons.chevron_left_rounded),
              ),
            ),
        ],
      ),
    );
  }
}
