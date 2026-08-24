<script setup lang="ts">
import type { CSSProperties } from 'vue'
import { useStationLibrary } from '~/composables/useStationLibrary'
import type { LibraryAsset } from '~/composables/useStationLibrary'

type StationMode = 'deepWork' | 'rainyDebug' | 'testsPassing'
type StationAssetUpdateKind = 'scene' | 'music'
type SceneVisualStyle = 'illustrated' | 'realistic'
type SceneGenerationType = 'static' | 'animated'
type AnimatedScenePhase =
  | 'creating_anchor'
  | 'preparing_source'
  | 'submitting_to_seedance'
  | 'generating_loop'
  | 'downloading_loop'
  | 'saving_loop'
type DeveloperPresentation = 'woman' | 'man'

interface AnimatedGenerationProgress {
  state: 'running' | 'completed' | 'failed'
  phase: AnimatedScenePhase
  label: string
  detail: string
  error?: string
}

interface StationSnapshot {
  mode?: StationMode
  assetsChangedAt?: string
  assetsChangedKind?: StationAssetUpdateKind
  assetsChangedMode?: StationMode
  generationStartedAt?: string
  generationKind?: StationAssetUpdateKind
  generationMode?: StationMode
}

interface RemoteGeneration {
  kind: StationAssetUpdateKind
  mode: StationMode
  startedAt: string
}

interface CachedScene {
  url: string
  contentType: 'image/png' | 'video/mp4'
  visualStyle: SceneVisualStyle
  developer: DeveloperPresentation
}

interface ServiceConfig {
  elevenLabsConfigured: boolean
  bedrockConfigured: boolean
  awsRegion: string
  imageModel: string
  demoMode: boolean
  cloudLibraryConfigured: boolean
}

const presets: Record<
  StationMode,
  { label: string; eyebrow: string; description: string; accent: string; track: string }
> = {
  deepWork: {
    label: 'Deep work',
    eyebrow: 'FOCUS BLOCK 02',
    description: 'Warm keys for quiet momentum',
    accent: '#6fb5ff',
    track: 'Threads in the Rain',
  },
  rainyDebug: {
    label: 'Rainy debug',
    eyebrow: 'NIGHT SHIFT 07',
    description: 'Errors become atmosphere',
    accent: '#a98cff',
    track: 'Stack Trace After Midnight',
  },
  testsPassing: {
    label: 'Tests passing',
    eyebrow: 'GREEN BUILD 11',
    description: 'Everything is finally green',
    accent: '#78e6b0',
    track: 'All Checks Passed',
  },
}

const DEFAULT_SCENE_URL = '/developer-observatory.svg'
const mode = ref<StationMode>('rainyDebug')
const direction = ref('A restrained late-night groove with soft thunder and warm analog keys')
const sceneState = ref<'idle' | 'generating' | 'loading' | 'ready'>('idle')
const sceneGenerationSeconds = ref(0)
const animatedGenerationProgress = shallowRef<AnimatedGenerationProgress | null>(null)
const activeAnimatedJobId = shallowRef<string | null>(null)
const sceneGeneratingMode = shallowRef<StationMode | null>(null)
const sceneGeneratingType = shallowRef<SceneGenerationType>('static')
const selectedVisualStyle = shallowRef<SceneVisualStyle>('realistic')
const selectedSceneType = shallowRef<SceneGenerationType>('static')
const selectedDeveloper = shallowRef<DeveloperPresentation>('woman')
const visualSettingsOpen = shallowRef(false)
const sceneCache = reactive<Record<StationMode, CachedScene | null>>({
  deepWork: null,
  rainyDebug: null,
  testsPassing: null,
})
const assetsChangedAt = shallowRef<string | null>(null)
const remoteGeneration = shallowRef<RemoteGeneration | null>(null)
const trackUrls = reactive<Record<StationMode, string | null>>({
  deepWork: null,
  rainyDebug: null,
  testsPassing: null,
})
const audioElement = ref<HTMLAudioElement | null>(null)
const isPlaying = ref(false)
const isGeneratingMusic = ref(false)
const generatingMode = ref<StationMode | null>(null)
const isGeneratingScene = ref(false)
const errorMessage = ref('')
const currentTime = ref('12:47 AM')
const config = ref<ServiceConfig | null>(null)
const libraryModalOpen = shallowRef(false)
const deleteStationOpen = shallowRef(false)
const directorExpanded = shallowRef(false)
const cinemaMode = shallowRef(false)
const cinemaControlsVisible = shallowRef(true)
const {
  library,
  status: libraryStatus,
  isDeleting: isDeletingStation,
  refresh: refreshLibrary,
  restore: restoreLibrary,
  clearThisBrowser,
  deleteSavedStation,
} = useStationLibrary()
const elapsed = ref(0)
let clockTimer: ReturnType<typeof setInterval> | undefined
let progressTimer: ReturnType<typeof setInterval> | undefined
let sceneGenerationTimer: ReturnType<typeof setInterval> | undefined
let animatedStatusTimer: ReturnType<typeof setInterval> | undefined
let cinemaControlsTimer: ReturnType<typeof setTimeout> | undefined
let usedNativeFullscreen = false
let stationSyncTimer: ReturnType<typeof setInterval> | undefined

