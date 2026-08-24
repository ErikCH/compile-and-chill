import { describe, expect, it } from 'vitest'
import {
  completeAnimatedSceneJob,
  createAnimatedSceneJob,
  failAnimatedSceneJob,
  getAnimatedSceneJob,
  isAnimatedSceneJobId,
  updateAnimatedSceneJob,
} from '../server/utils/animated-scene-jobs'

const stationId = '0d4bc88f438a46cc9a8f01ee0fc7de31'
const otherStationId = 'aa11bb22cc33dd44ee55ff6677889900'

describe('animated scene generation jobs', () => {
  it('accepts only opaque job identifiers', () => {
    expect(isAnimatedSceneJobId(crypto.randomUUID())).toBe(true)
    expect(isAnimatedSceneJobId('../escape')).toBe(false)
  })

  it('reports real phases and terminal completion to the owning station only', () => {
    const jobId = crypto.randomUUID()
    expect(createAnimatedSceneJob(jobId, stationId)?.phase).toBe('creating_anchor')

    updateAnimatedSceneJob(jobId, 'generating_loop')
    expect(getAnimatedSceneJob(jobId, stationId)?.phase).toBe('generating_loop')
    expect(getAnimatedSceneJob(jobId, otherStationId)).toBeNull()

    completeAnimatedSceneJob(jobId)
    expect(getAnimatedSceneJob(jobId, stationId)?.state).toBe('completed')
  })

  it('refuses a second concurrent paid job for the same station and keeps the failure reason', () => {
    const firstJob = crypto.randomUUID()
    const secondJob = crypto.randomUUID()
    createAnimatedSceneJob(firstJob, otherStationId)

    expect(createAnimatedSceneJob(secondJob, otherStationId)).toBeNull()

    failAnimatedSceneJob(firstJob, 'OpenRouter could not start the animated loop.')
    expect(getAnimatedSceneJob(firstJob, otherStationId)).toMatchObject({
      state: 'failed',
      error: 'OpenRouter could not start the animated loop.',
    })
    expect(createAnimatedSceneJob(secondJob, otherStationId)?.state).toBe('running')
  })
})
