import { describe, expect, it } from 'vitest'

// Mirrors redactUrls in openrouter-video.ts: a provider error body can echo the
// signed S3 source URL, which must never reach logs or the browser.
function redactUrls(text: string) {
  return text.replace(/https?:\/\/[^\s"'\\)]+/g, '[redacted-url]')
}

describe('provider error redaction', () => {
  it('strips a signed source URL from a provider error body', () => {
    const body = '{"error":{"message":"not valid: https://bucket.s3.us-west-2.amazonaws.com/stations/abc/scene.png?X-Amz-Signature=deadbeef"}}'
    const safe = redactUrls(body)
    expect(safe).not.toContain('X-Amz-Signature')
    expect(safe).not.toContain('amazonaws.com')
    expect(safe).toContain('[redacted-url]')
  })

  it('keeps the useful provider wording intact', () => {
    expect(redactUrls('InvalidParameter: resource not found')).toBe('InvalidParameter: resource not found')
  })
})
