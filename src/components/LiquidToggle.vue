<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = withDefaults(defineProps<{
  modelValue: boolean
  label: string
  disabled?: boolean
  tone?: 'accent' | 'gold'
  speed?: number
  stretch?: number
}>(), {
  disabled: false,
  tone: 'accent',
  speed: 50,
  stretch: 47
})

const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()
const motion = ref<'on' | 'off' | ''>('')
const duration = computed(() => `${620 - Math.min(100, Math.max(0, props.speed)) * 4}ms`)
const stretchScale = computed(() => 1 + Math.min(100, Math.max(0, props.stretch)) / 100)

watch(() => props.modelValue, value => {
  motion.value = value ? 'on' : 'off'
})
</script>

<template>
  <button
    type="button"
    class="liquid-toggle"
    :class="[`is-${tone}`, { 'is-checked': modelValue, 'moves-on': motion === 'on', 'moves-off': motion === 'off' }]"
    :style="{ '--liquid-speed': duration, '--liquid-stretch': stretchScale }"
    role="switch"
    :aria-checked="modelValue"
    :aria-label="label"
    :disabled="disabled"
    @click="emit('update:modelValue', !modelValue)"
  >
    <span class="liquid-toggle-knob" @animationend="motion = ''" />
  </button>
</template>
