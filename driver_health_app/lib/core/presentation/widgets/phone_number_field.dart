import 'dart:ui' as ui;

import 'package:driver_health_app/core/presentation/widgets/cabinguard_text_field.dart';
import 'package:driver_health_app/core/theme/app_colors.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

class DialingCountry {
  const new(this.isoCode, this.name, this.dialCode);

  final String isoCode;
  final String name;

  /// Without the leading `+`.
  final String dialCode;

  String get flag => String.fromCharCodes(
    isoCode.toUpperCase().codeUnits.map((unit) => 0x1F1E6 + unit - 0x41),
  );
}

/// Countries offered in the picker. Numbers from elsewhere can still be typed
/// in full international form with “Other”.
const dialingCountries = [
  DialingCountry('TN', 'Tunisia', '216'),
  DialingCountry('DZ', 'Algeria', '213'),
  DialingCountry('MA', 'Morocco', '212'),
  DialingCountry('LY', 'Libya', '218'),
  DialingCountry('EG', 'Egypt', '20'),
  DialingCountry('FR', 'France', '33'),
  DialingCountry('BE', 'Belgium', '32'),
  DialingCountry('CH', 'Switzerland', '41'),
  DialingCountry('DE', 'Germany', '49'),
  DialingCountry('IT', 'Italy', '39'),
  DialingCountry('ES', 'Spain', '34'),
  DialingCountry('PT', 'Portugal', '351'),
  DialingCountry('NL', 'Netherlands', '31'),
  DialingCountry('AT', 'Austria', '43'),
  DialingCountry('GB', 'United Kingdom', '44'),
  DialingCountry('IE', 'Ireland', '353'),
  DialingCountry('SE', 'Sweden', '46'),
  DialingCountry('NO', 'Norway', '47'),
  DialingCountry('DK', 'Denmark', '45'),
  DialingCountry('PL', 'Poland', '48'),
  DialingCountry('TR', 'Türkiye', '90'),
  DialingCountry('SA', 'Saudi Arabia', '966'),
  DialingCountry('AE', 'United Arab Emirates', '971'),
  DialingCountry('QA', 'Qatar', '974'),
  DialingCountry('KW', 'Kuwait', '965'),
  DialingCountry('US', 'United States', '1'),
  DialingCountry('CA', 'Canada', '1'),
];

final _e164 = RegExp(r'^\+[1-9]\d{6,14}$');

/// Splits an E.164 number into a picker country and the national digits.
/// Returns a `null` country when no listed dialing code matches.
(DialingCountry?, String) splitE164(String value) {
  if (!value.startsWith('+')) return (null, value);
  final digits = value.substring(1);
  DialingCountry? best;
  for (final country in dialingCountries) {
    if (digits.startsWith(country.dialCode) &&
        (best == null || country.dialCode.length > best.dialCode.length)) {
      best = country;
    }
  }
  return best == null
      ? (null, value)
      : (best, digits.substring(best.dialCode.length));
}

/// Builds E.164 from a country and what the user typed. A full `+…` number
/// typed by the user wins over the selected country.
String composeE164(DialingCountry? country, String input) {
  final cleaned = input.replaceAll(RegExp(r'[\s\-.()]'), '');
  if (cleaned.startsWith('+')) return cleaned;
  if (cleaned.startsWith('00')) return '+${cleaned.substring(2)}';
  if (country == null) return cleaned.isEmpty ? '' : '+$cleaned';
  final national = cleaned.startsWith('0') ? cleaned.substring(1) : cleaned;
  return national.isEmpty ? '' : '+${country.dialCode}$national';
}

bool isE164(String value) => _e164.hasMatch(value);

DialingCountry? _deviceCountry() {
  final code = ui.PlatformDispatcher.instance.locale.countryCode;
  for (final country in dialingCountries) {
    if (country.isoCode == code) return country;
  }
  return null;
}

/// International phone input that always reports E.164 through [onChanged].
class PhoneNumberField extends StatefulWidget {
  const new({
    required this.label,
    required this.onChanged,
    this.initialValue = '',
    this.errorText,
    this.enabled = true,
    this.textInputAction,
    this.extraValidator,
    super.key,
  });

