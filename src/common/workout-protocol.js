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

function normalizeExerciseMeta(value, index) {
  value = value || {}
  return {
    exerciseIndex: Math.max(0, Math.floor(Number(value.exerciseIndex) || index || 0)),
    exerciseId: String(value.exerciseId || 'exercise-' + index),
    name: String(value.name || '动作 ' + (index + 1)),
    warmup: !!value.warmup,
    loadType: String(value.loadType || 'weighted')
  }
}

function exerciseMetaForWorkout(workout) {
  var exercises = workout && Array.isArray(workout.exercises) ? workout.exercises : []
  return exercises.map(function(exercise, index) {
    return {
      exerciseIndex: index,
      exerciseId: String(exercise && exercise.exerciseId || 'exercise-' + index),
      name: String(exercise && exercise.name || '动作 ' + (index + 1)),
      warmup: !!(exercise && exercise.warmup),
      loadType: String(exercise && exercise.loadType || 'weighted')
    }
  })
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
    String(left.revision || '') === String(right.revision || '') &&
    String(left.planId || '') === String(right.planId || '')
}

function normalizeProgress(value) {
  if (!value || typeof value !== 'object') {
    return null
  }
  var records = Array.isArray(value.completedRecords) ? value.completedRecords : []
  var exerciseMeta = Array.isArray(value.exerciseMeta) ? value.exerciseMeta : []
  return {
    workoutId: String(value.workoutId || ''),
    revision: String(value.revision || ''),
    planId: String(value.planId || ''),
    workoutName: String(value.workoutName || value.planName || ''),
    status: value.status === 'complete' || value.status === 'ready' ? value.status : 'active',
    screen: String(value.screen || 'workout'),
    exerciseIndex: Math.max(0, Math.floor(Number(value.exerciseIndex) || 0)),
    setIndex: Math.max(0, Math.floor(Number(value.setIndex) || 0)),
    pendingExerciseIndex: Math.max(0, Math.floor(Number(value.pendingExerciseIndex) || 0)),
    pendingSetIndex: Math.max(0, Math.floor(Number(value.pendingSetIndex) || 0)),
    restEndAt: Math.max(0, Number(value.restEndAt) || 0),
    updatedAt: Math.max(0, Number(value.updatedAt) || 0),
    exerciseMeta: exerciseMeta.map(normalizeExerciseMeta),
    completedRecords: records.map(function(record) {
      record = record || {}
      return {
        exerciseIndex: Math.max(0, Math.floor(Number(record.exerciseIndex) || 0)),
        setIndex: Math.max(0, Math.floor(Number(record.setIndex) || 0)),
        plannedWeight: numberOrNull(record.plannedWeight),
        plannedReps: numberOrNull(record.plannedReps),
        actualWeight: numberOrNull(record.actualWeight),
        actualReps: numberOrNull(record.actualReps),
        actualRir: numberOrNull(record.actualRir),
        completedAt: Math.max(0, Number(record.completedAt) || 0)
      }
    })
  }
}

function progressMatchesPlan(progress, workout) {
  if (!progress || !workout) {
    return false
  }
  return String(progress.workoutId || '') === String(workout.id || '') &&
    String(progress.revision || '') === String(workout.revision || '') &&
    String(progress.planId || '') === String(workout.planId || '')
}

function progressPayload(workout, state) {
  state = state || {}
  return {
    workoutId: String(workout && workout.id || ''),
    revision: String(workout && workout.revision || ''),
    planId: String(workout && workout.planId || ''),
    workoutName: String(workout && workout.name || ''),
    status: state.screen === 'complete' ? 'complete' : ((state.completedRecords || []).length ? 'active' : 'ready'),
    screen: state.screen || 'workout',
    exerciseIndex: Number(state.exerciseIndex) || 0,
    setIndex: Number(state.setIndex) || 0,
    pendingExerciseIndex: Number(state.pendingExerciseIndex) || 0,
    pendingSetIndex: Number(state.pendingSetIndex) || 0,
    restEndAt: Number(state.restEndAt) || 0,
    updatedAt: Number(state.updatedAt) || nowMs(),
    exerciseMeta: exerciseMetaForWorkout(workout),
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
  normalizeProgress: normalizeProgress,
  progressMatchesPlan: progressMatchesPlan,
  progressPayload: progressPayload
}
