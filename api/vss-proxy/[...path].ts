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

  // Debug endpoint: POST /api/vss-proxy/debug to see what body we receive
  if (path === 'debug') {
    const body = await buffer(req)
    res.status(200).json({
      bodyLength: body.length,
      bodyType: typeof req.body,
      bodyIsBuffer: Buffer.isBuffer(req.body),
      rawBodyLength: body.length,
      contentType: req.headers['content-type'],
      method: req.method,
      firstBytes: body.length > 0 ? Array.from(body.slice(0, 20)) : [],
    })
    return
  }

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
      upstream.headers.get('content-type') ?? 'application/octet-stream',
    )
    res.setHeader('Cache-Control', 'no-store')
    res.send(Buffer.from(await upstream.arrayBuffer()))
  } catch {
    res.status(502).json({ error: 'upstream unavailable' })
  }
}
