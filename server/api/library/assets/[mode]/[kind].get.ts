import { getPrivateStationAsset } from '../../../../utils/station-library'

export default defineEventHandler(async (event) => {
  const asset = await getPrivateStationAsset(
    event,
    getRouterParam(event, 'mode'),
    getRouterParam(event, 'kind'),
  )

  setResponseHeader(event, 'Content-Type', asset.contentType)
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  setResponseHeader(event, 'X-Content-Type-Options', 'nosniff')
  return asset.bytes
})
