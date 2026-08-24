import {
  animatedScenePhaseCopy,
  getAnimatedSceneJob,
  isAnimatedSceneJobId,
} from '../../utils/animated-scene-jobs'
import { getPrivateStationId } from '../../utils/station-library'

export default defineEventHandler((event) => {
  const jobId = getQuery(event).job
  const stationId = getPrivateStationId(event)
  if (!stationId || !isAnimatedSceneJobId(jobId)) {
    throw createError({ statusCode: 404, statusMessage: 'Animated generation status was not found.' })
  }
  const job = getAnimatedSceneJob(jobId, stationId)
  if (!job) throw createError({ statusCode: 404, statusMessage: 'Animated generation status was not found.' })
  const phaseCopy = animatedScenePhaseCopy[job.phase]
  return {
    id: job.id,
    state: job.state,
    phase: job.phase,
    label: phaseCopy.label,
    detail: phaseCopy.detail,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    error: job.error,
  }
})