const current = computed(() => presets[mode.value])
const currentScene = computed(() => sceneCache[mode.value])
const sceneUrl = computed(() => currentScene.value?.url ?? DEFAULT_SCENE_URL)
const sceneIsVideo = computed(() => currentScene.value?.contentType === 'video/mp4')
const audioUrl = computed(() => trackUrls[mode.value])
const sceneStyle = computed<CSSProperties>(() => ({
  '--accent': current.value.accent,
}))
const musicActionLabel = computed(() => {
  if (generatingMode.value) return `Composing ${presets[generatingMode.value].label}…`
  if (audioUrl.value) return `Regenerate ${current.value.label} soundtrack`
  return `Generate ${current.value.label} soundtrack`
})
const remoteGenerationStatus = computed(() => {
  const active = remoteGeneration.value
  if (!active) return null
  const target = presets[active.mode].label
  return active.kind === 'music'
    ? {
        kind: active.kind,
        message: `Stream Deck is composing a new ${target} soundtrack…`,
        detail: 'The current track stays available until the replacement is ready.',
      }
    : {
        kind: active.kind,
        message: `Stream Deck is randomizing a new ${target} scene…`,
        detail: 'Generating a realistic static scene with a randomized adult developer presentation.',
      }
})
const sceneStatusLabel = computed(() => {
  if (sceneState.value === 'generating') {
    const target = sceneGeneratingMode.value ? presets[sceneGeneratingMode.value].label : current.value.label
    return sceneGeneratingType.value === 'animated'
      ? `Seedance is animating ${target} (${sceneGenerationSeconds.value}s). The private loop can take a few minutes.`
      : `Stable Image Ultra is painting ${target} (${sceneGenerationSeconds.value}s). This usually takes 10–30 seconds.`
  }
  if (sceneState.value === 'loading') return 'Scene generated. Loading it into the broadcast…'
  if (sceneState.value === 'ready' && currentScene.value) {
    return `${current.value.label} ${currentScene.value.visualStyle} ${sceneIsVideo.value ? 'animated loop' : 'scene'} is live.`
  }
  return ''
})
const modeReadiness = computed<Record<StationMode, string>>(() => {
  const readiness = {} as Record<StationMode, string>
  for (const stationMode of Object.keys(presets) as StationMode[]) {
    const audioReady = Boolean(trackUrls[stationMode])
    const sceneReady = Boolean(sceneCache[stationMode])
    readiness[stationMode] = audioReady && sceneReady
      ? ' · Audio + scene ready'
      : audioReady
        ? ' · Audio ready'
        : sceneReady
          ? ' · Scene ready'
          : ''
  }
  return readiness
})
const elapsedLabel = computed(() => {
  const minutes = Math.floor(elapsed.value / 60)
  const seconds = elapsed.value % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
})

onMounted(async () => {
  config.value = await $fetch<ServiceConfig>('/api/config')
  const station = await $fetch<StationSnapshot>('/api/station')
  if (station.mode && station.mode in presets) mode.value = station.mode
  assetsChangedAt.value = station.assetsChangedAt ?? null
  await $fetch('/api/station', { method: 'POST', body: { mode: mode.value } })

  try {
    await restoreLibrary({
      onScene: restoreLibraryScene,
      onMusic: restoreLibraryMusic,
    })
    if (sceneCache[mode.value]) sceneState.value = 'ready'
  } catch {
    // The library panel reports cloud availability without interrupting the station.
  }
  directorExpanded.value = !sceneCache[mode.value] || !trackUrls[mode.value]
  synchronizeRemoteGeneration(station)

  const updateClock = () => {
    currentTime.value = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date())
  }
  updateClock()
  clockTimer = setInterval(updateClock, 30_000)
  document.addEventListener('keydown', handleCinemaKeydown)
  document.addEventListener('fullscreenchange', handleFullscreenChange)
  stationSyncTimer = setInterval(() => {
    void synchronizeStationMode()
  }, 1_500)
})

