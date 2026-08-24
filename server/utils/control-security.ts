const loopbackHosts = new Set(['localhost', '::1'])

function normalizeHost(value: string) {
  return value.trim().toLowerCase().replace(/^\[|\]$/g, '')
}

export function isLoopbackHost(value: string) {
  const host = normalizeHost(value)
  const ipv4Host = host.startsWith('::ffff:') ? host.slice('::ffff:'.length) : host
  return loopbackHosts.has(host) || /^127(?:\.\d{1,3}){3}$/.test(ipv4Host)
}

export function isLoopbackAddress(value: string | undefined) {
  return typeof value === 'string' && isLoopbackHost(value)
}

export function getConfiguredBindHost(environment: NodeJS.ProcessEnv = process.env) {
  return environment.STATION_BIND_HOST || environment.NITRO_HOST || environment.HOST || '127.0.0.1'
}

export function assertSecureControlBinding(
  host: string,
  controlToken: string | undefined,
) {
  if (!isLoopbackHost(host) && !controlToken?.trim()) {
    throw new Error(
      'NUXT_CONTROL_TOKEN must be set when STATION_BIND_HOST is not a loopback address.',
    )
  }
}
