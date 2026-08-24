import { getStationLibrarySummary } from '../../utils/station-library'

export default defineEventHandler((event) => getStationLibrarySummary(event))
