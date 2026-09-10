import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()

async function importSource(relativePath) {
  const source = fs.readFileSync(path.join(root, relativePath), 'utf8')
  const url = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
  return (await import(url)).default
}

const runtime = await importSource('src/common/workout-runtime.js')
const storeFactory = await importSource('src/common/workout-store.js')
const transportFactory = await importSource('src/common/workout-transport.js')

const demo = runtime.demoWorkout()
assert.equal(runtime.countSets(demo), 8)
assert.equal(runtime.numeric('12.5'), 12.5)
assert.equal(runtime.numeric(''), null)
assert.equal(runtime.formatWeight(12.5), '12.5')
assert.equal(runtime.formatPrescription(null, 8), '8 次')
assert.equal(runtime.formatPrescription(20, 8), '20 kg × 8')
assert.equal(runtime.validSetIndex(demo, 0, 0), true)
assert.equal(runtime.validSetIndex(demo, 99, 0), false)
assert.deepEqual(runtime.getNextIndices(demo, 0, 2), { exerciseIndex: 1, setIndex: 0 })
assert.equal(runtime.getNextIndices(demo, 2, 1), null)

const normalized = runtime.normalizeCompletedRecords(demo, [
  { exerciseIndex: 0, setIndex: 0 },
  { exerciseIndex: 0, setIndex: 0 },
  { exerciseIndex: 99, setIndex: 0 },
  { exerciseIndex: 1, setIndex: 0 }
])
assert.equal(normalized.records.length, 2)
assert.deepEqual(runtime.firstIncompleteIndices(demo, normalized.completed), { exerciseIndex: 0, setIndex: 1 })

const workingPlan = {
  id: 'workout-1',
  revision: 'r1',
  planId: 'plan-1',
  name: '测试训练',
  exercises: [{
    exerciseId: 'bench',
    name: '卧推',
    warmup: false,
    restSeconds: 60,
    sets: [{ weight: 60, reps: 8 }]
  }]
}
const record = runtime.createCompletionRecord(workingPlan, {
  exerciseIndex: 0,
  setIndex: 0,
  currentWeight: 62.5,
  currentReps: 8
}, 2)
assert.equal(record.actualWeight, 62.5)
assert.equal(record.actualRir, 2)
assert.equal(runtime.createCompletionRecord(workingPlan, {
  exerciseIndex: 0,
  setIndex: 0,
  currentWeight: 62.5,
  currentReps: 8
}, 6), null)

const snapshot = runtime.stateSnapshot(workingPlan, {
  screen: 'workout',
  exerciseIndex: 0,
  setIndex: 0,
  pendingExerciseIndex: 0,
  pendingSetIndex: 0,
  currentWeight: 62.5,
  currentReps: 8,
  completedRecords: [],
  restEndAt: 0,
  completionConfirmed: false,
  completionSynced: false,
  progressUpdatedAt: 123,
  syncPending: true,
  lastAckUpdatedAt: 0
}, 3)
assert.equal(snapshot.stateVersion, 3)
assert.equal(snapshot.workoutId, 'workout-1')
assert.equal(snapshot.progressUpdatedAt, 123)
assert.equal(snapshot.syncPending, true)

const storageData = new Map()
const fakeStorage = {
  get(options) {
    options.success(storageData.has(options.key) ? storageData.get(options.key) : options.default)
  },
  set(options) {
    storageData.set(options.key, options.value)
    options.success()
  }
}
const store = storeFactory.create(fakeStorage, { planKey: 'plan', stateKey: 'state' })
let saved = false
store.saveState({ screen: 'workout' }, ok => { saved = ok })
assert.equal(saved, true)
assert.equal(JSON.parse(storageData.get('state')).screen, 'workout')

storageData.set('plan', JSON.stringify(workingPlan))
let loadedPlan = null
store.loadPlan(runtime.demoWorkout(), value => value, plan => { loadedPlan = plan })
assert.equal(loadedPlan.id, 'workout-1')

let loadedState = null
store.loadState(state => { loadedState = state })
assert.equal(loadedState.screen, 'workout')

let sent = null
let rawMessage = null
let readyEvents = 0
const fakeConn = {
  send(options) {
    sent = options.data
  },
  getReadyState(options) {
    options.success({ status: 1 })
  }
}
const fakeInterconnect = {
  instance() {
    return fakeConn
  }
}
const fakeProtocol = {
  envelope(type, payload) {
    return { type, payload }
  }
}
const transport = transportFactory.create(fakeInterconnect, fakeProtocol, {
  onMessage(value) { rawMessage = value },
  onReady() { readyEvents += 1 }
})
transport.start()
assert.equal(transport.isReady(), true)
assert.equal(readyEvents, 1)
assert.equal(transport.send('hello', { appVersion: 'test' }), true)
assert.deepEqual(sent, { type: 'hello', payload: { appVersion: 'test' } })
fakeConn.onmessage({ data: 'payload' })
assert.equal(rawMessage, 'payload')
fakeConn.onclose()
assert.equal(transport.isReady(), false)
assert.equal(transport.send('hello', {}), false)

console.log('vela-modules-check: all checks passed')
