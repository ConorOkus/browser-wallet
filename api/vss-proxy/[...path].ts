import type { VercelRequest, VercelResponse } from '@vercel/node'
import { buffer } from 'node:stream/consumers'

/** Disable body parser to preserve raw binary protobuf payloads. */
export const config = { api: { bodyParser: false } }

/**
 * Vercel serverless function that proxies VSS requests.
 * Reads VSS_ORIGIN from server-side env vars (not exposed to browser).
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const vssOrigin = process.env.VSS_ORIGIN
  if (!vssOrigin) {
    res.status(500).json({ error: 'VSS_ORIGIN not configured' })
    return
  }

  const path = (req.query.path as string[])?.join('/') ?? ''
  const targetUrl = `${vssOrigin}/vss/${path}`

  // Read raw body as Buffer using Node.js stream consumers API
  const body = await buffer(req)

  try {
    const upstream = await fetch(targetUrl, {
      method: req.method,
      headers: {
        'Content-Type': req.headers['content-type'] ?? 'application/octet-stream',
      },
      body: req.method !== 'GET' && req.method !== 'HEAD' ? body : undefined,
      signal: AbortSignal.timeout(15_000),
    })

    res.status(upstream.status)
    res.setHeader(
      'Content-Type',
      upstream.headers.get('content-type') ?? 'application/octet-stream'
    )
    res.setHeader('Cache-Control', 'no-store')
    res.send(Buffer.from(await upstream.arrayBuffer()))
  } catch {
    res.status(502).json({ error: 'upstream unavailable' })
  }
}
