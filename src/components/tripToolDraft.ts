import { useEffect } from 'react'
import type { FieldValues, UseFormWatch } from 'react-hook-form'
import type { TripItemKind } from '../types/trip'

// Trip items themselves auto-save to the DB as they're added, so the only thing an interruption
// (an unexpected session expiry, say) can discard is whatever tool form is open but not yet
// submitted. Persist that one form to localStorage, keyed by kind, so it comes back on reopen —
// including when a failed save reopens the form for another try. Only the add flow is persisted;
// edits start from the existing item. Cleared on a confirmed save or an explicit close, but not on
// an unexpected unmount, which is exactly why it survives one.
const TOOL_DRAFT_PREFIX = 'wanderlist:trip-tool-draft:'

function toolDraftKey(kind: TripItemKind): string {
  return `${TOOL_DRAFT_PREFIX}${kind}`
}

function loadToolDraft(kind: TripItemKind): Record<string, unknown> | null {
  try {
    const raw = localStorage.getItem(toolDraftKey(kind))
    return raw ? (JSON.parse(raw) as Record<string, unknown>) : null
  } catch {
    return null
  }
}

export function clearToolDraft(kind: TripItemKind): void {
  try {
    localStorage.removeItem(toolDraftKey(kind))
  } catch {
    /* ignore — draft persistence is best-effort */
  }
}

// Merge a saved draft (add mode only) over a form's empty defaults; `kind` is undefined when editing.
export function withToolDraft<T extends object>(kind: TripItemKind | undefined, base: T): T {
  return kind ? { ...base, ...((loadToolDraft(kind) as Partial<T> | null) ?? {}) } : base
}

// Mirror every keystroke of an add-mode tool form into localStorage. No-op when editing.
export function useToolDraftPersistence<T extends FieldValues>(kind: TripItemKind | undefined, watch: UseFormWatch<T>): void {
  useEffect(() => {
    if (!kind) return
    const subscription = watch((values) => {
      try {
        localStorage.setItem(toolDraftKey(kind), JSON.stringify(values))
      } catch {
        /* ignore — quota/private-mode failures shouldn't break the form */
      }
    })
    return () => subscription.unsubscribe()
  }, [kind, watch])
}
