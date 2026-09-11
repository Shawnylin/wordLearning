<script setup lang="ts">
withDefaults(defineProps<{ words: string[]; variant?: 'list' | 'card' }>(), { variant: 'card' })
</script>

<template>
  <div class="compare-words" :class="`compare-words--${variant}`" aria-label="对比词语">
    <div v-for="(word, index) in words" :key="index" class="compare-word-group">
      <span v-if="index" data-row-aux class="compare-word-divider" aria-hidden="true">vs</span>
      <span class="compare-word font-kai" :data-morph-word="word" :data-morph-index="index">{{ word }}</span>
    </div>
  </div>
</template>

<style>
.compare-words { display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px 10px; min-width: 0; max-width: 100%; }
.compare-word-group { display: inline-flex; align-items: baseline; gap: 8px; flex: 0 1 auto; min-width: 0; max-width: 100%; }
.compare-word { display: block; min-width: 0; max-width: 100%; line-height: 1.45; word-break: keep-all; overflow-wrap: anywhere; }
.compare-word-divider { flex: none; font-size: 12px; line-height: 1.5; color: var(--ink-mute); font-weight: 400; }
.compare-words--list { font-size: 16px; font-weight: 600; row-gap: 4px; }
.compare-words--card { justify-content: center; font-size: clamp(20px, 6vw, 28px); font-weight: 400; color: var(--ink); row-gap: 10px; }
.compare-words--card .compare-word-divider { font-size: 14px; }
</style>
