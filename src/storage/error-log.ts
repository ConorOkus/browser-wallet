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

  // Prune old entries in the background
  void pruneErrorLog().catch(() => {})
}

async function pruneErrorLog(): Promise<void> {
  const all = await idbGetAll<ErrorLogEntry>('ldk_error_log')
  if (all.size <= MAX_ENTRIES) return

  const sorted = [...all.entries()].sort(([, a], [, b]) => a.timestamp - b.timestamp)
  const toDelete = sorted.slice(0, sorted.length - MAX_ENTRIES).map(([key]) => key)
  await idbDeleteBatch('ldk_error_log', toDelete)
}

/**
 * Get all error log entries, sorted newest first.
 */
export async function getErrorLog(): Promise<ErrorLogEntry[]> {
  const all = await idbGetAll<ErrorLogEntry>('ldk_error_log')
  return [...all.values()].sort((a, b) => b.timestamp - a.timestamp)
}

/**
 * Export the error log as a privacy-safe string for sharing.
 * Strips any data that could identify the user — only includes
 * severity, source, message, and timestamps.
 */
export async function exportErrorLog(): Promise<string> {
  const entries = await getErrorLog()
  if (entries.length === 0) return 'No errors recorded.'

  const lines = entries.map((e) => {
    const date = new Date(e.timestamp).toISOString()
    return `[${date}] ${e.severity.toUpperCase()} (${e.source}) ${e.message}${e.detail ? '\n  ' + e.detail : ''}`
  })

  return `Zinq Error Log (${entries.length} entries)\n${'='.repeat(40)}\n${lines.join('\n')}`
}
