<script setup lang="ts">
import { computed } from 'vue'
import type { StationLibrarySummary } from '~/composables/useStationLibrary'

const props = defineProps<{
  library: StationLibrarySummary | null
  status: 'idle' | 'loading' | 'ready' | 'error'
}>()

const emit = defineEmits<{
  manage: []
}>()

const stateLabel = computed(() => {
  if (props.status === 'loading') return 'CHECKING'
  if (props.status === 'error') return 'OFFLINE'
  if (!props.library?.enabled) return 'NOT CONNECTED'
  return props.library.saved ? 'SAVED' : 'READY'
})

const description = computed(() => {
  if (props.status === 'loading') return 'Checking your private saved station…'
  if (props.status === 'error') return 'Private cloud storage could not be reached.'
  if (!props.library?.enabled) return 'Private cloud storage is not connected on this server.'
  if (!props.library.saved) return 'New scenes and soundtracks will save here.'
  return 'Your scenes and soundtracks are private to this browser.'
})

const assetCount = computed(() => {
  if (!props.library) return 0
  return Object.values(props.library.modes).reduce(
    (count, assets) => count + Number(Boolean(assets.scene)) + Number(Boolean(assets.music)),
    0,
  )
})
</script>

<template>
  <section class="cloud-library" aria-labelledby="cloud-library-title">
    <div class="cloud-library-heading">
      <span :class="['cloud-library-light', { saved: library?.saved && status === 'ready' }]" aria-hidden="true" />
      <div>
        <p id="cloud-library-title">PRIVATE CLOUD LIBRARY</p>
        <strong>{{ stateLabel }}</strong>
      </div>
      <span class="cloud-library-count">{{ assetCount }} asset{{ assetCount === 1 ? '' : 's' }}</span>
    </div>
    <p class="cloud-library-description">{{ description }}</p>
    <button class="cloud-library-manage" type="button" :disabled="status === 'loading'" @click="emit('manage')">
      Open cloud library
    </button>
  </section>
</template>

<style scoped>
.cloud-library {
  margin-top: 14px;
  padding: 11px;
  border: 1px solid color-mix(in srgb, var(--accent), transparent 72%);
  border-radius: 11px;
  background: color-mix(in srgb, var(--accent), transparent 92%);
}

.cloud-library-heading {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 8px;
}

.cloud-library-light {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #756f84;
}

.cloud-library-light.saved {
  background: #78e6b0;
  box-shadow: 0 0 9px rgba(120, 230, 176, 0.7);
}

.cloud-library-heading p {
  margin: 0;
  color: var(--muted);
  font-family: 'DM Mono', monospace;
  font-size: 8px;
  letter-spacing: 0.13em;
}

.cloud-library-heading strong {
  display: block;
  margin-top: 2px;
  color: var(--ink);
  font-family: 'DM Mono', monospace;
  font-size: 9px;
  letter-spacing: 0.1em;
}

.cloud-library-count {
  color: var(--muted);
  font-size: 9px;
}

.cloud-library-description {
  min-height: 28px;
  margin: 8px 0 9px;
  color: #d0ccdd;
  font-size: 9px;
  line-height: 1.45;
}

.cloud-library-manage {
  width: 100%;
  min-height: 31px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.045);
  color: var(--ink);
  cursor: pointer;
  font-size: 9px;
  font-weight: 700;
}

.cloud-library-manage:hover:not(:disabled) { background: rgba(255, 255, 255, 0.09); }
.cloud-library-manage:disabled { cursor: wait; opacity: 0.65; }
</style>
