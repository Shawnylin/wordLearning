<script setup lang="ts">
import { ref } from 'vue'
import { Eye, EyeOff } from 'lucide-vue-next'

withDefaults(defineProps<{ placeholder?: string; readonly?: boolean }>(), { placeholder: '输入 API Key', readonly: false })
const model = defineModel<string>({ required: true })
const visible = ref(false)
</script>

<template>
  <span class="api-key-field" :class="{ 'is-concealed': !visible && model }">
    <input
      v-model="model"
      type="text"
      :class="{ concealed: !visible }"
      :placeholder="placeholder"
      :readonly="readonly"
      autocomplete="off"
      autocapitalize="off"
      spellcheck="false"
    />
    <button
      type="button"
      class="api-key-toggle"
      :aria-label="visible ? '隐藏 API Key' : '显示 API Key'"
      :title="visible ? '隐藏 API Key' : '显示 API Key'"
      @click="visible = !visible"
    >
      <EyeOff v-if="visible" :size="17" />
      <Eye v-else :size="17" />
    </button>
  </span>
</template>

<style scoped>
.api-key-field { position: relative; display: block; }
.api-key-field input { display: block; width: 100%; min-width: 0; margin-top: 6px; padding: 12px 44px 12px 12px; border: 1px solid var(--line); border-radius: 12px; background: var(--soft); color: var(--ink); font-size: 16px; }
.api-key-field.is-concealed::after { content: '••••••••••••'; position: absolute; left: 13px; bottom: 12px; z-index: 1; color: var(--ink-mute); font-size: 9px; line-height: 1; letter-spacing: 2px; pointer-events: none; }
.api-key-field input.concealed { color: transparent; caret-color: var(--ink); }
.api-key-toggle { position: absolute; right: 5px; bottom: 5px; display: grid; width: 34px; height: 34px; place-items: center; border-radius: 9px; color: var(--ink-mute); }
.api-key-toggle:hover,.api-key-toggle:focus-visible { background: var(--zhuhong-soft); color: var(--zhuhong); }
.api-key-field input:focus { outline: 2px solid var(--zhuhong); outline-offset: 2px; }
.api-key-field input:read-only { cursor: default; }
@media (min-width: 768px) { .api-key-field input { margin-top: 4px; padding-block: 9px; font-size: 15px; } .api-key-toggle { bottom: 2px; } .api-key-field.is-concealed::after { bottom: 10px; } }
</style>
