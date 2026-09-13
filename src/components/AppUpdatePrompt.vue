<script setup lang="ts">
import { Download } from 'lucide-vue-next'
import Motion from './Motion.vue'
import { useAppUpdateStore } from '../stores/appUpdate'

const update = useAppUpdateStore()
</script>

<template>
  <Teleport to="body">
    <Motion>
      <div v-if="update.promptVisible && update.needRefresh" class="fixed inset-0 z-[70] flex items-end justify-center bg-black/35 p-3 backdrop-blur-[2px] sm:items-center" @click.self="update.dismissPrompt">
        <section class="card glass-card w-full max-w-sm rounded-3xl p-5 shadow-xl" role="dialog" aria-modal="true" aria-labelledby="update-title" aria-describedby="update-description">
          <div class="mb-3 flex items-center gap-3">
            <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-dai-soft text-dai"><Download :size="20" /></div>
            <h2 id="update-title" class="text-lg font-semibold text-ink">发现新版本</h2>
          </div>
          <p id="update-description" class="text-sm leading-6 text-ink-soft">新版本已经准备好，更新不会清除你的学习记录和本地设置。</p>
          <div class="mt-5 grid grid-cols-2 gap-3">
            <button class="rounded-xl bg-soft py-2.5 text-sm font-medium text-ink-soft" :disabled="update.applying" @click="update.dismissPrompt">稍后</button>
            <button class="btn-primary rounded-xl py-2.5 text-sm font-medium" :disabled="update.applying" @click="update.applyUpdate">{{ update.applying ? '正在更新…' : '立即更新' }}</button>
          </div>
        </section>
      </div>
    </Motion>
  </Teleport>
</template>
