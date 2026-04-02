import { idbPut, idbGetAll, idbDeleteBatch } from './idb'

export type ErrorSeverity = 'critical' | 'error' | 'warning'

export interface ErrorLogEntry {
  id: string
  timestamp: number
  severity: ErrorSeverity
  source: string
  message: string
  detail?: string
}

const MAX_ENTRIES = 100

let callsSinceLastPrune = 0

/**
 * Capture a structured error to the local IDB error log.
 * Also logs to console at the appropriate level.
 * Fire-and-forget — never throws.
 */
export function captureError(
  severity: ErrorSeverity,
  source: string,
  message: string,
  detail?: string
): void {
  const prefix = `[${source}]`
  const consoleFn = severity === 'critical' || severity === 'error' ? console.error : console.warn
  consoleFn(prefix, message, detail ?? '')

  const entry: ErrorLogEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
    severity,
    source,
    message,
    detail,
  }

  void idbPut('ldk_error_log', entry.id, entry).catch(() => {
    // If IDB write fails, the console.error above is the fallback
  })

  // Prune old entries every 10th capture to avoid IDB churn
  if (++callsSinceLastPrune >= 10) {
    callsSinceLastPrune = 0
    void pruneErrorLog().catch(() => {})
  }
}

async function pruneErrorLog(): Promise<void> {
  const all = await idbGetAll<ErrorLogEntry>('ldk_error_log')
  if (all.size <= MAX_ENTRIES) return

  const sorted = [...all.entries()].sort(([, a], [, b]) => a.timestamp - b.timestamp)
  const toDelete = sorted.slice(0, sorted.length - MAX_ENTRIES).map(([key]) => key)
  await idbDeleteBatch('ldk_error_log', toDelete)
}
