# Workout Protocol V1

`练了么` uses Xiaomi Vela `system.interconnect` / Xiaomi Wearable MessageApi as a bidirectional transport between the Android app and the wearable app.

## Identity

- Protocol namespace: `lianleme.workout`
- Protocol version: `1`
- Android package: `io.github.rogerlang.lianleme`
- Vela package: `io.github.rogerlang.lianleme`
- The Android APK and Vela RPK must use the same signing identity for Xiaomi interconnect.

## Envelope

Every message is UTF-8 JSON with this envelope:

```json
{
  "p": "lianleme.workout",
  "v": 1,
  "id": "message-id",
  "type": "hello",
  "ts": 1788840000000,
  "payload": {}
}
```

Unknown fields and unknown message types must be ignored so later protocol revisions can add optional data.

## Message types

### `hello` — wearable -> phone

Sent when the wearable page initializes or reconnects.

```json
{
  "appVersion": "0.3.0",
  "planId": "plan-id",
  "workoutId": "workout-id",
  "revision": "workout-revision"
}
```

The phone responds with the current `plan` snapshot when it has a confirmed workout. If the wearable already has the same workout, receiving the same plan is idempotent.

### `request-plan` — wearable -> phone

Explicit request for the current confirmed workout. Payload may be empty.

### `plan` — phone -> wearable

```json
{
  "id": "workout-id",
  "revision": "workout-revision",
  "planId": "plan-id",
  "name": "胸部训练",
  "updatedAt": 1788840000000,
  "exercises": [
    {
      "exerciseId": "exercise-id",
      "name": "杠铃卧推",
      "warmup": false,
      "loadType": "weighted",
      "restSeconds": 90,
      "sets": [
        { "weight": 60, "reps": 8 }
      ]
    }
  ]
}
```

The wearable persists the plan locally. A different `id` or `revision` replaces the local active plan and starts a fresh wearable session. Receiving the same identity keeps the existing local session.

### `progress` — wearable -> phone

The wearable sends an authoritative snapshot after a set is completed, undone, the workout is restarted, the workout is completed, and after reconnecting.

```json
{
  "workoutId": "workout-id",
  "revision": "workout-revision",
  "planId": "plan-id",
  "status": "active",
  "screen": "rest",
  "exerciseIndex": 0,
  "setIndex": 1,
  "pendingExerciseIndex": 0,
  "pendingSetIndex": 1,
  "restEndAt": 1788840090000,
  "updatedAt": 1788840000000,
  "completedRecords": [
    {
      "exerciseIndex": 0,
      "setIndex": 0,
      "plannedWeight": 60,
      "plannedReps": 8,
      "actualWeight": 60,
      "actualReps": 8,
      "completedAt": 1788840000000
    }
  ]
}
```

`status` is `ready`, `active`, or `complete`. The phone only imports progress whose `workoutId` and `revision` match its current confirmed workout.

### `ack` — either direction

Optional acknowledgement. V1 does not require retries based on `ack`; reconnect snapshots provide recovery.

```json
{ "replyTo": "message-id" }
```

## Conflict model

V1 is optimized for one active workout controller at a time. The wearable keeps a complete local progress snapshot and sends it again after reconnection. The phone accepts only snapshots for the current workout revision and ignores older wearable snapshots by `updatedAt`.

## Offline behavior

- The wearable can complete the workout with no phone connection.
- Plan and session state are stored locally on the wearable.
- On reconnection the wearable sends `hello` followed by its latest `progress` snapshot.
- The phone can resend the current `plan` at any time; same-revision delivery is idempotent.
