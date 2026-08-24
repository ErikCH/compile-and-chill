import { isStationMode, stationModes } from './station'
import type { StationMode } from './station'

const stationStateKey = 'compile-and-chill:station'

export type StationAssetUpdateKind = 'scene' | 'music'

export interface StationState {
  mode: StationMode
  label: string
  changedAt: string
  assetsChangedAt?: string
  assetsChangedKind?: StationAssetUpdateKind
  assetsChangedMode?: StationMode
  generationStartedAt?: string
  generationKind?: StationAssetUpdateKind
  generationMode?: StationMode
}

export function createStationState(
  mode: StationMode,
  changedAt = new Date().toISOString(),
): StationState {
  return {
    mode,
    label: stationModes[mode].label,
    changedAt,
  }
}

function isStationState(value: unknown): value is StationState {
  return Boolean(
    value &&
    typeof value === 'object' &&
    isStationMode((value as StationState).mode) &&
    typeof (value as StationState).changedAt === 'string',
  )
}

function updateMetadata(state: StationState) {
  const assetUpdate = state.assetsChangedAt && state.assetsChangedKind && state.assetsChangedMode
    ? {
        assetsChangedAt: state.assetsChangedAt,
        assetsChangedKind: state.assetsChangedKind,
        assetsChangedMode: state.assetsChangedMode,
      }
    : {}
  const generation = state.generationStartedAt && state.generationKind && state.generationMode
    ? {
        generationStartedAt: state.generationStartedAt,
        generationKind: state.generationKind,
        generationMode: state.generationMode,
      }
    : {}
  return { ...assetUpdate, ...generation }
}

function withoutGeneration(state: StationState) {
  const { generationStartedAt, generationKind, generationMode, ...station } = state
  return station
}

export async function getStationState() {
  const stored = await useStorage('data').getItem(stationStateKey)
  return isStationState(stored) ? stored : createStationState('rainyDebug')
}

export async function setStationState(mode: StationMode) {
  const previous = await getStationState()
  const state = { ...createStationState(mode), ...updateMetadata(previous) }
  await useStorage('data').setItem(stationStateKey, state)
  return state
}

export async function markStationGenerationStarted(
  generationKind: StationAssetUpdateKind,
  generationMode: StationMode,
) {
  const state = await getStationState()
  const updated = {
    ...state,
    generationStartedAt: new Date().toISOString(),
    generationKind,
    generationMode,
  }
  await useStorage('data').setItem(stationStateKey, updated)
  return updated
}

export async function clearStationGeneration() {
  const state = await getStationState()
  const updated = withoutGeneration(state)
  await useStorage('data').setItem(stationStateKey, updated)
  return updated
}

export async function markStationAssetsUpdated(
  assetsChangedKind: StationAssetUpdateKind,
  assetsChangedMode: StationMode,
) {
  const state = await getStationState()
  const updated = {
    ...withoutGeneration(state),
    assetsChangedAt: new Date().toISOString(),
    assetsChangedKind,
    assetsChangedMode,
  }
  await useStorage('data').setItem(stationStateKey, updated)
  return updated
}
