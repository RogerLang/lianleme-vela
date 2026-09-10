# Vela architecture

The Xiaomi Vela client stays intentionally small. The runtime is split by ownership so page lifecycle, workout calculations, persistence, transport and protocol compatibility can evolve independently without duplicating state authority.

## Runtime flow

```text
index.ux
  ├─ workout-runtime.js     pure workout calculations / snapshots
  ├─ workout-store.js       system.storage adapter ownership
  ├─ workout-transport.js   system.interconnect transport ownership
  └─ workout-protocol.js    Workout Protocol V1 encode/decode/normalization
```

`src/pages/index/index.ux` owns reactive UI state, Vela page lifecycle, rest timers, vibration calls and orchestration between the modules. It must not call `storage.get`, `storage.set` or `interconnect.instance` directly.

## Module ownership

### `workout-runtime.js`

Owns deterministic workout calculations that do not depend on Vela platform APIs:

- demo workout fallback construction
- number / prescription formatting
- set counting and index validation
- next-set and first-incomplete navigation
- incoming completed-record deduplication
- completed-set record construction including `actualRir`
- persisted state snapshot construction

These functions are exercised by `scripts/check-modules.mjs` with normal Node assertions.

### `workout-store.js`

Owns all direct `system.storage` reads and writes for:

- `lianleme.workout.plan.v1`
- `lianleme.workout.state.v3`

The page provides the current plan/state and receives parsed values or save completion callbacks. Storage schema version remains v3 across the 0.4.5 refactor.

### `workout-transport.js`

Owns the direct `system.interconnect` instance and transport callbacks:

- connection open / close / error
- ready-state probe
- raw incoming message forwarding
- envelope send calls

Workout semantics such as progress ACK handling, retry policy and pending-plan handoff remain in the page orchestration layer because they mutate the live workout session.

### `workout-protocol.js`

Remains the single Workout Protocol V1 model owner:

- message envelope / decode
- plan normalization and identity comparison
- progress normalization
- progress-to-plan identity matching
- progress payload generation

Protocol V1 continues to use `workoutId + revision + planId` as the full workout identity.

## UI and lifecycle constraints

The active workout view keeps an explicit `426px` height matching the screen container. This protects the verified Xiaomi Smart Band 9 Pro behavior where display sleep/wake relayout previously shifted the workout card upward.

`onHide` and `onDestroy` stop rest/progress timers and save the current state. `onShow` resumes absolute-time rest handling and republishes current progress when connected.

## Durability constraints

- wearable local progress is persisted before it is considered recoverable
- unacknowledged local progress remains `syncPending` and retries while connected
- incoming phone progress is persisted before the wearable returns `progress-ack`
- a new plan is deferred while active or unacknowledged local work must be protected
- deferred plans apply after the prior local session reaches a safe handoff point
- RIR remains part of completed-record progress data for normal working sets

## CI ownership guards

`npm run check` runs:

1. icon generation
2. repository/static ownership checks in `scripts/check.mjs`
3. executable runtime/store/transport contract checks in `scripts/check-modules.mjs`

Pull requests then run a real macOS Vela debug RPK build. Main-branch success triggers the signed RPK pipeline, followed by permanent GitHub Release creation for a new version.
