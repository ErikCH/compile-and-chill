const defaultImageModelId = 'stability.stable-image-ultra-v1:1'

export default defineNuxtConfig({
  compatibilityDate: '2026-08-01',
  css: ['~/assets/css/main.css'],
  // The station is watched full-screen as a broadcast surface, so the floating
  // DevTools badge should never overlay it.
  devtools: { enabled: false },
  devServer: {
    host: process.env.STATION_BIND_HOST || '127.0.0.1',
    port: 8231,
  },
  runtimeConfig: {
    elevenLabsApiKey:
      process.env.ELEVENLABS_API_KEY || process.env.NUXT_ELEVENLABS_API_KEY || '',
    imageGenerationRegion: process.env.BEDROCK_IMAGE_REGION || 'us-west-2',
    imageGenerationModel:
      process.env.BEDROCK_IMAGE_MODEL_ID || defaultImageModelId,
    controlToken: process.env.NUXT_CONTROL_TOKEN || '',
    stationStorageBucket: process.env.STATION_S3_BUCKET || '',
    stationStorageRegion: process.env.STATION_S3_REGION || 'us-west-2',
    openRouterApiKey: process.env.OPENROUTER_API_KEY || '',
  },
  typescript: {
    typeCheck: true,
  },
})
