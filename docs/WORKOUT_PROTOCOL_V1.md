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
  "appVersion": "0.4.0",
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

The wearable persists the plan locally. A different `id` or `revision` replaces the local session only when there is no active or unacknowledged local progress. Receiving the same identity keeps the current local session.

### `progress` — either direction

Both clients use the same progress snapshot shape. The wearable sends a snapshot after local set completion, undo, workout completion and reconnect. The Android app may send the current snapshot after phone-side set completion, undo or other session changes so the wearable can follow the same workout state.

```json
{
  "workoutId": "workout-id",
  "revision": "workout-revision",
  "planId": "plan-id",
  "status": "active",
  "screen": "workout",
  "exerciseIndex": 0,
  "setIndex": 1,
  "pendingExerciseIndex": 0,
  "pendingSetIndex": 1,
  "restEndAt": 0,
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

`status` is `ready`, `active`, or `complete`. A receiver only applies progress whose `workoutId` and `revision` match the current workout. The wearable derives its next visible set from the received `completedRecords` and enters the completion screen when the received progress is complete.

### `progress-ack` — either direction

Sent after a progress snapshot has been accepted. It acknowledges the workout identity and the applied progress timestamp.

```json
{
  "workoutId": "workout-id",
  "revision": "workout-revision",
  "planId": "plan-id",
  "updatedAt": 1788840000000
}
```

The wearable keeps `syncPending` while local progress has not yet been acknowledged. During that period, incoming phone progress does not replace the pending local snapshot; the wearable republishes its current progress instead.

### `ack` — either direction

General acknowledgement for plan or control messages. V1 does not rely on this message for progress conflict handling; `progress-ack` is used for progress snapshots.

```json
{ "replyTo": "message-id" }
```

## Conflict model

V1 uses `workoutId + revision` as the session identity and `updatedAt` as the progress revision timestamp.

- Progress for another workout identity is ignored.
- Local wearable progress is marked pending until acknowledged.
- Pending wearable progress is retained across local storage restore and reconnection.
- Incoming phone progress is applied only when no wearable progress is waiting for acknowledgement.
- An older `progress-ack` does not clear a newer pending wearable snapshot.
- A new plan does not replace an active or unacknowledged wearable workout; the wearable republishes its current progress first.

## Offline behavior

- The wearable can continue and complete a cached workout without a phone connection.
- Plan and session state are stored locally on the wearable.
- On reconnection the wearable sends `hello` followed by its latest `progress` snapshot.
- The phone can resend the current `plan` at any time; same-revision delivery is idempotent.
- Once both sides exchange the current progress and acknowledgement, either client can continue driving the same workout session.
