import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectVersionsCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import type { H3Event } from 'h3'
import type {
  DeveloperPresentation,
  SceneVisualStyle,
  StationMode,
} from './station'
import { isStationMode, stationModes } from './station'

const stationCookieName = 'compile_and_chill_station'
const stationIdPattern = /^[a-f0-9]{32}$/
const manifestKey = 'manifest.json'

export type StationAssetKind = 'scene' | 'music'

export interface StoredScene {
  key: string
  contentType: 'image/png' | 'video/mp4'
  createdAt: string
  visualStyle: SceneVisualStyle
  developer: DeveloperPresentation
}

export interface StoredMusic {
  key: string
  contentType: 'audio/mpeg'
  createdAt: string
}

export interface StoredModeAssets {
  direction?: string
  scene?: StoredScene
  music?: StoredMusic
}

export interface StationManifest {
  version: 1
  stationId: string
  createdAt: string
  updatedAt: string
  modes: Record<StationMode, StoredModeAssets>
}

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

interface StationStorageConfig {
  bucket: string
  region: string
}

const s3Clients = new Map<string, S3Client>()

function emptyModes(): Record<StationMode, StoredModeAssets> {
  return {
    deepWork: {},
    rainyDebug: {},
    testsPassing: {},
  }
}

function emptyLibraryModes(): StationLibrarySummary['modes'] {
  return {
    deepWork: {},
    rainyDebug: {},
    testsPassing: {},
  }
}

export function isPrivateStationId(value: unknown): value is string {
  return typeof value === 'string' && stationIdPattern.test(value)
}

export function createStationManifest(stationId: string, now = new Date().toISOString()): StationManifest {
  if (!isPrivateStationId(stationId)) {
    throw new Error('Station identifier is invalid.')
  }

  return {
    version: 1,
    stationId,
    createdAt: now,
    updatedAt: now,
    modes: emptyModes(),
  }
}

export function stationPrefix(stationId: string) {
  if (!isPrivateStationId(stationId)) {
    throw new Error('Station identifier is invalid.')
  }

  return `stations/${stationId}`
}

export function stationManifestKey(stationId: string) {
  return `${stationPrefix(stationId)}/${manifestKey}`
}

export function stationAssetKey(stationId: string, mode: StationMode, kind: StationAssetKind) {
  return `${stationPrefix(stationId)}/${mode}/${kind === 'scene' ? 'scene.png' : 'music.mp3'}`
}

export async function saveGeneratedAnimationSourceForStation(
  stationId: string,
  input: { mode: StationMode; bytes: Uint8Array },
) {
  const settings = assertStorageConfig()
  const key = `${stationPrefix(stationId)}/${input.mode}/animation-source-${crypto.randomUUID()}.png`

  await getS3Client(settings.region).send(
    new PutObjectCommand({
      Bucket: settings.bucket,
      Key: key,
      Body: input.bytes,
      ContentType: 'image/png',
      CacheControl: 'private, no-store',
      ServerSideEncryption: 'AES256',
    }),
  )

  return { key }
}

export async function createPrivateStationAssetReadUrl(stationId: string, key: string) {
  const settings = assertStorageConfig()
  const prefix = `${stationPrefix(stationId)}/`
  if (!key.startsWith(prefix)) throw new Error('Station asset key is invalid.')

  return getSignedUrl(
    getS3Client(settings.region),
    new GetObjectCommand({ Bucket: settings.bucket, Key: key }),
    { expiresIn: 300 },
  )
}

export async function deletePrivateStationAsset(stationId: string, key: string) {
  const settings = assertStorageConfig()
  const prefix = `${stationPrefix(stationId)}/`
  if (!key.startsWith(prefix)) throw new Error('Station asset key is invalid.')

  await getS3Client(settings.region).send(
    new DeleteObjectCommand({ Bucket: settings.bucket, Key: key }),
  )
}

function getStorageConfig(): StationStorageConfig | null {
  const config = useRuntimeConfig()
  const bucket = String(config.stationStorageBucket || '').trim()
  const region = String(config.stationStorageRegion || '').trim()

  return bucket && region ? { bucket, region } : null
}

export function isStationStorageConfigured() {
  return getStorageConfig() !== null
}

function getS3Client(region: string) {
  const existing = s3Clients.get(region)
  if (existing) return existing

  const client = new S3Client({ region, maxAttempts: 3 })
  s3Clients.set(region, client)
  return client
}

function isMissingObject(error: unknown) {
  if (!error || typeof error !== 'object') return false
  const serviceError = error as { name?: string; $metadata?: { httpStatusCode?: number } }
  return serviceError.name === 'NoSuchKey' || serviceError.name === 'NotFound' || serviceError.$metadata?.httpStatusCode === 404
}

function assertStorageConfig(): StationStorageConfig {
  const settings = getStorageConfig()
  if (!settings) {
    throw createError({
      statusCode: 503,
      statusMessage: 'Private cloud storage is not configured on this server.',
    })
  }
  return settings
}

function getStationId(event: H3Event) {
  const stationId = getCookie(event, stationCookieName)
  return isPrivateStationId(stationId) ? stationId : null
}

