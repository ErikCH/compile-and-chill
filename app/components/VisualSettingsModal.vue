<script setup lang="ts">
type SceneVisualStyle = 'illustrated' | 'realistic'
type SceneGenerationType = 'static' | 'animated'
type DeveloperPresentation = 'woman' | 'man'

const props = defineProps<{
  modeLabel: string
  accent: string
  initialVisualStyle: SceneVisualStyle
  initialSceneType: SceneGenerationType
  initialDeveloper: DeveloperPresentation
  hasCachedScene: boolean
  isGenerating: boolean
  generationProgress: {
    state: 'running' | 'completed' | 'failed'
    phase: string
    label: string
    detail: string
    error?: string
  } | null
  elapsedSeconds: number
}>()

const emit = defineEmits<{
  close: []
  generate: [options: {
    visualStyle: SceneVisualStyle
    sceneType: SceneGenerationType
    developer: DeveloperPresentation
  }]
}>()

const visualStyle = shallowRef<SceneVisualStyle>(props.initialVisualStyle)
const sceneType = shallowRef<SceneGenerationType>(props.initialSceneType)
const developer = shallowRef<DeveloperPresentation>(props.initialDeveloper)
const closeButton = useTemplateRef<HTMLButtonElement>('closeButton')
const phaseOrder = [
  'creating_anchor',
  'preparing_source',
  'submitting_to_seedance',
  'generating_loop',
  'downloading_loop',
  'saving_loop',
] as const
const phaseLabels: Record<string, string> = {
  creating_anchor: 'Create illustrated anchor',
  preparing_source: 'Prepare private source',
  submitting_to_seedance: 'Submit to Seedance',
  generating_loop: 'Generate six-second loop',
  downloading_loop: 'Download completed MP4',
  saving_loop: 'Save to private library',
}
const elapsedLabel = computed(() => {
  const minutes = Math.floor(props.elapsedSeconds / 60)
  const seconds = props.elapsedSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
})
const activePhaseIndex = computed(() => props.generationProgress
  ? phaseOrder.indexOf(props.generationProgress.phase as typeof phaseOrder[number])
  : -1)

function requestClose() {
  if (!props.isGenerating) emit('close')
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') requestClose()
}

function chooseSceneType(nextType: SceneGenerationType) {
  sceneType.value = nextType
  visualStyle.value = nextType === 'animated' ? 'illustrated' : 'realistic'
}

