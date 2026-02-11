# Theme Park Assistant V1 PRD

## 1) Product Summary

Theme Park Assistant is a dark-first, mobile-first web app (PWA) for Orlando parks that helps guests make better in-park decisions in real time.

Primary user outcomes:
- See current wait conditions quickly.
- Get clear "what should I do next?" guidance.
- Build and update a day plan without account setup.

## 2) V1 Scope (Locked)

Parks in scope:
- Walt Disney World: Magic Kingdom, EPCOT, Hollywood Studios, Animal Kingdom.
- Universal Orlando Resort parks in Orlando.

Functional scope:
- Guest access (no account required).
- Chat assistant for park operations.
- Near real-time wait times and ride status.
- Proactive suggestions (user-enabled toggle).
- Day-planning timeline view.
- Park switcher and attraction search.

Out of scope for v1:
- Dining/hotels/transport booking.
- Persistent user profiles across sessions.
- Payments/enforced subscriptions.

## 3) Target Users

- First-time visitors who want clear guidance.
- Repeat visitors optimizing ride throughput.
- Small groups/families coordinating next steps.

## 4) Core User Stories

1. As a guest, I can ask current wait times for any attraction in supported parks.
2. As a guest, I can ask what to do next and get ranked recommendations.
3. As a guest, I can generate a day plan and view it as a timeline.
4. As a guest, I can toggle proactive assistant nudges on/off.
5. As a guest, I can replan quickly if wait times spike or rides close.

## 5) Functional Requirements

### Chat Assistant
- Answer questions using live park data.
- Support intents:
  - Wait time lookup.
  - Next-best attraction recommendation.
  - Day plan generation.
  - Replan after disruption.
- Return confidence and source freshness timestamp.

### Day Planner
- Timeline blocks with attraction, target window, expected wait, and rationale.
- One-tap "replan from here" action.
- Alternative options when a step is no longer optimal.

### Live Operations Layer
- Attraction status (open/closed/delayed when available).
- Wait times.
- Last updated timestamp surfaced in UI.
- Park-level summary cards (longest waits, biggest drops, closures).

### Proactive Mode
- Off by default; user activates.
- Nudge cards:
  - "Wait dropped at X"
  - "Move now to Y"
  - "Ride closed, switch to Z"
- Quiet-hours throttle to prevent spam behavior.

### Pricing/Tiers (Concept Only in V1)
- Show tier page (Free / Pro / Family).
- All features operational for all users in v1.
- Paid features tagged "Coming soon" only.

## 6) Non-Functional Requirements

- Mobile-first performance:
  - Time to interactive < 3.0s on mid-tier devices over LTE where feasible.
- Data freshness:
  - Display feed timestamps.
  - Keep operational lag bounded and visible.
- Reliability:
  - Graceful degraded mode if a provider fails.
- Accessibility:
  - WCAG AA contrast baseline.
  - Reduced motion mode support.

## 7) Success Metrics (V1)

- Activation:
  - % users who send first chat message.
- Utility:
  - % sessions with at least one "next action" accepted.
- Planning:
  - % sessions creating a day plan.
- Trust:
  - % responses with fresh data timestamp visible.
  - Low rate of "stale/incorrect" feedback events.

## 8) Risks and Mitigations

Risk: Data provider instability or changed upstream access.
- Mitigation: dual-provider adapter, cached fallback, explicit freshness labels.

Risk: No official public park operations API.
- Mitigation: clearly classify source type; monitor drift vs official apps; build provider abstraction to swap to licensed feeds later.

Risk: Over-animated UI hurting usability outdoors.
- Mitigation: motion budget + reduced motion mode + battery-aware animation defaults.

## 9) Launch Criteria

Must-have before v1 launch:
1. Live wait times for all scoped Orlando parks.
2. Chat answers for wait-time and next-step intents.
3. Day planner create + replan flows.
4. Proactive toggle with at least 3 trigger types.
5. PWA installable on iOS/Android browsers.
6. Clear data timestamp + provider fallback behavior.
