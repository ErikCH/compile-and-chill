import { clearPrivateStationId } from '../../utils/station-library'

export default defineEventHandler((event) => {
  clearPrivateStationId(event)
  return { cleared: true }
})
