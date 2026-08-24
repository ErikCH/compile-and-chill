import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime'
import type { H3Event } from 'h3'
import {
  buildMusicPrompt,
  buildScenePrompt,
  type DeveloperPresentation,
  type SceneVisualStyle,
  type StationMode,
} from './station'
import {
  isStationStorageConfigured,
  saveGeneratedMusic,
  saveGeneratedMusicForStation,
  saveGeneratedScene,
  saveGeneratedSceneForStation,
} from './station-library'

interface StableImageResponse {
  images?: string[]
  seeds?: number[]
  finish_reasons?: Array<string | null>
}

type GenerationPersistence = {
  event?: H3Event
  stationId?: string
} | undefined

async function persistMusic(
  persistence: GenerationPersistence,
  input: { mode: StationMode; direction?: string; bytes: Uint8Array },
) {
  if (!isStationStorageConfigured() || !persistence) return false
  if (persistence.stationId) {
    await saveGeneratedMusicForStation(persistence.stationId, input)
  } else if (persistence.event) {
    await saveGeneratedMusic(persistence.event, input)
  } else {
    return false
  }
  return true
}

async function persistScene(
  persistence: GenerationPersistence,
  input: {
    mode: StationMode
    direction?: string
    bytes: Uint8Array
    visualStyle: SceneVisualStyle
    developer: DeveloperPresentation
  },
) {
  if (!isStationStorageConfigured() || !persistence) return null
  if (persistence.stationId) {
    return saveGeneratedSceneForStation(persistence.stationId, input)
  }
  if (persistence.event) return saveGeneratedScene(persistence.event, input)
  return null
}

export async function generateStationMusic(input: {
  mode: StationMode
  direction?: string
  durationSeconds?: number
  persistence?: GenerationPersistence
}) {
  const config = useRuntimeConfig()
  if (!config.elevenLabsApiKey) {
    throw createError({
      statusCode: 503,
      statusMessage: 'Add NUXT_ELEVENLABS_API_KEY to .env to generate music.',
    })
  }

  const durationSeconds = Math.min(60, Math.max(10, Number(input.durationSeconds ?? 60)))
  const response = await fetch(
    'https://api.elevenlabs.io/v1/music?output_format=mp3_44100_128',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': config.elevenLabsApiKey,
      },
      body: JSON.stringify({
        prompt: buildMusicPrompt(input.mode, input.direction),
        music_length_ms: durationSeconds * 1000,
        model_id: 'music_v2',
        generation_mode: 'loop',
        force_instrumental: true,
        sign_with_c2pa: true,
      }),
    },
  )

  if (!response.ok) {
    const detail = await response.text()
    console.error('ElevenLabs Music request failed', response.status, detail)
    throw createError({
      statusCode: response.status,
      statusMessage: 'ElevenLabs could not generate this track. Check usage and prompt policy.',
    })
  }

  const bytes = new Uint8Array(await response.arrayBuffer())
  const savedToPrivateLibrary = await persistMusic(input.persistence, {
    mode: input.mode,
    direction: input.direction,
    bytes,
  })

  return {
    bytes,
    contentType: response.headers.get('content-type') || 'audio/mpeg',
    songId: response.headers.get('song-id') || undefined,
    savedToPrivateLibrary,
  }
}

export async function generateStationScene(input: {
  mode: StationMode
  direction?: string
  seed?: number
  visualStyle?: SceneVisualStyle
  developer?: DeveloperPresentation
  persistence?: GenerationPersistence
}) {
  const config = useRuntimeConfig()
  const visualStyle = input.visualStyle ?? 'illustrated'
  const developer = input.developer ?? 'woman'
  const requestedSeed = Number(input.seed)
  const safeSeed = Number.isFinite(requestedSeed)
    ? requestedSeed
    : Math.floor(Math.random() * 4_294_967_295)
  const seed = Math.min(4_294_967_295, Math.max(0, Math.floor(safeSeed)))
  const client = new BedrockRuntimeClient({ region: config.imageGenerationRegion })
  const payload = {
    prompt: buildScenePrompt(input.mode, input.direction, {
      visualStyle,
      developer,
      diversitySeed: seed,
    }),
    negative_prompt: [
      'logos, readable text, watermark, child, teenager, adolescent, minor, youthful childlike face, childlike proportions, school uniform, copied character, existing lo-fi channel, rear view, back of head, hidden face, obscured face, hair covering eyes, cropped face, blurry face, soft focus, motion blur, shallow depth of field, excessive bloom, atmospheric haze, smeared details, low resolution, extra fingers, malformed hands, duplicate monitors',
      visualStyle === 'illustrated'
        ? 'photograph, live action, photorealistic skin, realistic portrait, hyperrealism, 3D render, CGI'
        : 'cartoon, anime, cel shading, flat illustration',
    ].join(', '),
    mode: 'text-to-image',
    aspect_ratio: '16:9',
    output_format: 'png',
    seed,
  }

  try {
    const response = await client.send(
      new InvokeModelCommand({
        modelId: config.imageGenerationModel,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify(payload),
      }),
    )
    const result = JSON.parse(new TextDecoder().decode(response.body)) as StableImageResponse
    const finishReason = result.finish_reasons?.find((reason) => reason !== null)
    if (finishReason) throw new Error(`Image generation was filtered: ${finishReason}`)
    if (!result.images?.[0]) throw new Error('Bedrock returned no generated image.')

    const bytes = Uint8Array.from(Buffer.from(result.images[0], 'base64'))
    const savedScene = await persistScene(input.persistence, {
      mode: input.mode,
      direction: input.direction,
      bytes,
      visualStyle,
      developer,
    })

    return {
      bytes,
      seed: result.seeds?.[0] ?? seed,
      model: config.imageGenerationModel,
      region: config.imageGenerationRegion,
      visualStyle,
      developer,
      savedScene,
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    console.error('Bedrock image generation failed', detail)
    throw createError({
      statusCode: 502,
      statusMessage: `Bedrock image generation failed with ${config.imageGenerationModel} in ${config.imageGenerationRegion}: ${detail}`,
    })
  }
}