export function getPrivateStationId(event: H3Event) {
  return getStationId(event)
}

function cookieOptions() {
  return {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 365,
    path: '/',
    sameSite: 'strict' as const,
    secure: process.env.NODE_ENV === 'production',
  }
}

export function getOrCreatePrivateStationId(event: H3Event) {
  const existing = getStationId(event)
  if (existing) return existing

  const stationId = crypto.randomUUID().replaceAll('-', '')
  setCookie(event, stationCookieName, stationId, cookieOptions())
  return stationId
}

export async function registerActivePrivateStation(event: H3Event) {
  const stationId = getOrCreatePrivateStationId(event)
  await useStorage('data').setItem('compile-and-chill:active-station-id', stationId)
  return stationId
}

export async function getActivePrivateStationId() {
  const stationId = await useStorage('data').getItem('compile-and-chill:active-station-id')
  return isPrivateStationId(stationId) ? stationId : null
}

export function clearPrivateStationId(event: H3Event) {
  deleteCookie(event, stationCookieName, { path: '/', sameSite: 'strict', secure: process.env.NODE_ENV === 'production' })
}

async function readManifest(settings: StationStorageConfig, stationId: string) {
  try {
    const response = await getS3Client(settings.region).send(
      new GetObjectCommand({
        Bucket: settings.bucket,
        Key: stationManifestKey(stationId),
      }),
    )
    const contents = await response.Body?.transformToString()
    if (!contents) throw new Error('Saved station manifest was empty.')
    const manifest = JSON.parse(contents) as StationManifest

    if (
      manifest.version !== 1 ||
      manifest.stationId !== stationId ||
      !manifest.modes ||
      !Object.keys(stationModes).every((mode) => mode in manifest.modes)
    ) {
      throw new Error('Saved station manifest was invalid.')
    }

    return manifest
  } catch (error) {
    if (isMissingObject(error)) return null
    throw error
  }
}

async function writeManifest(settings: StationStorageConfig, manifest: StationManifest) {
  await getS3Client(settings.region).send(
    new PutObjectCommand({
      Bucket: settings.bucket,
      Key: stationManifestKey(manifest.stationId),
      Body: JSON.stringify(manifest),
      ContentType: 'application/json',
      CacheControl: 'private, no-store',
      ServerSideEncryption: 'AES256',
    }),
  )
}

async function updateManifest(
  settings: StationStorageConfig,
  stationId: string,
  update: (manifest: StationManifest) => void,
) {
  const manifest = (await readManifest(settings, stationId)) ?? createStationManifest(stationId)
  update(manifest)
  manifest.updatedAt = new Date().toISOString()
  await writeManifest(settings, manifest)
  return manifest
}

export async function saveGeneratedScene(
  event: H3Event,
  input: {
    mode: StationMode
    direction?: string
    bytes: Uint8Array
    visualStyle: SceneVisualStyle
    developer: DeveloperPresentation
  },
) {
  return saveGeneratedSceneForStation(getOrCreatePrivateStationId(event), input)
}

export async function saveGeneratedSceneForStation(
  stationId: string,
  input: {
    mode: StationMode
    direction?: string
    bytes: Uint8Array
    visualStyle: SceneVisualStyle
    developer: DeveloperPresentation
  },
) {
  const settings = assertStorageConfig()
  const key = stationAssetKey(stationId, input.mode, 'scene')
  const createdAt = new Date().toISOString()

  await getS3Client(settings.region).send(
    new PutObjectCommand({
      Bucket: settings.bucket,
      Key: key,
      Body: input.bytes,
      ContentType: 'image/png',
      CacheControl: 'private, max-age=300',
      ServerSideEncryption: 'AES256',
    }),
  )

  const manifest = await updateManifest(settings, stationId, (current) => {
    current.modes[input.mode].direction = input.direction?.slice(0, 500)
    current.modes[input.mode].scene = {
      key,
      contentType: 'image/png',
      createdAt,
      visualStyle: input.visualStyle,
      developer: input.developer,
    }
  })

  return manifest.modes[input.mode].scene!
}

export async function saveGeneratedAnimatedSceneForStation(
  stationId: string,
  input: {
    mode: StationMode
    direction?: string
    bytes: Uint8Array
    visualStyle: SceneVisualStyle
    developer: DeveloperPresentation
  },
) {
  const settings = assertStorageConfig()
  const key = `${stationPrefix(stationId)}/${input.mode}/scene.mp4`
  const createdAt = new Date().toISOString()

  await getS3Client(settings.region).send(
    new PutObjectCommand({
      Bucket: settings.bucket,
      Key: key,
      Body: input.bytes,
      ContentType: 'video/mp4',
      CacheControl: 'private, max-age=300',
      ServerSideEncryption: 'AES256',
    }),
  )

  const manifest = await updateManifest(settings, stationId, (current) => {
    current.modes[input.mode].direction = input.direction?.slice(0, 500)
    current.modes[input.mode].scene = {
      key,
      contentType: 'video/mp4',
      createdAt,
      visualStyle: input.visualStyle,
      developer: input.developer,
    }
  })

  return manifest.modes[input.mode].scene!
}