  final String label;
  final String initialValue;
  final ValueChanged<String> onChanged;
  final String? errorText;
  final bool enabled;
  final TextInputAction? textInputAction;

  /// Runs on a valid E.164 value, e.g. duplicate detection.
  final String? Function(String e164)? extraValidator;

  @override
  State<PhoneNumberField> createState() => _PhoneNumberFieldState();
}

class _PhoneNumberFieldState extends State<PhoneNumberField> {
  late DialingCountry? _country;
  late final TextEditingController _controller;

  @override
  void initState() {
    super.initState();
    final (country, national) = splitE164(widget.initialValue);
    _country = widget.initialValue.isEmpty
        ? (_deviceCountry() ?? dialingCountries.first)
        : country;
    _controller = TextEditingController(text: national);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _emit() => widget.onChanged(composeE164(_country, _controller.text));

  Future<void> _pickCountry() async {
    final picked = await showModalBottomSheet<_CountryChoice>(
      context: context,
      backgroundColor: AppColors.navy900,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (context) => _CountrySheet(selected: _country),
    );
    if (picked == null || !mounted) return;
    setState(() => _country = picked.country);
    _emit();
  }

  @override
  Widget build(BuildContext context) {
    final country = _country;
    return CabinGuardTextField(
      label: widget.label,
      controller: _controller,
      hintText: country == null ? '+216 12 345 678' : '12 345 678',
      keyboardType: TextInputType.phone,
      textInputAction: widget.textInputAction,
      autofillHints: const [AutofillHints.telephoneNumber],
      autocorrect: false,
      enabled: widget.enabled,
      errorText: widget.errorText,
      inputFormatters: [
        FilteringTextInputFormatter.allow(RegExp(r'[\d\s\-.()+]')),
        LengthLimitingTextInputFormatter(20),
      ],
      onChanged: (_) => _emit(),
      validator: (_) {
        final value = composeE164(_country, _controller.text);
        if (value.isEmpty) return 'Enter a phone number.';
        if (!isE164(value)) return 'Enter a valid international number.';
        return widget.extraValidator?.call(value);
      },
      prefix: Semantics(
        button: true,
        label: country == null
            ? 'Country code: other'
            : 'Country code: ${country.name}, plus ${country.dialCode}',
        excludeSemantics: true,
        child: InkWell(
          onTap: widget.enabled ? _pickCountry : null,
          borderRadius: BorderRadius.circular(12),
          child: Padding(
            padding: const EdgeInsets.only(left: 12, right: 6),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  country == null ? '🌐' : country.flag,
                  style: const TextStyle(fontSize: 22),
                ),
                const SizedBox(width: 4),
                Text(
                  country == null ? '+' : '+${country.dialCode}',
                  style: const TextStyle(color: AppColors.ice, fontSize: 16),
                ),
                const Icon(
                  Icons.expand_more_rounded,
                  color: AppColors.slate,
                  size: 20,
                ),
                const SizedBox(width: 4),
                SizedBox(
                  height: 28,
                  child: VerticalDivider(
                    width: 1,
                    color: AppColors.slate.withValues(alpha: 0.4),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _CountryChoice {
  const new(this.country);

  final DialingCountry? country;
}

class _CountrySheet extends StatelessWidget {
  const new({required this.selected});

  final DialingCountry? selected;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.sizeOf(context).height * 0.7,
        ),
        child: ListView(
          shrinkWrap: true,
          children: [
            for (final country in dialingCountries)
              ListTile(
                leading: Text(
                  country.flag,
                  style: const TextStyle(fontSize: 24),
                ),
                title: Text(
                  country.name,
                  style: const TextStyle(color: Colors.white),
                ),
                trailing: Text(
                  '+${country.dialCode}',
                  style: const TextStyle(color: AppColors.slate),
                ),
                selected: identical(country, selected),
                onTap: () => Navigator.of(context).pop(_CountryChoice(country)),
              ),
            ListTile(
              leading: const Icon(Icons.public_rounded, color: AppColors.ice),
              title: const Text(
                'Other — type the full international number',
                style: TextStyle(color: Colors.white),
              ),
              selected: selected == null,
              onTap: () =>
                  Navigator.of(context).pop(const _CountryChoice(null)),
            ),
          ],
        ),
      ),
    );
  }
}
