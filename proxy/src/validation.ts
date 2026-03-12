export interface ProxyTarget {
  host: string
  port: number
}

export function parseProxyPath(pathname: string): ProxyTarget | null {
  const match = pathname.match(/^\/v1\/([^/]+)\/(\d+)$/)
  if (!match) return null

  const host = match[1]!.replace(/_/g, '.')
  const port = parseInt(match[2]!, 10)

  if (isNaN(port) || port < 1 || port > 65535) return null

  return { host, port }
}

export function validateOrigin(
  origin: string | null,
  allowedOrigins: string[],
): boolean {
  if (!origin) return false
  return allowedOrigins.includes(origin)
}

export function validateTarget(
  host: string,
  port: number,
  allowedPorts: number[],
): string | null {
  if (!allowedPorts.includes(port)) {
    return `Port ${port} not allowed`
  }

  if (host.endsWith('.onion')) {
    return 'Tor .onion addresses are not supported'
  }

  if (isPrivateIP(host)) {
    return 'Connection to private IP ranges is not allowed'
  }

  return null
}

function isPrivateIP(host: string): boolean {
  const match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (!match) return false

  const a = parseInt(match[1]!, 10)
  const b = parseInt(match[2]!, 10)

  if (a > 255 || b > 255) return false

  if (a === 10) return true // 10.0.0.0/8
  if (a === 172 && b >= 16 && b <= 31) return true // 172.16.0.0/12
  if (a === 192 && b === 168) return true // 192.168.0.0/16
  if (a === 127) return true // 127.0.0.0/8
  if (a === 169 && b === 254) return true // 169.254.0.0/16 link-local
  if (a === 0) return true // 0.0.0.0/8
  if (a === 100 && b >= 64 && b <= 127) return true // 100.64.0.0/10 CGNAT
  if (a === 255) return true // 255.x.x.x broadcast

  return false
}
