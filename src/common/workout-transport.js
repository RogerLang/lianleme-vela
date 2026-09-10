function create(interconnect, protocol, handlers) {
  handlers = handlers || {}
  var conn = null
  var ready = false

  function setReady(nextReady, source) {
    nextReady = !!nextReady
    var changed = ready !== nextReady
    ready = nextReady
    if (changed && typeof handlers.onConnectionChange === 'function') {
      handlers.onConnectionChange(ready, source || '')
    }
    if (ready && typeof handlers.onReady === 'function') {
      handlers.onReady(source || '')
    }
  }

  function start() {
    conn = interconnect.instance()
    conn.onmessage = function(data) {
      if (typeof handlers.onMessage === 'function') {
        handlers.onMessage(data && data.data)
      }
    }
    conn.onopen = function() {
      setReady(true, 'open')
    }
    conn.onclose = function() {
      setReady(false, 'close')
    }
    conn.onerror = function(data) {
      setReady(false, 'error')
      console.log('Vela interconnect error: ' + (data && data.code))
    }

    conn.getReadyState({
      success: function(data) {
        setReady(!!data && data.status === 1, 'ready-state')
      },
      fail: function(data, code) {
        setReady(false, 'ready-state-fail')
        console.log('Vela interconnect state failed: ' + code)
      }
    })
  }

  function send(type, payload) {
    if (!ready || !conn) {
      return false
    }
    conn.send({
      data: protocol.envelope(type, payload),
      fail: function(data, code) {
        console.log('Vela interconnect send failed: ' + code)
      }
    })
    return true
  }

  function isReady() {
    return ready
  }

  return {
    start: start,
    send: send,
    isReady: isReady
  }
}

export default {
  create: create
}
