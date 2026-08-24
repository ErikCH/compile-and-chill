import { shallowRef } from 'vue'

type StationMode = 'deepWork' | 'rainyDebug' | 'testsPassing'
type SceneVisualStyle = 'illustrated' | 'realistic'
type DeveloperPresentation = 'woman' | 'man'

export interface LibraryAsset {
  url: string
  contentType?: 'image/png' | 'video/mp4' | 'audio/mpeg'
  createdAt: string
  visualStyle?: SceneVisualStyle
  developer?: DeveloperPresentation
}

export interface StationLibrarySummary {
  enabled: boolean
  saved: boolean
  updatedAt?: string
  modes: Record<StationMode, { scene?: LibraryAsset; music?: LibraryAsset }>
}

interface RestoreHandlers {
  onScene: (mode: StationMode, asset: LibraryAsset) => Promise<void>
  onMusic: (mode: StationMode, asset: LibraryAsset) => Promise<void>
}

export function useStationLibrary() {
  const library = shallowRef<StationLibrarySummary | null>(null)
  const status = shallowRef<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const errorMessage = shallowRef('')
  const isDeleting = shallowRef(false)

  async function refresh() {
    status.value = 'loading'
    errorMessage.value = ''
    try {
      library.value = await $fetch<StationLibrarySummary>('/api/library')
      status.value = 'ready'
      return library.value
    } catch (error) {
      status.value = 'error'
      errorMessage.value = error instanceof Error ? error.message : 'Could not reach the private cloud library.'
      throw error
    }
  }

  async function restore(handlers: RestoreHandlers) {
    const nextLibrary = await refresh()
    if (!nextLibrary.enabled || !nextLibrary.saved) return nextLibrary

    const operations: Promise<void>[] = []
    for (const [mode, assets] of Object.entries(nextLibrary.modes) as Array<[StationMode, StationLibrarySummary['modes'][StationMode]]>) {
      if (assets.scene) operations.push(handlers.onScene(mode, assets.scene))
      if (assets.music) operations.push(handlers.onMusic(mode, assets.music))
    }
    await Promise.all(operations)
    return nextLibrary
  }

  async function clearThisBrowser() {
    await $fetch('/api/library/reset', { method: 'POST' })
    library.value = await $fetch<StationLibrarySummary>('/api/library')
    status.value = 'ready'
  }

  async function deleteSavedStation() {
    isDeleting.value = true
    try {
      await $fetch('/api/library/delete', {
        method: 'POST',
        body: { confirmation: 'DELETE' },
      })
      library.value = await $fetch<StationLibrarySummary>('/api/library')
      status.value = 'ready'
    } finally {
      isDeleting.value = false
    }
  }

  return {
    library,
    status,
    errorMessage,
    isDeleting,
    refresh,
    restore,
    clearThisBrowser,
    deleteSavedStation,
  }
}
