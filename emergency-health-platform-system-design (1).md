# Emergency Health Monitoring & Dispatch Platform — System Design

## 1. Product summary

A two-sided platform:

- **User side**: pulls vitals (heart rate, SpO2, pulse, and optionally ECG/skin temp/fall detection) from a wearable or phone health app, monitors continuously, detects dangerous deviations, raises a 30-second cancellable alert, and — on timeout — auto-books the best-matched hospital and ambulance based on the user's saved preferences (budget, preferred hospitals, insurance).
- **Hospital side**: a dashboard where hospitals keep bed count, service availability, ambulance fleet status, and indicative pricing up to date, and receive/accept incoming emergency bookings.

The two diagrams above cover the component map and the alert-to-dispatch flow. This document covers what sits underneath: data model, matching logic, APIs, edge cases, and compliance.

---

## 2. Core components

| Component | Responsibility |
|---|---|
| Wearable/health-app connectors | Pull data via Apple HealthKit, Google Fit/Health Connect, Fitbit/Garmin APIs, or direct BLE GATT from the device |
| Vitals ingestion & stream processor | Normalizes readings, timestamps, buffers, writes to time-series store, publishes to the anomaly pipeline |
| Anomaly / emergency detection engine | Rule-based thresholds + personalized baselines (and later ML) to flag a likely emergency |
| Alert & escalation service | Fires the in-app/push/SMS alert, owns the 30-second countdown, listens for cancellation |
| Hospital matching & dispatch service | Given user location + preferences, ranks eligible hospitals and requests a booking |
| Hospital service | Bed/service/pricing inventory, kept current by hospital staff via the dashboard |
| Ambulance booking service | Talks to hospital-owned ambulances or third-party dispatch (e.g. regional ambulance aggregators) |
| Notification service | Push, SMS, voice call fallback, and emergency-contact notification |
| User & hospital profile service | Auth, medical profile, budget/insurance preferences, hospital credentials and verification |

---

## 3. Data model (core entities)

**User profile**
- demographics, medical history summary, allergies, medications, blood type
- emergency contacts (name, phone, relation)
- preferences: monthly/per-incident budget ceiling, insurance provider, preferred hospital list, preferred hospital tier
- linked wearable/device tokens

**Vitals reading** (time-series)
- user_id, timestamp, heart_rate, spo2, pulse, (optional: ECG snippet, temp, fall flag), source device

**Baseline profile** (per user)
- resting HR range, SpO2 floor, age/condition-adjusted thresholds — recalculated periodically so alerts aren't tuned to a "generic adult" and don't over/under-fire for athletes, elderly users, or people with known conditions

**Hospital profile**
- name, geolocation, verified license ID, service tags (cardiac, trauma, ICU, pediatric, etc.), indicative pricing tier, insurance networks accepted
- live bed count by ward, live ambulance fleet count and status

**Emergency event**
- trigger reading(s), detection reason, alert timestamps, user response (cancelled/timeout), matched hospital, booking status, outcome

**Booking**
- event_id, hospital_id, ambulance_id, ETA, status (requested → accepted → en route → arrived → closed)

---

## 4. Emergency detection logic

Two layers, so it doesn't depend on network latency at the moment it matters most:

1. **On-device / on-phone lightweight check** — simple threshold rules run locally (e.g. HR > 150 or < 40 sustained for N seconds, SpO2 < 90%) so detection still works with a spotty connection. This layer can fire the alert immediately.
2. **Server-side model** — richer, personalized-baseline and trend-based detection (e.g. rate of decline over 5 minutes, combination of falling SpO2 + rising HR) run against the streamed data, catching things a fixed threshold misses.

Both feed the same Alert service, deduplicated by event ID.

**False-positive handling matters a lot here** — an over-eager system that cries wolf will get its alerts ignored or muted, which defeats the purpose. Practical mitigations:
- Require the abnormal reading to persist over a short window, not a single sample (sensors spike).
- Use personalized baselines, not one-size-fits-all thresholds.
- Let the user quickly mark a false alarm as "not an emergency" with a reason, and feed that back to tune their baseline.
- Track alert precision as a monitored metric per user cohort.

---

## 5. The 30-second window and dispatch trigger

