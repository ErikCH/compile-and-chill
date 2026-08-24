import { isStationMode } from '../utils/station'
import { registerActivePrivateStation } from '../utils/station-library'
import { setStationState } from '../utils/station-state'

interface ModeBody {
  mode?: unknown
}

export default defineEventHandler(async (event) => {
  const body = await readBody<ModeBody>(event)
  if (!isStationMode(body.mode)) {
    throw createError({ statusCode: 400, statusMessage: 'Unknown station mode.' })
  }

  await registerActivePrivateStation(event)
  return setStationState(body.mode)
})
