"use client"

import { useCallback, useEffect, useSyncExternalStore } from "react"

import {
  getBookmarks,
  getRecent,
  getServerBookmarks,
  getServerRecent,
  recordView,
  subscribe,
  toggleBookmark,
} from "@/lib/local-store"

/**
 * `useSyncExternalStore` rather than a `setState` in an effect: it is the
 * supported way to render a browser-only value as its server value first, and
 * the effect version trips the React Compiler lint rules and causes a cascading
 * render. Same pattern as `useHydrated`.
 */
export function useBookmarks() {
  const bookmarks = useSyncExternalStore(
    subscribe,
    getBookmarks,
    getServerBookmarks
  )

  const toggle = useCallback((id: string) => toggleBookmark(id), [])

  const isBookmarked = useCallback(
    (id: string) => bookmarks.includes(id),
    [bookmarks]
  )

  return { bookmarks, isBookmarked, toggle }
}

export function useRecentlyViewed() {
  return useSyncExternalStore(subscribe, getRecent, getServerRecent)
}

/** Records a view once per id. Rendered on detail pages. */
export function useRecordView(id: string | undefined) {
  useEffect(() => {
    if (!id) return
    recordView(id)
  }, [id])
}
