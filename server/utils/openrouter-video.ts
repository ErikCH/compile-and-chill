export interface OpenRouterVideoModel {
  id: string
  supported_durations?: number[]
  supported_resolutions?: string[]
  supported_aspect_ratios?: string[]
  supported_frame_images?: string[]
}

interface OpenRouterVideoJob {
  id: string
  polling_url?: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled' | 'expired'
  error?: string
}

const preferredModelIds = [
  'bytedance/seedance-2.0-fast',
  'bytedance/seedance-2.0-mini',
  'kwaivgi/kling-v3.0-std',
  'alibaba/wan-2.7',
  'google/veo-3.1-lite',
  'bytedance/seedance-2.0',
]
const openRouterApiUrl = 'https://openrouter.ai/api/v1'
const maximumVideoBytes = 50 * 1024 * 1024

function supportsControlledLoop(model: OpenRouterVideoModel) {
  const frames = new Set(model.supported_frame_images ?? [])
  return model.supported_durations?.includes(6)
    && model.supported_resolutions?.includes('720p')
    && frames.has('first_frame')
    && frames.has('last_frame')
}

export function chooseControlledLoopModels(models: OpenRouterVideoModel[]) {
  return preferredModelIds
    .map((id) => models.find((model) => model.id === id && supportsControlledLoop(model)))
    .filter((model): model is OpenRouterVideoModel => Boolean(model))
}

export function chooseControlledLoopModel(models: OpenRouterVideoModel[]) {
  return chooseControlledLoopModels(models)[0] ?? null
}