function submit() {
  if (props.isGenerating) return
  emit('generate', {
    visualStyle: visualStyle.value,
    sceneType: sceneType.value,
    developer: developer.value,
  })
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
  closeButton.value?.focus()
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <Teleport to="body">
    <div
      class="visual-modal-backdrop"
      :style="{ '--modal-accent': accent }"
      @click.self="requestClose"
    >
      <section
        class="visual-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="visual-modal-title"
        aria-describedby="visual-modal-description"
      >
        <header class="visual-modal-header">
          <div>
            <p>SCENE DIRECTOR</p>
            <h2 id="visual-modal-title">Visual settings</h2>
          </div>
          <button ref="closeButton" class="modal-close" type="button" :disabled="isGenerating" :aria-label="isGenerating ? 'Animated generation in progress' : 'Close visual settings'" @click="requestClose">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
          </button>
        </header>

        <template v-if="generationProgress">
          <p id="visual-modal-description" class="visual-modal-description">
            {{ generationProgress.state === 'completed'
              ? 'Your illustrated animated scene is now live.'
              : generationProgress.state === 'failed'
                ? 'The animated scene could not be completed. No hidden retry will be started.'
                : 'Keep this window open while the private animated scene is created.' }}
          </p>

          <section class="generation-progress" role="status" aria-live="polite">
            <div class="generation-progress-heading">
              <span>
                <small>{{ generationProgress.state === 'running' ? 'ANIMATED LOOP IN PROGRESS' : generationProgress.state.toUpperCase() }}</small>
                <strong>{{ generationProgress.state === 'failed' ? 'Generation stopped' : generationProgress.label }}</strong>
              </span>
              <time>{{ elapsedLabel }}</time>
            </div>
            <p>{{ generationProgress.state === 'failed' ? generationProgress.error : generationProgress.detail }}</p>
            <ol class="generation-steps">
              <li
                v-for="(phase, index) in phaseOrder"
                :key="phase"
                :class="{
                  done: generationProgress.state === 'completed' || index < activePhaseIndex,
                  active: generationProgress.state === 'running' && index === activePhaseIndex,
                  failed: generationProgress.state === 'failed' && index === activePhaseIndex,
                }"
              >
                <span aria-hidden="true" />
                {{ phaseLabels[phase] }}
              </li>
            </ol>
          </section>

          <footer class="visual-modal-actions progress-actions">
            <button v-if="isGenerating" type="button" class="generate-visual-action" disabled>
              Generation locked · {{ elapsedLabel }}
            </button>
            <button v-else type="button" class="generate-visual-action" @click="requestClose">
              {{ generationProgress.state === 'completed' ? 'Done' : 'Close and review' }}
            </button>
          </footer>
        </template>

        <template v-else>
          <p id="visual-modal-description" class="visual-modal-description">
            Choose a new {{ modeLabel }} scene. Static scenes are realistic; animated scenes are illustrated and loop seamlessly.
          </p>

          <fieldset>
            <legend>Scene type</legend>
            <div class="visual-options">
              <button
                type="button"
                :class="{ selected: sceneType === 'static' }"
                :aria-pressed="sceneType === 'static'"
                @click="chooseSceneType('static')"
              >
                <strong>Realistic static</strong>
                <small>Stable Image Ultra · crisp cinematic still</small>
              </button>
              <button
                type="button"
                :class="{ selected: sceneType === 'animated' }"
                :aria-pressed="sceneType === 'animated'"
                @click="chooseSceneType('animated')"
              >
                <strong>Illustrated animated</strong>
                <small>Private 6-second Seedance typing loop</small>
              </button>
            </div>
          </fieldset>

          <p v-if="sceneType === 'animated'" class="replace-note">
            The illustration anchors both ends of the loop. Generating uses OpenRouter credits and keeps source URLs private.
          </p>

          <fieldset>
            <legend>Character</legend>
            <div class="visual-options compact">
              <button
                type="button"
                :class="{ selected: developer === 'woman' }"
                :aria-pressed="developer === 'woman'"
                @click="developer = 'woman'"
              >
                <strong>Woman</strong>
              </button>
              <button
                type="button"
                :class="{ selected: developer === 'man' }"
                :aria-pressed="developer === 'man'"
                @click="developer = 'man'"
              >
                <strong>Man</strong>
              </button>
            </div>
          </fieldset>

          <p v-if="hasCachedScene" class="replace-note">The current {{ modeLabel }} scene will be replaced.</p>

          <footer class="visual-modal-actions">
            <button type="button" class="cancel-action" :disabled="isGenerating" @click="requestClose">Cancel</button>
            <button type="button" class="generate-visual-action" :disabled="isGenerating" @click="submit">
              {{ isGenerating
                ? 'Generation in progress…'
                : sceneType === 'animated' ? 'Generate animated loop — uses credits' : `Generate for ${modeLabel}` }}
            </button>
          </footer>
        </template>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.visual-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(3, 5, 13, 0.76);
  backdrop-filter: blur(12px);
}

.visual-modal {
  width: min(100%, 520px);
  max-height: calc(100vh - 40px);
  overflow-y: auto;
  padding: 24px;
  border: 1px solid color-mix(in srgb, var(--modal-accent), transparent 62%);
  border-radius: 22px;
  background: var(--panel-strong);
  color: var(--ink);
  box-shadow: 0 30px 90px rgba(0, 0, 0, 0.62), 0 0 50px color-mix(in srgb, var(--modal-accent), transparent 84%);
}

.visual-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
}

