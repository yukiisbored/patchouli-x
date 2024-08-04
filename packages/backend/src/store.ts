export function Store<T>(init: T) {
  let value = init

  function set(newValue: T) {
    value = newValue
  }

  function get() {
    return value
  }

  return {
    set,
    get
  }
}
