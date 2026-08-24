export const stationModes = {
  deepWork: {
    label: 'Deep work',
    subtitle: 'Quiet momentum',
    bpm: 72,
    accent: '#6fb5ff',
    ambience: 'Soft rain on a high-rise window and a distant city at night',
    music:
      'warm Rhodes piano, muted boom-bap drums, rounded analog bass, subtle vinyl texture',
  },
  rainyDebug: {
    label: 'Rainy debug',
    subtitle: 'Errors become atmosphere',
    bpm: 68,
    accent: '#a98cff',
    ambience: 'Steady nighttime rain, occasional distant thunder, quiet mechanical keyboard',
    music:
      'minor seventh chords, restrained glitch details, brushed drums, soft sub bass',
  },
  testsPassing: {
    label: 'Tests passing',
    subtitle: 'Everything is green',
    bpm: 82,
    accent: '#78e6b0',
    ambience: 'Light rain easing outside a bright studio with a soft success chime',
    music:
      'bright electric piano, crisp relaxed drums, melodic bass, gentle synth sparkles',
  },
} as const

export type StationMode = keyof typeof stationModes
export type SceneVisualStyle = 'illustrated' | 'realistic'
export type DeveloperPresentation = 'woman' | 'man'

export const isStationMode = (value: unknown): value is StationMode =>
  typeof value === 'string' && value in stationModes

export const isSceneVisualStyle = (value: unknown): value is SceneVisualStyle =>
  value === 'illustrated' || value === 'realistic'

export const isDeveloperPresentation = (value: unknown): value is DeveloperPresentation =>
  value === 'woman' || value === 'man'

export function chooseRandomSceneOptions(random = Math.random): {
  visualStyle: SceneVisualStyle
  developer: DeveloperPresentation
  seed: number
} {
  return {
    // Stream Deck randomization is a STATIC scene, and static scenes are
    // realistic — illustrated belongs to the animated loop path only.
    visualStyle: 'realistic',
    developer: random() < 0.5 ? 'woman' : 'man',
    seed: Math.floor(random() * 4_294_967_295),
  }
}

export function buildMusicPrompt(mode: StationMode, direction?: string) {
  const preset = stationModes[mode]
  const custom = direction?.trim()
    ? `Primary creative direction: ${direction.trim().slice(0, 500)}. Treat these details as required while keeping the result instrumental and focus-friendly.`
    : ''

  return [
    `Create an original instrumental lo-fi focus track at ${preset.bpm} BPM.`,
    custom,
    `Mode foundation: ${preset.music}.`,
    'It must be a seamless repeating loop: no intro-only pickup, no ending cadence, no fade-out, and first and final beats that interlock musically. Keep stable energy, no vocals, no dramatic drops, and no piercing frequencies.',
    'Do not imitate or mention any artist, song, franchise, or existing lo-fi channel.',
  ]
    .filter(Boolean)
    .join(' ')
}

export const diverseAdultAppearances = [
  'deep brown skin, close-cropped coily hair, warm brown eyes, and a confident relaxed expression',
  'medium brown skin, long dark wavy hair, an oval face, and thoughtful eyes',
  'light freckled skin, soft auburn curls, and bright observant eyes',
  'olive skin, thick black curls, strong brows, and a calm focused expression',
  'medium tan skin, straight dark hair, a softly rounded face, and attentive eyes',
  'light skin, textured brown hair, a square jaw, and kind alert eyes',
] as const

export function getDiverseAdultAppearance(seed: number) {
  return diverseAdultAppearances[Math.abs(Math.floor(seed)) % diverseAdultAppearances.length]
}

export function buildScenePrompt(
  mode: StationMode,
  direction?: string,
  options: {
    visualStyle?: SceneVisualStyle
    developer?: DeveloperPresentation
    diversitySeed?: number
  } = {},
) {
  const preset = stationModes[mode]
  const visualStyle = options.visualStyle ?? 'illustrated'
  const developer = options.developer ?? 'woman'
  const diverseAppearance = getDiverseAdultAppearance(options.diversitySeed ?? 0)
  const custom = direction?.trim()
    ? `Top-priority custom art direction: ${direction.trim().slice(0, 500)}. You MUST make these details visibly present in the final image; do not silently replace them with generic alternatives.`
    : ''
  const styleDirection = visualStyle === 'illustrated'
    ? 'Use bold, charming 2D cartoon animation artwork with clean rounded linework, simplified facial anatomy, expressive features, graphic shapes, strong color blocks, flat cel shading, and visible illustrated brush/vector texture. It must read instantly as a hand-drawn fictional cartoon character — never a photograph, never a real identifiable person, never photorealistic skin or hyperrealistic detail, never a 3D render.'
    : 'Use polished cinematic realism with natural skin texture, physically plausible materials, restrained color grading, and crisp photographic detail.'

  return [
    `Create original, crisp, highly detailed cinematic 16:9 artwork of an adult ${developer} software developer who is clearly 25 to 40 years old, in a cozy observatory studio at night.`,
    custom,
    styleDirection,
    `Diversity direction: portray this adult character with ${diverseAppearance}. Across generations, vary adult skin tones, facial features, and hair textures/styles deliberately and respectfully; do not add cultural costumes, assumptions, or stereotypes.`,
    "Use a medium-wide three-quarter front composition from slightly to one side at eye level. The developer's face is clearly visible near the upper center of the frame, naturally proportioned, unobstructed, and in sharp focus as they turn slightly from one monitor toward the camera; keep hair swept away from the eyes.",
    'Arrange multiple monitors with abstract terminal interfaces around the developer without blocking the face. Include a mechanical keyboard, coffee, and a small friendly ghost-shaped coding assistant.',
    `The atmosphere is ${preset.ambience}.`,
    'Deep blue exterior light and warm amber desk light, detailed rain-covered window, futuristic city, calm concentration-friendly mood, and open negative space on the left for broadcast text.',
    'Render crisp facial features and clean edges across the developer and desk, with controlled cinematic lighting, minimal bloom, and no artificial depth-of-field blur or atmospheric haze over the face.',
    'No logos, readable words, watermarks, copyrighted characters, recognizable existing compositions, school uniform, or imitation of an existing lo-fi channel.',
  ]
    .filter(Boolean)
    .join(' ')
}
