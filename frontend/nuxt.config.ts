import { fileURLToPath } from 'node:url'

export default defineNuxtConfig({
  ssr: false,
  compatibilityDate: "2024-04-03",
  devtools: { enabled: true },
  css: ["~/assets/css/main.css"],
  postcss: {
    plugins: {
      tailwindcss: {},
      autoprefixer: {},
    },
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
    "shadcn-nuxt",
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
  shadcn: {
    /**
     * Prefix for all the imported component
     */
    prefix: "",
    /**
     * Directory that the component lives in.
     * @default "./components/ui"
     */
    componentDir: "./app/components/ui",
  },
  plugins: ["~/plugins/auto-animate.ts"],
});
