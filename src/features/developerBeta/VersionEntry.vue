<script setup lang="ts">
import { useRouter } from 'vue-router'
import { onBeforeUnmount } from 'vue'
import { BETA_PATH, unlockBeta } from './state'

const router = useRouter()
const version = __APP_VERSION__
let taps = 0
let timer: ReturnType<typeof setTimeout> | undefined
function tap() {
  clearTimeout(timer)
  if (++taps === 5) {
    taps = 0
    unlockBeta()
    void router.push(BETA_PATH)
  } else {
    timer = setTimeout(() => { taps = 0 }, 900)
  }
}
onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <p class="text-xs text-ink-mute"><button type="button" class="version-entry" :aria-label="`当前版本 v${version}`" @click="tap" @keydown="event => { if (event.repeat) event.preventDefault() }">当前版本 v{{ version }}</button></p>
</template>

<style scoped>
.version-entry { font: inherit; color: inherit; touch-action: manipulation; user-select: none; }
.version-entry:focus-visible { outline: 2px solid var(--zhuhong); outline-offset: 4px; border-radius: 8px; }
</style>
