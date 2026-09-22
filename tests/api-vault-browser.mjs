import assert from 'node:assert/strict'
import { launchBrowser, base } from './helpers/browser.mjs'
const browser = await launchBrowser()
const contexts=[]
async function device(){const context=await browser.newContext();contexts.push(context);const page=await context.newPage();await page.route('https://**/*',r=>r.fulfill({json:{}}));await page.goto(`${base}#/profile/models`);await page.getByRole('button',{name:'添加模型服务商',exact:true}).waitFor();return page}
const first=await device()
const encrypted=await first.evaluate(async()=>{
 const {useSettingsStore}=await import('/wordLearning/src/stores/settings.ts');const s=useSettingsStore()
 s.saveProfile({id:'mimo',name:'MiMo',apiKey:'mock-encrypted-key',baseUrl:'https://api.xiaomimimo.com/v1',model:'mimo-pdf',models:['mimo-pdf','mimo-tts']})
 s.pdfProfileId='mimo';s.pdfConfig={apiKey:'mock-encrypted-key',baseUrl:'https://api.xiaomimimo.com/v1',model:'mimo-pdf'}
 s.speechProfileId='mimo';s.speechConfig={...s.speechConfig,apiKey:'mock-encrypted-key',baseUrl:'https://api.xiaomimimo.com/v1',model:'mimo-tts'}
 const {useApiVaultStore}=await import('/wordLearning/src/stores/apiVault.ts');const vault=useApiVaultStore();await vault.initialize('test-user');await vault.unlock('test-only-long-passphrase',true)
 const {buildLocalSyncPayload,saveRemoteSyncPayload,mergeSyncPayload}=await import('/wordLearning/src/services/cloudSync.ts')
 const local=await buildLocalSyncPayload();const {cloudbaseRdb}=await import('/wordLearning/src/services/cloudbase.ts');let wire
 cloudbaseRdb.from=()=>({upsert:async value=>{wire=value;return {error:null}}})
 await saveRemoteSyncPayload('test-user',local)
 const merged=mergeSyncPayload({...local,apiSettings:undefined},local)
 return {envelope:vault.envelope,wire:JSON.stringify(wire),merged:merged.apiSettings,unlocked:vault.unlocked}
})
assert(encrypted.unlocked);assert(!encrypted.wire.includes('mock-encrypted-key'));assert.deepEqual(encrypted.merged,encrypted.envelope)
const second=await device()
const restored=await second.evaluate(async envelope=>{
 const {useApiVaultStore}=await import('/wordLearning/src/stores/apiVault.ts');const {useSettingsStore}=await import('/wordLearning/src/stores/settings.ts');const v=useApiVaultStore(),s=useSettingsStore();await v.initialize('test-user');await v.accept(envelope)
 let rejected=false;try{await v.unlock('wrong-long-passphrase',false)}catch{rejected=true}
 const untouched=s.profiles.length===0
 await v.unlock('test-only-long-passphrase',true)
 const restored={pdf:s.pdfConfig.model,speech:s.speechConfig.model,count:s.profiles.length,key:s.pdfConfig.apiKey}
 s.saveProfile({...s.profiles[0],apiKey:'rotated-test-key'})
 const propagated=s.pdfConfig.apiKey==='rotated-test-key'&&s.speechConfig.apiKey==='rotated-test-key'
 await v.capture()
 await v.initialize('different-user')
 return {rejected,untouched,restored,propagated,cleared:s.profiles.length===0&&s.apiKey===''&&s.pdfConfig.apiKey===''&&s.speechConfig.apiKey===''}
},encrypted.envelope)
assert(restored.rejected&&restored.untouched&&restored.propagated&&restored.cleared)
assert.deepEqual(restored.restored,{pdf:'mimo-pdf',speech:'mimo-tts',count:1,key:'mock-encrypted-key'})
await first.reload();await first.getByRole('button',{name:'添加模型服务商',exact:true}).waitFor()
const remembered=await first.evaluate(async()=>{const {useApiVaultStore}=await import('/wordLearning/src/stores/apiVault.ts');const v=useApiVaultStore();await v.initialize('test-user');return v.unlocked})
assert(remembered)
console.log(JSON.stringify({passed:['ciphertext-only cloud payload','encrypted merge preservation','second-device restore','wrong-password preserves local data','credential rotation reaches PDF and speech','cross-account credential isolation','non-extractable remembered device key']}))
await browser.close()