.visual-modal-header p,
.visual-modal legend {
  margin: 0;
  color: var(--muted);
  font-family: 'DM Mono', monospace;
  font-size: 9px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.visual-modal-header h2 { margin: 4px 0 0; font-size: 22px; }
.visual-modal-description { margin: 16px 0 20px; color: #d0ccdd; font-size: 12px; line-height: 1.55; }

.modal-close {
  width: 36px;
  height: 36px;
  display: grid;
  place-items: center;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.04);
  cursor: pointer;
}
.modal-close:hover { background: rgba(255, 255, 255, 0.08); }
.modal-close svg { width: 17px; fill: none; stroke: currentColor; stroke-width: 1.8; }

.visual-modal fieldset { margin: 0 0 18px; padding: 0; border: 0; }
.visual-modal legend { margin-bottom: 9px; }
.visual-options { display: grid; grid-template-columns: 1fr 1fr; gap: 9px; }
.visual-options button {
  min-height: 78px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: 5px;
  padding: 13px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.035);
  color: var(--ink);
  text-align: left;
  cursor: pointer;
}
.visual-options button:hover { background: rgba(255, 255, 255, 0.065); }
.visual-options button.selected {
  border-color: color-mix(in srgb, var(--modal-accent), transparent 28%);
  background: color-mix(in srgb, var(--modal-accent), transparent 85%);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--modal-accent), transparent 74%);
}
.visual-options strong { font-size: 12px; }
.visual-options small { color: var(--muted); font-size: 9px; line-height: 1.4; }
.visual-options.compact button { min-height: 52px; align-items: center; text-align: center; }

.replace-note { margin: -4px 0 17px; color: #c9c4d8; font-size: 10px; }

.generation-progress {
  margin: 0 0 18px;
  padding: 15px;
  border: 1px solid color-mix(in srgb, var(--modal-accent), transparent 58%);
  border-radius: 14px;
  background: color-mix(in srgb, var(--modal-accent), transparent 90%);
}
.generation-progress-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
}
.generation-progress-heading small {
  display: block;
  color: var(--muted);
  font-family: 'DM Mono', monospace;
  font-size: 9px;
  letter-spacing: 0.14em;
}
.generation-progress-heading strong { display: block; margin-top: 4px; font-size: 14px; }
.generation-progress-heading time {
  font-family: 'DM Mono', monospace;
  font-size: 17px;
  font-variant-numeric: tabular-nums;
  color: var(--ink);
}
.generation-progress > p { margin: 11px 0 0; color: #d0ccdd; font-size: 11px; line-height: 1.55; }

.generation-steps { margin: 14px 0 0; padding: 0; list-style: none; display: grid; gap: 7px; }
.generation-steps li {
  display: flex;
  align-items: center;
  gap: 9px;
  color: var(--muted);
  font-size: 11px;
}
.generation-steps li span {
  width: 9px;
  height: 9px;
  flex: none;
  border: 1px solid currentColor;
  border-radius: 50%;
}
.generation-steps li.done { color: #78e6b0; }
.generation-steps li.done span { background: #78e6b0; border-color: #78e6b0; }
.generation-steps li.active { color: var(--ink); font-weight: 700; }
.generation-steps li.active span {
  background: var(--modal-accent);
  border-color: var(--modal-accent);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--modal-accent), transparent 76%);
}
.generation-steps li.failed { color: #ff9d9d; }
.generation-steps li.failed span { background: #ff9d9d; border-color: #ff9d9d; }

.progress-actions { grid-template-columns: 1fr; }
.visual-modal-actions { display: grid; grid-template-columns: auto 1fr; gap: 9px; }
.visual-modal-actions button {
  min-height: 44px;
  padding: 0 16px;
  border: 1px solid var(--line);
  border-radius: 11px;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
}
.cancel-action { background: rgba(255, 255, 255, 0.04); }
.visual-modal-actions button:disabled { cursor: not-allowed; opacity: 0.6; }
.generate-visual-action { border-color: transparent !important; background: var(--modal-accent); color: #0c0c18; }

@media (max-width: 520px) {
  .visual-modal { padding: 19px; }
  .visual-options { grid-template-columns: 1fr; }
  .visual-options.compact { grid-template-columns: 1fr 1fr; }
  .visual-modal-actions { grid-template-columns: 1fr; }
  .cancel-action { order: 2; }
}
</style>
