import { isStationMode, stationModes } from '../../utils/station'

interface GenerateAmbienceBody {
  mode?: unknown
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  if (!config.elevenLabsApiKey) {
    throw createError({
      statusCode: 503,
      statusMessage: 'Add ELEVENLABS_API_KEY to .env to generate ambience.',
    })
  }

  const body = await readBody<GenerateAmbienceBody>(event)
  if (!isStationMode(body.mode)) {
    throw createError({ statusCode: 400, statusMessage: 'Unknown station mode.' })
  }

  const response = await fetch(
    'https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': config.elevenLabsApiKey,
      },
      body: JSON.stringify({
        text: stationModes[body.mode].ambience,
        model_id: 'eleven_text_to_sound_v2',
        duration_seconds: 10,
        prompt_influence: 0.45,
        loop: true,
      }),
    },
  )

  if (!response.ok) {
    const detail = await response.text()
    console.error('ElevenLabs Sound Effects request failed', response.status, detail)
    throw createError({
      statusCode: response.status,
      statusMessage: 'ElevenLabs could not generate the ambience loop.',
    })
  }

  setResponseHeader(event, 'Content-Type', response.headers.get('content-type') || 'audio/mpeg')
  setResponseHeader(event, 'Cache-Control', 'no-store')
  return new Uint8Array(await response.arrayBuffer())
})
