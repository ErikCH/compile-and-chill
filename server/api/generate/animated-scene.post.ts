import {
  isDeveloperPresentation,
  isStationMode,
} from '../../utils/station'
import {
  completeAnimatedSceneJob,
  createAnimatedSceneJob,
  failAnimatedSceneJob,
  isAnimatedSceneJobId,
  updateAnimatedSceneJob,
} from '../../utils/animated-scene-jobs'
import { generateAnimatedStationScene } from '../../utils/animated-scene'
import { getOrCreatePrivateStationId } from '../../utils/station-library'

interface GenerateAnimatedSceneBody {
  mode?: unknown
  direction?: unknown
  developer?: unknown
  confirmation?: unknown
  jobId?: unknown
}

export default defineEventHandler(async (event) => {
  const body = await readBody<GenerateAnimatedSceneBody>(event)
  if (!isStationMode(body.mode)) {
    throw createError({ statusCode: 400, statusMessage: 'Unknown station mode.' })
  }
  if (body.developer !== undefined && !isDeveloperPresentation(body.developer)) {
    throw createError({ statusCode: 400, statusMessage: 'Unknown developer presentation.' })
  }
  if (body.confirmation !== 'GENERATE_ANIMATED_LOOP') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Animated loops require explicit confirmation before using OpenRouter credits.',
    })
  }
  if (!isAnimatedSceneJobId(body.jobId)) {
    throw createError({ statusCode: 400, statusMessage: 'Animated generation job identifier is invalid.' })
  }

  const stationId = getOrCreatePrivateStationId(event)
  if (!createAnimatedSceneJob(body.jobId, stationId)) {
    throw createError({
      statusCode: 409,
      statusMessage: 'An animated loop is already running for this private station.',
    })
  }

  try {
    const result = await generateAnimatedStationScene({
      event,
      mode: body.mode,
      direction: typeof body.direction === 'string' ? body.direction : undefined,
      developer: body.developer,
      stationId,
      onPhase: (phase) => updateAnimatedSceneJob(body.jobId as string, phase),
    })
    completeAnimatedSceneJob(body.jobId)

    return {
      media: `/api/library/assets/${body.mode}/scene?v=${encodeURIComponent(result.savedScene.createdAt)}`,
      contentType: result.savedScene.contentType,
      model: result.model,
      seed: result.seed,
      savedToPrivateLibrary: true,
    }
  } catch (error) {
    const statusMessage = typeof error === 'object' && error && 'statusMessage' in error
      ? String((error as { statusMessage?: unknown }).statusMessage || 'Animated loop generation failed.')
      : error instanceof Error ? error.message : 'Animated loop generation failed.'
    failAnimatedSceneJob(body.jobId, statusMessage)
    throw error
  }
})
