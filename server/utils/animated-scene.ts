import type { AnimatedSceneJobPhase } from './animated-scene-jobs'
import type { H3Event } from 'h3'
import type { DeveloperPresentation, StationMode } from './station'
import { generateStationScene } from './station-generation'
import {
  createPrivateStationAssetReadUrl,
  deletePrivateStationAsset,
  getOrCreatePrivateStationId,
  isStationStorageConfigured,
  saveGeneratedAnimatedSceneForStation,
  saveGeneratedAnimationSourceForStation,
} from './station-library'
import { generateControlledIllustratedLoop } from './openrouter-video'

export async function generateAnimatedStationScene(input: {
  event: H3Event
  mode: StationMode
  direction?: string
  developer?: DeveloperPresentation
  stationId?: string
  onPhase?: (phase: AnimatedSceneJobPhase) => void
}) {
  if (!isStationStorageConfigured()) {
    throw createError({
      statusCode: 503,
      statusMessage: 'Private cloud storage is required before an animated loop can be generated.',
    })
  }

  const apiKey = String(useRuntimeConfig().openRouterApiKey || '').trim()
  if (!apiKey) {
    throw createError({
      statusCode: 503,
      statusMessage: 'OpenRouter is not configured for animated loops on this server.',
    })
  }

  const stationId = input.stationId ?? getOrCreatePrivateStationId(input.event)
  const developer = input.developer ?? 'woman'
  input.onPhase?.('creating_anchor')
  const source = await generateStationScene({
    mode: input.mode,
    direction: input.direction,
    visualStyle: 'illustrated',
    developer,
  })

  input.onPhase?.('preparing_source')
  const sourceAsset = await saveGeneratedAnimationSourceForStation(stationId, {
    mode: input.mode,
    bytes: source.bytes,
  })

  try {
    const sourceUrl = await createPrivateStationAssetReadUrl(stationId, sourceAsset.key)
    const video = await generateControlledIllustratedLoop({
      apiKey,
      sourceUrl,
      onPhase: input.onPhase,
    })
    input.onPhase?.('saving_loop')
    const savedScene = await saveGeneratedAnimatedSceneForStation(stationId, {
      mode: input.mode,
      direction: input.direction,
      bytes: video.bytes,
      visualStyle: 'illustrated',
      developer,
    })

    return {
      savedScene,
      model: video.model,
      seed: source.seed,
      developer,
    }
  } finally {
    await deletePrivateStationAsset(stationId, sourceAsset.key).catch(() => undefined)
  }
}