- Alert fires as a full-screen, high-priority, hard-to-miss notification (loud sound overriding silent mode, similar to how fall-detection works on modern watches), plus a push to the phone if the wearable app itself can't hold attention.
- Countdown is tracked **server-side**, not just on-device, so a dead phone battery or closed app doesn't silently cancel the emergency response — if the device goes dark mid-countdown, the server should treat that as "no cancellation received" and proceed at timeout, not assume the user is fine.
- On cancellation: log the event, resume monitoring, optionally ask a one-tap "are you sure?" to catch accidental cancels.
- On timeout: hand off to the matching service immediately, and simultaneously notify emergency contacts (this happens whether or not the hospital dispatch step succeeds — a friend/family member being alerted shouldn't wait on hospital matching logic).

---

## 6. Hospital matching logic

Inputs: user's live GPS location, medical profile (e.g. cardiac history → prioritize cardiac-capable hospitals), budget ceiling, insurance network, preferred hospital list.

Ranking approach (roughly, tunable):
1. **Hard filters first**: hospital must currently report available beds in the relevant ward, must be within a reasonable travel radius, and — for a true emergency — should not be hard-filtered out purely on budget the way it would be for a scheduled procedure (see note below).
2. **Soft ranking**: weighted score combining travel time (from live traffic-aware ETA, not straight-line distance), service-match to the detected condition, budget/insurance fit, and hospital-reported current load.
3. **Send booking request** to the top-ranked hospital with a short accept/reject SLA (e.g. 20–30 seconds); on rejection or no response, cascade to the next-ranked hospital automatically.

**Important product/ethical point to design in deliberately**: in a true life-threatening emergency, strictly obeying a budget cap over hospital capability could cost time or worse. A reasonable design is to treat the user's stated budget/preference as the primary ranking factor for non-critical dispatch, but flag it as advisory-only (not a hard filter) once the detected severity crosses a "life-threatening" tier — and always let the ambulance crew/EMT make the final call on-site, since they're trained for it and the app isn't a medical authority.

---

## 7. Key API surface (illustrative)

```
POST /v1/vitals/stream          # continuous ingestion from device
POST /v1/emergency/alerts       # created by detection engine
POST /v1/emergency/alerts/{id}/cancel   # user cancels within window
GET  /v1/hospitals/nearby       # matching query: location, condition, budget
POST /v1/bookings                # dispatch service creates a booking request
PATCH /v1/bookings/{id}          # hospital accepts/rejects/updates status
PUT  /v1/hospitals/{id}/inventory # hospital dashboard updates beds/services
```

---

## 8. Non-functional requirements

- **Latency**: vitals-to-alert path should be sub-second for on-device checks; end-to-end dispatch decision within a few seconds of timeout.
- **Availability**: the detection and alert path is the most safety-critical component — design it to degrade gracefully (e.g. local detection still works offline, alert queues and sends the moment connectivity returns) rather than fail silently.
- **Data privacy & compliance**: continuous health data + location is highly sensitive. Plan for encryption in transit and at rest, strict access controls, consent management for sharing medical history with a matched hospital, and regional compliance (HIPAA in the US, DPDP Act in India, GDPR in the EU — pick based on target market). Get real legal/compliance review before launch; this is not optional for a product that touches PHI and dispatches real ambulances.
- **Auditability**: every emergency event needs an immutable log (detection reason, timestamps, actions taken) — useful for debugging, for hospitals, and potentially for liability review.

---

## 9. Suggested tech stack (one reasonable option)

- **Ingestion/streaming**: Kafka or AWS Kinesis for the vitals pipeline
- **Time-series storage**: TimescaleDB or InfluxDB for vitals history
- **Relational storage**: PostgreSQL for users, hospitals, bookings
- **Cache/real-time state**: Redis (countdown timers, geo queries via geo-indexes)
- **Services**: containerized microservices (Kubernetes) or a simpler modular monolith to start — you don't need microservices on day one; a well-structured monolith with clear module boundaries is easier to build and debug for an MVP, and you can peel services out later once you know where the real scaling pressure is
- **Mobile**: native iOS/Android (needed for reliable HealthKit/Health Connect access and background execution) — background/foreground service reliability for continuous monitoring is one of the harder engineering problems here, especially on iOS's stricter background execution limits
- **Hospital dashboard**: standard web app

---

## 10. Biggest open risks to validate early

1. **Background monitoring reliability on iOS** — Apple restricts background execution; continuous vitals polling needs careful use of HealthKit background delivery, and you may not get true real-time streaming without the wearable itself doing on-device detection and pushing alerts (e.g. Apple Watch fall detection model).
2. **Hospital data freshness** — the whole matching quality depends on hospitals actually keeping bed/service data current; without an incentive or automated integration (e.g. pulling from hospital bed-management systems where available), manually-entered data will go stale.
3. **Liability and regulatory approval** — an app that auto-books ambulances is functionally a medical dispatch system in many jurisdictions, which likely triggers regulatory requirements beyond a typical consumer app (medical device software classification, local emergency-services coordination, etc.). Worth a legal consult before building further.
4. **False positive/negative tuning** — the hardest part of the whole product isn't the booking flow, it's getting the detection threshold right for a wide range of users (athletes, elderly, chronic condition patients) without becoming a nuisance or missing real events.
