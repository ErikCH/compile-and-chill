import { describe, expect, it } from 'vitest'
import {
  buildMusicPrompt,
  buildScenePrompt,
  chooseRandomSceneOptions,
  getDiverseAdultAppearance,
  isDeveloperPresentation,
  isSceneVisualStyle,
  isStationMode,
} from '../server/utils/station'
import { createStationState } from '../server/utils/station-state'

describe('station prompt builders', () => {
  it('accepts only known station and scene options', () => {
    expect(isStationMode('rainyDebug')).toBe(true)
    expect(isStationMode('lofi-girl-copy')).toBe(false)
    expect(isSceneVisualStyle('illustrated')).toBe(true)
    expect(isSceneVisualStyle('oil-painting')).toBe(false)
    expect(isDeveloperPresentation('man')).toBe(true)
    expect(isDeveloperPresentation('robot')).toBe(false)
  })

  it('creates a stable persisted station state for browser and Stream Deck updates', () => {
    expect(createStationState('testsPassing', '2026-08-22T23:10:00.000Z')).toEqual({
      mode: 'testsPassing',
      label: 'Tests passing',
      changedAt: '2026-08-22T23:10:00.000Z',
    })
  })

  it('randomizes the developer and seed but always produces a realistic static scene', () => {
    expect(chooseRandomSceneOptions(() => 0)).toEqual({
      visualStyle: 'realistic',
      developer: 'woman',
      seed: 0,
    })
    expect(chooseRandomSceneOptions(() => 0.9)).toEqual({
      visualStyle: 'realistic',
      developer: 'man',
      seed: 3_865_470_565,
    })
  })

  it('builds an instrumental concentration prompt', () => {
    const prompt = buildMusicPrompt('deepWork', 'keep the bass understated')
    expect(prompt).toContain('instrumental')
    expect(prompt).toContain('72 BPM')
    expect(prompt).toContain('keep the bass understated')
    expect(prompt).toContain('Do not imitate')
  })

  it('prioritizes custom creative direction over the fixed mode foundation', () => {
    const musicPrompt = buildMusicPrompt('deepWork', 'no drums, distant train ambience')
    const scenePrompt = buildScenePrompt('rainyDebug', 'red rain jacket and lightning outside')

    expect(musicPrompt).toContain('Primary creative direction: no drums, distant train ambience.')
    expect(musicPrompt).toContain('seamless repeating loop')
    expect(musicPrompt).toContain('no ending cadence')
    expect(musicPrompt.indexOf('Primary creative direction:')).toBeLessThan(musicPrompt.indexOf('Mode foundation:'))
    expect(scenePrompt).toContain('Top-priority custom art direction: red rain jacket and lightning outside.')
    expect(scenePrompt.indexOf('Top-priority custom art direction:')).toBeLessThan(scenePrompt.indexOf('Diversity direction:'))
  })

  it('defaults to an original illustrated adult woman', () => {
    const prompt = buildScenePrompt('rainyDebug')
    expect(prompt).toContain('adult woman software developer')
    expect(prompt).toContain('clearly 25 to 40 years old')
    expect(prompt).toContain('2D cartoon animation artwork')
    expect(prompt).toContain('hand-drawn fictional cartoon character')
    expect(prompt).toContain('never a real identifiable person')
    expect(prompt).toContain('three-quarter front composition')
    expect(prompt).toContain('face is clearly visible')
    expect(prompt).toContain('sharp focus')
    expect(prompt).toContain('ghost-shaped coding assistant')
    expect(prompt).toContain('No logos')
    expect(prompt).toContain('imitation of an existing lo-fi channel')
  })

  it('varies adult appearances deterministically across generation seeds', () => {
    const firstAppearance = getDiverseAdultAppearance(0)
    const secondAppearance = getDiverseAdultAppearance(1)
    const prompt = buildScenePrompt('testsPassing', undefined, { diversitySeed: 1 })

    expect(firstAppearance).not.toBe(secondAppearance)
    expect(prompt).toContain(secondAppearance)
    expect(prompt).toContain('vary adult skin tones, facial features, and hair textures/styles')
    expect(prompt).toContain('do not add cultural costumes, assumptions, or stereotypes')
  })

  it('supports realistic scenes with a man developer', () => {
    const prompt = buildScenePrompt('deepWork', undefined, {
      visualStyle: 'realistic',
      developer: 'man',
    })
    expect(prompt).toContain('adult man software developer')
    expect(prompt).toContain('cinematic realism')
    expect(prompt).not.toContain('adult woman software developer')
  })
})
