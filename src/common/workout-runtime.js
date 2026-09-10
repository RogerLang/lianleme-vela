var DEMO_WORKOUT = {
  id: '',
  revision: '',
  planId: '',
  name: '演示训练',
  exercises: [
    {
      exerciseId: 'demo-a',
      name: '动作 A',
      restSeconds: 60,
      loadType: 'weighted',
      sets: [
        { weight: 20, reps: 8 },
        { weight: 20, reps: 8 },
        { weight: 20, reps: 8 }
      ]
    },
    {
      exerciseId: 'demo-b',
      name: '动作 B',
      restSeconds: 45,
      loadType: 'weighted',
      sets: [
        { weight: 12.5, reps: 10 },
        { weight: 12.5, reps: 10 },
        { weight: 12.5, reps: 10 }
      ]
    },
    {
      exerciseId: 'demo-c',
      name: '动作 C',
      restSeconds: 30,
      loadType: 'weighted',
      sets: [
        { weight: 10, reps: 12 },
        { weight: 10, reps: 12 }
      ]
    }
  ]
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function demoWorkout() {
  return clone(DEMO_WORKOUT)
}

function nowMs() {
  return new Date().getTime()
}

function numeric(value) {
  if (value === null || value === undefined || value === '') {
    return null
  }
  var result = Number(value)
  return isNaN(result) ? null : result
}

function formatWeight(value) {
  value = numeric(value)
  if (value === null) {
    return '自重'
  }
  if (value % 1 === 0) {
    return String(value)
  }
  return value.toFixed(1)
}

function formatPrescription(weight, reps) {
  var value = numeric(weight)
  if (value === null) {
    return reps + ' 次'
  }
  return formatWeight(value) + ' kg × ' + reps
}

function countSets(workout) {
  var total = 0
  var exercises = workout && Array.isArray(workout.exercises) ? workout.exercises : []
  for (var i = 0; i < exercises.length; i++) {
    total += Array.isArray(exercises[i].sets) ? exercises[i].sets.length : 0
  }
  return total
}

function validSetIndex(workout, exerciseIndex, setIndex) {
  if (typeof exerciseIndex !== 'number' || typeof setIndex !== 'number') {
    return false
  }
  var exercises = workout && Array.isArray(workout.exercises) ? workout.exercises : []
  if (exerciseIndex < 0 || exerciseIndex >= exercises.length) {
    return false
  }
  var exercise = exercises[exerciseIndex]
  return Array.isArray(exercise.sets) && setIndex >= 0 && setIndex < exercise.sets.length
}

function recordKey(exerciseIndex, setIndex) {
  return String(exerciseIndex) + ':' + String(setIndex)
}

function getNextIndices(workout, exerciseIndex, setIndex) {
  if (!validSetIndex(workout, exerciseIndex, setIndex)) {
    return null
  }
  var exercise = workout.exercises[exerciseIndex]
  if (setIndex + 1 < exercise.sets.length) {
    return { exerciseIndex: exerciseIndex, setIndex: setIndex + 1 }
  }
  if (exerciseIndex + 1 < workout.exercises.length) {
    return { exerciseIndex: exerciseIndex + 1, setIndex: 0 }
  }
  return null
}

function firstIncompleteIndices(workout, completed) {
  completed = completed || {}
  for (var exerciseIndex = 0; exerciseIndex < workout.exercises.length; exerciseIndex++) {
    var exercise = workout.exercises[exerciseIndex]
    for (var setIndex = 0; setIndex < exercise.sets.length; setIndex++) {
      if (!completed[recordKey(exerciseIndex, setIndex)]) {
        return { exerciseIndex: exerciseIndex, setIndex: setIndex }
      }
    }
  }
  return null
}

function normalizeCompletedRecords(workout, records) {
  records = Array.isArray(records) ? records : []
  var result = []
  var completed = {}
  for (var i = 0; i < records.length; i++) {
    var record = records[i]
    if (!record || !validSetIndex(workout, record.exerciseIndex, record.setIndex)) {
      continue
    }
    var key = recordKey(record.exerciseIndex, record.setIndex)
    if (completed[key]) {
      continue
    }
    completed[key] = true
    result.push(record)
  }
  return { records: result, completed: completed }
}

function createCompletionRecord(workout, state, actualRir) {
  if (!validSetIndex(workout, state.exerciseIndex, state.setIndex)) {
    return null
  }
  var exercise = workout.exercises[state.exerciseIndex]
  var plannedSet = exercise.sets[state.setIndex]
  var rir = numeric(actualRir)
  if (!exercise.warmup && (rir === null || rir < 0 || rir > 5)) {
    return null
  }
  return {
    exerciseIndex: state.exerciseIndex,
    setIndex: state.setIndex,
    plannedWeight: plannedSet.weight,
    plannedReps: plannedSet.reps,
    actualWeight: state.currentWeight,
    actualReps: state.currentReps,
    actualRir: exercise.warmup ? null : rir,
    completedAt: nowMs()
  }
}

function stateSnapshot(workout, state, stateVersion) {
  return {
    stateVersion: stateVersion,
    workoutId: String(workout.id || ''),
    revision: String(workout.revision || ''),
    screen: state.screen,
    exerciseIndex: state.exerciseIndex,
    setIndex: state.setIndex,
    pendingExerciseIndex: state.pendingExerciseIndex,
    pendingSetIndex: state.pendingSetIndex,
    currentWeight: state.currentWeight,
    currentReps: state.currentReps,
    completedRecords: state.completedRecords,
    restEndAt: state.restEndAt,
    completionConfirmed: state.completionConfirmed,
    completionSynced: state.completionSynced,
    updatedAt: state.progressUpdatedAt || nowMs(),
    progressUpdatedAt: state.progressUpdatedAt || nowMs(),
    syncPending: state.syncPending,
    lastAckUpdatedAt: state.lastAckUpdatedAt
  }
}

export default {
  demoWorkout: demoWorkout,
  nowMs: nowMs,
  numeric: numeric,
  formatWeight: formatWeight,
  formatPrescription: formatPrescription,
  countSets: countSets,
  validSetIndex: validSetIndex,
  recordKey: recordKey,
  getNextIndices: getNextIndices,
  firstIncompleteIndices: firstIncompleteIndices,
  normalizeCompletedRecords: normalizeCompletedRecords,
  createCompletionRecord: createCompletionRecord,
  stateSnapshot: stateSnapshot
}
