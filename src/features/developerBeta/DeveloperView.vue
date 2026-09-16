<script setup lang="ts">
import { ArrowLeft, FlaskConical, ArrowUpRight, Check } from 'lucide-vue-next'
import LiquidToggle from './LiquidToggle.vue'
import { betaEnabled, betaPending, betaMessage, setBetaEnabled } from './state'

const blocks = [
  ['Magnifying dock · Icon bar', '主导航', '悬停放大、选中滑块与紧凑工具栏'],
  ['Liquid toggle · Magnetic select', '开关与选项', '按压伸缩、分段选择与选中反馈'],
  ['Search · Command bar', '输入与搜索', '内嵌操作、柔和轮廓与聚焦反馈'],
  ['Create menu · Selection list', '菜单与记录', '浮层菜单、列表选择与轻量卡片'],
]
</script>

<template>
  <div class="developer-page px-4 pt-6 pb-6">
    <div class="mx-auto max-w-lg space-y-6">
      <header class="flex items-center gap-3">
        <RouterLink to="/profile" class="developer-back bg-soft text-ink" aria-label="返回个人"><ArrowLeft :size="20" /></RouterLink>
        <div><p class="developer-eyebrow">DEVELOPER LAB</p><h1 class="text-2xl font-semibold">开发者实验室</h1></div>
      </header>
      <section class="card developer-control">
        <div class="flex items-center gap-3 mb-6"><span class="developer-icon"><FlaskConical :size="22" /></span><span class="developer-eyebrow">BETA / 01</span></div>
        <div class="flex items-center justify-between gap-4">
          <div><h2 class="text-xl font-semibold">Beta UI</h2><p class="text-sm text-ink-soft mt-2">体验 Bencho 风格的交互界面</p></div>
          <LiquidToggle :model-value="betaEnabled" :disabled="betaPending" label="开发者 Beta UI" @update:model-value="setBetaEnabled($event)" />
        </div>
        <p class="developer-status" role="status"><Check v-if="betaEnabled" :size="14" />{{ betaPending ? '正在加载界面…' : betaEnabled ? '已启用 · 切换页面即可体验' : '未启用 · 正在使用原版界面' }}</p>
        <p class="text-xs text-ink-mute leading-6 mt-4">设置自动保存。随时关闭即可恢复原版外观，学习记录、模型配置与主题设置均保留。</p>
        <p v-if="betaMessage" role="alert" class="mt-3 text-sm text-zhuhong">{{ betaMessage }}</p>
      </section>
      <section aria-label="界面适配范围" class="space-y-3">
        <h2 class="developer-eyebrow">交互组件适配</h2>
        <div v-for="[name, title, description] in blocks" :key="name" class="card developer-block">
          <p class="developer-eyebrow">{{ name }}</p><h3 class="font-medium mt-2">{{ title }}</h3><p class="text-sm text-ink-soft mt-1 leading-6">{{ description }}</p>
        </div>
      </section>
      <RouterLink to="/learn" class="btn-primary developer-start">进入学习页 <ArrowUpRight :size="17" /></RouterLink>
      <a href="https://bencho.dev/" target="_blank" rel="noopener noreferrer" class="developer-source text-ink-mute">交互设计参考 Bencho <ArrowUpRight :size="13" /></a>
    </div>
  </div>
</template>

<style scoped>
.developer-page { color: var(--ink); }
.developer-back { display: grid; place-items: center; width: 44px; height: 44px; border-radius: 50%; flex-shrink: 0; }
.developer-eyebrow { color: var(--ink-mute); font-size: 10px; letter-spacing: .1em; line-height: 1.8; }
.developer-control { padding: 24px; border-radius: 28px; }
.developer-icon { display: grid; place-items: center; width: 48px; height: 48px; border-radius: 16px; background: var(--soft); }
.developer-status { display: flex; gap: 6px; align-items: center; margin-top: 24px; font-size: 12px; color: var(--ink-soft); }
.developer-block { padding: 18px 20px; border-radius: 20px; }
.developer-start { display: flex; align-items: center; justify-content: center; gap: 10px; padding: 14px; border-radius: 999px; font-size: 14px; }
.developer-source { display: flex; align-items: center; justify-content: center; gap: 4px; font-size: 11px; }
</style>
