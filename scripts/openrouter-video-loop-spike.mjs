import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { OpenRouter, tool } from '@openrouter/agent'
import { z } from 'zod'

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const skillsDirectory = path.join(appRoot, 'skills')
const selectedSkill = 'openrouter-video-loop'
const preferredModels = [
  'bytedance/seedance-2.0-fast',
  'bytedance/seedance-2.0',
  'kwaivgi/kling-v3.0-std',
  'google/veo-3.1-fast',
]

function availableSkills() {
  if (!existsSync(skillsDirectory)) return []

  return readdirSync(skillsDirectory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .filter((entry) => existsSync(path.join(skillsDirectory, entry.name, 'SKILL.md')))
    .map((entry) => entry.name)
}

function skillPath(type) {
  return path.join(skillsDirectory, type, 'SKILL.md')
}

export const openRouterVideoSkillLoader = tool({
  name: 'load_openrouter_video_skill',
  description: `Load a vetted local policy for private OpenRouter video-loop planning. Available skills: ${availableSkills().join(', ') || 'none'}.`,
  inputSchema: z.object({
    type: z.literal(selectedSkill),
  }),
  outputSchema: z.string(),
  nextTurnParams: {
    input: ({ type }, context) => {
      const marker = `[Skill: ${type}]`
      if (JSON.stringify(context.input).includes(marker)) return context.input

      const source = skillPath(type)
      if (!existsSync(source)) return context.input

      const currentInput = Array.isArray(context.input) ? context.input : [context.input]
      return [
        ...currentInput,
        {
          role: 'user',
          content: `${marker}\nBase directory: ${path.dirname(source)}\n\n${readFileSync(source, 'utf8')}`,
        },
      ]
    },
  },
  execute: async ({ type }) => existsSync(skillPath(type))
    ? `Loaded ${type}`
    : `Skill ${type} is unavailable.`,
})

export function createVideoLoopPlanner() {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not configured.')

  return new OpenRouter({ apiKey })
}

function supportsLoopFrames(model) {
  const frames = new Set(model.supported_frame_images ?? [])
  return frames.has('first_frame')
    && frames.has('last_frame')
    && model.supported_resolutions?.includes('720p')
    && model.supported_durations?.includes(6)
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options)
  if (!response.ok) throw new Error(`Request failed with HTTP ${response.status}.`)
  return response.json()
}

async function verifyKey() {
  await fetchJson('https://openrouter.ai/api/v1/auth/key', {
    headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` },
  })
}

async function runCapabilityCheck() {
  createVideoLoopPlanner()
  await verifyKey()

  const response = await fetchJson('https://openrouter.ai/api/v1/videos/models')
  const models = response.data ?? []
  const modelRank = (model) => {
    const index = preferredModels.indexOf(model.id)
    return index === -1 ? Number.MAX_SAFE_INTEGER : index
  }
  const candidates = models
    .filter(supportsLoopFrames)
    .sort((left, right) => modelRank(left) - modelRank(right))
    .map((model) => ({
      id: model.id,
      durations: model.supported_durations,
      resolutions: model.supported_resolutions,
      frameImages: model.supported_frame_images,
    }))

  const recommended = candidates.find((model) => model.id === preferredModels[0]) ?? candidates[0]
  if (!recommended) throw new Error('No live OpenRouter model satisfies the six-second loop-frame requirements.')

  console.log(JSON.stringify({
    keyAuthentication: 'available',
    configuredSkillLoader: selectedSkill,
    recommendedModel: recommended.id,
    candidates,
    requestPreview: {
      model: recommended.id,
      duration: 6,
      resolution: '720p',
      aspectRatio: '16:9',
      generateAudio: false,
      frameImages: ['first_frame', 'last_frame'],
      privateSource: 'server-created short-lived URL only',
      submission: 'requires explicit human confirmation',
    },
  }, null, 2))
}

if (process.argv.includes('--capabilities')) {
  await runCapabilityCheck()
}
