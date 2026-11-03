import type { SessionManager } from '../utils/sessionManager'

declare module '#app' {
  interface NuxtApp {
    $authSession: SessionManager
  }
  interface PageMeta {
    requiresAuth?: boolean
    requiresAdmin?: boolean
    guestOnly?: boolean
  }
}

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
    requiresAdmin?: boolean
    guestOnly?: boolean
  }
}

export {}