onBeforeUnmount(() => {
  if (clockTimer) clearInterval(clockTimer)
  if (progressTimer) clearInterval(progressTimer)
  if (sceneGenerationTimer) clearInterval(sceneGenerationTimer)
  if (animatedStatusTimer) clearInterval(animatedStatusTimer)
  if (stationSyncTimer) clearInterval(stationSyncTimer)
  if (cinemaControlsTimer) clearTimeout(cinemaControlsTimer)
  document.removeEventListener('keydown', handleCinemaKeydown)
  document.removeEventListener('fullscreenchange', handleFullscreenChange)
  for (const scene of Object.values(sceneCache)) {
    if (scene) URL.revokeObjectURL(scene.url)
  }
  for (const url of Object.values(trackUrls)) {
    if (url) URL.revokeObjectURL(url)
  }
})

async function setMode(nextMode: StationMode) {
  if (nextMode === mode.value) return

  await applyMode(nextMode)
  try {
    await $fetch('/api/station', {
      method: 'POST',
      body: { mode: nextMode },
    })
  } catch (error) {
    errorMessage.value = getErrorMessage(error, 'The station mode changed locally but could not be synced.')
  }
}

function synchronizeRemoteGeneration(station: StationSnapshot) {
  const { generationKind, generationMode, generationStartedAt } = station
  if (!generationKind || !generationMode || !generationStartedAt || !(generationMode in presets)) {
    remoteGeneration.value = null
    return
  }

  remoteGeneration.value = {
    kind: generationKind,
    mode: generationMode,
    startedAt: generationStartedAt,
  }
  directorExpanded.value = true
}

async function synchronizeStationMode() {
  try {
    const station = await $fetch<StationSnapshot>('/api/station')
    synchronizeRemoteGeneration(station)
    if (station.mode && station.mode in presets && station.mode !== mode.value) {
      await applyMode(station.mode)
    }
    if (!station.assetsChangedAt || station.assetsChangedAt === assetsChangedAt.value) return

    const updatedMode = station.assetsChangedMode
    const updatedKind = station.assetsChangedKind
    if (!updatedMode || !updatedKind || !(updatedMode in presets)) {
      assetsChangedAt.value = station.assetsChangedAt
      return
    }

    const refreshedLibrary = await refreshLibrary()
    const asset = refreshedLibrary.modes[updatedMode][updatedKind]
    if (!asset) {
      assetsChangedAt.value = station.assetsChangedAt
      return
    }

    if (updatedKind === 'scene') {
      await restoreLibraryScene(updatedMode, asset)
      if (updatedMode === mode.value) sceneState.value = 'ready'
    } else {
      const resumePlayback = updatedMode === mode.value && isPlaying.value
      if (resumePlayback) stopPlayback()
      await restoreLibraryMusic(updatedMode, asset)
      if (updatedMode === mode.value) {
        sceneState.value = currentScene.value ? 'ready' : 'idle'
        await nextTick()
        if (resumePlayback) {
          try {
            await playActiveTrack(true)
          } catch {
            errorMessage.value = `${presets[updatedMode].label} soundtrack is ready. Press play to start it.`
          }
        } else {
          audioElement.value?.load()
        }
      }
    }
    assetsChangedAt.value = station.assetsChangedAt
  } catch {
    // Mode syncing is best-effort and must not interrupt local playback controls.
  }
}

async function applyMode(nextMode: StationMode) {
  stopPlayback()
  mode.value = nextMode
  sceneState.value = sceneCache[nextMode] ? 'loading' : 'idle'
  errorMessage.value = ''
  await nextTick()

  if (audioUrl.value) {
    try {
      await playActiveTrack(true)
    } catch {
      errorMessage.value = `${presets[nextMode].label} is ready. Press play to start it.`
    }
  }
}

function openVisualSettings() {
  if (!isGeneratingScene.value) animatedGenerationProgress.value = null
  const cachedScene = currentScene.value
  const nextSceneType: SceneGenerationType = cachedScene?.contentType === 'video/mp4' ? 'animated' : 'static'
  selectedSceneType.value = nextSceneType
  selectedVisualStyle.value = nextSceneType === 'animated' ? 'illustrated' : 'realistic'
  if (cachedScene) selectedDeveloper.value = cachedScene.developer
  visualSettingsOpen.value = true
}

function closeVisualSettings() {
  if (isGeneratingScene.value) return
  visualSettingsOpen.value = false
  animatedGenerationProgress.value = null
}

