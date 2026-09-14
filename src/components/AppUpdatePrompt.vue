<script setup lang="ts">
import { Download } from "lucide-vue-next";
import { useAppUpdateStore } from "../stores/appUpdate";

const update = useAppUpdateStore();
</script>

<template>
  <Teleport to="body">
    <Transition name="update-sheet">
      <div
        v-if="update.promptVisible && update.needRefresh"
        class="update-layer"
        @click.self="update.dismissPrompt"
      >
        <div
          class="update-backdrop"
          aria-hidden="true"
          @click="update.dismissPrompt"
        />
        <section
          class="update-panel"
          :class="{ 'is-applying': update.applying }"
          role="dialog"
          aria-modal="true"
          aria-labelledby="update-title"
          aria-describedby="update-description"
        >
          <div class="update-handle" aria-hidden="true" />
          <div class="mb-4 flex items-center gap-3.5">
            <div class="update-icon">
              <Download :size="21" :class="{ 'animate-pulse': update.applying }" />
            </div>
            <div>
              <h2 id="update-title" class="text-lg font-semibold text-ink">
                {{ update.applying ? "正在切换到新版本" : "发现新版本" }}
              </h2>
              <p v-if="update.applying" class="mt-0.5 text-xs text-ink-mute">
                即将重新打开，请稍候
              </p>
            </div>
          </div>
          <p id="update-description" class="text-sm leading-6 text-ink-soft">
            新版本已经准备好，更新不会清除你的学习记录和本地设置。
          </p>
          <div class="mt-6 grid grid-cols-2 gap-3">
            <button
              class="update-button bg-soft text-ink-soft"
              :disabled="update.applying"
              @click="update.dismissPrompt"
            >
              稍后
            </button>
            <button
              class="update-button btn-primary"
              :disabled="update.applying"
              @click="update.applyUpdate"
            >
              {{ update.applying ? "正在更新…" : "立即更新" }}
            </button>
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.update-layer {
  position: fixed;
  inset: 0;
  z-index: 70;
  min-height: 100dvh;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 12px;
  padding-bottom: max(12px, env(safe-area-inset-bottom));
}

.update-backdrop {
  position: absolute;
  inset: 0;
  background: rgb(20 18 16 / 38%);
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
}

.update-panel {
  position: relative;
  width: min(100%, 420px);
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--line) 82%, transparent);
  border-radius: 34px;
  padding: 13px 22px 22px;
  background: color-mix(in srgb, var(--card) 94%, transparent);
  box-shadow:
    0 24px 70px rgb(22 18 13 / 28%),
    inset 0 1px rgb(255 255 255 / 58%);
  backdrop-filter: blur(28px) saturate(1.35);
  -webkit-backdrop-filter: blur(28px) saturate(1.35);
  transform-origin: center bottom;
  will-change: transform, opacity;
  transition:
    transform 360ms cubic-bezier(0.22, 1, 0.36, 1),
    box-shadow 360ms ease;
}

.update-handle {
  width: 36px;
  height: 5px;
  margin: 0 auto 17px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--ink-mute) 42%, transparent);
}

.update-icon {
  display: flex;
  width: 44px;
  height: 44px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border-radius: 15px;
  background: var(--dai-soft);
  color: var(--dai);
}

.update-button {
  min-height: 48px;
  border-radius: 16px;
  font-size: 0.875rem;
  font-weight: 600;
}

.update-panel.is-applying {
  transform: translateY(-4px) scale(0.992);
  box-shadow: 0 18px 52px rgb(22 18 13 / 22%);
}

.update-sheet-enter-active {
  transition: visibility 560ms;
}

.update-sheet-leave-active {
  transition: visibility 360ms;
}

.update-sheet-enter-active .update-backdrop,
.update-sheet-leave-active .update-backdrop {
  transition: opacity 420ms ease;
}

.update-sheet-enter-active .update-panel {
  transition:
    transform 560ms cubic-bezier(0.22, 1, 0.36, 1),
    opacity 360ms ease;
}

.update-sheet-leave-active .update-panel {
  transition:
    transform 360ms cubic-bezier(0.4, 0, 0.2, 1),
    opacity 260ms ease;
}

.update-sheet-enter-from .update-backdrop,
.update-sheet-leave-to .update-backdrop {
  opacity: 0;
}

.update-sheet-enter-from .update-panel,
.update-sheet-leave-to .update-panel {
  opacity: 0;
  transform: translate3d(0, calc(100% + 42px), 0) scale(0.98);
}

@media (min-width: 640px) {
  .update-layer {
    padding-bottom: 24px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .update-sheet-enter-active,
  .update-sheet-leave-active,
  .update-sheet-enter-active .update-backdrop,
  .update-sheet-leave-active .update-backdrop,
  .update-sheet-enter-active .update-panel,
  .update-sheet-leave-active .update-panel {
    transition-duration: 1ms;
  }
}
</style>
