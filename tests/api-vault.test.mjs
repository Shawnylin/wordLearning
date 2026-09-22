import assert from 'node:assert/strict'
import { test } from 'node:test'
import { build } from 'esbuild'
const result = await build({entryPoints:['src/utils/apiVaultCrypto.ts'],bundle:true,write:false,platform:'node',format:'esm'})
const { deriveVaultKey, newVaultSalt, encryptApiSettings, decryptApiSettings, readEncryptedApiSettings } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)
test('API vault encrypts, restores across devices and authenticates account and metadata', async () => {
 const salt=newVaultSalt(), key=await deriveVaultKey('a sufficiently long test phrase',salt)
 const data={profiles:[{apiKey:'test-secret-never-plaintext',models:['mimo-audio','mimo-pdf']}]}
 const envelope=await encryptApiSettings(data,key,salt,'user-a',100)
 assert.equal(key.extractable,false)
 assert(!JSON.stringify(envelope).includes(data.profiles[0].apiKey))
 const deviceKey=await deriveVaultKey('a sufficiently long test phrase',envelope.salt)
 assert.deepEqual(await decryptApiSettings(envelope,deviceKey,'user-a'),data)
 await assert.rejects(decryptApiSettings(envelope,deviceKey,'user-b'))
 await assert.rejects(decryptApiSettings({...envelope,updatedAt:101},deviceKey,'user-a'))
 const wrongKey=await deriveVaultKey('a different wrong test phrase',salt)
 await assert.rejects(decryptApiSettings(envelope,wrongKey,'user-a'))
 const second=await encryptApiSettings(data,key,salt,'user-a',100)
 assert.notEqual(second.iv,envelope.iv)
 assert.notEqual(second.ciphertext,envelope.ciphertext)
 assert.deepEqual(readEncryptedApiSettings(envelope),envelope)
 assert.throws(()=>readEncryptedApiSettings({...envelope,iv:'bad'}))
 assert.throws(()=>readEncryptedApiSettings({...envelope,version:2}))
})