async function handleVisualGeneration(options: {
  visualStyle: SceneVisualStyle
  sceneType: SceneGenerationType
  developer: DeveloperPresentation
}) {
  selectedVisualStyle.value = options.visualStyle
  selectedSceneType.value = options.sceneType
  selectedDeveloper.value = options.developer
  if (options.sceneType === 'static') visualSettingsOpen.value = false
  await generateScene(options)
}

async function pollAnimatedGeneration(jobId: string) {
  try {
    const progress = await $fetch<AnimatedGenerationProgress>('/api/generate/animated-scene-status', {
      query: { job: jobId },
    })
    if (activeAnimatedJobId.value !== jobId) return
    animatedGenerationProgress.value = progress
    if (progress.state !== 'running' && animatedStatusTimer) {
      clearInterval(animatedStatusTimer)
      animatedStatusTimer = undefined
    }
  } catch {
    // The first poll can race job creation; the POST result remains authoritative.
  }
}

function startAnimatedGenerationPolling(jobId: string) {
  if (animatedStatusTimer) clearInterval(animatedStatusTimer)
  animatedStatusTimer = setInterval(() => {
    void pollAnimatedGeneration(jobId)
  }, 750)
}

function createAnimatedJobId() {
  // crypto.randomUUID is secure-context only, and the private station is served
  // over plain http on the tailnet, so derive a v4 id from getRandomValues.
  const bytes = new Uint8Array(16)
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes)
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256)
    }
  }
  bytes[6] = (bytes[6]! & 0x0f) | 0x40
  bytes[8] = (bytes[8]! & 0x3f) | 0x80
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

async function generateScene(options: {
  visualStyle: SceneVisualStyle
  sceneType: SceneGenerationType
  developer: DeveloperPresentation
}) {
  const requestedMode = mode.value
  const requestedDirection = direction.value
  isGeneratingScene.value = true
  sceneGeneratingMode.value = requestedMode
  sceneGeneratingType.value = options.sceneType
  sceneState.value = 'generating'
  sceneGenerationSeconds.value = 0
  errorMessage.value = ''
  let animatedJobId: string | null = null

  try {
    if (options.sceneType === 'animated') {
      animatedJobId = createAnimatedJobId()
      activeAnimatedJobId.value = animatedJobId
      animatedGenerationProgress.value = {
        state: 'running',
        phase: 'creating_anchor',
        label: 'Creating the illustrated anchor',
        detail: 'Stable Image Ultra is painting the matching first and last frame.',
      }
      startAnimatedGenerationPolling(animatedJobId)
    }
    if (sceneGenerationTimer) clearInterval(sceneGenerationTimer)
    sceneGenerationTimer = setInterval(() => {
      sceneGenerationSeconds.value += 1
    }, 1000)

    let mediaUrl: string
    let contentType: CachedScene['contentType']
    let savedToPrivateLibrary = false
    if (options.sceneType === 'animated') {
      const next = await $fetch<{ media: string; contentType: 'video/mp4'; savedToPrivateLibrary: true }>('/api/generate/animated-scene', {
        method: 'POST',
        body: {
          mode: requestedMode,
          direction: requestedDirection,
          developer: options.developer,
          confirmation: 'GENERATE_ANIMATED_LOOP',
          jobId: animatedJobId,
        },
        timeout: 900_000,
      })
      mediaUrl = next.media
      contentType = next.contentType
      savedToPrivateLibrary = next.savedToPrivateLibrary
    } else {
      const next = await $fetch<{ image: string; savedToPrivateLibrary?: boolean }>('/api/generate/image', {
        method: 'POST',
        body: {
          mode: requestedMode,
          direction: requestedDirection,
          visualStyle: options.visualStyle,
          developer: options.developer,
        },
        timeout: 120_000,
      })
      mediaUrl = next.image
      contentType = 'image/png'
      savedToPrivateLibrary = Boolean(next.savedToPrivateLibrary)
    }

    const mediaBlob = await (await fetch(mediaUrl)).blob()
    const previousScene = sceneCache[requestedMode]
    sceneCache[requestedMode] = {
      url: URL.createObjectURL(mediaBlob),
      contentType,
      visualStyle: options.visualStyle,
      developer: options.developer,
    }
    if (previousScene) URL.revokeObjectURL(previousScene.url)
    if (savedToPrivateLibrary) await refreshLibrary()
    sceneState.value = mode.value === requestedMode ? 'loading' : sceneCache[mode.value] ? 'ready' : 'idle'
    if (animatedJobId) {
      animatedGenerationProgress.value = {
        state: 'completed',
        phase: 'saving_loop',
        label: 'Animated loop is live',
        detail: 'The private MP4 is saved and now playing behind the station.',
      }
    }
  } catch (error) {
    sceneState.value = sceneCache[mode.value] ? 'ready' : 'idle'
    const message = getErrorMessage(error, 'Could not generate the scene.')
    errorMessage.value = message
    if (animatedJobId) {
      animatedGenerationProgress.value = {
        state: 'failed',
        phase: animatedGenerationProgress.value?.phase ?? 'creating_anchor',
        label: 'Generation stopped',
        detail: 'No automatic retry was started.',
        error: message,
      }
    }
  } finally {
    isGeneratingScene.value = false
    sceneGeneratingMode.value = null
    if (sceneGenerationTimer) clearInterval(sceneGenerationTimer)
    if (animatedStatusTimer) clearInterval(animatedStatusTimer)
    animatedStatusTimer = undefined
    activeAnimatedJobId.value = null
  }
}

