import { describe, expect, it } from 'vitest'
import {
  createStationManifest,
  isPrivateStationId,
  stationAssetKey,
  stationManifestKey,
  stationPrefix,
} from '../server/utils/station-library'

const stationId = '0d4bc88f438a46cc9a8f01ee0fc7de31'

describe('private station library', () => {
  it('accepts only opaque station identifiers and never allows path traversal', () => {
    expect(isPrivateStationId(stationId)).toBe(true)
    expect(isPrivateStationId('../shared-station')).toBe(false)
    expect(isPrivateStationId('short-id')).toBe(false)
    expect(() => stationPrefix('../shared-station')).toThrow('invalid')
  })

  it('creates an empty per-mode manifest with a stable schema', () => {
    const manifest = createStationManifest(stationId, '2026-08-22T21:00:00.000Z')

    expect(manifest).toMatchObject({
      version: 1,
      stationId,
      createdAt: '2026-08-22T21:00:00.000Z',
      updatedAt: '2026-08-22T21:00:00.000Z',
      modes: {
        deepWork: {},
        rainyDebug: {},
        testsPassing: {},
      },
    })
  })

  it('uses per-station, per-mode keys that replace only the selected asset', () => {
    expect(stationManifestKey(stationId)).toBe(`stations/${stationId}/manifest.json`)
    expect(stationAssetKey(stationId, 'deepWork', 'scene')).toBe(`stations/${stationId}/deepWork/scene.png`)
    expect(stationAssetKey(stationId, 'rainyDebug', 'music')).toBe(`stations/${stationId}/rainyDebug/music.mp3`)
  })
})
