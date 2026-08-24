import { describe, expect, it } from 'vitest'
import {
  chooseControlledLoopModel,
  chooseControlledLoopModels,
  isInputModerationRefusal,
} from '../server/utils/openrouter-video'

describe('OpenRouter controlled video loop selection', () => {
  const compatible = {
    id: 'bytedance/seedance-2.0-fast',
    supported_durations: [6],
    supported_resolutions: ['720p'],
    supported_aspect_ratios: ['16:9'],
    supported_frame_images: ['first_frame', 'last_frame'],
  }

  it('selects Seedance Fast only when its frame-loop contract is complete', () => {
    expect(chooseControlledLoopModel([compatible])).toEqual(compatible)
  })

  it('rejects models without both loop anchor frames', () => {
    expect(chooseControlledLoopModel([
      { ...compatible, id: 'bytedance/seedance-2.0', supported_frame_images: ['first_frame'] },
    ])).toBeNull()
  })
})

describe('input-image moderation fallback', () => {
  const contract = {
    supported_durations: [6],
    supported_resolutions: ['720p'],
    supported_frame_images: ['first_frame', 'last_frame'],
  }

  it('detects a person-likeness refusal so a different provider can be tried', () => {
    const body = '{"error":{"code":"InputImageSensitiveContentDetected.PrivacyInformation","message":"the input image \'content[1]\' may contain real person"}}'
    expect(isInputModerationRefusal(400, body)).toBe(true)
  })

  it('does not treat other failures as a reason to try another model', () => {
    expect(isInputModerationRefusal(400, 'InvalidParameter: resource not found')).toBe(false)
    expect(isInputModerationRefusal(500, 'InputImageSensitiveContentDetected')).toBe(false)
    expect(isInputModerationRefusal(402, 'insufficient credits')).toBe(false)
  })

  it('orders fallback candidates cheapest-capable first and skips incapable models', () => {
    const ids = chooseControlledLoopModels([
      { id: 'kwaivgi/kling-v3.0-std', ...contract },
      { id: 'bytedance/seedance-2.0-fast', ...contract },
      { id: 'some/other-model', ...contract },
      { id: 'google/veo-3.1-lite', ...contract, supported_frame_images: ['first_frame'] },
    ]).map((model) => model.id)

    expect(ids[0]).toBe('bytedance/seedance-2.0-fast')
    expect(ids).toContain('kwaivgi/kling-v3.0-std')
    expect(ids).not.toContain('some/other-model')
    expect(ids).not.toContain('google/veo-3.1-lite')
  })
})
