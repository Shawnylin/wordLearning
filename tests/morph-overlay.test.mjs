import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
const code = ts.transpileModule(readFileSync(new URL('../src/composables/useMorphOverlay.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
function setup(overrides = {}) {
  let cleanup, deactivate, activate, reduced = false
  const animations = [], ticks = [], doc = { activeElement: null }
  const rect = { left: 300, top: 24, width: 40, height: 40, right: 340 }
  function element(bounds = rect) {
    return { style: { visibility: '' }, computed: { borderRadius: '24px', backgroundColor: 'rgb(255, 255, 255)', opacity: '1' }, isConnected: true, tabIndex: 0,
      getBoundingClientRect: () => bounds, getClientRects: () => [bounds], matches: () => false,
      focus() { doc.activeElement = this }, querySelectorAll: () => [], contains: el => el === doc.activeElement,
      animate(frames, options) { const a = { frames, options, cancel() { this.cancelled = true; this.oncancel?.() } }; animations.push(a); return a },
    }
  }
  const trigger = element(), panel = element({ left: 12, top: 24, width: 369, height: 400, right: 381 })
  panel.firstElementChild = element()
  const exports = {}
  new Function('require', 'exports', 'getComputedStyle', 'matchMedia', 'innerWidth', 'innerHeight', 'document', code)(
    () => ({ ref: value => ({ value }), nextTick: () => new Promise(resolve => ticks.push(resolve)), onBeforeUnmount: fn => cleanup = fn, onDeactivated: fn => deactivate = fn, onActivated: fn => activate = fn }), exports,
    el => el.computed, () => ({ matches: reduced }), 393, 852, doc)
  const overlay = exports.useMorphOverlay({ trigger: { value: trigger }, panel: { value: panel }, maxWidth: 480, initialWidth: 360, topLimit: height => height - 120, ...overrides })
  return { overlay, trigger, panel, animations, doc, element, tick: async () => { ticks.splice(0).forEach(fn => fn()); await Promise.resolve() }, cleanup: () => cleanup(), deactivate: () => deactivate(), activate: () => activate(), reduce: () => reduced = true }
}
test('staged opening is invalidated by close/unmount and last open wins', async () => {
  const s = setup({ stagedMount: true })
  s.overlay.open(); s.overlay.close(); await s.tick()
  assert.equal(s.overlay.isOpen.value, false)
  s.overlay.open(); s.overlay.open(); await s.tick(); await s.tick()
  assert.equal(s.overlay.isOpen.value, true)
  s.overlay.close(); s.overlay.open(); s.cleanup(); await s.tick()
  assert.equal(s.doc.activeElement, s.panel)
  assert.equal(s.overlay.isOpen.value, false)
})
test('interrupted opening reads displayed geometry before cancel; stale callbacks cannot finish the new transition', () => {
  const s = setup(); let oldDone = 0, done = 0
  s.overlay.position(); s.overlay.morph(s.panel, () => oldDone++)
  const old = s.animations.at(-1), stale = old.onfinish
  assert.equal(old.options.duration, 720)
  assert.equal(old.options.easing, 'cubic-bezier(.32,0,.18,1)')
  assert.equal(old.frames[0].borderRadius, '20px')
  s.panel.getBoundingClientRect = () => ({ left: 90, top: 24, width: 200, height: 180 })
  s.panel.computed.borderRadius = '22px'; s.panel.firstElementChild.computed.opacity = '.4'
  s.overlay.morph(s.panel, () => done++, true)
  const close = s.animations.at(-1)
  assert.equal(close.frames[0].width, '200px'); assert.equal(close.frames[0].borderRadius, '22px')
  assert.equal(close.options.duration, 520); assert.equal(s.animations.at(-2).frames[0].opacity, '.4')
  stale(); assert.equal(oldDone, 0); assert.equal(s.overlay.morphing.value, true)
  close.onfinish(); assert.equal(done, 1); assert.equal(s.overlay.morphing.value, false)
  assert(s.animations.every(a => a.cancelled))
})
test('reduced motion, external cancellation and unmount release animation effects and source visibility', () => {
  const s = setup({ hideSource: true, sourceBackground: true, fill: 'both' }); let done = 0
  s.reduce(); s.overlay.position(); s.overlay.morph(s.panel, () => done++)
  assert.equal(s.animations.at(-1).options.duration, 1)
  s.animations.at(-1).cancel(); assert.equal(done, 1)
  s.overlay.morph(s.panel, () => done++, true)
  const stale = s.animations.at(-1).onfinish
  s.cleanup(); stale()
  assert.equal(done, 1); assert.equal(s.trigger.style.visibility, '')
  assert(s.animations.every(a => a.cancelled))
})
test('Tab contains empty dialogs and wraps enabled controls; Escape requests closing', () => {
  const s = setup(); let prevented = 0
  const key = (key, shiftKey = false) => s.overlay.keydown({ key, shiftKey, preventDefault: () => prevented++ })
  key('Tab'); assert.equal(s.doc.activeElement, s.panel)
  const first = s.element(), disabled = s.element(), last = s.element()
  disabled.matches = () => true; s.panel.querySelectorAll = () => [first, disabled, last]
  first.focus(); key('Tab', true); assert.equal(s.doc.activeElement, last)
  key('Tab'); assert.equal(s.doc.activeElement, first)
  s.overlay.isOpen.value = true; key('Escape'); assert.equal(s.overlay.isOpen.value, false)
  assert.equal(prevented, 4)
})

test('KeepAlive deactivation clears the overlay; focus return waits for rendering and cannot steal focus on reopen', async () => {
  const s = setup()
  s.overlay.position(); s.overlay.morph(s.panel, () => {})
  s.deactivate()
  assert.equal(s.overlay.isOpen.value, false)
  assert.equal(s.overlay.mounted.value, false)
  assert(s.animations.every(a => a.cancelled))
  let removed = false
  s.overlay.morph(s.panel, () => removed = true, true)
  assert(removed)
  s.activate()
  s.overlay.afterLeave(); assert.notEqual(s.doc.activeElement, s.trigger)
  await s.tick(); assert.equal(s.doc.activeElement, s.trigger)
  s.panel.focus(); s.overlay.afterLeave(); s.overlay.open()
  await s.tick(); assert.equal(s.doc.activeElement, s.panel)
})
