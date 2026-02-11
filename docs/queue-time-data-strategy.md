# Queue-Time Data Strategy (V1)

## Short Answer

For v1, queue/wait-time data should come from a dual-source provider layer:
1. Primary: ThemeParks Wiki API (`api.themeparks.wiki`).
2. Fallback: Queue-Times API (`queue-times.com`).

Then cross-check quality against official consumer app outputs for Disney and Universal.

## Why This Approach

- There is no straightforward, openly documented official public developer API from Disney/Universal for this exact use case in a startup MVP context.
- Theme park wait-time ecosystems are volatile; provider abstraction is required from day one.
- Queue-Times explicitly documents updates approximately every 5 minutes, which is acceptable for "near real-time" v1 expectations.

## Provider Notes

### 1) ThemeParks Wiki API (Primary)
- Pros:
  - Clean API shape for destination/park/entity/live data usage.
  - Works well with normalized adapter model.
- Cons:
  - Community/unofficial ecosystem risk; upstream behavior can change.

### 2) Queue-Times API (Fallback)
- Pros:
  - Simple park/ride/wait endpoints.
  - Documented freshness cadence (~5 minutes).
  - Includes park IDs and ride wait endpoints.
- Cons:
  - Also non-official ecosystem dependency.
  - Requires attribution per docs.

## Ground-Truth Validation Sources

Use official consumer app experiences for sanity checks and QA:
- Disney states guests can check attraction wait times in the My Disney Experience app.
- Universal Orlando app FAQ includes ride wait times as a feature.

This does not make them public developer APIs; they are validation references for expected behavior.

## Reliability Plan

1. Poll every 60 seconds; ingest source timestamps.
2. Mark stale when beyond freshness threshold.
3. Serve last-known-good with stale indicator if provider fails.
4. Fallback provider per park if primary fails.
5. Disable proactive nudges during severe stale conditions.

## Compliance/Business Risk

- Treat these feeds as replaceable adapters.
- Keep internal canonical schema provider-agnostic.
- Plan a future migration path to licensed/commercial data feeds if scale or policy requires.

## Source Links

- ThemeParks API client docs (v1 endpoints/no-auth usage): https://github.com/ThemeParks/parksapi/blob/master/README.md
- Queue-Times API docs (including freshness/attribution): https://queue-times.com/pages/api
- Disney app support (mentions checking wait times): https://plandisney.disney.go.com/question/check-current-wait-times-apple-android-phone-visiting-508104/
- Universal Orlando app FAQ (lists ride wait times): https://www.universalorlando.com/web/en/us/faqs/mobile-app-faq
- Context on unofficial park API ecosystem volatility: https://github.com/cubehouse/themeparks
