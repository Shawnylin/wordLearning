<script setup lang="ts">
import Motion from '../components/Motion.vue'
import { reactive, ref, watch } from 'vue'
import { Pencil, Plus, X } from 'lucide-vue-next'
import { useSettingsStore } from '../stores/settings'
import { apiEndpoint, fetchModels } from '../api/deepseek'
import { useMorphOverlay } from '../composables/useMorphOverlay'
import ApiKeyInput from './ApiKeyInput.vue'

const settings = useSettingsStore()
const draft = reactive({ id: '', name: '', apiKey: '', baseUrl: '', model: '', extraModel: '', models: [] as string[] })
const busy = ref('')
const message = ref('')
const failed = ref(false)
const addTrigger = ref<HTMLButtonElement>()
const providerDialog = ref<HTMLElement>()
const {
  isOpen: providerOpen, mounted: providerMounted, morphing: providerMorphing,
  placement: providerPlacement, open: openEditor, close: closeEditor,
  morph: providerMorph, keydown: providerKeydown, afterLeave: providerAfterLeave,
} = useMorphOverlay({
  trigger: addTrigger, panel: providerDialog, maxWidth: 520, initialWidth: 520,
  topLimit: height => height - Math.min(640, height - 24),
  stagedMount: true, sourceBackground: true, hideSource: true, fill: 'both',
  focusOptions: { preventScroll: true },
})

function loadActiveProfile() {
  const profile = settings.profiles.find(p => p.id === settings.activeProfileId)
  Object.assign(draft, profile ? { ...profile, models: [...profile.models], extraModel: '' } : { ...settings.apiConfig, id: '', name: 'DeepSeek', models: [] })
  message.value = ''
}
loadActiveProfile()
watch(() => [draft.baseUrl, draft.apiKey], () => { draft.models = []; message.value = '' }, { flush: 'sync' })
function editProfile(id: string, event?: Event) {
  const profile = settings.profiles.find(item => item.id === id)
  if (!profile) return
  Object.assign(draft, { ...profile, models: [...profile.models], extraModel: '' })
  void openEditor(event?.currentTarget instanceof HTMLElement ? event.currentTarget : undefined)
}
function add(event: Event) {
  Object.assign(draft, { id: '', name: '', apiKey: '', baseUrl: 'https://api.deepseek.com', model: '', extraModel: '', models: [] })
  message.value = ''
  void openEditor(event.currentTarget instanceof HTMLElement ? event.currentTarget : undefined)
}
async function run(action: 'models' | 'test') {
  busy.value = action
  message.value = ''
  failed.value = false
  try {
    const config = { ...draft }
    if (action === 'models') {
      draft.models = await fetchModels(config)

      message.value = `已获取 ${draft.models.length} 个模型`
    } else { draft.models = await fetchModels(config); message.value = '连接成功' }
  } catch (error) {
    failed.value = true
    message.value = error instanceof Error ? error.message : '请求失败'
  } finally { busy.value = '' }
}
function save() {
  try {
    apiEndpoint(draft.baseUrl, 'models')
    if (!draft.apiKey.trim()) throw new Error('请填写 API Key')
    const id = draft.id || crypto.randomUUID()
    settings.saveProfile({ id, name: draft.name.trim() || new URL(draft.baseUrl).hostname, apiKey: draft.apiKey.trim(), baseUrl: draft.baseUrl.trim(), model: draft.model.trim(), models: [...new Set([...draft.models, draft.model.trim(), draft.extraModel.trim()].filter(Boolean))] })
    draft.id = id
    failed.value = false
    message.value = '已保存'
    closeEditor()
  } catch (error) { failed.value = true; message.value = (error as Error).message }
}
function remove() { settings.deleteProfile(draft.id); loadActiveProfile(); closeEditor() }
</script>

