function create(storage, options) {
  options = options || {}
  var planKey = String(options.planKey || '')
  var stateKey = String(options.stateKey || '')

  function loadPlan(defaultPlan, normalizePlan, onDone) {
    storage.get({
      key: planKey,
      default: '',
      success: function(data) {
        var plan = defaultPlan
        if (data) {
          try {
            var parsed = normalizePlan(JSON.parse(data))
            if (parsed) {
              plan = parsed
            }
          } catch (error) {
            console.log('Vela workout plan parse failed: ' + error)
          }
        }
        onDone(plan)
      },
      fail: function(data, code) {
        console.log('Vela workout plan read failed: ' + code)
        onDone(defaultPlan)
      }
    })
  }

  function loadState(onDone) {
    storage.get({
      key: stateKey,
      default: '',
      success: function(data) {
        if (!data) {
          onDone(null)
          return
        }
        try {
          onDone(JSON.parse(data))
        } catch (error) {
          console.log('Vela workout state parse failed: ' + error)
          onDone(null)
        }
      },
      fail: function(data, code) {
        console.log('Vela workout state read failed: ' + code)
        onDone(null)
      }
    })
  }

  function saveState(state, onSaved) {
    storage.set({
      key: stateKey,
      value: JSON.stringify(state),
      success: function() {
        if (typeof onSaved === 'function') {
          onSaved(true)
        }
      },
      fail: function(data, code) {
        console.log('Vela workout state save failed: ' + code)
        if (typeof onSaved === 'function') {
          onSaved(false)
        }
      }
    })
  }

  function savePlan(plan, onSaved) {
    storage.set({
      key: planKey,
      value: JSON.stringify(plan),
      success: function() {
        if (typeof onSaved === 'function') {
          onSaved(true)
        }
      },
      fail: function(data, code) {
        console.log('Vela workout plan save failed: ' + code)
        if (typeof onSaved === 'function') {
          onSaved(false)
        }
      }
    })
  }

  return {
    loadPlan: loadPlan,
    loadState: loadState,
    saveState: saveState,
    savePlan: savePlan
  }
}

export default {
  create: create
}
