import { createApp } from 'vue'
import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import App from './App.vue'
import router from './router'
import './styles/main.css'
import { installDeveloperBeta } from './features/developerBeta'

if (sessionStorage.getItem('app-update-transition') === '1') {
  sessionStorage.removeItem('app-update-transition')
  document.documentElement.classList.add('app-update-entering')
  setTimeout(() => {
    document.documentElement.classList.remove('app-update-entering')
  }, 760)
}

const app = createApp(App)
const pinia = createPinia()
pinia.use(piniaPluginPersistedstate)

app.use(pinia)
installDeveloperBeta(app, router)
app.use(router)
app.mount('#app')