function redactUrls(text: string) {
  // A provider error can echo the signed S3 source URL. Never log or return it.
  return text.replace(/https?:\/\/[^\s"'\\)]+/g, '[redacted-url]')
}

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

function authorizationHeaders(apiKey: string) {
  return { Authorization: `Bearer ${apiKey}` }
}

async function loadVideoModels() {
  const response = await fetch(`${openRouterApiUrl}/videos/models`)
  if (!response.ok) {
    throw createError({
      statusCode: 502,
      statusMessage: 'OpenRouter video model discovery is unavailable. No generation was submitted.',
    })
  }

  const payload = await response.json() as { data?: OpenRouterVideoModel[] }
  return payload.data ?? []
}

function safePollingUrl(pollingUrl: string) {
  const url = new URL(pollingUrl, openRouterApiUrl)
  if (url.origin !== 'https://openrouter.ai' || !url.pathname.startsWith('/api/v1/videos/')) {
    throw createError({ statusCode: 502, statusMessage: 'OpenRouter returned an invalid video polling URL.' })
  }
  return url.toString()
}

async function readJob(url: string, apiKey: string) {
  const response = await fetch(url, { headers: authorizationHeaders(apiKey) })
  if (!response.ok) {
    throw createError({ statusCode: 502, statusMessage: 'OpenRouter video status check failed.' })
  }
  return await response.json() as OpenRouterVideoJob
}

export function isInputModerationRefusal(status: number, detail: string) {
  if (status !== 400) return false
  return /InputImageSensitiveContentDetected|may contain real person|SensitiveContent|PrivacyInformation/i.test(detail)
}

function submitControlledLoop(apiKey: string, modelId: string, sourceUrl: string) {
  return fetch(`${openRouterApiUrl}/videos`, {
    method: 'POST',
    headers: {
      ...authorizationHeaders(apiKey),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: modelId,
      duration: 6,
      resolution: '720p',
      aspect_ratio: '16:9',
      generate_audio: false,
      prompt: [
        'Animate this 2D cartoon illustration of a fictional, non-photorealistic character.',
        'Locked-off static camera and unchanged illustrated composition.',
        'The exact provided illustration is both the first and last frame.',
        'Only tiny natural two-hand typing motion and one gentle blink are allowed.',
        'No zoom, pan, dolly, reframing, cut, character identity change, body repositioning, new objects, or background geometry changes.',
        'Silent seamless six-second ambient loop.',
      ].join(' '),
      frame_images: [
        { type: 'image_url', image_url: { url: sourceUrl }, frame_type: 'first_frame' },
        { type: 'image_url', image_url: { url: sourceUrl }, frame_type: 'last_frame' },
      ],
    }),
  })
}

export async function generateControlledIllustratedLoop(input: {
  apiKey: string
  sourceUrl: string
  onPhase?: (phase: 'submitting_to_seedance' | 'generating_loop' | 'downloading_loop') => void
}) {
  const candidates = chooseControlledLoopModels(await loadVideoModels())
  if (!candidates.length) {
    throw createError({
      statusCode: 503,
      statusMessage: 'No compatible controlled-loop model is currently available. No generation was submitted.',
    })
  }

  input.onPhase?.('submitting_to_seedance')
  let submission: Response | undefined
  let selectedModel: OpenRouterVideoModel | undefined
  let moderationDetail = ''

  for (const candidate of candidates) {
    const response = await submitControlledLoop(input.apiKey, candidate.id, input.sourceUrl)
    if (response.ok) {
      submission = response
      selectedModel = candidate
      break
    }

    const detail = redactUrls(await response.text().catch(() => '')).slice(0, 300)
    console.error('OpenRouter video submission failed', candidate.id, response.status, detail)

    if (response.status === 402) {
      throw createError({
        statusCode: 402,
        statusMessage: 'OpenRouter could not start the animated loop because credits are unavailable.',
      })
    }
    if (response.status === 429) {
      throw createError({
        statusCode: 429,
        statusMessage: 'OpenRouter is rate limiting animated loop requests. No video was saved. Try again shortly.',
      })
    }
    // An input-image moderation refusal creates no job and costs nothing, so it
    // is safe to try a provider with a different classifier. Anything else stops.
    if (isInputModerationRefusal(response.status, detail)) {
      moderationDetail = detail
      continue
    }
    throw createError({
      statusCode: 502,
      statusMessage: `OpenRouter rejected the animated loop (HTTP ${response.status}) on ${candidate.id}. No video was saved. Provider said: ${detail || 'no detail returned'}`,
    })
  }

  if (!submission || !selectedModel) {
    throw createError({
      statusCode: 502,
      statusMessage: `Every available video model refused this illustration as possibly depicting a real person, so no video was generated. Regenerate the scene as a flatter, more cartoon-like illustration and try again. Provider said: ${moderationDetail || 'no detail returned'}`,
    })
  }

  let job = await submission.json() as OpenRouterVideoJob
  input.onPhase?.('generating_loop')
  for (let attempt = 0; attempt < 48; attempt += 1) {
    if (job.status === 'completed') break
    if (job.status === 'failed' || job.status === 'cancelled' || job.status === 'expired') {
      const reason = redactUrls(String(job.error ?? '')).slice(0, 300)
      console.error('OpenRouter video job ended', job.status, reason)
      throw createError({
        statusCode: 502,
        statusMessage: `OpenRouter could not complete the animated loop (${job.status})${reason ? `: ${reason}` : '.'}`,
      })
    }
    if (!job.polling_url) {
      throw createError({ statusCode: 502, statusMessage: 'OpenRouter did not return a video polling URL.' })
    }
    await wait(15_000)
    job = await readJob(safePollingUrl(job.polling_url), input.apiKey)
  }

  if (job.status !== 'completed') {
    throw createError({
      statusCode: 504,
      statusMessage: 'The animated loop is still processing. No video was saved; please try again later.',
    })
  }

  input.onPhase?.('downloading_loop')
  const contentUrl = `${openRouterApiUrl}/videos/${encodeURIComponent(job.id)}/content?index=0`
  const content = await fetch(contentUrl, { headers: authorizationHeaders(input.apiKey) })
  if (!content.ok) {
    throw createError({ statusCode: 502, statusMessage: 'OpenRouter completed the loop but its video could not be downloaded.' })
  }

  const length = Number(content.headers.get('content-length') || 0)
  if (Number.isFinite(length) && length > maximumVideoBytes) {
    throw createError({ statusCode: 502, statusMessage: 'The generated animated loop exceeded the private storage size limit.' })
  }

  const bytes = new Uint8Array(await content.arrayBuffer())
  if (!bytes.length || bytes.length > maximumVideoBytes) {
    throw createError({ statusCode: 502, statusMessage: 'OpenRouter returned an invalid animated loop.' })
  }

  return { bytes, model: selectedModel.id }}
