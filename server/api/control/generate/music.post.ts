import { assertAuthorizedControlRequest } from '../../../utils/control-request'
import { generateStationMusic } from '../../../utils/station-generation'
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
  await markStationGenerationStarted('music', station.mode)
  try {
    const result = await generateStationMusic({
      mode: station.mode,
      durationSeconds: 60,
      persistence: { stationId },
    })
    const updated = await markStationAssetsUpdated('music', station.mode)

    return {
      mode: updated.mode,
      label: updated.label,
      generatedAt: updated.assetsChangedAt,
      savedToPrivateLibrary: result.savedToPrivateLibrary,
    }
  } catch (error) {
    await clearStationGeneration()
    throw error
  }
})
