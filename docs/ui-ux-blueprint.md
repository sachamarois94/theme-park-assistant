# Theme Park Assistant V1 UI/UX Blueprint

## 1) Design Direction

Name: Magical Minimalism

Tone:
- Clean, spacious, premium.
- Dark-first for eye comfort in parks.
- Small moments of delight (glow/sparkle) with strict motion discipline.

Reference alignment:
- Arc: inventive layout behavior and transitions.
- Linear: information density without clutter.
- Raycast: dark UI clarity.
- Apple Maps: rich cards and fluid navigations.
- Disney+: subtle magic accents.

## 2) UX Principles

1. "What should I do next?" is always visible.
2. Every key card shows freshness (`Updated Xm ago`).
3. Motion clarifies state changes; never decorative-only.
4. One-thumb operation on mobile is default.
5. Chat and planner are peers, not separate products.

## 3) App Structure

Top-level navigation:
1. Home (live overview + recommendation)
2. Plan (timeline builder/replanner)
3. Chat (assistant thread)
4. Pricing (tier concept)

Persistent controls:
- Park selector
- Proactive mode toggle
- Data freshness pill

## 4) Screen-by-Screen Blueprint

### A) Home (Operations Dashboard)

Sections:
- Hero recommendation card:
  - "Do this next"
  - expected wait
  - urgency chip
  - quick actions: `Go`, `Why`, `Alternatives`
- Live board:
  - biggest wait drops
  - longest current waits
  - closures/reopenings
- Mini timeline preview:
  - next 3 planned steps + `Open full plan`

### B) Plan (Timeline)

Sections:
- Day progress bar.
- Timeline cards:
  - attraction
  - target window
  - expected wait
  - confidence/freshness
- Sticky actions:
  - `Replan from here`
  - `Swap step`
  - `Add break`

### C) Chat

Layout:
- Large message canvas with roomy spacing.
- Quick prompts row:
  - "What should I do now?"
  - "Best low-wait options"
  - "Replan my afternoon"
- Rich answer cards injected inline for recommendations and plan changes.

### D) Pricing (Concept)

Three cards:
- Free (current default)
- Pro (coming soon)
- Family (coming soon)

Use "locked capabilities" chips without enforcing payments in v1.

## 5) Visual System

Color tokens (example direction):
- `--bg-0`: deep navy-black
- `--bg-1`: desaturated indigo layer
- `--text-0`: high-contrast cool white
- `--accent-0`: electric cyan
- `--accent-1`: aurora pink (small usage)
- `--success`: mint
- `--warn`: amber

Surface behavior:
- Soft glass cards over gradient field.
- Low-noise grain texture at very low opacity.
- Radius system: large rounded cards, pill chips, minimal hard edges.

Typography:
- Premium sans with high legibility.
- Large numeric styling for wait times.
- Tight hierarchy with minimal font count.

## 6) Motion System

Transitions:
- Page transitions: 220-320ms transform+opacity.
- Card stagger reveals: 30-50ms intervals.
- Proactive nudge entry: subtle vertical lift + glow pulse.

Micro-interactions:
- Freshness pill updates with soft shimmer.
- Recommendation card acceptance triggers brief sparkle trail.

Safety constraints:
- Respect `prefers-reduced-motion`.
- Disable non-essential effects on low-power mode.

## 7) Key Components

1. `RecommendationCard`
2. `FreshnessPill`
3. `LiveDeltaList`
4. `TimelineStepCard`
5. `ProactiveNudgeToast`
6. `AssistantRichMessage`
7. `ParkSelectorDrawer`
8. `TierCard`

## 8) Mobile and Desktop Behavior

Mobile:
- Bottom tab bar + floating primary action.
- Gesture-friendly card stacks.

Desktop:
- Split-pane layout:
  - left: live board/planner
  - right: chat thread

## 9) V1 UX Acceptance Criteria

1. User can get a next recommendation within 2 taps from app open.
2. Live wait-time context appears with visible freshness status.
3. Replan action updates timeline in under 2 seconds (excluding provider delay).
4. Proactive mode can be toggled in one interaction.
5. Motion remains smooth while preserving readability in bright outdoor conditions.
