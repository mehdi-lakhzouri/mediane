# Administrative incident register

`/dashboard/incidents` uses the shared dashboard statistics, table/card view,
pagination and detail sheet components. It refreshes every 15 seconds while
visible. Search, sorting, status and rolling time-period filters run on the API;
the five statistics cards always summarize the entire incident register.

## API and access

These read-only routes require an active administrator session:

| Route under `/api/v1`              | Result                                                   |
| ---------------------------------- | -------------------------------------------------------- |
| `GET /admin/incidents`             | Paginated operational incident summaries.                |
| `GET /admin/incidents/stats`       | Global total and the four status counts.                 |
| `GET /admin/incidents/:incidentId` | Response milestones, timeline and notification attempts. |

List parameters: `page`, `pageSize` (maximum 100), `search` (driver name/email or
exact incident UUID), `status`, `period` (`24h`, `7d`, `30d`), `sortBy`
(`openedAt`, `status`, `driver`, `respondBy`) and `sortDir` (`asc`, `desc`).

The repository selects driver identity, incident status, response times, event
and attempt counts, timeline kind/time, and notification channel/status/time.
It does not select medical event types, severity, scores, readings, location,
model evidence, contact identities, notification errors or free-form timeline
details. Existing driver-owned mobile endpoints retain their access rules.
The console does not acknowledge, resolve or escalate incidents on a driver's behalf.

`FALSE_ALARM` is displayed as **Cancelled**: it means the driver responded before
escalation, not that an independent medical assessment disproved a detection.
System closure is identified separately from an app/device response in the sheet.
Notification channel acceptance is not delivery confirmation; `LOG` entries are
displayed as local records.

Replayed AI scenarios remain non-actionable driver history. They do not create
incidents for this register. Empty and unavailable API states are shown separately;
failed refreshes retain the last table snapshot and mark global counts unavailable.

## Checks

- `backend/test/admin-incidents.e2e-spec.ts`: real PostgreSQL, administrator access,
  driver/anonymous rejection, global counts, pagination/filtering, validation and
  exclusion of medical evidence and recipient details.
- `frontend/apps/web/e2e/specs/anonymous/incidents.spec.ts`: browser interactions,
  server pagination, summary scope, detail history, notification wording,
  French/mobile cards, empty states and API failure recovery (mocked API).

The UI and API changes must both be deployed before the register is available on the VM.