async function restoreLibraryScene(nextMode: StationMode, asset: LibraryAsset) {
  if (!asset.visualStyle || !asset.developer) return
  const mediaBlob = await (await fetch(asset.url)).blob()
  const previous = sceneCache[nextMode]
  sceneCache[nextMode] = {
    url: URL.createObjectURL(mediaBlob),
    contentType: asset.contentType === 'video/mp4' ? 'video/mp4' : 'image/png',
    visualStyle: asset.visualStyle,
    developer: asset.developer,
  }
  if (previous) URL.revokeObjectURL(previous.url)
}

async function restoreLibraryMusic(nextMode: StationMode, asset: LibraryAsset) {
  const musicBlob = await (await fetch(asset.url)).blob()
  const previous = trackUrls[nextMode]
  trackUrls[nextMode] = URL.createObjectURL(musicBlob)
  if (previous) URL.revokeObjectURL(previous)
}

async function clearBrowserLibrary() {
  try {
    stopPlayback()
    for (const stationMode of Object.keys(presets) as StationMode[]) {
      const scene = sceneCache[stationMode]
      if (scene) URL.revokeObjectURL(scene.url)
      sceneCache[stationMode] = null
      const track = trackUrls[stationMode]
      if (track) URL.revokeObjectURL(track)
      trackUrls[stationMode] = null
    }
    sceneState.value = 'idle'
    await clearThisBrowser()
    libraryModalOpen.value = false
  } catch (error) {
    errorMessage.value = getErrorMessage(error, 'Could not clear this browser.')
  }
}

async function permanentlyDeleteLibrary() {
  try {
    await deleteSavedStation()
    stopPlayback()
    for (const stationMode of Object.keys(presets) as StationMode[]) {
      const scene = sceneCache[stationMode]
      if (scene) URL.revokeObjectURL(scene.url)
      sceneCache[stationMode] = null
      const track = trackUrls[stationMode]
      if (track) URL.revokeObjectURL(track)
      trackUrls[stationMode] = null
    }
    sceneState.value = 'idle'
    deleteStationOpen.value = false
    libraryModalOpen.value = false
  } catch (error) {
    errorMessage.value = getErrorMessage(error, 'Could not permanently delete the saved station.')
  }
}

function handleSceneLoaded() {
  sceneState.value = currentScene.value && sceneUrl.value === currentScene.value.url ? 'ready' : 'idle'
}

function handleSceneError() {
  sceneState.value = 'idle'
  errorMessage.value = 'The image was generated, but the browser could not display it.'
  const failedScene = currentScene.value
  if (failedScene) {
    URL.revokeObjectURL(failedScene.url)
    sceneCache[mode.value] = null
  }
}

async function generateMusic() {
  const requestedMode = mode.value
  const requestedDirection = direction.value
  isGeneratingMusic.value = true
  generatingMode.value = requestedMode
  errorMessage.value = ''
  try {
    const response = await fetch('/api/generate/music', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: requestedMode,
        direction: requestedDirection,
        durationSeconds: 60,
      }),
    })
    if (!response.ok) {
      const problem = (await response.json().catch(() => null)) as
        | { statusMessage?: string; message?: string }
        | null
      throw new Error(problem?.statusMessage || problem?.message || 'Music generation failed.')
    }

    const previousUrl = trackUrls[requestedMode]
    const nextUrl = URL.createObjectURL(await response.blob())

    if (mode.value === requestedMode) stopPlayback()
    trackUrls[requestedMode] = nextUrl
    if (previousUrl) URL.revokeObjectURL(previousUrl)
    if (library.value?.enabled) await refreshLibrary()

    if (mode.value === requestedMode) {
      await nextTick()
      try {
        await playActiveTrack(true)
      } catch {
        errorMessage.value = `${presets[requestedMode].label} is ready. Press play to start it.`
      }
    }
  } catch (error) {
    errorMessage.value = getErrorMessage(error, 'Could not generate the soundtrack.')
  } finally {
    isGeneratingMusic.value = false
    generatingMode.value = null
  }
}

