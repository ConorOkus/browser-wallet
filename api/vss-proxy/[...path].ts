import type { VercelRequest, VercelResponse } from '@vercel/node'

/**
 * Vercel serverless function that proxies VSS requests.
 * Reads VSS_ORIGIN from server-side env vars (not exposed to browser).
 * Mapped via vercel.json rewrite: /__vss_proxy/vss/* → /api/vss-proxy/*
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const vssOrigin = process.env.VSS_ORIGIN
  if (!vssOrigin) {
    res.status(500).json({ error: 'VSS_ORIGIN not configured' })
    return
  }

  const path = (req.query.path as string[])?.join('/') ?? ''
  const targetUrl = `${vssOrigin}/vss/${path}`

  try {
    const upstream = await fetch(targetUrl, {
      method: req.method ?? 'POST',
      headers: { 'Content-Type': req.headers['content-type'] ?? 'application/octet-stream' },
      body: req.method !== 'GET' && req.method !== 'HEAD' ? req.body : undefined,
    })

    res.status(upstream.status)
    res.setHeader('Content-Type', upstream.headers.get('content-type') ?? 'application/octet-stream')
    const buffer = Buffer.from(await upstream.arrayBuffer())
    res.send(buffer)
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : 'Proxy error' })
  }
}
