import { isStationMode } from '../../utils/station'
import { generateStationMusic } from '../../utils/station-generation'

interface GenerateMusicBody {
  mode?: unknown
  direction?: unknown
  durationSeconds?: unknown
}

export default defineEventHandler(async (event) => {
  const body = await readBody<GenerateMusicBody>(event)
  if (!isStationMode(body.mode)) {
    throw createError({ statusCode: 400, statusMessage: 'Unknown station mode.' })
  }

  const direction = typeof body.direction === 'string' ? body.direction : undefined
  const result = await generateStationMusic({
    mode: body.mode,
    direction,
    durationSeconds: Number(body.durationSeconds ?? 30),
    persistence: { event },
  })

  setResponseHeader(event, 'Content-Type', result.contentType)
  setResponseHeader(event, 'Cache-Control', 'no-store')
  if (result.songId) setResponseHeader(event, 'X-Song-Id', result.songId)

  return result.bytes
})
