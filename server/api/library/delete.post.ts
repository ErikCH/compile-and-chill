import { deleteSavedPrivateStation } from '../../utils/station-library'

interface DeleteStationBody {
  confirmation?: unknown
}

export default defineEventHandler(async (event) => {
  const body = await readBody<DeleteStationBody>(event)
  if (body.confirmation !== 'DELETE') {
    throw createError({ statusCode: 400, statusMessage: 'Type DELETE to permanently remove the saved station.' })
  }

  return deleteSavedPrivateStation(event)
})
