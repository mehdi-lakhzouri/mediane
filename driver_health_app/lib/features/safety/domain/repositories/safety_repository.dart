import 'package:driver_health_app/core/network/api_envelope.dart';
import 'package:driver_health_app/features/safety/domain/entities/incident.dart';
import 'package:driver_health_app/features/safety/domain/entities/medical_event.dart';

/// One page of a list, with where it stands.
class Paged<T> {
  const new({required this.items, required this.page});

  final List<T> items;
  final PageInfo page;
}

/// The driver's own safety data, and what the family may see.
abstract interface class SafetyRepository {
  Future<Paged<MedicalEvent>> events({
    required int page,
    MedicalEventType? type,
  });

  Future<MedicalEvent> event(String eventId);

  Future<Paged<Incident>> incidents({required int page});

  /// The open incident, or `null` when there is none.
  Future<IncidentDetail?> activeIncident();

  Future<IncidentDetail> incident(String incidentId);

  /// "I'm OK". Safe to repeat.
  Future<Incident> acknowledge(String incidentId);

  /// Calls for help now. [clientEventId] makes retries safe.
  Future<Incident> sos({required String clientEventId});

  Future<List<FamilyIncident>> familyIncidents();
}
