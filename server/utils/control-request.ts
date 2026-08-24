import type { H3Event } from 'h3'
import { isLoopbackAddress } from './control-security'

export function assertAuthorizedControlRequest(event: H3Event) {
  const config = useRuntimeConfig()
  const suppliedToken = getHeader(event, 'x-control-token')
  const remoteAddress = event.node.req.socket.remoteAddress

  if (!config.controlToken && !isLoopbackAddress(remoteAddress)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'A control token is required for remote requests.',
    })
  }

  if (config.controlToken && suppliedToken !== config.controlToken) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid control token.' })
  }
}
