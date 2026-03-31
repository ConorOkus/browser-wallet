import { Logger, Level, type Record } from 'lightningdevkit'

export function createLogger(): Logger {
  return Logger.new_impl({
    log(record: Record): void {
      const level = record.get_level()
      const module = record.get_module_path()
      const message = record.get_args()
      const prefix = `[LDK ${module}]`

      // Log HTLC/channel/payment messages at all levels to help debug payment flow
      if (
        level === Level.LDKLevel_Debug &&
        (message.includes('HTLC') ||
          message.includes('htlc') ||
          message.includes('payment') ||
          message.includes('claim') ||
          message.includes('reject') ||
          message.includes('fail'))
      ) {
        console.log(prefix, message)
        return
      }

      switch (level) {
        case Level.LDKLevel_Gossip:
        case Level.LDKLevel_Trace:
          console.debug(prefix, message)
          break
        case Level.LDKLevel_Debug:
          console.debug(prefix, message)
          break
        case Level.LDKLevel_Info:
          console.info(prefix, message)
          break
        case Level.LDKLevel_Warn:
          console.warn(prefix, message)
          break
        case Level.LDKLevel_Error:
          console.error(prefix, message)
          break
      }
    },
  })
}
