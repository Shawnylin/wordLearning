<script setup lang="ts">
defineProps<{ modelValue: boolean; disabled?: boolean; label: string }>()
defineEmits<{ 'update:modelValue': [value: boolean] }>()
</script>

<template>
  <button type="button" class="liquid-toggle" role="switch" :aria-checked="modelValue" :aria-label="label" :disabled="disabled" @click="$emit('update:modelValue', !modelValue)">
    <span class="liquid-thumb" />
  </button>
</template>

<style scoped>
/* Vue adaptation of Bencho's Liquid toggle interaction: pill, translating
   thumb, directional stretch while pressed, spring-like settling. */
.liquid-toggle { width: 60px; height: 34px; flex-shrink: 0; padding: 4px; border: 1px solid var(--line); border-radius: 999px; background: var(--soft); cursor: pointer; touch-action: manipulation; }
.liquid-thumb { display: block; width: 24px; height: 24px; border-radius: 50%; background: var(--ink-mute); box-shadow: 0 2px 4px #0002; transition: transform 460ms cubic-bezier(.22,1.5,.36,1), background 220ms, scale 220ms; transform-origin: left center; }
.liquid-toggle[aria-checked="true"] { background: var(--zhuhong-solid); border-color: transparent; }
.liquid-toggle[aria-checked="true"] .liquid-thumb { transform: translateX(26px); background: #fff; transform-origin: right center; }
.liquid-toggle:active:not(:disabled) .liquid-thumb { scale: 1.2 .86; }
.liquid-toggle:focus-visible { outline: 2px solid var(--zhuhong); outline-offset: 4px; }
.liquid-toggle:disabled { opacity: .5; cursor: wait; }
@media (prefers-reduced-motion: reduce) { .liquid-thumb { transition: none; } .liquid-toggle:active .liquid-thumb { scale: 1; } }
</style>
