import { assertAuthorizedControlRequest } from '../../utils/control-request'
import { isStationMode } from '../../utils/station'
import { setStationState } from '../../utils/station-state'

interface ModeBody {
  mode?: unknown
}

export default defineEventHandler(async (event) => {
  assertAuthorizedControlRequest(event)

  const body = await readBody<ModeBody>(event)
  if (!isStationMode(body.mode)) {
    throw createError({ statusCode: 400, statusMessage: 'Unknown station mode.' })
  }

  return setStationState(body.mode)
})
