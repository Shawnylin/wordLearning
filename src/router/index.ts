import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: '/learn'
    },
    {
      path: '/learn',
      name: 'learn',
      component: () => import('../views/LearnView.vue')
    },
    {
      path: '/compare',
      name: 'compare',
      redirect: to => ({ path: '/learn', query: { ...to.query, mode: 'compare' } })
    },
    {
      path: '/record',
      name: 'record',
      component: () => import('../views/RecordView.vue')
    },
    {
      path: '/report',
      name: 'report',
      component: () => import('../views/DailyView.vue')
    },
    {
      path: '/review',
      name: 'review',
      component: () => import('../views/ReviewView.vue')
    },
    {
      path: '/profile/models',
      name: 'models',
      component: () => import('../views/ModelSettingsView.vue')
    },
    {
      path: '/profile/account',
      name: 'account',
      component: () => import('../views/ProfileAccountView.vue')
    },
    {
      path: '/profile/changelog',
      name: 'changelog',
      component: () => import('../views/ChangelogView.vue')
    },
    { path: '/profile/settings', redirect: '/profile' },
    {
      path: '/profile',
      name: 'profile',
      component: () => import('../views/ProfileView.vue')
    }
  ]
})

export default router
