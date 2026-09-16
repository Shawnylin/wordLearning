import type { App } from 'vue'
import type { Router } from 'vue-router'
import { BETA_KEY, BETA_PATH, betaEnabled, betaUnlocked, disposeBeta, setBetaEnabled } from './state'

// One install hook owns routing, persistence, cross-tab changes and cleanup.
export function installDeveloperBeta(app: App, router: Router) {
  const removeRoute = router.addRoute({
    path: BETA_PATH,
    name: 'developer-beta',
    component: () => import('./DeveloperView.vue'),
    beforeEnter: () => betaUnlocked.value || betaEnabled.value || savedEnabled() || '/profile',
  })
  function savedEnabled() {
    try { return localStorage.getItem(BETA_KEY) === '1' } catch { return false }
  }
  if (savedEnabled()) void setBetaEnabled(true, false)
  function sync(event: StorageEvent) {
    if (event.storageArea === localStorage && (event.key === BETA_KEY || event.key === null)) {
      void setBetaEnabled(event.newValue === '1', false)
    }
  }
  window.addEventListener('storage', sync)
  app.onUnmount(() => {
    window.removeEventListener('storage', sync)
    removeRoute()
    disposeBeta()
  })
}
