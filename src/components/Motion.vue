<script setup lang="ts">
// Animate actual block height so adjacent content follows expanding/collapsing UI.
const animations = new WeakMap<Element, Animation>()
function run(el: Element, done: () => void, entering: boolean) {
  const node = el as HTMLElement
  animations.get(el)?.cancel()
  // Finish after Vue's patch, including when a loading state changes synchronously.
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { queueMicrotask(done); return }
  const style = getComputedStyle(node)
  const full = { height: `${node.getBoundingClientRect().height}px`, opacity: '1', marginTop: style.marginTop, marginBottom: style.marginBottom, paddingTop: style.paddingTop, paddingBottom: style.paddingBottom }
  const collapsed = { height: '0px', opacity: '0', marginTop: '0px', marginBottom: '0px', paddingTop: '0px', paddingBottom: '0px' }
  const fixed = style.position === 'fixed' || style.position === 'absolute' || style.display === 'inline'
  const frames = fixed ? [{ opacity: 0 }, { opacity: 1 }] : [collapsed, full]
  const overflow = node.style.overflow
  const inert = node.inert
  if (!entering) node.inert = true
  if (!fixed) node.style.overflow = 'clip'
  const duration = Number.parseFloat(style.getPropertyValue('--motion-content-duration')) || 220
  const animation = node.animate(entering ? frames : [...frames].reverse(), { duration, easing: 'cubic-bezier(.22,1,.36,1)' })
  animations.set(el, animation)
  const restore = () => { node.style.overflow = overflow; node.inert = inert; animations.delete(el) }
  animation.onfinish = () => { restore(); done() }
  animation.oncancel = restore
}
function cancel(el: Element) { animations.get(el)?.cancel() }
</script>

<template>
  <Transition :css="false" mode="out-in" @enter="(el, done) => run(el, done, true)" @leave="(el, done) => run(el, done, false)" @enter-cancelled="cancel" @leave-cancelled="cancel">
    <slot />
  </Transition>
</template>
