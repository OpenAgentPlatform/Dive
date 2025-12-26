let binding

try {
  binding = require('./index.js')
} catch (e) {
  console.warn('[core-js] Native binding not found, using stub functions')
  binding = new Proxy(
    {},
    {
      get(_target, _prop) {
        return function () {}
      },
    },
  )
}

module.exports = binding
