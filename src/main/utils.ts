export type Ok<T> = { success: true; data: T }
export type Err<E> = { success: false; error: E }
export type Result<T, E> = Err<E> | Ok<T>

export function Ok<T>(data: T): Ok<T> {
  return { success: true, data }
}

export function Err<E>(error: E): Err<E> {
  return { success: false, error }
}

export type Tuple<L, R> = { l: L; r: R }

export function Tuple<L, R>(l: L, r: R): Tuple<L, R> {
  return { l, r }
}
