<script setup lang="ts">
import { computed, shallowRef, useTemplateRef } from 'vue'

const props = defineProps<{
  isDeleting: boolean
}>()

const emit = defineEmits<{
  cancel: []
  confirm: []
}>()

const confirmation = shallowRef('')
const confirmButton = useTemplateRef<HTMLButtonElement>('confirmButton')
const canDelete = computed(() => confirmation.value === 'DELETE' && !props.isDeleting)

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && !props.isDeleting) emit('cancel')
}

onMounted(() => document.addEventListener('keydown', handleKeydown))
onBeforeUnmount(() => document.removeEventListener('keydown', handleKeydown))
</script>

<template>
  <Teleport to="body">
    <div class="delete-station-backdrop" @click.self="!isDeleting && emit('cancel')">
      <section class="delete-station-modal" role="alertdialog" aria-modal="true" aria-labelledby="delete-station-title" aria-describedby="delete-station-description">
        <p class="delete-station-kicker">PERMANENT ACTION</p>
        <h2 id="delete-station-title">Delete this saved station?</h2>
        <p id="delete-station-description">
          This permanently deletes all saved scenes, soundtracks, the manifest, and every retained S3 version. It cannot be undone.
        </p>
        <label for="delete-station-confirmation">Type <strong>DELETE</strong> to continue</label>
        <input id="delete-station-confirmation" v-model="confirmation" autocomplete="off" spellcheck="false" :disabled="isDeleting" @keyup.enter="canDelete && emit('confirm')">
        <div class="delete-station-actions">
          <button type="button" :disabled="isDeleting" @click="emit('cancel')">Cancel</button>
          <button ref="confirmButton" type="button" :disabled="!canDelete" @click="emit('confirm')">
            {{ isDeleting ? 'Deleting…' : 'Delete permanently' }}
          </button>
        </div>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.delete-station-backdrop { position: fixed; inset: 0; z-index: 1001; display: grid; place-items: center; padding: 20px; background: rgba(3, 5, 13, 0.82); backdrop-filter: blur(12px); }
.delete-station-modal { width: min(100%, 470px); padding: 24px; border: 1px solid rgba(255, 106, 128, 0.45); border-radius: 22px; background: var(--panel-strong); color: var(--ink); box-shadow: 0 30px 90px rgba(0, 0, 0, 0.68); }
.delete-station-kicker { margin: 0; color: #ff9ead; font-family: 'DM Mono', monospace; font-size: 9px; letter-spacing: 0.14em; }
.delete-station-modal h2 { margin: 7px 0 0; font-size: 22px; }
.delete-station-modal > p:not(.delete-station-kicker) { margin: 14px 0 18px; color: #d0ccdd; font-size: 12px; line-height: 1.55; }
.delete-station-modal label { display: block; margin-bottom: 8px; color: var(--muted); font-family: 'DM Mono', monospace; font-size: 9px; letter-spacing: 0.08em; }
.delete-station-modal label strong { color: #ffb5c1; }
.delete-station-modal input { width: 100%; min-height: 42px; padding: 0 12px; border: 1px solid var(--line); border-radius: 10px; background: rgba(4, 5, 13, 0.58); color: var(--ink); font-family: 'DM Mono', monospace; }
.delete-station-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 9px; margin-top: 18px; }
.delete-station-actions button { min-height: 42px; border: 1px solid var(--line); border-radius: 10px; background: rgba(255, 255, 255, 0.045); color: var(--ink); cursor: pointer; font-size: 10px; font-weight: 700; }
.delete-station-actions button:last-child { border-color: rgba(255, 106, 128, 0.48); background: rgba(255, 106, 128, 0.16); color: #ffb5c1; }
.delete-station-actions button:disabled { cursor: not-allowed; opacity: 0.45; }
</style>