<template>
  <section class="card settings-card model-settings">
    <header class="settings-card-header">
      <div>
        <h2 class="settings-title">模型服务商</h2>

      </div>
      <button ref="addTrigger" class="settings-icon-button settings-add-button" type="button" aria-label="添加模型服务商" @click="add"><Plus :size="18" /></button>
    </header>

    <div v-if="settings.profiles.length" class="settings-provider-list" aria-label="模型服务商列表">
      <div v-for="profile in settings.profiles" :key="profile.id" class="settings-provider-row">
        <button class="settings-provider-main" type="button" @click="editProfile(profile.id, $event)">

          <span class="settings-provider-copy"><strong>{{ profile.name || profile.model }}</strong><small class="break-all">{{ profile.models.length }} 个模型</small></span>

        </button>
        <div class="settings-provider-actions">
          <button class="settings-row-icon" type="button" aria-label="编辑模型服务商" @click="editProfile(profile.id, $event)"><Pencil :size="16" /></button>
        </div>
      </div>
    </div>
    <div v-else class="settings-empty-row">

      <span>点击右上角添加服务商</span>
    </div>

  </section>

  <Teleport to="body">
    <div v-if="providerMounted" class="provider-editor-layer" @pointerdown.self="closeEditor">
      <div class="provider-editor-backdrop" aria-hidden="true" @pointerdown="closeEditor" />
      <Transition
        appear
        :css="false"
        @enter="(el, done) => providerMorph(el, done)"
        @leave="(el, done) => providerMorph(el, done, true)"
        @after-leave="providerAfterLeave"
      >
        <section
          v-if="providerOpen"
          ref="providerDialog"
          class="provider-editor-dialog"
          :class="{ 'is-morphing': providerMorphing }"
          :style="providerPlacement"
          role="dialog"
          aria-modal="true"
          aria-label="模型服务商配置"
          tabindex="-1"
          @keydown="providerKeydown"
        >
          <div class="provider-editor-content">
            <header class="provider-editor-heading">
              <div><h2>{{ draft.id ? '编辑服务商' : '添加服务商' }}</h2></div>
              <button class="provider-editor-close" type="button" aria-label="关闭模型服务商配置" @click="closeEditor"><X :size="18" /></button>
            </header>
            <fieldset :disabled="!!busy" class="settings-form">
              <label class="settings-label">名称<input v-model="draft.name" placeholder="例如：DeepSeek 或 小米 MiMo" /></label>
              <label class="settings-label">API 地址<input v-model="draft.baseUrl" type="url" placeholder="https://api.deepseek.com" autocomplete="off" autocapitalize="off" spellcheck="false" /></label>
              <label class="settings-label">API Key<ApiKeyInput v-model="draft.apiKey" /></label>
            </fieldset>
            <div class="settings-model-picker">
              <div class="settings-model-picker-head"><span>模型</span><button class="settings-text-button" :disabled="!!busy" type="button" @click="run('models')">{{ busy === 'models' ? '获取中…' : '获取列表' }}</button></div>
              <div v-if="draft.models.length" class="provider-model-list" aria-label="可用模型"><span v-for="model in draft.models" :key="model">{{ model }}</span></div>
              <label class="settings-label">补充模型名称<input v-model="draft.extraModel" placeholder="可选，接口不提供列表时填写" autocapitalize="off" spellcheck="false" /></label>
            </div>
            <div class="settings-actions provider-editor-actions">
              <button class="btn-primary" type="button" :disabled="!!busy" @click="save">保存</button>
              <button v-if="draft.id" class="settings-secondary" type="button" :disabled="!!busy" @click="remove">删除此配置</button>
              <button v-else class="settings-secondary" type="button" :disabled="!!busy" @click="run('test')">{{ busy === 'test' ? '测试中…' : '测试连接' }}</button>
            </div>
            <Motion><p v-if="message" role="status" class="settings-status break-words" :class="failed ? 'text-zhuhong' : 'text-bamboo'">{{ message }}</p></Motion>

          </div>
        </section>
      </Transition>
    </div>
  </Teleport>
</template>

