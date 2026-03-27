/**
 * Vercel serverless function that proxies LNURL requests to bypass CORS.
 * Vercel rewrite maps /api/lnurl-proxy/DOMAIN/PATH to /api/lnurl-proxy?_path=DOMAIN/PATH
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const rest = url.searchParams.get('_path') ?? ''
  const slashIdx = rest.indexOf('/')
  if (slashIdx === -1) {
    return Response.json(
      { error: 'Bad proxy URL — expected /api/lnurl-proxy/DOMAIN/PATH' },
      { status: 400 }
    )
  }

  const targetHost = rest.slice(0, slashIdx)
  const targetPath = rest.slice(slashIdx)

  // Forward original query params (excluding internal _path)
  const forwardParams = new URLSearchParams()
  for (const [key, value] of url.searchParams) {
    if (key !== '_path') forwardParams.set(key, value)
  }
  const queryString = forwardParams.toString()
  const targetUrl = `https://${targetHost}${targetPath}${queryString ? '?' + queryString : ''}`

  try {
    const upstream = await fetch(targetUrl, {
      signal: AbortSignal.timeout(10_000),
    })

    return new Response(await upstream.text(), {
      status: upstream.status,
      headers: {
        'Content-Type': upstream.headers.get('content-type') ?? 'application/json',
        'Cache-Control': 'no-store',
      },
    })
  } catch {
    return Response.json({ error: 'upstream unavailable' }, { status: 502 })
  }
}
