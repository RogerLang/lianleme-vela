import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { runInNewContext } from 'node:vm'

const root = process.cwd()

async function importSource(relativePath) {
  const source = fs.readFileSync(path.join(root, relativePath), 'utf8')
  const url = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
  return (await import(url)).default
}

const runtime = await importSource('src/common/workout-runtime.js')
const protocol = await importSource('src/common/workout-protocol.js')
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

const restPlan = {
  ...workingPlan,
  exercises: [
    { ...workingPlan.exercises[0], restSeconds: 90 },
    { exerciseId: 'row', name: '单臂划船', sets: [{ weight: 20, reps: 10 }, { weight: 20, reps: 10 }] }
  ]
}
storageData.set('lianleme.workout.plan.v1', JSON.stringify(restPlan))
const restStateKey = 'lianleme.workout.state.v3'
const pageScript = fs.readFileSync(path.join(root, 'src/pages/index/index.ux'), 'utf8')
  .match(/<script>([\s\S]*?)<\/script>/)[1]
  .replace(/^import .*$/gm, '')
  .replace('export default', 'page =')
let now = 1000000
let restVibrations = 0
let tickRest
function openPage(connection, messages) {
  const globals = {
    runtime: { ...runtime, nowMs: () => now },
    storage: fakeStorage,
    storeFactory,
    transportFactory,
    protocol,
    interconnect: { instance: () => connection },
    vibrator: { vibrate: ({ mode }) => { if (mode === 'long') restVibrations++ } },
    setInterval: callback => { tickRest = callback; return 1 },
    clearInterval: () => { tickRest = null },
    setTimeout: () => 1,
    clearTimeout: () => {}
  }
  connection.getReadyState = ({ success }) => success({ status: 0 })
  connection.send = ({ data }) => messages.push(protocol.decode(data))
  runInNewContext(pageScript, globals)
  const page = Object.assign(globals.page, globals.page.private)
  page.onShow()
  page.onInit()
  return page
}

const messages = []
const connection = {}
let page = openPage(connection, messages)
page.finishCurrentSet(2)
assert.equal(page.restRemaining, 90)
assert.equal(page.nextExerciseName, '单臂划船')
page.decreaseRest()
assert.equal(page.restRemaining, 60)
now += 60000
tickRest()
assert.equal(page.restRemaining, 0)
assert.equal(page.screen, 'rest')
assert.equal(page.exerciseIndex, 0)
assert.equal(tickRest, null)
assert.equal(restVibrations, 1)
assert.equal(JSON.parse(storageData.get(restStateKey)).restEndNotified, true)

page.onHide()
page.onShow()
page.onDestroy()
now += 45000
page = openPage(connection, messages)
assert.equal(restVibrations, 1)
assert.equal(page.restRemaining, 0)
page.increaseRest()
assert.equal(page.restEndAt, now + 30000)
assert.equal(page.restRemaining, 30)

page.onHide()
now += 10000
page.onShow()
assert.equal(page.restRemaining, 20)
page.increaseRestByMinute()
assert.equal(page.restRemaining, 80)
page.onDestroy()

const legacyRest = JSON.parse(storageData.get(restStateKey))
delete legacyRest.restEndNotified
storageData.set(restStateKey, JSON.stringify(legacyRest))
now = legacyRest.restEndAt + 5000
page = openPage(connection, messages)
assert.equal(page.screen, 'rest')
assert.equal(page.restRemaining, 0)
assert.equal(restVibrations, 2)
page.increaseRestByMinute()
assert.equal(page.restEndAt, now + 60000)

connection.onopen()
const progress = messages.find(message => message.type === 'progress').payload
assert.equal(Object.hasOwn(progress, 'restEndNotified'), false)
page.applyProgressAck(progress)
page.applyIncomingProgress({
  ...progress,
  screen: 'workout',
  restEndAt: 0,
  completedRecords: progress.completedRecords.map(record => ({ ...record, completedAt: 0 }))
})
assert.equal(page.screen, 'rest')
assert.equal(page.restRemaining, 60)
assert.equal(messages.at(-1).type, 'progress-ack')
page.decreaseRest()
page.decreaseRest()
page.decreaseRest()
assert.equal(page.screen, 'rest')
assert.equal(page.restRemaining, 0)
assert.equal(restVibrations, 3)
page.finishRest()
assert.equal(page.screen, 'workout')
assert.equal(page.exerciseIndex, 1)
assert.equal(page.currentRestSeconds, 60)

page.finishCurrentSet(2)
assert.equal(page.restRemaining, 60)
page.undoLastSet()
assert.equal(page.screen, 'workout')
assert.equal(page.completedRecords.length, 1)
assert.equal(tickRest, null)
assert.equal(JSON.parse(storageData.get(restStateKey)).restEndNotified, false)

console.log('vela-modules-check: all checks passed')
