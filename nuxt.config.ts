export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  css: ['~/assets/css/main.css'],
  experimental: {
    // 旧URLの .html をファイルとして生成できるよう、画面データをHTML内に保持する。
    payloadExtraction: false,
  },
  nitro: {
    prerender: {
      // ボタンから遷移するページと旧URLも、静的HTMLを明示的に生成する。
      routes: [
        '/',
        '/login',
        '/index.html',
        '/registration',
        '/main',
        '/Front/Html/Registration.html',
        '/Front/Html/Main.html',
      ],
    },
  },
  runtimeConfig: {
    public: {
      apiBase: '/Back/Api',
      legacyWorkPath: '/Front/Html/WorkManagement.html',
    },
  },
  app: {
    head: {
      htmlAttrs: { lang: 'ja' },
      link: [
        {
          rel: 'stylesheet',
          href: 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
        },
        {
          rel: 'icon',
          type: 'image/svg+xml',
          href: '/images/book-solid.svg',
        },
      ],
    },
  },
})
