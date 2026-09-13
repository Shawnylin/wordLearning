<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Heart, RefreshCw } from 'lucide-vue-next'
import type { IdiomData } from '../types/idiom'
import { useIdiomStore } from '../stores/idiom'
const props = defineProps<{ idiom: IdiomData; loading: boolean }>()
const emit = defineEmits<{ regenerate: []; relatedClick: [word: string] }>()
const store = useIdiomStore()
const tabs = [{ key: 'explanation', label: '释义' }, { key: 'usage', label: '用法' }, { key: 'example', label: '例句' }, { key: 'origin', label: '出处' }, { key: 'relatedIdioms', label: '相关' }] as const
const active = ref<typeof tabs[number]['key']>('explanation')
const scroller = ref<HTMLElement>()
const text = computed(() => active.value === 'relatedIdioms' ? '' : props.idiom[active.value])
watch(() => props.idiom.word, () => { active.value = 'explanation' })
watch(active, () => scroller.value?.scrollTo({ top: 0 }))
</script>
<template>
  <div class="word-content">
    <div class="flex items-center gap-2 px-4 pt-3 pb-2 shrink-0">
      <div class="flex-1 min-w-0"><h2 class="font-kai text-2xl break-words">{{ idiom.word }}</h2><p class="text-xs text-ink-mute mt-1">{{ idiom.pinyin }}</p></div>
      <button @click="store.toggleFavorite(idiom.word)" class="p-2 rounded-full bg-soft" :aria-label="store.isFavorite(idiom.word) ? '取消收藏' : '收藏词语'"><Heart :size="17" :fill="store.isFavorite(idiom.word) ? 'currentColor' : 'none'" /></button>
      <button @click="emit('regenerate')" :disabled="loading" class="p-2 rounded-full bg-soft disabled:opacity-50" aria-label="重新生成词语"><RefreshCw :size="17" :class="{ 'animate-spin': loading }" /></button>
    </div>
    <div class="flex gap-1 px-3 pb-2 shrink-0" role="tablist" aria-label="词语学习内容">
      <button v-for="tab in tabs" :key="tab.key" role="tab" :aria-selected="active === tab.key" :aria-controls="'daily-word-' + tab.key" :id="'daily-tab-' + tab.key" @click="active = tab.key" class="flex-1 py-2 rounded-full text-xs transition-colors" :class="active === tab.key ? 'bg-zhuhong-soft text-zhuhong' : 'text-ink-mute bg-soft'">{{ tab.label }}</button>
    </div>
    <div ref="scroller" class="word-pane" role="tabpanel" :id="'daily-word-' + active" :aria-labelledby="'daily-tab-' + active" tabindex="0">
      <Transition name="word-pane" mode="out-in"><div :key="active">
        <div v-if="active === 'relatedIdioms'" class="flex flex-wrap gap-2"><button v-for="word in idiom.relatedIdioms" :key="word" @click="emit('relatedClick', word)" :disabled="loading" class="rounded-full px-4 py-2 bg-soft text-sm disabled:opacity-50">{{ word }}</button><p v-if="!idiom.relatedIdioms.length" class="text-ink-mute text-sm">{{ loading ? '正在生成相关成语…' : '暂无相关成语' }}</p></div>
        <p v-else class="text-sm leading-7 whitespace-pre-wrap break-words">{{ text || (loading ? '正在生成…' : '暂无内容') }}</p>
      </div></Transition>
    </div>
    <footer class="text-[10px] text-ink-mute px-4 py-2 shrink-0 border-t border-line">{{ loading ? '正在生成，内容实时更新…' : `已保存到记录 · ${idiom.tokenUsage ?? 0} tokens` }}</footer>
  </div>
</template>
<style scoped>
.word-content { display: flex; flex-direction: column; height: 100%; min-height: 0; }
.word-pane { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: 4px 18px 12px; }
.word-pane-enter-active,.word-pane-leave-active { transition: opacity .12s ease; }
.word-pane-enter-from,.word-pane-leave-to { opacity: 0; }
@media (prefers-reduced-motion: reduce) { .word-pane-enter-active,.word-pane-leave-active { transition: none; } }
</style>
