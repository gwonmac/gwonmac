// The docs layer's options (README of @lupinum/ginko-docs, "Configure"). Texts are not set here: the banner text is
// `docs.banner.unofficial` in i18n/en.json and i18n/de.json, so each language has its own.
import site from "../site.json";

export default defineAppConfig({
  docs: {
    // The Guild Wars Reforged wordmark carries the name.
    logo: { light: "/reforged-logo.png", wordmark: true },
    social: [
      { icon: "docs:github", href: site.links.github, label: "GitHub" },
      { icon: "docs:discord", href: site.links.discord, label: "Discord" },
    ],
    banner: { id: "unofficial" },
    // "Edit this page" opens the page's file on GitHub (Ginko keeps its path from the repository root).
    repository: {
      url: site.links.github,
      branch: "main",
    },
    footer: { attribution: false },
  },
});