<style scoped>
.provider-editor-dialog.is-morphing { overflow: hidden; pointer-events: none; }
.provider-model-list { display: flex; flex-wrap: wrap; gap: 6px; max-height: 140px; overflow: auto; }
.provider-model-list span { padding: 4px 7px; border-radius: 6px; background: var(--card); font-size: 12px; overflow-wrap: anywhere; }
button:disabled { opacity: .5; cursor: wait; }

input, select { display: block; width: 100%; min-width: 0; margin-top: 6px; padding: 12px; border: 1px solid var(--line); border-radius: 12px; background: var(--soft); color: var(--ink); font-size: 16px; }
input:focus, select:focus { outline: 2px solid var(--zhuhong); outline-offset: 2px; }
fieldset:disabled { opacity: .65; }
.provider-editor-layer { position: fixed; inset: 0; z-index: 90; }
.provider-editor-backdrop { position: absolute; inset: 0; background: rgb(18 16 13 / 18%); backdrop-filter: blur(3px); }
.provider-editor-dialog { position: fixed; max-height: calc(100dvh - 24px); overflow-y: auto; border: 1px solid var(--line); border-radius: 24px; background: var(--card); color: var(--ink); box-shadow: 0 18px 60px rgb(25 19 12 / 22%); outline: none; }
.provider-editor-content { display: grid; gap: 14px; padding: 20px; }
.provider-editor-heading { display: flex; min-width: 0; align-items: flex-start; justify-content: space-between; gap: 16px; padding-bottom: 14px; border-bottom: 1px solid var(--line); }
.provider-editor-heading h2 { color: var(--ink); font-size: 16px; font-weight: 600; line-height: 1.4; }
.provider-editor-heading p:last-child { margin-top: 4px; color: var(--ink-mute); font-size: 11px; line-height: 1.55; }
.provider-editor-close { display: grid; width: 36px; height: 36px; flex: none; place-items: center; border-radius: 50%; background: var(--soft); color: var(--ink-soft); }
.provider-editor-close:hover { color: var(--zhuhong); }
.provider-editor-dialog .settings-form { display: grid; gap: 11px; }
.provider-editor-dialog .settings-label { display: block; color: var(--ink-soft); font-size: 13px; font-weight: 500; line-height: 1.45; }
.provider-editor-dialog .settings-model-picker { display: grid; gap: 7px; padding: 11px 12px; border: 1px solid var(--line); border-radius: 13px; background: var(--soft); }
.provider-editor-dialog .settings-model-picker-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; color: var(--ink-soft); font-size: 13px; font-weight: 500; }
.provider-editor-dialog .settings-model-picker select { min-width: 0; border: 1px solid var(--line); border-radius: 12px; background: var(--card); color: var(--ink); }
.provider-editor-dialog .settings-model-current { display: grid; gap: 3px; color: var(--ink); font-size: 12px; }
.provider-editor-dialog .settings-model-current span { color: var(--ink-mute); font-size: 10px; }
.provider-editor-dialog .settings-actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.provider-editor-dialog .settings-actions > button { min-height: 40px; border-radius: 11px; padding: 9px 10px; font-size: 12px; }
.provider-editor-dialog .settings-secondary { border-radius: 11px; background: var(--soft); color: var(--ink-soft); }
.provider-editor-dialog .settings-text-button { color: var(--zhuhong); font-size: 11px; }
.provider-editor-dialog .settings-status { padding: 8px 10px; border-radius: 10px; background: var(--soft); font-size: 11px; line-height: 1.5; }
.provider-editor-dialog .settings-status.text-zhuhong { border: 1px solid color-mix(in srgb, var(--zhuhong) 30%, transparent); background: var(--zhuhong-soft); }
.provider-editor-dialog .settings-footnote { color: var(--ink-mute); font-size: 10px; line-height: 1.6; }
@media (max-width: 520px) { .provider-editor-dialog { max-height: min(84dvh, 760px); } .provider-editor-content { padding: 17px; } }
@media (min-width: 768px) {
  input, select { margin-top: 4px; padding: 9px 11px; font-size: 15px; }
}
@media (prefers-reduced-motion: reduce) { .provider-editor-backdrop { backdrop-filter: none; } }
</style>
