var NAMESPACE = 'lianleme.workout'
var VERSION = 1
var counter = 0

function nowMs() {
  return new Date().getTime()
}

function messageId() {
  counter = counter + 1
  return 'vela-' + nowMs() + '-' + counter
}

function clone(value) {
  if (value === undefined || value === null) {
    return value
  }
  return JSON.parse(JSON.stringify(value))
}

function envelope(type, payload) {
  return {
    p: NAMESPACE,
    v: VERSION,
    id: messageId(),
    type: type,
    ts: nowMs(),
    payload: payload || {}
  }
}

function decode(value) {
  var data = value
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data)
    } catch (error) {
      return null
    }
  }
  if (!data || typeof data !== 'object') {
    return null
  }
  if (data.p !== NAMESPACE || data.v !== VERSION || typeof data.type !== 'string') {
    return null
  }
  return data
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === '') {
    return null
  }
  var number = Number(value)
  return isNaN(number) ? null : number
}

function positiveInt(value, fallback) {
  var number = Math.round(Number(value))
  return number > 0 ? number : fallback
}

function normalizeSet(value) {
  value = value || {}
  return {
    weight: numberOrNull(value.weight),
    reps: positiveInt(value.reps, 1)
  }
}

function normalizeExercise(value, index) {
  value = value || {}
  var sets = Array.isArray(value.sets) ? value.sets : []
  if (!sets.length) {
    sets = [{ weight: null, reps: 1 }]
  }
  return {
    exerciseId: String(value.exerciseId || 'exercise-' + index),
    name: String(value.name || '动作 ' + (index + 1)),
    warmup: !!value.warmup,
    loadType: String(value.loadType || (numberOrNull(sets[0] && sets[0].weight) === null ? 'bodyweight' : 'weighted')),
    restSeconds: positiveInt(value.restSeconds, 60),
    sets: sets.map(normalizeSet)
  }
}

function normalizePlan(value) {
  if (!value || typeof value !== 'object') {
    return null
  }
  var exercises = Array.isArray(value.exercises) ? value.exercises : []
  if (!exercises.length) {
    return null
  }
  return {
    id: String(value.id || ''),
    revision: String(value.revision || ''),
    planId: String(value.planId || ''),
    name: String(value.name || value.planName || '训练'),
    updatedAt: Number(value.updatedAt) || nowMs(),
    exercises: exercises.map(normalizeExercise)
  }
}

function samePlan(left, right) {
  if (!left || !right) {
    return false
  }
  return String(left.id || '') === String(right.id || '') &&
    String(left.revision || '') === String(right.revision || '')
}

function progressPayload(workout, state) {
  state = state || {}
  return {
    workoutId: String(workout && workout.id || ''),
    revision: String(workout && workout.revision || ''),
    planId: String(workout && workout.planId || ''),
    status: state.screen === 'complete' ? 'complete' : ((state.completedRecords || []).length ? 'active' : 'ready'),
    screen: state.screen || 'workout',
    exerciseIndex: Number(state.exerciseIndex) || 0,
    setIndex: Number(state.setIndex) || 0,
    pendingExerciseIndex: Number(state.pendingExerciseIndex) || 0,
    pendingSetIndex: Number(state.pendingSetIndex) || 0,
    restEndAt: Number(state.restEndAt) || 0,
    updatedAt: Number(state.updatedAt) || nowMs(),
    completedRecords: clone(state.completedRecords || [])
  }
}

export default {
  NAMESPACE: NAMESPACE,
  VERSION: VERSION,
  envelope: envelope,
  decode: decode,
  normalizePlan: normalizePlan,
  samePlan: samePlan,
  progressPayload: progressPayload
}
