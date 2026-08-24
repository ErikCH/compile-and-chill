import { describe, expect, it } from 'vitest'
import {
  assertSecureControlBinding,
  getConfiguredBindHost,
  isLoopbackAddress,
  isLoopbackHost,
} from '../server/utils/control-security'

describe('Stream Deck control security', () => {
  it('recognizes localhost and IPv4/IPv6 loopback addresses', () => {
    expect(isLoopbackHost('localhost')).toBe(true)
    expect(isLoopbackHost('127.0.0.1')).toBe(true)
    expect(isLoopbackHost('127.10.20.30')).toBe(true)
    expect(isLoopbackHost('[::1]')).toBe(true)
    expect(isLoopbackAddress('::ffff:127.0.0.1')).toBe(true)
    expect(isLoopbackAddress('::1')).toBe(true)
    expect(isLoopbackAddress('100.64.0.8')).toBe(false)
  })

  it('uses a loopback bind host unless an explicit server host is configured', () => {
    expect(getConfiguredBindHost({})).toBe('127.0.0.1')
    expect(getConfiguredBindHost({ STATION_BIND_HOST: '100.64.0.8' })).toBe('100.64.0.8')
    expect(getConfiguredBindHost({ NITRO_HOST: '10.0.0.2' })).toBe('10.0.0.2')
  })

  it('rejects a non-loopback control binding without a token', () => {
    expect(() => assertSecureControlBinding('100.64.0.8', '')).toThrow('NUXT_CONTROL_TOKEN')
    expect(() => assertSecureControlBinding('0.0.0.0', undefined)).toThrow('NUXT_CONTROL_TOKEN')
    expect(() => assertSecureControlBinding('127.0.0.1', '')).not.toThrow()
    expect(() => assertSecureControlBinding('100.64.0.8', 'private-token')).not.toThrow()
  })
})
