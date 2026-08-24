import { describe, expect, it } from 'vitest'

// Mirrors the seed normalization in generateStationScene: a missing or
// non-numeric seed must fall back to a valid integer, never NaN/null.
// `??` does not catch NaN, which is what previously reached Bedrock as null.
function normalizeSeed(seed: unknown, random = Math.random) {
  const requested = Number(seed)
  const safe = Number.isFinite(requested)
    ? requested
    : Math.floor(random() * 4_294_967_295)
  return Math.min(4_294_967_295, Math.max(0, Math.floor(safe)))
}

describe('scene seed normalization', () => {
  it('falls back to a valid integer when the browser omits a seed', () => {
    for (const missing of [undefined, null, '', 'abc', Number.NaN]) {
      const seed = normalizeSeed(missing, () => 0.5)
      expect(Number.isInteger(seed)).toBe(true)
      expect(JSON.stringify({ seed })).not.toContain('null')
    }
  })

  it('keeps an explicit seed and clamps out-of-range values', () => {
    expect(normalizeSeed(42)).toBe(42)
    expect(normalizeSeed(-5)).toBe(0)
    expect(normalizeSeed(9_999_999_999)).toBe(4_294_967_295)
  })
})
