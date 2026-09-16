<script setup lang="ts">
import { useId } from 'vue'

// Filter only the two background shapes: text and controls stay sharp.
const filterId = `command-liquid-${useId()}`
</script>

<template>
  <div class="word-command-surface" aria-hidden="true">
    <svg class="word-command-filter" width="0" height="0" focusable="false">
      <defs>
        <filter :id="filterId" x="-20%" y="-50%" width="140%" height="200%" color-interpolation-filters="sRGB">
          <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
          <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -9.5" />
        </filter>
      </defs>
    </svg>
    <div class="word-command-liquid" :style="{ filter: `url(#${filterId})` }">
      <div class="word-command-body" />
      <div class="word-command-drop" />
    </div>
  </div>
</template>
