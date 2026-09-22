import { nextTick, onActivated, onBeforeUnmount, onDeactivated, ref, type Ref } from 'vue'

interface MorphOverlayOptions {
  trigger: Ref<HTMLElement | undefined>
  panel: Ref<HTMLElement | undefined>
  maxWidth: number
  initialWidth: number
  topLimit: (height: number) => number
  stagedMount?: boolean
  liveOrigin?: boolean
  sourceBackground?: boolean
  hideSource?: boolean
  fill?: FillMode
  focusOptions?: FocusOptions
  onClose?: () => void
}

/** Shared mechanics only: the caller owns its template, fixed-position CSS and layout policy. */
export function useMorphOverlay(options: MorphOverlayOptions) {
  const isOpen = ref(false)
  const mounted = ref(false)
  const morphing = ref(false)
  const placement = ref({ left: '0px', top: '0px', width: `${options.initialWidth}px` })
  let source: HTMLElement | undefined
  let origin: DOMRect | undefined
  let sourceVisibility = ''
  let hiddenSource: HTMLElement | undefined
  let animation: Animation | undefined
  let contentAnimation: Animation | undefined
  let animatedElement: HTMLElement | undefined
  let interrupted: { frame: Keyframe; opacity: string } | undefined
  let request = 0
  let disposed = false
  let active = true

  function restoreSource() {
    if (hiddenSource) hiddenSource.style.visibility = sourceVisibility
    hiddenSource = undefined
  }
  function cancelAnimations() {
    if (animation) {
      animation.onfinish = null
      animation.oncancel = null
      animation.cancel()
      animation = undefined
    }
    contentAnimation?.cancel()
    contentAnimation = undefined
  }
  function currentFrame(element: HTMLElement) {
    const rect = element.getBoundingClientRect()
    const style = getComputedStyle(element)
    const inner = element.firstElementChild
    return {
      frame: { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px`, borderRadius: style.borderRadius, backgroundColor: style.backgroundColor, opacity: 1 },
      opacity: inner ? getComputedStyle(inner).opacity : '1',
    }
  }
  function position(nextSource?: HTMLElement) {
    source = nextSource || source || options.trigger.value
    origin = source?.getBoundingClientRect()
    if (!origin) return
    const width = Math.min(options.maxWidth, innerWidth - 24)
    placement.value = {
      left: `${Math.max(12, Math.min(origin.right - width, innerWidth - width - 12))}px`,
      top: `${Math.max(12, Math.min(origin.top, options.topLimit(innerHeight)))}px`,
      width: `${width}px`,
    }
  }
  async function open(nextSource?: HTMLElement) {
    if (disposed || !active || isOpen.value) return
    const ticket = ++request
    if (animation && animatedElement) interrupted = currentFrame(animatedElement)
    if (nextSource && nextSource !== source) restoreSource()
    position(nextSource || options.trigger.value)
    mounted.value = true
    if (options.stagedMount) await nextTick()
    if (disposed || !active || ticket !== request) return
    isOpen.value = true
    await nextTick()
    if (!disposed && ticket === request && isOpen.value) options.panel.value?.focus(options.focusOptions)
  }
  function close() {
    ++request // Invalidates both mount and focus continuations.
    isOpen.value = false
    if (!animation && !options.panel.value) mounted.value = false
    options.onClose?.()
  }
  async function afterLeave() {
    if (disposed || !active || isOpen.value) return
    mounted.value = false
    restoreSource()
    const ticket = request
    // Vue must first remove the trigger's reactive visibility:hidden style.
    await nextTick()
    if (disposed || !active || isOpen.value || ticket !== request) return
    const target = source?.isConnected ? source : options.trigger.value
    target?.focus({ preventScroll: true })
  }
  function keydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault()
      close()
      return
    }
    const panel = options.panel.value
    if (event.key !== 'Tab' || !panel) return
    const controls = [...panel.querySelectorAll<HTMLElement>('button, input, select, textarea, a[href], [tabindex]')]
      .filter(control => control.tabIndex >= 0 && !control.matches(':disabled, [hidden], [inert], [inert] *') && control.getClientRects().length > 0 && getComputedStyle(control).visibility !== 'hidden')
    const first = controls[0], last = controls[controls.length - 1]
    const active = document.activeElement
    if (!first) {
      event.preventDefault()
      panel.focus()
    } else if (event.shiftKey && (active === first || active === panel || !panel.contains(active))) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && (active === last || active === panel || !panel.contains(active))) {
      event.preventDefault()
      first.focus()
    }
  }
  function morph(el: Element, done: () => void, leaving = false) {
    if (disposed || !active) { done(); return }
    const element = el as HTMLElement
    // Read before cancellation so a reversal starts at the displayed frame.
    const current = currentFrame(element)
    const previous = interrupted || (animation && !leaving && animatedElement ? currentFrame(animatedElement) : undefined)
    interrupted = undefined
    cancelAnimations()
    const end = leaving ? current.frame : currentFrame(element).frame
    const start = (options.liveOrigin ? options.trigger.value?.getBoundingClientRect() : origin) || origin || options.trigger.value?.getBoundingClientRect() || element.getBoundingClientRect()
    const small: Keyframe = {
      left: `${start.left}px`, top: `${start.top}px`, width: `${start.width}px`, height: `${start.height}px`,
      borderRadius: `${Math.min(start.width, start.height) / 2}px`,
      backgroundColor: options.sourceBackground ? getComputedStyle(source || element).backgroundColor : 'var(--card)', opacity: 1,
    }
    const large = { ...end, borderRadius: leaving ? current.frame.borderRadius : '24px', backgroundColor: leaving && options.sourceBackground ? current.frame.backgroundColor : 'var(--card)' }
    const duration = matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : leaving ? 520 : 720
    morphing.value = true
    animatedElement = element
    if (options.hideSource && source && !hiddenSource) {
      hiddenSource = source
      sourceVisibility = source.style.visibility
      source.style.visibility = 'hidden'
    }
    const inner = element.firstElementChild as HTMLElement | null
    contentAnimation = inner?.animate(
      leaving ? [{ opacity: current.opacity }, { opacity: 0, offset: .35 }, { opacity: 0 }]
        : [{ opacity: previous?.opacity || 0 }, { opacity: previous?.opacity || 0, offset: .22 }, { opacity: 1, offset: .85 }, { opacity: 1 }],
      { duration, fill: 'both', easing: 'linear' },
    )
    const running = element.animate(leaving ? [large, small] : [previous?.frame || small, large], {
      duration, ...(options.fill ? { fill: options.fill } : {}), easing: 'cubic-bezier(.32,0,.18,1)',
    })
    animation = running
    const finish = () => {
      if (disposed || animation !== running) return
      cancelAnimations()
      animatedElement = undefined
      morphing.value = false
      if (leaving) restoreSource()
      done()
    }
    running.onfinish = finish
    running.oncancel = finish
  }
  function cleanup() {
    active = false
    isOpen.value = false
    mounted.value = false
    ++request
    cancelAnimations()
    interrupted = undefined
    animatedElement = undefined
    morphing.value = false
    restoreSource()
  }
  onDeactivated(cleanup)
  onActivated(() => { active = true })
  onBeforeUnmount(() => { disposed = true; cleanup() })
  return { isOpen, mounted, morphing, placement, position, open, close, afterLeave, keydown, morph }
}

