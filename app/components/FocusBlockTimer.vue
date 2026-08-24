<script setup lang="ts">
type PomodoroPhase = 'focus' | 'shortBreak' | 'longBreak'

interface StoredPomodoro {
  version: 1
  phase: PomodoroPhase
  completedFocusBlocks: number
  remainingSeconds: number
  isRunning: boolean
  endsAt?: number
  savedAt: number
}

const storageKey = 'compile-and-chill:focus-block'
const durations: Record<PomodoroPhase, number> = {
  focus: 25 * 60,
  shortBreak: 5 * 60,
  longBreak: 15 * 60,
}

const phase = shallowRef<PomodoroPhase>('focus')
const completedFocusBlocks = ref(0)
const remainingSeconds = ref(durations.focus)
const isRunning = ref(false)
const isExpanded = shallowRef(false)
const endsAt = shallowRef<number | null>(null)
let timer: ReturnType<typeof setInterval> | undefined

const phaseLabel = computed(() => {
  if (phase.value === 'focus') return 'DEEP WORK'
  if (phase.value === 'shortBreak') return 'SHORT BREAK'
  return 'LONG BREAK'
})
const phaseDescription = computed(() => {
  if (phase.value === 'focus') return `Focus block ${Math.min(completedFocusBlocks.value + 1, 4)} of 4`
  if (phase.value === 'shortBreak') return `Focus block ${completedFocusBlocks.value} complete · reset your eyes`
  return 'Four focus blocks complete · take a longer reset'
})
const timeLabel = computed(() => {
  const minutes = Math.floor(remainingSeconds.value / 60)
  const seconds = remainingSeconds.value % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
})
const progress = computed(() => Math.max(0, Math.min(1, remainingSeconds.value / durations[phase.value])))
const ringStyle = computed(() => ({ '--progress': String(progress.value) }))
const toggleLabel = computed(() => (isRunning.value ? 'Pause' : `Start ${phase.value === 'focus' ? 'focus' : 'break'}`))
const skipLabel = computed(() => (phase.value === 'focus' ? 'Finish focus' : 'Start focus'))

onMounted(() => {
  restore()
  timer = setInterval(tick, 1_000)
})

onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
})

function restore() {
  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return
    const saved = JSON.parse(raw) as StoredPomodoro
    if (saved.version !== 1 || !Object.hasOwn(durations, saved.phase)) return

    phase.value = saved.phase
    completedFocusBlocks.value = Math.max(0, Math.min(4, Math.floor(saved.completedFocusBlocks)))
    remainingSeconds.value = Math.max(0, Math.min(durations[saved.phase], Math.floor(saved.remainingSeconds)))
    isRunning.value = Boolean(saved.isRunning)
    endsAt.value = typeof saved.endsAt === 'number'
      ? saved.endsAt
      : saved.savedAt + remainingSeconds.value * 1_000
    if (isRunning.value) {
      remainingSeconds.value = Math.max(0, Math.ceil((endsAt.value - Date.now()) / 1_000))
      if (remainingSeconds.value === 0) completePhase()
    } else {
      endsAt.value = null
    }
  } catch {
    window.localStorage.removeItem(storageKey)
  }
}

function persist() {
  const saved: StoredPomodoro = {
    version: 1,
    phase: phase.value,
    completedFocusBlocks: completedFocusBlocks.value,
    remainingSeconds: remainingSeconds.value,
    isRunning: isRunning.value,
    endsAt: endsAt.value ?? undefined,
    savedAt: Date.now(),
  }
  window.localStorage.setItem(storageKey, JSON.stringify(saved))
}

function tick() {
  if (!isRunning.value || !endsAt.value) return
  remainingSeconds.value = Math.max(0, Math.ceil((endsAt.value - Date.now()) / 1_000))
  if (remainingSeconds.value === 0) {
    completePhase()
    return
  }
  persist()
}

function completePhase() {
  isRunning.value = false
  endsAt.value = null
  if (phase.value === 'focus') {
    completedFocusBlocks.value += 1
    phase.value = completedFocusBlocks.value % 4 === 0 ? 'longBreak' : 'shortBreak'
  } else {
    phase.value = 'focus'
    if (completedFocusBlocks.value >= 4) completedFocusBlocks.value = 0
  }
  remainingSeconds.value = durations[phase.value]
  persist()
}

function toggle() {
  if (isRunning.value) {
    if (endsAt.value) remainingSeconds.value = Math.max(0, Math.ceil((endsAt.value - Date.now()) / 1_000))
    isRunning.value = false
    endsAt.value = null
  } else {
    endsAt.value = Date.now() + remainingSeconds.value * 1_000
    isRunning.value = true
  }
  persist()
}

function reset() {
  isRunning.value = false
  endsAt.value = null
  remainingSeconds.value = durations[phase.value]
  persist()
}
</script>

