<script setup lang="ts">
import { ArrowLeft, Check } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import { changelog } from '../data/changelog'

const router = useRouter()
</script>

<template>
  <div class="min-h-screen px-4 pt-6 pb-8">
    <div class="mx-auto max-w-2xl">
      <header class="mb-6 flex items-center gap-3">
        <button
          class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-soft text-ink-soft"
          aria-label="返回个人页"
          @click="router.push('/profile')"
        ><ArrowLeft :size="20" /></button>
        <div>
          <h1 class="font-kai text-3xl text-ink">更新日志</h1>
          <p class="mt-1 text-sm text-ink-mute">了解每个版本带来的变化</p>
        </div>
      </header>

      <div class="space-y-4">
        <article v-for="(release, index) in changelog" :key="release.version" class="card rounded-2xl p-5">
          <div class="flex flex-wrap items-center gap-2">
            <h2 class="font-serif text-xl font-bold text-ink">v{{ release.version }}</h2>
            <span v-if="index === 0" class="rounded-full bg-zhuhong-soft px-2.5 py-1 text-xs font-medium text-zhuhong">当前版本</span>
            <time class="ml-auto text-xs text-ink-mute">{{ release.date }}</time>
          </div>
          <p class="mt-2 font-medium text-ink-soft">{{ release.title }}</p>
          <ul class="mt-4 space-y-3">
            <li v-for="change in release.changes" :key="change" class="flex gap-2.5 text-sm leading-6 text-ink-soft">
              <Check :size="16" class="mt-1 shrink-0 text-bamboo" />
              <span>{{ change }}</span>
            </li>
          </ul>
        </article>
      </div>
    </div>
  </div>
</template>
