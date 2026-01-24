/// <reference types="node" />
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  ssr: false,
  compatibilityDate: '2024-04-03',
  app: {
    head: {
      link: [{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }]
    }
  },
  devtools: { enabled: true },
  css: ['~/assets/css/main.css'],
  vite: {
    plugins: [tailwindcss()]
  },
  runtimeConfig: {
    public: {
      apiUrl: process.env.API_URL
    }
  },
  alias: {
    '@': fileURLToPath(new URL('./app', import.meta.url))
  },
  modules: [
    '@nuxt/ui',
    '@nuxt/eslint',
    '@nuxtjs/color-mode',
    '@nuxtjs/i18n',
    '@pinia/nuxt',
    '@vueuse/nuxt',
    '@formkit/auto-animate/nuxt'
  ],
  routeRules: {
    '/': { prerender: true }
  },
  i18n: {
    strategy: 'prefix_and_default',
    langDir: 'locales',
    defaultLocale: 'fr',
    locales: [
      {
        code: 'fr',
        file: 'fr.json'
      },
      {
        code: 'en',
        file: 'en.json'
      }
    ],
    vueI18n: './i18n/i18n.config.ts'
  },
  colorMode: {
    classSuffix: ''
  }
})
