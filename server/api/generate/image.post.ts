import {
  isDeveloperPresentation,
  isSceneVisualStyle,
  isStationMode,
} from '../../utils/station'
import { generateStationScene } from '../../utils/station-generation'

interface GenerateImageBody {
  mode?: unknown
  direction?: unknown
  seed?: unknown
  visualStyle?: unknown
  developer?: unknown
}

export default defineEventHandler(async (event) => {
  const body = await readBody<GenerateImageBody>(event)
  if (!isStationMode(body.mode)) {
    throw createError({ statusCode: 400, statusMessage: 'Unknown station mode.' })
  }
  if (body.visualStyle !== undefined && !isSceneVisualStyle(body.visualStyle)) {
    throw createError({ statusCode: 400, statusMessage: 'Unknown scene visual style.' })
  }
  if (body.developer !== undefined && !isDeveloperPresentation(body.developer)) {
    throw createError({ statusCode: 400, statusMessage: 'Unknown developer presentation.' })
  }

  const requestedSeed = Number(body.seed)
  const result = await generateStationScene({
    mode: body.mode,
    direction: typeof body.direction === 'string' ? body.direction : undefined,
    seed: Number.isFinite(requestedSeed) ? requestedSeed : undefined,
    visualStyle: body.visualStyle,
    developer: body.developer,
    persistence: { event },
  })

  return {
    image: result.savedScene
      ? `/api/library/assets/${body.mode}/scene?v=${encodeURIComponent(result.savedScene.createdAt)}`
      : `data:image/png;base64,${Buffer.from(result.bytes).toString('base64')}`,
    seed: result.seed,
    model: result.model,
    region: result.region,
    savedToPrivateLibrary: Boolean(result.savedScene),
  }
})
