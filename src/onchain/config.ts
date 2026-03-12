export const ONCHAIN_CONFIG = {
  esploraUrl: 'https://mutinynet.com/api',
  syncIntervalMs: 30_000,
  fullScanGapLimit: 20,
  syncParallelRequests: 5,
  esploraMaxRetries: 3,
} as const
