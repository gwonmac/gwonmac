import ginko from "./ginko.config.ts";

// The site is the Ginko Docs layer with its own frame (header, footer, search, language menu, light and dark): this
// project brings the content (content/), the start page (app/pages/index.vue), the server routes (server/), the
// texts of its own links (i18n/) and app/app.config.ts.
export default defineNuxtConfig({
  compatibilityDate: "2026-11-01",
  extends: ["@lupinum/ginko-docs"],
  modules: ["@lupinum/ginko/nuxt"],
  ginko,
  app: {
    head: {
      link: [
        { rel: "icon", type: "image/png", href: "/favicon-96x96.png", sizes: "96x96" },
        { rel: "shortcut icon", href: "/favicon.ico" },
        { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
        { rel: "manifest", href: "/site.webmanifest" },
      ],
      meta: [
        { name: "apple-mobile-web-app-title", content: "gwonmac" },
        {
          name: "google-site-verification",
          content: "mFA4hQqscVMdgB5EefYAjQxRZRBYMDJeJ7Rqbx76ewk",
        },
      ],
      script: [
        {
          async: true,
          src: "https://plausible.io/js/pa--X4qMlLVyMnUW4L8emwE_.js",
        },
        {
          innerHTML:
            "window.plausible=window.plausible||function(){(window.plausible.q=window.plausible.q||[]).push(arguments)},window.plausible.init=window.plausible.init||function(i){window.plausible.o=i||{}};window.plausible.init()",
        },
      ],
    },
  },
  routeRules: {
    // /download must stay a live redirect to the newest DMG: prerendering it
    // would bake the answer of one build-time GitHub call into the deploy, and
    // Ginko's site-wide ISR cache drops the query, so `?channel=beta` would get
    // the Stable answer. The server route sets its own cache header.
    "/download": { prerender: false, isr: false },
  },
});
