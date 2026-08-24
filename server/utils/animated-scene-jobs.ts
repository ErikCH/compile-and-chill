export type AnimatedSceneJobPhase =
  | 'creating_anchor'
  | 'preparing_source'
  | 'submitting_to_seedance'
  | 'generating_loop'
  | 'downloading_loop'
  | 'saving_loop'

export type AnimatedSceneJobState = 'running' | 'completed' | 'failed'

export interface AnimatedSceneJob {
  id: string
  stationId: string
  state: AnimatedSceneJobState
  phase: AnimatedSceneJobPhase
  createdAt: string
  updatedAt: string
  error?: string
}

const jobIdPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i
const jobs = new Map<string, AnimatedSceneJob>()
const maximumJobAgeMilliseconds = 30 * 60 * 1000

export const animatedScenePhaseCopy: Record<AnimatedSceneJobPhase, { label: string; detail: string }> = {
  creating_anchor: {
    label: 'Creating the illustrated anchor',
    detail: 'Stable Image Ultra is painting the matching first and last frame.',
  },
  preparing_source: {
    label: 'Preparing the private source',
    detail: 'The illustration is being encrypted and signed for one-time provider access.',
  },
  submitting_to_seedance: {
    label: 'Submitting to Seedance',
    detail: 'OpenRouter is accepting the six-second controlled loop request.',
  },
  generating_loop: {
    label: 'Seedance is generating the loop',
    detail: 'The camera is locked while the typing and blink loop is rendered.',
  },
  downloading_loop: {
    label: 'Downloading the completed loop',
    detail: 'The private MP4 is being retrieved from OpenRouter.',
  },
  saving_loop: {
    label: 'Saving your private loop',
    detail: 'The MP4 is being stored in this browser-bound station library.',
  },
}

function pruneExpiredJobs(now = Date.now()) {
  for (const [id, job] of jobs) {
    if (now - Date.parse(job.updatedAt) > maximumJobAgeMilliseconds) jobs.delete(id)
  }
}

export function isAnimatedSceneJobId(value: unknown): value is string {
  return typeof value === 'string' && jobIdPattern.test(value)
}

export function createAnimatedSceneJob(id: string, stationId: string) {
  if (!isAnimatedSceneJobId(id)) throw new Error('Animated generation job identifier is invalid.')
  pruneExpiredJobs()
  const active = [...jobs.values()].find((job) => job.stationId === stationId && job.state === 'running')
  if (active) return null
  const now = new Date().toISOString()
  const job: AnimatedSceneJob = {
    id,
    stationId,
    state: 'running',
    phase: 'creating_anchor',
    createdAt: now,
    updatedAt: now,
  }
  jobs.set(id, job)
  return job
}

export function updateAnimatedSceneJob(id: string, phase: AnimatedSceneJobPhase) {
  const job = jobs.get(id)
  if (!job || job.state !== 'running') return null
  job.phase = phase
  job.updatedAt = new Date().toISOString()
  return job
}

export function completeAnimatedSceneJob(id: string) {
  const job = jobs.get(id)
  if (!job) return null
  job.state = 'completed'
  job.updatedAt = new Date().toISOString()
  return job
}

export function failAnimatedSceneJob(id: string, error: string) {
  const job = jobs.get(id)
  if (!job) return null
  job.state = 'failed'
  job.error = error.slice(0, 300)
  job.updatedAt = new Date().toISOString()
  return job
}

export function getAnimatedSceneJob(id: string, stationId: string) {
  pruneExpiredJobs()
  const job = jobs.get(id)
  return job?.stationId === stationId ? job : null
}
