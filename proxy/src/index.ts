import { connect } from 'cloudflare:sockets'
import { parseProxyPath, validateOrigin, validateTarget } from './validation'

interface Env {
  ALLOWED_ORIGINS: string
  ALLOWED_PORTS: string
  MAX_MESSAGE_SIZE: string
}

export default {
  fetch(request: Request, env: Env): Response {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected WebSocket upgrade', { status: 426 })
    }

    const origin = request.headers.get('Origin')
    const allowedOrigins = env.ALLOWED_ORIGINS.split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    if (!validateOrigin(origin, allowedOrigins)) {
      return new Response('Forbidden', { status: 403 })
    }

    const url = new URL(request.url)
    const target = parseProxyPath(url.pathname)
    if (!target) {
      return new Response('Invalid path. Expected /v1/{host}/{port}', {
        status: 400,
      })
    }

    const allowedPorts = env.ALLOWED_PORTS.split(',').map((s) =>
      parseInt(s.trim(), 10),
    )
    const maxMessageSize = parseInt(env.MAX_MESSAGE_SIZE, 10)

    const targetError = validateTarget(target.host, target.port, allowedPorts)
    if (targetError) {
      return new Response(targetError, { status: 400 })
    }

    // Open TCP connection to Lightning node
    const tcp = connect({ hostname: target.host, port: target.port })

    // Create WebSocket pair
    const pair = new WebSocketPair()
    const client = pair[0]
    const server = pair[1]
    server.accept()

    // Pipe: WebSocket -> TCP
    server.addEventListener('message', (event: MessageEvent) => {
      const data: unknown = event.data
      if (data instanceof ArrayBuffer && data.byteLength > maxMessageSize) {
        server.close(1009, 'Message too large')
        void tcp.close()
        return
      }
      const writer = tcp.writable.getWriter()
      void writer
        .write(
          data instanceof ArrayBuffer
            ? new Uint8Array(data)
            : new TextEncoder().encode(String(data)),
        )
        .then(() => writer.releaseLock())
        .catch(() => {
          writer.releaseLock()
          if (server.readyState === WebSocket.OPEN) {
            server.close(1011, 'TCP write error')
          }
        })
    })

    server.addEventListener('close', () => {
      void tcp.close()
    })

    server.addEventListener('error', () => {
      void tcp.close()
    })

    // Pipe: TCP -> WebSocket
    void tcp.readable
      .pipeTo(
        new WritableStream({
          write(chunk: Uint8Array) {
            if (server.readyState === WebSocket.OPEN) {
              server.send(chunk)
            }
          },
          close() {
            if (server.readyState === WebSocket.OPEN) {
              server.close(1000, 'TCP connection closed')
            }
          },
          abort() {
            if (server.readyState === WebSocket.OPEN) {
              server.close(1011, 'TCP connection error')
            }
          },
        }),
      )
      .catch(() => {
        if (server.readyState === WebSocket.OPEN) {
          server.close(1011, 'TCP connection error')
        }
      })

    return new Response(null, { status: 101, webSocket: client })
  },
} satisfies ExportedHandler<Env>
