import 'package:dio/dio.dart';
import 'package:driver_health_app/core/network/api_envelope.dart';
import 'package:driver_health_app/features/safety/data/safety_json.dart';
import 'package:driver_health_app/features/safety/domain/entities/incident.dart';
import 'package:driver_health_app/features/safety/domain/entities/medical_event.dart';
import 'package:driver_health_app/features/safety/domain/repositories/safety_repository.dart';

class RemoteSafetyRepository implements SafetyRepository {
  const new(this._dio);

  static const pageSize = 20;

  final Dio _dio;

  @override
  Future<Paged<MedicalEvent>> events({
    required int page,
    MedicalEventType? type,
  }) async {
    final response = await _dio.get<Object?>(
      'safety/events',
      queryParameters: {
        'page': page,
        'pageSize': pageSize,
        if (type != null) 'type': SafetyJson.eventTypeToJson(type),
      },
    );
    return _paged(response.data, page, SafetyJson.event);
  }

  @override
  Future<MedicalEvent> event(String eventId) async {
    final response = await _dio.get<Object?>(
      'safety/events/${Uri.encodeComponent(eventId)}',
    );
    return SafetyJson.event(ApiEnvelope.data(response.data));
  }

  @override
  Future<Paged<Incident>> incidents({required int page}) async {
    final response = await _dio.get<Object?>(
      'safety/incidents',
      queryParameters: {'page': page, 'pageSize': pageSize},
    );
    return _paged(response.data, page, SafetyJson.incident);
  }

  @override
  Future<IncidentDetail?> activeIncident() async {
    final response = await _dio.get<Object?>('safety/incidents/active');
    final data = ApiEnvelope.optionalData(response.data);
    return data == null ? null : SafetyJson.incidentDetail(data);
  }

  @override
  Future<IncidentDetail> incident(String incidentId) async {
    final response = await _dio.get<Object?>(
      'safety/incidents/${Uri.encodeComponent(incidentId)}',
    );
    return SafetyJson.incidentDetail(ApiEnvelope.data(response.data));
  }

  @override
  Future<Incident> acknowledge(String incidentId) async {
    final response = await _dio.post<Object?>(
      'safety/incidents/${Uri.encodeComponent(incidentId)}/acknowledge',
    );
    return SafetyJson.incident(ApiEnvelope.data(response.data));
  }

  @override
  Future<Incident> sos({required String clientEventId}) async {
    final response = await _dio.post<Object?>(
      'safety/sos',
      data: {'clientEventId': clientEventId},
    );
    return SafetyJson.incident(ApiEnvelope.data(response.data));
  }

  @override
  Future<List<FamilyIncident>> familyIncidents() async {
    final response = await _dio.get<Object?>('families/mine/incidents');
    return [
      for (final item in ApiEnvelope.list(response.data))
        SafetyJson.familyIncident(item),
    ];
  }

  static Paged<T> _paged<T>(
    Object? payload,
    int page,
    T Function(Map<String, Object?> json) parse,
  ) {
    final items = [for (final item in ApiEnvelope.list(payload)) parse(item)];
    return Paged(
      items: items,
      page:
          ApiEnvelope.page(payload) ??
          PageInfo(page: page, totalPages: page, totalItems: items.length),
    );
  }
}
