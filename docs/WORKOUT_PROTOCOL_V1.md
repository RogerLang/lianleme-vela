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
  "appVersion": "0.4.3",
  "planId": "plan-id",
  "workoutId": "workout-id",
  "revision": "workout-revision"
}
```

The phone responds with the current `plan` snapshot when it has a confirmed workout. If the wearable already has the same workout, receiving the same plan is idempotent and the wearable acknowledges it again.

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

The wearable persists an accepted plan locally. A different workout identity is accepted immediately when there is no active or unacknowledged local progress. If local work is still active or waiting for a progress acknowledgement, the wearable keeps the newest incoming plan as a pending plan, acknowledges the delivery with `status: "deferred"`, republishes its current progress, and applies the pending plan automatically when the old local session is safe to hand off.

### `progress` — either direction

Both clients use the same progress snapshot shape. The wearable sends a snapshot after local set completion, undo, workout completion and reconnect. The Android app sends the current snapshot after phone-side set completion, undo or other session changes so the wearable can follow the same workout state.

```json
{
  "workoutId": "workout-id",
  "revision": "workout-revision",
  "planId": "plan-id",
  "workoutName": "胸部训练",
  "status": "active",
  "screen": "workout",
  "exerciseIndex": 0,
  "setIndex": 1,
  "pendingExerciseIndex": 0,
  "pendingSetIndex": 1,
  "restEndAt": 0,
  "updatedAt": 1788840000000,
  "exerciseMeta": [
    {
      "exerciseIndex": 0,
      "exerciseId": "bench",
      "name": "杠铃卧推",
      "warmup": false,
      "loadType": "weighted"
    }
  ],
  "completedRecords": [
    {
      "exerciseIndex": 0,
      "setIndex": 0,
      "plannedWeight": 60,
      "plannedReps": 8,
      "actualWeight": 60,
      "actualReps": 8,
      "actualRir": 2,
      "completedAt": 1788840000000
    }
  ]
}
```

`exerciseMeta` and `workoutName` are optional recovery metadata within Protocol V1. New clients include them so a completed wearable workout can be reconstructed into Android history even after the phone has already switched to another planned workout. Older clients that omit the fields remain readable; their mismatched snapshots stay in the Android durable inbox until the matching workout can be resolved.

`actualRir` is optional for backward compatibility. When present for a normal working set it is a numeric RIR value; the wearable UI records values from `0` through `5`. Warm-up sets and older clients may send `null` or omit the field. Receivers must preserve compatibility with progress snapshots that do not contain RIR.

`status` is `ready`, `active`, or `complete`. A receiver applies live session state only when `workoutId`, `revision`, and `planId` match its current workout. The wearable derives its next visible set from the received `completedRecords` and enters the completion screen when the received progress is complete.

The Android bridge is the single owner of wearable progress acknowledgement for both live messages and messages drained from the native startup queue. Progress for another workout identity is first written to the Android IndexedDB durable inbox. Complete snapshots with recovery metadata are then imported idempotently into training history and removed from the inbox. Unresolved snapshots remain retained; the inbox has no fixed-size silent eviction path.

### `progress-ack` — either direction

Sent only after a progress snapshot has reached a durable recovery point on the receiver. It acknowledges the workout identity and the exact progress timestamp.

```json
{
  "workoutId": "workout-id",
  "revision": "workout-revision",
  "planId": "plan-id",
  "updatedAt": 1788840000000
}
```

For wearable -> phone progress, Android writes the current draft to IndexedDB before ACK. If the snapshot completes the current workout, Android persists the formal history session before ACK. If the snapshot belongs to another workout, Android persists it to the deferred inbox before ACK.

For phone -> wearable progress, the Vela app writes its resulting state through `system.storage` before sending `progress-ack`. The Android sender keeps the snapshot pending until that ACK arrives and retries the same snapshot after an ACK timeout.

The wearable keeps `syncPending` while local progress has not yet been acknowledged. During that period, incoming phone progress does not replace the pending local snapshot; the wearable republishes its current progress instead. Local wearable progress is retried periodically while the connection remains available. Once the acknowledgement arrives, the retry stops and a pending plan may be applied automatically if there is no active local workout left to protect.

### `ack` — either direction

General acknowledgement for plan or control messages. Plan delivery uses the following payload so the phone can distinguish an accepted plan from a deferred handoff:

```json
{
  "replyTo": "plan-message-id",
  "workoutId": "new-workout-id",
  "revision": "new-workout-revision",
  "status": "accepted",
  "reason": "",
  "currentWorkoutId": "new-workout-id",
  "currentRevision": "new-workout-revision"
}
```

`status` is `accepted` or `deferred`. A deferred acknowledgement may use `reason: "active-session"` when the previous workout is still being performed, or `reason: "sync-pending"` when previous local progress still needs acknowledgement. Older clients that omit `status` are interpreted as accepted for compatibility.

## Conflict model

V1 uses `workoutId + revision + planId` as the full workout identity. `updatedAt` orders snapshots emitted by one device for the same workout identity, while ACK matching also requires all three identity fields.

- Progress for the current workout identity may update the current session.
- Progress for another workout identity must not mutate the current session; Android stores it durably before sending `progress-ack`.
- A complete deferred snapshot with `exerciseMeta` can be reconstructed directly into Android history without replacing the current workout.
- Imported history is deduplicated by `plannedWorkoutId + plannedRevision`.
- Local wearable progress is marked pending until acknowledged and is retained across local storage restore and reconnection.
- Pending wearable progress is retried while the interconnect remains open.
- Incoming phone progress is applied only when no wearable progress is waiting for acknowledgement.
- An older `progress-ack` does not clear a newer pending wearable snapshot.
- Phone-origin progress is retained as pending on Android until the wearable returns a matching `progress-ack`; timeout causes retry of the same payload and timestamp.
- A new plan does not overwrite an active or unacknowledged wearable workout immediately. The wearable keeps the newest incoming plan as a pending plan, sends a deferred plan acknowledgement, republishes current progress, and applies the pending plan when the old session is no longer active and no progress acknowledgement is outstanding.
- Replayed native messages are idempotent: Android deduplicates envelope IDs in memory and the progress/history layers also deduplicate by progress timestamp and workout identity.

## Offline behavior

- The wearable can continue and complete a cached workout without a phone connection.
- Plan and session state are stored locally on the wearable before local progress is published.
- If the wearable is closed while the RIR picker is visible, the existing state schema restores that picker and the current set without discarding the pending entry.
- On reconnection the wearable sends `hello` followed by its latest `progress` snapshot.
- While `syncPending` remains true and the connection is open, the wearable retries progress until the phone sends a matching durable ACK.
- The phone can resend the current `plan` at any time; same-revision delivery is idempotent and acknowledged.
- If a new plan arrives during an older active workout, the wearable keeps that newest plan in memory as a pending plan for the current app session. If the app closes before handoff, the phone resends its current plan after the next `hello`.
- A completed old workout received after the phone switched plans can still enter Android history through its recovery metadata.
- Once both sides exchange the current progress and acknowledgement, either client can continue driving the same workout session.
