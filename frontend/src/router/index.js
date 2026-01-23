import { createRouter, createWebHistory } from 'vue-router'
import AgvMonitor from '../views/AgvMonitor.vue'
import AgvRemoteManager from '../views/AgvRemoteManager.vue'
import AgvConfigurator from '../views/AgvConfigurator.vue'

const routes = [
    {
        path: '/',
        redirect: '/monitor'
    },
    {
        path: '/monitor',
        name: 'AgvMonitor',
        component: AgvMonitor
    },
    {
        path: '/remote',
        name: 'AgvRemoteManager',
        component: AgvRemoteManager
    },
    {
        path: '/configurator',
        name: 'AgvConfigurator',
        component: AgvConfigurator
    }
]

const router = createRouter({
    history: createWebHistory(),
    routes
})

export default router
