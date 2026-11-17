"use client"

import { useSyncExternalStore } from "react"

const subscribe = () => () => {}
const getSnapshot = () => true
const getServerSnapshot = () => false

/**
 * False on the server and during the first client render, true afterwards.
 *
 * Anything read from `localStorage`, `navigator`, or the OS theme has to render
 * as its server value first or hydration fails. `useSyncExternalStore` is the
 * supported way to express that; a `setState` in an effect trips the React
 * Compiler lint rules and causes a cascading render.
 */
export function useHydrated() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