function revealCinemaControls() {
  cinemaControlsVisible.value = true
  if (cinemaControlsTimer) clearTimeout(cinemaControlsTimer)
  cinemaControlsTimer = setTimeout(() => {
    cinemaControlsVisible.value = false
  }, 3000)
}

async function enterCinemaMode() {
  cinemaMode.value = true
  revealCinemaControls()

  // Native fullscreen is best-effort: iOS Safari can refuse it for non-video
  // elements. The in-page takeover already hides every control either way.
  try {
    const root = document.documentElement as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void>
    }
    if (!document.fullscreenElement) {
      if (root.requestFullscreen) await root.requestFullscreen()
      else if (root.webkitRequestFullscreen) await root.webkitRequestFullscreen()
    }
    usedNativeFullscreen = Boolean(document.fullscreenElement)
  } catch {
    usedNativeFullscreen = false
  }
}

async function exitCinemaMode() {
  cinemaMode.value = false
  cinemaControlsVisible.value = true
  if (cinemaControlsTimer) clearTimeout(cinemaControlsTimer)

  try {
    const doc = document as Document & { webkitExitFullscreen?: () => Promise<void> }
    if (document.fullscreenElement) {
      if (doc.exitFullscreen) await doc.exitFullscreen()
      else if (doc.webkitExitFullscreen) await doc.webkitExitFullscreen()
    }
  } catch {
    // Leaving the in-page takeover is what matters; ignore fullscreen errors.
  }
  usedNativeFullscreen = false
}

// Escape is wired independently of the Fullscreen API so the mode can never
// trap the user, even when native fullscreen was refused.
function handleCinemaKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && cinemaMode.value) void exitCinemaMode()
}

// Exiting fullscreen via a browser gesture must also leave cinema mode, but
// only when native fullscreen actually engaged.
function handleFullscreenChange() {
  if (usedNativeFullscreen && cinemaMode.value && !document.fullscreenElement) {
    void exitCinemaMode()
  }
}

async function togglePlayback() {
  if (!audioElement.value || !audioUrl.value) return
  if (audioElement.value.paused) {
    await playActiveTrack()
  } else {
    stopPlayback(false)
  }
}

async function playActiveTrack(restart = false) {
  if (!audioElement.value || !audioUrl.value) return
  if (restart) {
    audioElement.value.load()
    elapsed.value = 0
  }
  await audioElement.value.play()
  isPlaying.value = true
  startProgress()
}

function stopPlayback(resetElapsed = true) {
  audioElement.value?.pause()
  isPlaying.value = false
  if (progressTimer) clearInterval(progressTimer)
  if (resetElapsed) elapsed.value = 0
}

function startProgress() {
  if (progressTimer) clearInterval(progressTimer)
  progressTimer = setInterval(() => {
    elapsed.value = Math.floor(audioElement.value?.currentTime || 0)
  }, 500)
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error && 'data' in error) {
    const data = (error as { data?: { statusMessage?: string; message?: string } }).data
    return data?.statusMessage || data?.message || fallback
  }
  return fallback
}
</script>

