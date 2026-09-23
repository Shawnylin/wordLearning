<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, useId } from 'vue'

defineProps<{ title: string; description: string; confirmLabel?: string }>()
const emit = defineEmits<{ cancel: []; confirm: [] }>()
const dialog = ref<HTMLDialogElement>()
const id = useId()

onMounted(() => dialog.value?.showModal())
onBeforeUnmount(() => dialog.value?.close())
</script>

<template>
  <Teleport to="body">
    <dialog
      ref="dialog"
      class="confirm-dialog"
      :aria-labelledby="`${id}-title`"
      :aria-describedby="`${id}-description`"
      @cancel.prevent="emit('cancel')"
      @click.self="emit('cancel')"
    >
      <div class="confirm-dialog-body">
        <h2 :id="`${id}-title`">{{ title }}</h2>
        <p :id="`${id}-description`">{{ description }}</p>
        <div class="confirm-dialog-actions">
          <button type="button" autofocus @click="emit('cancel')">取消</button>
          <button type="button" class="btn-primary" @click="emit('confirm')">{{ confirmLabel || '确认删除' }}</button>
        </div>
      </div>
    </dialog>
  </Teleport>
</template>

<style scoped>
.confirm-dialog {
  width: min(360px, calc(100vw - 32px));
  max-height: calc(100dvh - 32px);
  margin: auto;
  padding: 0;
  overflow: auto;
  border: 1px solid var(--line);
  border-radius: 20px;
  background: var(--card);
  color: var(--ink);
  box-shadow: 0 20px 54px color-mix(in srgb, var(--ink) 22%, transparent);
}
.confirm-dialog::backdrop { background: rgb(18 20 22 / .42); }
.confirm-dialog-body { padding: 24px; }
h2 { font-size: 18px; font-weight: 600; line-height: 1.4; }
p { margin-top: 8px; color: var(--ink-soft); font-size: 14px; line-height: 1.65; }
.confirm-dialog-actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin-top: 24px; }
.confirm-dialog-actions button { min-height: 44px; border-radius: 11px; font-size: 14px; font-weight: 600; }
.confirm-dialog-actions button:first-child { background: var(--soft); color: var(--ink-soft); }
.confirm-dialog-actions button:focus-visible { outline: 2px solid var(--zhuhong); outline-offset: 2px; }
</style>
