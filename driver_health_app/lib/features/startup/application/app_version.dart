class AppVersion implements Comparable<AppVersion> {
  const new(this.major, this.minor, this.patch);

  factory parse(String value) {
    final core = value.split(RegExp('[-+]')).first;
    final parts = core.split('.');
    if (parts.length != 3) throw FormatException('Invalid app version: $value');
    return AppVersion(
      int.parse(parts[0]),
      int.parse(parts[1]),
      int.parse(parts[2]),
    );
  }

  final int major;
  final int minor;
  final int patch;

  @override
  int compareTo(AppVersion other) {
    final majorComparison = major.compareTo(other.major);
    if (majorComparison != 0) return majorComparison;
    final minorComparison = minor.compareTo(other.minor);
    if (minorComparison != 0) return minorComparison;
    return patch.compareTo(other.patch);
  }
}
