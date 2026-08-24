<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'
import type { StationLibrarySummary } from '~/composables/useStationLibrary'

const props = defineProps<{
  library: StationLibrarySummary | null
  isDeleting: boolean
}>()

const emit = defineEmits<{
  close: []
  clearBrowser: []
  requestDelete: []
}>()

const closeButton = useTemplateRef<HTMLButtonElement>('closeButton')
const assetCount = computed(() => {
  if (!props.library) return 0
  return Object.values(props.library.modes).reduce(
    (count, assets) => count + Number(Boolean(assets.scene)) + Number(Boolean(assets.music)),
    0,
  )
})
const updatedAtLabel = computed(() => props.library?.updatedAt
  ? new Date(props.library.updatedAt).toLocaleString()
  : 'Just now')

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') emit('close')
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
    <div class="station-library-backdrop" @click.self="emit('close')">
      <section class="station-library-modal" role="dialog" aria-modal="true" aria-labelledby="station-library-title">
        <header class="station-library-header">
          <div>
            <p>PRIVATE CLOUD LIBRARY</p>
            <h2 id="station-library-title">Saved station</h2>
          </div>
          <button ref="closeButton" class="modal-close" type="button" aria-label="Close saved station" @click="emit('close')">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
          </button>
        </header>

        <p class="station-library-description">
          {{ library?.saved
            ? 'Your generated scenes and soundtracks are stored privately and restore only in this browser.'
            : 'Your next generated scene or soundtrack will create a private saved station for this browser.' }}
        </p>

        <dl v-if="library?.saved" class="station-library-summary">
          <div><dt>Saved assets</dt><dd>{{ assetCount }}</dd></div>
          <div><dt>Last update</dt><dd>{{ updatedAtLabel }}</dd></div>
          <div><dt>Visibility</dt><dd>Only this browser</dd></div>
        </dl>

        <div class="library-action">
          <div>
            <h3>Clear this browser</h3>
            <p>Stops this browser from restoring the saved station. It does not delete anything in the cloud.</p>
          </div>
          <button type="button" :disabled="!library?.saved || isDeleting" @click="emit('clearBrowser')">Clear browser</button>
        </div>

        <div class="library-action danger">
          <div>
            <h3>Delete saved station</h3>
            <p>Permanently removes every saved scene, soundtrack, manifest, and retained S3 version for this station.</p>
          </div>
          <button type="button" :disabled="!library?.saved || isDeleting" @click="emit('requestDelete')">Delete saved station…</button>
        </div>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.station-library-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(3, 5, 13, 0.76);
  backdrop-filter: blur(12px);
}

.station-library-modal {
  width: min(100%, 540px);
  max-height: calc(100vh - 40px);
  overflow-y: auto;
  padding: 24px;
  border: 1px solid color-mix(in srgb, var(--accent), transparent 62%);
  border-radius: 22px;
  background: var(--panel-strong);
  color: var(--ink);
  box-shadow: 0 30px 90px rgba(0, 0, 0, 0.62);
}

.station-library-header { display: flex; align-items: center; justify-content: space-between; gap: 20px; }
.station-library-header p { margin: 0; color: var(--muted); font-family: 'DM Mono', monospace; font-size: 9px; letter-spacing: 0.14em; }
.station-library-header h2 { margin: 4px 0 0; font-size: 22px; }
.modal-close { width: 36px; height: 36px; display: grid; place-items: center; border: 1px solid var(--line); border-radius: 10px; background: rgba(255, 255, 255, 0.04); color: var(--ink); cursor: pointer; }
.modal-close:hover { background: rgba(255, 255, 255, 0.08); }
.modal-close svg { width: 17px; fill: none; stroke: currentColor; stroke-width: 1.8; }
.station-library-description { margin: 16px 0 18px; color: #d0ccdd; font-size: 12px; line-height: 1.55; }
.station-library-summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 0 0 18px; }
.station-library-summary div { padding: 10px; border: 1px solid var(--line); border-radius: 10px; background: rgba(255, 255, 255, 0.035); }
.station-library-summary dt { color: var(--muted); font-family: 'DM Mono', monospace; font-size: 8px; letter-spacing: 0.1em; }
.station-library-summary dd { margin: 5px 0 0; font-size: 10px; line-height: 1.35; }
.library-action { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 18px; padding: 15px 0; border-top: 1px solid var(--line); }
.library-action h3 { margin: 0; font-size: 12px; }
.library-action p { margin: 5px 0 0; color: var(--muted); font-size: 10px; line-height: 1.45; }
.library-action button { min-height: 34px; padding: 0 11px; border: 1px solid var(--line); border-radius: 9px; background: rgba(255, 255, 255, 0.045); color: var(--ink); cursor: pointer; font-size: 9px; font-weight: 700; }
.library-action button:hover:not(:disabled) { background: rgba(255, 255, 255, 0.09); }
.library-action button:disabled { cursor: not-allowed; opacity: 0.45; }
.library-action.danger h3 { color: #ffb5c1; }
.library-action.danger button { border-color: rgba(255, 106, 128, 0.38); color: #ffb5c1; }
.library-action.danger button:hover:not(:disabled) { background: rgba(255, 106, 128, 0.14); }

@media (max-width: 520px) {
  .station-library-modal { padding: 19px; }
  .station-library-summary { grid-template-columns: 1fr; }
  .library-action { grid-template-columns: 1fr; gap: 11px; }
  .library-action button { width: 100%; }
}
</style>
