export default defineEventHandler(() => {
  const config = useRuntimeConfig()

  return {
    elevenLabsConfigured: Boolean(config.elevenLabsApiKey),
    bedrockConfigured: Boolean(
      config.imageGenerationRegion && config.imageGenerationModel,
    ),
    awsRegion: config.imageGenerationRegion,
    imageModel: config.imageGenerationModel,
    cloudLibraryConfigured: Boolean(config.stationStorageBucket && config.stationStorageRegion),
    demoMode: !config.elevenLabsApiKey,
  }
})
