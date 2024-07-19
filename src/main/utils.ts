export type Ok<T> = { success: true; data: T }
export type Err<E> = { success: false; error: E }
export type Result<T, E> = Err<E> | Ok<T>

export function Ok<T>(data: T): Ok<T> {
  return { success: true, data }
}

export function Err<E>(error: E): Err<E> {
  return { success: false, error }
}

export function SortedArray<T>(compare: (a: T, b: T) => number, initial: T[] = []) {
  const arr: T[] = initial.slice().sort(compare)

  function get(): T[] {
    return arr.slice(0)
  }

  function bisect(item: T): number {
    let low = 0
    let high = arr.length
    while (low < high) {
      const mid = (low + high) >>> 1
      if (compare(arr[mid], item) < 0) {
        low = mid + 1
      } else {
        high = mid
      }
    }
    return low
  }

  function index(item: T): number | null {
    const i = bisect(item)
    return i < arr.length && compare(arr[i], item) === 0 ? i : null
  }

  function contains(item: T): boolean {
    return index(item) !== null
  }

  function insert(item: T): void {
    arr.splice(bisect(item), 0, item)
  }

  function remove(item: T): void {
    const i = index(item)

    if (i !== null) {
      arr.splice(i, 1)
    }
  }

  return {
    get,
    index,
    insert,
    remove,
    contains
  }
}
