// iOS can restore the visual viewport after blur returns. Measure the orb only
// after that movement settles; hardware keyboards and desktop need no delay.
export async function settleViewportAfterBlur() {
  const viewport = window.visualViewport
  const keyboardVisible = viewport && viewport.scale === 1 &&
    document.documentElement.clientHeight - viewport.height > 120
  const active = document.activeElement
  if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) active.blur()
  if (!keyboardVisible || !viewport) return

  await new Promise<void>(resolve => {
    const start = performance.now()
    let changedAt = start
    let previous = ''
    const sample = () => {
      const now = performance.now()
      const position = `${viewport.height}:${viewport.offsetTop}:${window.scrollY}:${document.getElementById('app')?.scrollTop}`
      if (position !== previous) { previous = position; changedAt = now }
      const restored = document.documentElement.clientHeight - viewport.height < 120
      if ((restored && now - changedAt >= 100) || now - start >= 1000) resolve()
      else requestAnimationFrame(sample)
    }
    requestAnimationFrame(sample)
  })
}