<template>
  <main class="station-shell" :style="sceneStyle">
    <video
      v-if="sceneIsVideo"
      class="scene"
      :src="sceneUrl"
      autoplay
      muted
      loop
      playsinline
      preload="auto"
      aria-hidden="true"
      @loadeddata="handleSceneLoaded"
      @error="handleSceneError"
    />
    <img
      v-else
      class="scene"
      :src="sceneUrl"
      alt=""
      aria-hidden="true"
      @load="handleSceneLoaded"
      @error="handleSceneError"
    />
    <div class="scene-vignette" aria-hidden="true" />
    <div class="rain rain-near" aria-hidden="true" />
    <div class="rain rain-far" aria-hidden="true" />

    <header v-show="!cinemaMode" class="topbar">
      <a class="brand" href="#station" aria-label="Compile and Chill home">
        <span class="brand-mark" aria-hidden="true">
          <svg viewBox="0 0 36 36" role="img">
            <path d="M9 27V14a9 9 0 0 1 18 0v13l-4-3-5 4-5-4-4 3Z" />
            <circle cx="15" cy="15" r="1.5" />
            <circle cx="21" cy="15" r="1.5" />
          </svg>
        </span>
        <span>COMPILE <i>&amp;</i> CHILL</span>
      </a>

      <div class="broadcast-status">
        <span class="live-dot" />
        <span>STATION ONLINE</span>
        <span class="listeners">128 focusing</span>
      </div>

      <time class="station-clock">{{ currentTime }}</time>
    </header>

    <section v-show="!cinemaMode" id="station" class="broadcast-layout">
      <div class="hero-copy">
        <p class="eyebrow">{{ current.eyebrow }}</p>
        <h1>{{ current.track }}</h1>
        <p>{{ current.description }}</p>
      </div>

      <aside :class="['agent-card', { collapsed: !directorExpanded }]" aria-labelledby="director-heading">
        <button
          class="director-toggle"
          type="button"
          :aria-expanded="directorExpanded"
          aria-controls="station-director-controls"
          :aria-label="directorExpanded ? 'Minimize Station director' : 'Expand Station director'"
          @click="directorExpanded = !directorExpanded"
        >
          <span class="agent-orb" aria-hidden="true" />
          <span class="agent-heading">
            <span class="agent-kicker">STATION CONTROLS</span>
            <strong id="director-heading">Station director</strong>
            <span v-if="!directorExpanded" class="director-summary">
              {{ current.label }} · {{ library?.saved ? 'Cloud library saved' : 'No cloud assets saved' }}
            </span>
          </span>
          <span class="agent-state">READY</span>
          <svg class="director-chevron" viewBox="0 0 24 24" aria-hidden="true">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>

        <div v-show="directorExpanded" id="station-director-controls" class="director-content">
        <label for="direction">Creative direction</label>
        <textarea
          id="direction"
          v-model="direction"
          maxlength="500"
          rows="3"
          placeholder="Describe the mood for the next program block"
        />

        <div class="generate-actions">
          <button class="primary-action" :disabled="isGeneratingMusic || isGeneratingScene || Boolean(remoteGeneration)" @click="generateMusic">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M9 18V5l11-2v13" />
              <circle cx="6" cy="18" r="3" />
              <circle cx="17" cy="16" r="3" />
            </svg>
            {{ musicActionLabel }}
          </button>
          <button class="secondary-action" :disabled="isGeneratingMusic || isGeneratingScene || Boolean(remoteGeneration)" @click="openVisualSettings">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <circle cx="9" cy="10" r="2" />
              <path d="m4 17 5-4 4 3 3-2 4 3" />
            </svg>
            {{ isGeneratingScene ? 'Painting…' : 'Visual settings' }}
          </button>
        </div>

        <FocusBlockTimer />

        <div
          v-if="remoteGenerationStatus"
          class="remote-generation-status"
          role="status"
          aria-live="polite"
        >
          <span class="remote-generation-icon" aria-hidden="true">
            <svg v-if="remoteGenerationStatus.kind === 'music'" viewBox="0 0 24 24"><path d="M9 18V5l11-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="17" cy="16" r="3" /></svg>
            <svg v-else viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2" /><path d="m4 17 5-4 4 3 3-2 4 3" /></svg>
          </span>
          <span>
            <strong>STREAM DECK · {{ remoteGenerationStatus.kind === 'music' ? 'NEW TRACK' : 'RANDOM SCENE' }}</strong>
            <span>{{ remoteGenerationStatus.message }}</span>
            <small>{{ remoteGenerationStatus.detail }}</small>
          </span>
        </div>

        <p
          v-if="sceneStatusLabel && !remoteGeneration"
          :class="['generation-status', { complete: sceneState === 'ready' }]"
          role="status"
          aria-live="polite"
        >
          <span class="status-spinner" aria-hidden="true" />
          {{ sceneStatusLabel }}
        </p>

        <div class="service-grid">
          <div>
            <span :class="['service-light', { connected: config?.elevenLabsConfigured }]" />
            <strong>ElevenLabs</strong>
            <small>{{ config?.elevenLabsConfigured ? 'Connected' : 'Add API key' }}</small>
          </div>
          <div>
            <span :class="['service-light', { connected: config?.bedrockConfigured }]" />
            <strong>Stable Image Ultra</strong>
            <small>{{ config?.awsRegion || 'AWS profile needed' }}</small>
          </div>
        </div>

        <CloudLibraryPanel
          :library="library"
          :status="libraryStatus"
          @manage="libraryModalOpen = true"
        />

        <p v-if="errorMessage" class="error-message" role="alert">{{ errorMessage }}</p>
        </div>
      </aside>
    </section>

    <section v-show="!cinemaMode" class="player-dock" aria-label="Station player and mode controls">
      <div class="now-playing">
        <button
          class="play-button"
          :disabled="!audioUrl"
          :aria-label="isPlaying ? 'Pause generated track' : 'Play generated track'"
          @click="togglePlayback"
        >
          <svg v-if="!isPlaying" viewBox="0 0 24 24" aria-hidden="true">
            <path d="m9 7 8 5-8 5V7Z" />
          </svg>
          <svg v-else viewBox="0 0 24 24" aria-hidden="true">
            <path d="M8 7v10M16 7v10" />
          </svg>
        </button>

        <div class="track-meta">
          <span>{{ audioUrl ? (isPlaying ? 'NOW PLAYING' : 'READY TO PLAY') : 'NO TRACK GENERATED' }}</span>
          <strong>{{ audioUrl ? current.track : `${current.label} soundtrack not generated` }}</strong>
          <small>
            {{ audioUrl ? `Compile & Chill FM · ${current.label}` : 'Generate it once, then switch back anytime' }}
          </small>
        </div>

        <div class="waveform" :class="{ active: isPlaying }" aria-hidden="true">
          <i v-for="bar in 28" :key="bar" :style="{ '--bar': `${(bar * 7) % 19 + 5}px`, '--delay': `${bar * -42}ms` }" />
        </div>

        <span class="elapsed">{{ elapsedLabel }}</span>
        <button
          class="cinema-enter"
          type="button"
          aria-label="Enter fullscreen scene mode"
          @click="enterCinemaMode"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
          </svg>
          <span>Fullscreen</span>
        </button>
        <audio ref="audioElement" loop :src="audioUrl || undefined" />
      </div>

      <div class="mode-switcher" role="group" aria-label="Station mode">
        <button
          v-for="(preset, key) in presets"
          :key="key"
          :class="{ active: mode === key }"
          @click="setMode(key as StationMode)"
        >
          <span class="mode-icon" aria-hidden="true" />
          <span>
            <strong>{{ preset.label }}</strong>
            <small>
              {{ preset.description }}{{ modeReadiness[key as StationMode] }}
            </small>
          </span>
        </button>
      </div>
    </section>

    <div
      v-if="cinemaMode"
      :class="['cinema-layer', { idle: !cinemaControlsVisible }]"
      @mousemove="revealCinemaControls"
      @touchstart.passive="revealCinemaControls"
      @click="revealCinemaControls"
    >
      <div :class="['cinema-bar', { hidden: !cinemaControlsVisible }]">
        <button
          class="cinema-play"
          type="button"
          :disabled="!audioUrl"
          :aria-label="isPlaying ? 'Pause generated track' : 'Play generated track'"
          @click.stop="togglePlayback"
        >
          <svg v-if="!isPlaying" viewBox="0 0 24 24" aria-hidden="true">
            <path d="m9 7 8 5-8 5V7Z" />
          </svg>
          <svg v-else viewBox="0 0 24 24" aria-hidden="true">
            <path d="M8 7v10M16 7v10" />
          </svg>
        </button>

        <span class="cinema-track">
          <strong>{{ audioUrl ? current.track : `${current.label} soundtrack not generated` }}</strong>
          <small>{{ current.label }}</small>
        </span>

        <span class="cinema-elapsed">{{ elapsedLabel }}</span>

        <button
          class="cinema-exit"
          type="button"
          aria-label="Exit fullscreen scene mode"
          @click.stop="exitCinemaMode"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m6 6 12 12M18 6 6 18" />
          </svg>
        </button>
      </div>
    </div>

    <StationLibraryModal
      v-if="libraryModalOpen"
      :library="library"
      :is-deleting="isDeletingStation"
      @close="libraryModalOpen = false"
      @clear-browser="clearBrowserLibrary"
      @request-delete="deleteStationOpen = true"
    />

    <DeleteSavedStationModal
      v-if="deleteStationOpen"
      :is-deleting="isDeletingStation"
      @cancel="deleteStationOpen = false"
      @confirm="permanentlyDeleteLibrary"
    />

    <VisualSettingsModal
      v-if="visualSettingsOpen"
      :mode-label="current.label"
      :accent="current.accent"
      :initial-visual-style="selectedVisualStyle"
      :initial-scene-type="selectedSceneType"
      :initial-developer="selectedDeveloper"
      :has-cached-scene="Boolean(currentScene)"
      :is-generating="isGeneratingScene"
      :generation-progress="animatedGenerationProgress"
      :elapsed-seconds="sceneGenerationSeconds"
      @close="closeVisualSettings"
      @generate="handleVisualGeneration"
    />
  </main>
</template>
