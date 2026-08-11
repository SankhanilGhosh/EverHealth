# Implementation Plan — Emergency Health Monitoring & Dispatch Platform

## Guiding principle

Build so that the riskiest, hardest-to-fake assumptions get tested first, before you sink months into the full auto-dispatch pipeline. The three biggest unknowns from the system design are: (1) can you reliably detect an emergency without a flood of false alarms, (2) will hospitals actually keep their bed/service data current, and (3) what regulatory approval does auto-dispatching an ambulance require in your target market. Each phase below is scoped to answer one of these before you commit further engineering to it.

---

## Phase 0 — Validation & compliance groundwork (4–8 weeks)

Goal: de-risk the parts that aren't code problems.

- **Legal/regulatory consult**: in most jurisdictions, an app that auto-dispatches ambulances is functionally an emergency-medical-dispatch system, which may require certification, coordination with local emergency services (don't want to bypass the official emergency number, e.g. 108/911), and medical-device-software classification review. Get this read before building Phase 3.
- **Data privacy plan**: decide target jurisdiction(s) and the applicable regime (HIPAA / India's DPDP Act / GDPR), and design consent flows (sharing medical history with a matched hospital) and data retention policy up front — retrofitting this later is expensive.
- **Talk to 5–10 hospitals**: confirm whether they'd realistically keep a bed/availability dashboard updated, and what would motivate them to (e.g. it also drives them patient volume). This tells you whether Phase 2's core assumption holds.
- **Talk to wearable platforms**: confirm what background data access Apple HealthKit / Google Health Connect / Fitbit actually allow in practice, since this determines how "real-time" your detection can be.

Team: 1 founder/PM, part-time legal counsel, part-time technical advisor. No engineering hires needed yet.

---

## Phase 1 — MVP: monitoring, detection, alerting (8–12 weeks)

Goal: prove the detection-and-alert loop works and people trust it, before adding any hospital or dispatch logic.

**Scope:**
- Mobile app (start with one platform — likely iOS or Android, not both, to move faster) that reads HR/SpO2 from HealthKit/Health Connect or a supported wearable SDK.
- Basic on-device threshold detection + server-side stream ingestion into a time-series store.
- Alert UI with the 30-second countdown and cancel button. No hospital matching yet — on timeout, just notify the user's emergency contacts (this alone is a useful, shippable product).
- Basic user profile: emergency contacts, medical summary, baseline vitals.

**Explicitly out of scope for Phase 1**: hospital dashboard, ambulance booking, budget/insurance matching.

**Team**: 1 mobile engineer, 1 backend engineer, 1 PM/designer (can double up). 
**Success metric before moving on**: run a private beta (friends, family, maybe a local sports club or elderly-care group) long enough to measure false-positive rate and whether cancels/timeouts behave as expected. If the false-alarm rate is unacceptably high, this is the phase to fix it — don't move on until detection is trustworthy.

---

## Phase 2 — Hospital dashboard + manual-confirm pilot (8–10 weeks)

Goal: test hospital data freshness and matching quality with a human in the loop, before automating dispatch.

**Scope:**
- Web dashboard for hospitals to log in and update beds, services, and ambulance availability.
- Hospital matching logic (distance, service match, budget/insurance) built and tested, but **bookings require a human tap to confirm** on both sides rather than being fully automatic — this catches matching-logic bugs without real-world consequences.
- Onboard a small number of pilot hospitals (start with 2–5 in one city/region) with a simple ops process to keep them engaged (e.g. a human on your team calling to remind them to update beds, until it's habitual or automated).
- Booking status tracking (requested → accepted → en route → arrived).

**Team**: add 1 backend engineer (hospital service + matching), 1 person doing hospital partnerships/ops (this is as much a sales/relationship job as an engineering one).
**Success metric**: hospitals keep data reasonably fresh without heavy hand-holding, and matched bookings make sense to a human reviewer.

---

## Phase 3 — Automated dispatch + ambulance integration (10–14 weeks)

Only start this once Phase 0's regulatory review is resolved and Phase 2 has proven matching quality.

**Scope:**
- Remove the manual confirmation step: timeout triggers real automatic hospital request → cascade-on-rejection → ambulance booking.
- Integrate with actual ambulance dispatch — either hospital-owned fleets via their dashboard, or a third-party ambulance aggregator API if one exists in your market.
- Server-side countdown authority (don't trust the client alone) and offline-resilience for the detection path.
- Full audit logging of every emergency event for liability/debugging.
- Real-money or insurance-linked billing flow if budget-matching needs to actually reserve payment, not just estimate it.

**Team**: add 1 SRE/infra engineer (this phase is where uptime and failure-mode handling matter most), QA focused on failure injection (network drop mid-countdown, hospital non-response, etc.).
**Success metric**: a controlled live-fire pilot (with safety nets — e.g. still cc'ing a human ops line during early rollout) showing correct end-to-end behavior under real conditions.

---

## Phase 4 — Scale, smarter detection, multi-city (ongoing)

- Personalized baselines and ML-based anomaly detection replacing/augmenting fixed thresholds, using the false-positive/negative data collected since Phase 1.
- Expand hospital network city by city — this scales by partnerships/ops effort as much as engineering.
- Consider deeper wearable integrations (Apple Watch fall detection style on-device models) to reduce reliance on phone connectivity.
- Add analytics/ops dashboards for monitoring alert precision, dispatch success rate, and hospital SLA adherence in production.

**Team**: scales out — dedicated data/ML engineer, additional backend engineers per new integration, city-by-city ops hires.

---

## Rough overall timeline

| Phase | Duration | Cumulative |
|---|---|---|
| 0 — Validation & compliance | 4–8 weeks | ~2 months |
| 1 — MVP detection & alert | 8–12 weeks | ~5 months |
| 2 — Hospital dashboard, manual pilot | 8–10 weeks | ~7.5 months |
| 3 — Automated dispatch | 10–14 weeks | ~11 months |
| 4 — Scale | ongoing | — |

A realistic path to a real, automated, multi-hospital pilot is **around 10–12 months**, assuming Phase 0's regulatory question doesn't turn up a hard blocker. Treat this as a planning estimate, not a commitment — the two phases most likely to run long are Phase 0 (regulatory review timelines are outside your control) and Phase 1 (tuning detection to an acceptable false-positive rate is genuinely hard and iterative).

---

## Minimum team to get through Phase 2

- 1 product/founder driving scope and hospital relationships
- 2 backend engineers (streaming/detection, hospital/matching services)
- 1 mobile engineer
- 1 designer (can be part-time/contract for an MVP)
- Part-time legal/compliance advisor throughout

This is enough to reach a working, human-confirmed pilot. Phase 3's automation and scale work is where you'll want to grow the team.

---

## What to build vs. buy

To move faster, prefer buying over building for anything not core to your differentiation:
- **Wearable data**: use platform SDKs (HealthKit, Health Connect) rather than talking to raw device Bluetooth where possible.
- **Push/SMS/voice notification**: use a provider (e.g. Twilio-style service) rather than building delivery infrastructure.
- **Ambulance dispatch**: if a regional aggregator API exists in your target market, integrate rather than building fleet management yourself — this is a significant separate business in its own right.
- **Maps/ETA/geo-matching**: use a mapping platform's routing API rather than building traffic-aware ETA estimation from scratch.

Your actual differentiation is the detection quality, the alert UX people trust, and the hospital-matching logic — put your engineering effort there.