<template>
  <section :class="['focus-block', { collapsed: !isExpanded }]" aria-labelledby="focus-block-heading">
    <button
      class="focus-toggle"
      type="button"
      :aria-expanded="isExpanded"
      aria-controls="focus-block-controls"
      @click="isExpanded = !isExpanded"
    >
      <span class="focus-toggle-copy">
        <span class="focus-kicker">FOCUS BLOCK</span>
        <strong id="focus-block-heading">{{ phase === 'focus' ? 'Deep work' : 'Reset interval' }}</strong>
      </span>
      <span class="focus-compact-time">{{ timeLabel }}</span>
      <span :class="['focus-phase', { break: phase !== 'focus' }]">{{ phaseLabel }}</span>
      <svg class="focus-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
    </button>

    <div v-show="isExpanded" id="focus-block-controls" class="focus-details">
      <div class="focus-main">
        <div class="focus-ring" :style="ringStyle" aria-hidden="true">
          <span>{{ timeLabel }}</span>
        </div>
        <div class="focus-copy">
          <h3>{{ phase === 'focus' ? 'Deep work' : 'Reset interval' }}</h3>
          <p>{{ phaseDescription }}</p>
        </div>
      </div>

      <p class="focus-announcement" role="status" aria-live="polite">
        {{ isRunning ? `${phaseLabel.toLowerCase()} timer running` : `${phaseLabel.toLowerCase()} timer paused` }}
      </p>

      <div class="focus-actions">
        <button type="button" class="focus-primary" @click="toggle">
          <svg v-if="isRunning" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6v12M16 6v12" /></svg>
          <svg v-else viewBox="0 0 24 24" aria-hidden="true"><path d="m9 7 8 5-8 5V7Z" /></svg>
          {{ toggleLabel }}
        </button>
        <button type="button" class="focus-secondary" @click="completePhase">{{ skipLabel }}</button>
        <button type="button" class="focus-reset" aria-label="Reset current focus timer" title="Reset timer" @click="reset">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.3-5.7M4 5v5h5" /></svg>
        </button>
      </div>

      <p class="focus-note">25 min focus · 5 min break · 15 min after four blocks · private to this browser</p>
    </div>
  </section>
</template>

<style scoped>
.focus-block { margin-top: 14px; padding: 8px 10px; border: 1px solid color-mix(in srgb, var(--accent), transparent 67%); border-radius: 13px; background: color-mix(in srgb, var(--accent), transparent 93%); }
.focus-block:not(.collapsed) { padding: 12px 13px; }
.focus-toggle { width: 100%; min-height: 44px; display: grid; grid-template-columns: minmax(0, 1fr) auto auto auto; align-items: center; gap: 8px; padding: 0; border: 0; background: transparent; color: inherit; cursor: pointer; text-align: left; }
.focus-toggle:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; border-radius: 8px; }
.focus-toggle-copy { min-width: 0; display: grid; gap: 2px; }
.focus-toggle-copy strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; }
.focus-kicker, .focus-phase { font-family: 'DM Mono', monospace; font-size: 8px; font-weight: 700; letter-spacing: .14em; }
.focus-kicker { color: var(--muted); }
.focus-compact-time { font-family: 'DM Mono', monospace; font-size: 12px; font-weight: 700; color: var(--ink); }
.focus-phase { padding: 4px 6px; border: 1px solid color-mix(in srgb, var(--accent), transparent 50%); border-radius: 5px; color: var(--accent); white-space: nowrap; }
.focus-phase.break { color: #78e6b0; border-color: rgba(120, 230, 176, .45); }
.focus-chevron { width: 15px; fill: none; stroke: var(--muted); stroke-width: 1.8; transition: transform 160ms ease; }
.focus-block.collapsed .focus-chevron { transform: rotate(-90deg); }
.focus-details { padding-top: 12px; }
.focus-main { display: grid; grid-template-columns: 62px minmax(0, 1fr); align-items: center; gap: 12px; }
.focus-ring { position: relative; width: 62px; height: 62px; display: grid; place-items: center; border-radius: 50%; background: conic-gradient(var(--accent) calc(var(--progress) * 1turn), rgba(255,255,255,.12) 0); }
.focus-ring::before { content: ''; position: absolute; width: 50px; height: 50px; border-radius: 50%; background: var(--panel-strong); }
.focus-ring span { position: relative; font-family: 'DM Mono', monospace; font-size: 11px; font-weight: 700; }
.focus-copy h3 { margin: 0; font-size: 14px; }
.focus-copy p { margin: 4px 0 0; color: var(--muted); font-size: 9px; line-height: 1.45; }
.focus-announcement { margin: 10px 0 0; color: var(--accent); font-family: 'DM Mono', monospace; font-size: 8px; letter-spacing: .08em; text-transform: uppercase; }
.focus-actions { display: grid; grid-template-columns: 1fr 1fr auto; gap: 7px; margin-top: 10px; }
.focus-actions button { min-height: 35px; border: 1px solid var(--line); border-radius: 9px; cursor: pointer; font-size: 10px; font-weight: 700; }
.focus-primary { display: flex; align-items: center; justify-content: center; gap: 6px; border-color: transparent !important; background: var(--accent); color: #0c0c18; }
.focus-primary svg, .focus-reset svg { width: 14px; fill: none; stroke: currentColor; stroke-width: 2; }
.focus-secondary, .focus-reset { background: rgba(255,255,255,.045); color: var(--ink); }
.focus-reset { width: 36px; display: grid; place-items: center; }
.focus-note { margin: 9px 0 0; color: var(--muted); font-size: 8px; line-height: 1.45; }
@media (prefers-reduced-motion: reduce) { .focus-chevron { transition: none; } }
</style>
