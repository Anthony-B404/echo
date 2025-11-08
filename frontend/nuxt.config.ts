import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  ssr: false,
  compatibilityDate: "2024-04-03",
  devtools: { enabled: true },
  css: ["~/assets/css/main.css"],
  vite: {
    plugins: [
      tailwindcss(),
    ],
  },
  runtimeConfig: {
    public: {
      apiUrl: process.env.API_URL,
    },
  },
  alias: {
    '@': fileURLToPath(new URL('./app', import.meta.url)),
  },
  modules: [
    "@nuxtjs/color-mode",
    "@nuxtjs/i18n",
    "@pinia/nuxt",
  ],
  i18n: {
    strategy: "prefix_and_default",
    langDir: "./locales",
    defaultLocale: "fr",
    lazy: true,
    locales: [
      {
        code: "fr",
        file: "fr.json",
      },
    ],
  },
  colorMode: {
    classSuffix: "",
  },
});