export async function saveGeneratedMusic(
  event: H3Event,
  input: { mode: StationMode; direction?: string; bytes: Uint8Array },
) {
  return saveGeneratedMusicForStation(getOrCreatePrivateStationId(event), input)
}

export async function saveGeneratedMusicForStation(
  stationId: string,
  input: { mode: StationMode; direction?: string; bytes: Uint8Array },
) {
  const settings = assertStorageConfig()
  const key = stationAssetKey(stationId, input.mode, 'music')
  const createdAt = new Date().toISOString()

  await getS3Client(settings.region).send(
    new PutObjectCommand({
      Bucket: settings.bucket,
      Key: key,
      Body: input.bytes,
      ContentType: 'audio/mpeg',
      CacheControl: 'private, max-age=300',
      ServerSideEncryption: 'AES256',
    }),
  )

  const manifest = await updateManifest(settings, stationId, (current) => {
    current.modes[input.mode].direction = input.direction?.slice(0, 500)
    current.modes[input.mode].music = {
      key,
      contentType: 'audio/mpeg',
      createdAt,
    }
  })

  return manifest.modes[input.mode].music!
}

function assetUrl(mode: StationMode, kind: StationAssetKind, createdAt: string) {
  return `/api/library/assets/${mode}/${kind}?v=${encodeURIComponent(createdAt)}`
}

function asLibrarySummary(manifest: StationManifest): StationLibrarySummary {
  const modes = emptyLibraryModes()
  for (const mode of Object.keys(stationModes) as StationMode[]) {
    const assets = manifest.modes[mode]
    if (assets.scene) {
      modes[mode].scene = {
        url: assetUrl(mode, 'scene', assets.scene.createdAt),
        contentType: assets.scene.contentType,
        createdAt: assets.scene.createdAt,
        visualStyle: assets.scene.visualStyle,
        developer: assets.scene.developer,
      }
    }
    if (assets.music) {
      modes[mode].music = {
        url: assetUrl(mode, 'music', assets.music.createdAt),
        createdAt: assets.music.createdAt,
      }
    }
  }

  return { enabled: true, saved: true, updatedAt: manifest.updatedAt, modes }
}

export async function getStationLibrarySummary(event: H3Event): Promise<StationLibrarySummary> {
  const settings = getStorageConfig()
  if (!settings) return { enabled: false, saved: false, modes: emptyLibraryModes() }

  const stationId = getStationId(event)
  if (!stationId) return { enabled: true, saved: false, modes: emptyLibraryModes() }

  const manifest = await readManifest(settings, stationId)
  return manifest ? asLibrarySummary(manifest) : { enabled: true, saved: false, modes: emptyLibraryModes() }
}

export async function getPrivateStationAsset(
  event: H3Event,
  mode: unknown,
  kind: unknown,
) {
  if (!isStationMode(mode) || (kind !== 'scene' && kind !== 'music')) {
    throw createError({ statusCode: 404, statusMessage: 'Saved asset was not found.' })
  }

  const settings = assertStorageConfig()
  const stationId = getStationId(event)
  if (!stationId) throw createError({ statusCode: 404, statusMessage: 'Saved asset was not found.' })

  const manifest = await readManifest(settings, stationId)
  const asset = manifest?.modes[mode][kind]
  if (!asset) throw createError({ statusCode: 404, statusMessage: 'Saved asset was not found.' })

  const response = await getS3Client(settings.region).send(
    new GetObjectCommand({ Bucket: settings.bucket, Key: asset.key }),
  )
  const bytes = await response.Body?.transformToByteArray()
  if (!bytes) throw createError({ statusCode: 404, statusMessage: 'Saved asset was empty.' })

  return { bytes, contentType: asset.contentType }
}

export async function deleteSavedPrivateStation(event: H3Event) {
  const settings = assertStorageConfig()
  const stationId = getStationId(event)
  if (!stationId) return { deleted: false }

  const client = getS3Client(settings.region)
  const prefix = `${stationPrefix(stationId)}/`
  let keyMarker: string | undefined
  let versionIdMarker: string | undefined

  do {
    const page = await client.send(new ListObjectVersionsCommand({
      Bucket: settings.bucket,
      Prefix: prefix,
      KeyMarker: keyMarker,
      VersionIdMarker: versionIdMarker,
    }))
    const objects = [...(page.Versions ?? []), ...(page.DeleteMarkers ?? [])]
      .flatMap((entry) => entry.Key ? [{ Key: entry.Key, VersionId: entry.VersionId }] : [])

    if (objects.length) {
      await client.send(
        new DeleteObjectsCommand({
          Bucket: settings.bucket,
          Delete: { Objects: objects, Quiet: true },
        }),
      )
    }

    keyMarker = page.IsTruncated ? page.NextKeyMarker : undefined
    versionIdMarker = page.IsTruncated ? page.NextVersionIdMarker : undefined
  } while (keyMarker)

  clearPrivateStationId(event)
  return { deleted: true }
}
