import { assertAuthorizedControlRequest } from '../../../utils/control-request'
import { chooseRandomSceneOptions } from '../../../utils/station'
import { generateStationScene } from '../../../utils/station-generation'
import { getActivePrivateStationId, isStationStorageConfigured } from '../../../utils/station-library'
import {
  clearStationGeneration,
  getStationState,
  markStationAssetsUpdated,
  markStationGenerationStarted,
} from '../../../utils/station-state'

export default defineEventHandler(async (event) => {
  assertAuthorizedControlRequest(event)
  if (!isStationStorageConfigured()) {
    throw createError({
      statusCode: 503,
      statusMessage: 'Private cloud storage is required for Stream Deck generation.',
    })
  }

  const stationId = await getActivePrivateStationId()
  if (!stationId) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Open Compile & Chill in its browser once before using Stream Deck generation.',
    })
  }

  const station = await getStationState()
  const options = chooseRandomSceneOptions()
  await markStationGenerationStarted('scene', station.mode)
  try {
    const result = await generateStationScene({
      mode: station.mode,
      ...options,
      persistence: { stationId },
    })
    const updated = await markStationAssetsUpdated('scene', station.mode)

    return {
      mode: updated.mode,
      label: updated.label,
      generatedAt: updated.assetsChangedAt,
      visualStyle: result.visualStyle,
      developer: result.developer,
      seed: result.seed,
    }
  } catch (error) {
    await clearStationGeneration()
    throw error
  }
})
