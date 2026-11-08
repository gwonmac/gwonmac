<script setup lang="ts">
// The landing page at / and /de: the site's own start page (it wins over the layer's), inside the layer's frame and
// on its tokens. Sections: hero with the stat band, the features grid, what Mac players say, the FAQ, the Discord
// line and the closing call. Copy is localized inline; testimonial quotes stay in their original English.
import { computed } from "vue";
import { useFetch, useGinkoSeo, useI18n } from "#imports";
import { useTracking, type DownloadSource } from "../composables/useTracking";
import type { LatestRelease } from "../../server/utils/release-select";
import site from "../../site.json";

const { locale } = useI18n();

type Localized = string | { en: string; de?: string };
const localize = (value: Localized) =>
  typeof value === "string" ? value : (locale.value === "de" ? value.de : undefined) ?? value.en;

// The buttons link to /download, the site's live redirect to the newest DMG, so
// the prerendered HTML carries the right target from the first paint. Resolving
// the DMG in the browser instead raced hydration: a third of clicks landed on
// the releases page because the fetch had not answered yet.
const DOWNLOAD_PATH = "/download";
// /api/latest resolves the newest downloadable release from GitHub (cached
// server-side, Stable by default). Fetched in the browser so
// the prerendered page never bakes in a stale version; it only names the
// version in the fine print and the click event, so a late answer costs nothing.
const { data: latestRelease } = useFetch<LatestRelease>("/api/latest", { server: false });

const { trackDownload, trackFaqOpen } = useTracking();

function handleDownload(source: DownloadSource): void {
  trackDownload(source, latestRelease.value?.version ?? null);
}

const DOCS_PATH = { en: "/docs/install", de: "/de/docs/installation" };
const COMPARE_PATH = {
  en: "/docs/play-guild-wars-on-mac",
  de: "/de/docs/guild-wars-auf-dem-mac-spielen",
};
const ACCOUNTS_PATH = {
  en: "/docs/accounts",
  de: "/de/docs/konten",
};
const SAFETY_PATH = { en: "/docs/safety", de: "/de/docs/sicherheit" };
const TROUBLE_PATH = {
  en: "/docs/troubleshooting",
  de: "/de/docs/fehlerbehebung",
};

// The head query this page exists to win: "play guild wars on mac".
const SEO = {
  title: {
    en: "Play Guild Wars on Mac | GWonMac",
    de: "Guild Wars auf dem Mac spielen | GWonMac",
  },
  description: {
    en: "Play ArenaNet’s official Guild Wars client on an Apple Silicon Mac without Windows, Wine, CrossOver, or Parallels. Free, signed, and notarized.",
    de: "Spiele ArenaNets offiziellen Guild-Wars-Client auf einem Apple-Silicon-Mac – ohne Windows, Wine, CrossOver oder Parallels. Kostenlos, signiert und notarisiert.",
  },
};

const HERO = {
  title: {
    en: "Play Guild Wars on your Mac",
    de: "Spiele Guild Wars auf deinem Mac",
  },
  sub: {
    en: "Download GWonMac, sign in with your Guild Wars account, and play. You don’t need Windows, Wine, or a virtual machine.",
    de: "Lade GWonMac herunter, melde dich mit deinem Guild-Wars-Konto an und spiele. Du brauchst weder Windows noch Wine oder eine virtuelle Maschine.",
  },
  download: { en: "Download for Mac", de: "Für Mac herunterladen" },
  docs: { en: "Installation guide", de: "Installationsanleitung" },
  finePrint: {
    en: "Free · For Apple Silicon · Signed & notarized",
    de: "Kostenlos · Für Apple Silicon · Signiert & notarisiert",
  },
};

const STATS = [
  { value: "3 steps", label: { en: "download, move, open", de: "laden, verschieben, öffnen" } },
  { value: "M1+", label: { en: "Apple Silicon Macs", de: "Apple-Silicon-Macs" } },
  { value: "macOS 12+", label: { en: "Monterey or later", de: "Monterey oder neuer" } },
  { value: "Free", label: { en: "to download and use", de: "herunterladen und nutzen" } },
];

const FEATURES_HEADING = {
  title: { en: "Everything you need to start playing", de: "Alles, was du zum Spielen brauchst" },
  sub: {
    en: "Install the app, sign in with your existing account, and let GWonMac take care of the game files and updates.",
    de: "Installiere die App und melde dich mit deinem bestehenden Konto an. GWonMac kümmert sich um die Spieldaten und Updates.",
  },
};

const FEATURES = [
  {
    title: { en: "Download, move, open", de: "Laden, verschieben, öffnen" },
    description: {
      en: "Download the DMG, move Guild Wars to Applications, and open it. That’s all you need to install GWonMac.",
      de: "Lade die DMG-Datei herunter, verschiebe Guild Wars in „Programme“ und öffne die App. Mehr ist für die Installation nicht nötig.",
    },
  },
  {
    title: { en: "Use your existing account", de: "Nutze dein bestehendes Konto" },
    description: {
      en: "Sign in with your Guild Wars account or Steam. You don’t need to create a separate GWonMac account.",
      de: "Melde dich mit deinem Guild-Wars-Konto oder über Steam an. Du brauchst kein eigenes GWonMac-Konto.",
    },
  },
  {
    title: { en: "A normal Mac installation", de: "Eine normale Mac-Installation" },
    description: {
      en: "Every release is signed and notarized by Apple. You don’t need to turn off any Mac security settings.",
      de: "Jede Version ist signiert und von Apple notarisiert. Du musst keine Sicherheitseinstellungen auf deinem Mac ausschalten.",
    },
  },
  {
    title: { en: "Made for M-series Macs", de: "Für Macs mit M-Chip" },
    description: {
      en: "GWonMac works on Apple Silicon Macs running macOS 12 Monterey or later. Intel Macs are not supported.",
      de: "GWonMac läuft auf Apple-Silicon-Macs mit macOS 12 Monterey oder neuer. Intel-Macs werden nicht unterstützt.",
    },
  },
  {
    title: { en: "Game files come from ArenaNet", de: "Spieldaten direkt von ArenaNet" },
    description: {
      en: "GWonMac uses ArenaNet’s official client and downloads the game files directly from ArenaNet. The files are not bundled with the app.",
      de: "GWonMac nutzt ArenaNets offiziellen Client und lädt die Spieldaten direkt von ArenaNet. Die App enthält keine Spieldaten.",
    },
  },
  {
    title: { en: "Updates are handled for you", de: "Updates ohne Handarbeit" },
    description: {
      en: "Game data stays up to date automatically. When a new GWonMac version is ready, the app lets you know before it installs.",
      de: "Die Spieldaten bleiben automatisch aktuell. Wenn eine neue GWonMac-Version bereitsteht, informiert dich die App vor der Installation.",
    },
  },
];

const VOICES_HEADING = {
  title: { en: "What Mac players say", de: "Das sagen Spieler auf dem Mac" },
  sub: {
    en: "Reports from people playing on M1, M2, M4, and M5 Macs in the Guild Wars subreddit.",
    de: "Erfahrungen von Spielern mit M1-, M2-, M4- und M5-Macs aus dem Guild-Wars-Subreddit.",
  },
};

const TESTIMONIALS = [
  {
    quote:
      "Made a reddit account to say thank you so much for sharing this! Wow, I can’t even believe I’m able to play gw1 again.",
    user: "aer0_dynamic",
    device: "MacBook Pro M1",
    href: "https://reddit.com/r/GuildWars/comments/1v4sehu/guild_wars_native_experience_achieved_on_apple/ozrm8xi/",
  },
  {
    quote:
      "Runs very very well on a MacBook Air M2. Way better than parallels version, which fps would drop and had some lag.",
    user: "Embr822",
    device: "MacBook Air M2",
    href: "https://reddit.com/r/GuildWars/comments/1v4sehu/guild_wars_native_experience_achieved_on_apple/ozece76/",
  },
  {
    quote: "Well done sir! Working great — buttery smooth and native-feeling! Impressive work!",
    user: "6davids",
    device: "r/GuildWars",
    href: "https://reddit.com/r/GuildWars/comments/1v4sehu/guild_wars_native_experience_achieved_on_apple/ozg7o11/",
  },
  {
    quote:
      "It’s so awesome to finally be able to play GW in full glory and without performance issues on my MacBook.",
    user: "Okay_sure_lets_post",
    device: "MacBook Air M4",
    href: "https://reddit.com/r/GuildWars/comments/1v7fb8k/guild_wars_on_macos_the_gwonmac_beta_is_here/p0di9x1/",
  },
  {
    quote: "It runs without any issue on my M2 Mac Mini as well. Guild Wars itself runs nicely.",
    user: "Kevjoe",
    device: "Mac Mini M2",
    href: "https://reddit.com/r/GuildWars/comments/1v4sehu/guild_wars_native_experience_achieved_on_apple/ozdq9y7/",
  },
  {
    quote: "This is working great on m1pro Mac with 16gb.",
    user: "Thrasher_Josh",
    device: "MacBook Pro M1",
    href: "https://reddit.com/r/GuildWars/comments/1v7fb8k/guild_wars_on_macos_the_gwonmac_beta_is_here/p058kvy/",
  },
];


const FAQ_HEADING = {
  title: { en: "Questions before you install", de: "Fragen vor der Installation" },
};

type FaqItem = {
  q: Localized;
  a: Localized;
  link?: { label: Localized; href: Localized };
};

const FAQ: FaqItem[] = [
  {
    q: { en: "Will this get me banned?", de: "Kann ich dafür gebannt werden?" },
    a: {
      en: "Nobody outside ArenaNet can promise that. Before launch, an ArenaNet staff member tested GWonMac and said they were fine with the project as it stood in July 2026. This was not an endorsement or a policy. GWonMac uses ArenaNet’s official client, does not automate gameplay, and will stop if ArenaNet asks.",
      de: "Niemand außerhalb von ArenaNet kann das versprechen. Vor dem Start hat ein ArenaNet-Mitarbeiter GWonMac getestet und im Juli 2026 gesagt, dass das Projekt für ihn in seiner damaligen Form in Ordnung war. Das war weder eine offizielle Freigabe noch eine Richtlinie. GWonMac nutzt ArenaNets offiziellen Client, automatisiert das Spiel nicht und wird eingestellt, wenn ArenaNet darum bittet.",
    },
    link: {
      label: { en: "Read the full safety page", de: "Zur ausführlichen Sicherheitsseite" },
      href: SAFETY_PATH,
    },
  },
  {
    q: { en: "Which Macs are supported?", de: "Welche Macs werden unterstützt?" },
    a: {
      en: "GWonMac supports Apple Silicon Macs running macOS 12 Monterey or later. Intel Macs are not supported. Performance depends on your Mac and the graphics settings you choose.",
      de: "GWonMac unterstützt Apple-Silicon-Macs mit macOS 12 Monterey oder neuer. Intel-Macs werden nicht unterstützt. Die Leistung hängt von deinem Mac und den gewählten Grafikeinstellungen ab.",
    },
  },
  {
    q: { en: "How do I install it?", de: "Wie installiere ich es?" },
    a: {
      en: "Download the DMG, move Guild Wars to Applications, and open it. Every release is signed and notarized, so you don’t need to turn off any Mac security settings.",
      de: "Lade die DMG-Datei herunter, verschiebe Guild Wars in „Programme“ und öffne die App. Jede Version ist signiert und notarisiert. Du musst keine Sicherheitseinstellungen auf deinem Mac ausschalten.",
    },
    link: {
      label: { en: "Step-by-step install guide", de: "Schritt-für-Schritt-Anleitung" },
      href: DOCS_PATH,
    },
  },
  {
    q: { en: "Do I need a Guild Wars account?", de: "Brauche ich ein Guild-Wars-Konto?" },
    a: {
      en: "Yes. Sign in with your existing Guild Wars account or Steam account. GWonMac does not include the game or create a separate account for you.",
      de: "Ja. Melde dich mit deinem bestehenden Guild-Wars-Konto oder Steam-Konto an. GWonMac enthält das Spiel nicht und erstellt kein eigenes Konto für dich.",
    },
  },
  {
    q: { en: "Is GWonMac free?", de: "Ist GWonMac kostenlos?" },
    a: {
      en: "Yes. GWonMac is free to download and use.",
      de: "Ja. Du kannst GWonMac kostenlos herunterladen und nutzen.",
    },
  },
  {
    q: {
      en: "What about CrossOver, Parallels, or Whisky?",
      de: "Was ist mit CrossOver, Parallels oder Whisky?",
    },
    a: {
      en: "They can work, but they run the Windows client through extra software or a virtual machine. GWonMac runs ArenaNet’s official client directly as a Mac app.",
      de: "Diese Programme können funktionieren, benötigen dafür aber zusätzliche Software oder eine virtuelle Maschine. GWonMac startet ArenaNets offiziellen Client direkt als Mac-App.",
    },
    link: {
      label: { en: "Every option compared", de: "Alle Optionen im Vergleich" },
      href: COMPARE_PATH,
    },
  },
  {
    q: { en: "Does it update automatically?", de: "Aktualisiert es sich automatisch?" },
    a: {
      en: "Yes. Game data updates automatically. When a new GWonMac version is available, the app tells you before it installs.",
      de: "Ja. Die Spieldaten werden automatisch aktualisiert. Wenn eine neue GWonMac-Version verfügbar ist, informiert dich die App vor der Installation.",
    },
  },
  {
    q: { en: "Does Steam login work?", de: "Funktioniert die Steam-Anmeldung?" },
    a: {
      en: "Yes. You can sign in with Steam or a regular Guild Wars account. Your password goes only to your login provider and ArenaNet, never to a GWonMac service. If you save your login, it stays in the Keychain on your Mac.",
      de: "Ja. Du kannst dich über Steam oder mit einem normalen Guild-Wars-Konto anmelden. Dein Passwort geht nur an deinen Anmeldeanbieter und ArenaNet, niemals an einen GWonMac-Dienst. Wenn du deine Anmeldung speicherst, bleibt sie im Schlüsselbund auf deinem Mac.",
    },
  },
  {
    q: {
      en: "I play on mobile with Sign in with Apple. Can I play on Mac without buying again?",
      de: "Ich spiele mobil mit Apple-Login. Kann ich ohne erneuten Kauf auf dem Mac spielen?",
    },
    a: {
      en: "Yes. A mobile account uses a Mobile ID, which the desktop client doesn’t accept, so link it once to an ArenaNet account from the mobile app. After that you sign in on your Mac with the ArenaNet credentials, and your characters and the campaigns you bought on mobile come with you.",
      de: "Ja. Ein Mobilkonto nutzt eine Mobile ID, die der Desktop-Client nicht annimmt. Verknüpfe es einmal in der Mobil-App mit einem ArenaNet-Konto. Danach meldest du dich auf dem Mac mit den ArenaNet-Zugangsdaten an, und deine Charaktere und die mobil gekauften Kampagnen kommen mit.",
    },
    link: {
      label: { en: "How to link your mobile account", de: "Mobilkonto verknüpfen" },
      href: ACCOUNTS_PATH,
    },
  },
  {
    q: { en: "Can I use GWToolbox++?", de: "Kann ich GWToolbox++ nutzen?" },
    a: {
      en: "No. GWToolbox++ only works with the Windows client. GWonMac Tools Beta provides its own build and team features. It is optional and works only in supported PvE outposts.",
      de: "Nein. GWToolbox++ funktioniert nur mit dem Windows-Client. GWonMac Tools Beta bietet eigene Funktionen für Builds und Teams. Die Tools sind optional und funktionieren nur in unterstützten PvE-Außenposten.",
    },
  },
  {
    q: { en: "Does GWonMac run Guild Wars 2?", de: "Läuft Guild Wars 2 mit GWonMac?" },
    a: {
      en: "No. GWonMac runs the original Guild Wars (Reforged) only. Guild Wars 2 is a different engine, and its native Mac client was discontinued by ArenaNet in February 2021.",
      de: "Nein. GWonMac führt nur das originale Guild Wars (Reforged) aus. Guild Wars 2 nutzt eine andere Engine, und dessen nativer Mac-Client wurde von ArenaNet im Februar 2021 eingestellt.",
    },
  },
  {
    q: { en: "How do I report bugs or get help?", de: "Wie melde ich Bugs oder bekomme Hilfe?" },
    a: {
      en: "Join the Discord for quick help. In the app, Help → Report a Bug or Help → Request a Feature opens the matching GitHub issue form immediately. Diagnostics are optional and never uploaded automatically.",
      de: "Komm für schnelle Hilfe auf den Discord. In der App öffnet Hilfe → Bug melden oder Hilfe → Feature vorschlagen sofort das passende GitHub-Issue-Formular. Diagnosedaten sind optional und werden nie automatisch hochgeladen.",
    },
    link: {
      label: { en: "Troubleshooting & known issues", de: "Fehlerbehebung & bekannte Probleme" },
      href: TROUBLE_PATH,
    },
  },
];

// Each FAQ item is tracked once per visit, on first open. Questions are
// tracked by their English text so both locales group under one event value.
// The first item renders open (browsers fire toggle for it on load), so it is
// pre-seeded and never tracked.
const faqKey = (question: Localized): string =>
  typeof question === "string" ? question : question.en;
const trackedFaqs = new Set<string>(FAQ[0] ? [faqKey(FAQ[0].q)] : []);

function handleFaqToggle(event: Event, question: Localized): void {
  const details = event.currentTarget as HTMLDetailsElement;
  const key = faqKey(question);
  if (!details.open || trackedFaqs.has(key)) return;
  trackedFaqs.add(key);
  trackFaqOpen(key);
}

const DISCORD = {
  url: site.links.discord,
  text: {
    en: "Join Discord for release notes, known issues, and help.",
    de: "Auf Discord findest du Versionshinweise, bekannte Probleme und Hilfe.",
  },
  cta: { en: "Join the Discord", de: "Discord beitreten" },
};

const CTA = {
  title: { en: "Ready to play?", de: "Bereit zum Spielen?" },
  sub: {
    en: "Download GWonMac, move it to Applications, and sign in with your Guild Wars account.",
    de: "Lade GWonMac herunter, verschiebe die App in „Programme“ und melde dich mit deinem Guild-Wars-Konto an.",
  },
  download: { en: "Download for Mac", de: "Für Mac herunterladen" },
  docs: { en: "Installation guide", de: "Installationsanleitung" },
};

const docsPath = computed(() => localize(DOCS_PATH));

// The head query this page exists to win; the title already names the site, so no template is added.
useGinkoSeo(() => ({
  title: localize(SEO.title),
  titleTemplate: false,
  description: localize(SEO.description),
  type: "website",
}));
</script>

<template>
  <div class="landing">
    <!-- Hero, with the stat band on its bottom edge -->
    <section class="landing-hero">
      <div class="landing-hero-inner">
        <img src="/reforged-logo.webp" alt="Guild Wars Reforged" class="landing-logo" loading="eager" />
        <h1 class="landing-title">
          {{ localize(HERO.title) }}
        </h1>
        <p class="landing-lead">
          {{ localize(HERO.sub) }}
        </p>
        <div class="landing-actions">
          <NuxtLink
            :to="DOWNLOAD_PATH"
            target="_blank"
            rel="noopener noreferrer"
            class="landing-button landing-button-primary"
            @click="handleDownload('hero')"
          >
            <Icon name="lucide:download" aria-hidden="true" />
            {{ localize(HERO.download) }}
          </NuxtLink>
          <NuxtLink :to="docsPath" class="landing-button">{{ localize(HERO.docs) }}</NuxtLink>
        </div>
        <p class="landing-fine-print">
          <template v-if="latestRelease?.version">{{ latestRelease.version }} · </template>{{ localize(HERO.finePrint) }}
        </p>
      </div>
      <dl class="landing-stats">
        <div v-for="stat in STATS" :key="stat.value" class="landing-stat">
          <dt class="landing-sr-only">{{ localize(stat.label) }}</dt>
          <dd class="landing-stat-value">{{ stat.value }}</dd>
          <dd class="landing-stat-label">{{ localize(stat.label) }}</dd>
        </div>
      </dl>
    </section>

    <!-- Features -->
    <section class="landing-section">
      <div class="landing-heading">
        <h2>{{ localize(FEATURES_HEADING.title) }}</h2>
        <p>{{ localize(FEATURES_HEADING.sub) }}</p>
      </div>
      <div class="landing-features">
        <article v-for="feature in FEATURES" :key="feature.title.en" class="landing-card">
          <h3>{{ localize(feature.title) }}</h3>
          <p>{{ localize(feature.description) }}</p>
        </article>
      </div>
    </section>

    <!-- What Mac players say -->
    <section class="landing-section">
      <div class="landing-heading landing-heading-center">
        <h2>{{ localize(VOICES_HEADING.title) }}</h2>
        <p>{{ localize(VOICES_HEADING.sub) }}</p>
      </div>
      <div class="landing-voices">
        <figure v-for="item in TESTIMONIALS" :key="item.href" class="landing-card landing-voice">
          <figcaption>
            <span class="landing-avatar" aria-hidden="true">{{ item.user[0]!.toUpperCase() }}</span>
            <span class="landing-voice-who">
              <NuxtLink :to="item.href" target="_blank" rel="noopener noreferrer">u/{{ item.user }}</NuxtLink>
              <span>{{ item.device }}</span>
            </span>
          </figcaption>
          <blockquote>
            <q>{{ item.quote }}</q>
          </blockquote>
        </figure>
      </div>
    </section>

    <!-- FAQ -->
    <section class="landing-section landing-section-narrow">
      <h2 class="landing-faq-title">{{ localize(FAQ_HEADING.title) }}</h2>
      <div class="landing-faq">
        <details
          v-for="(item, index) in FAQ"
          :key="localize(item.q)"
          :open="index === 0"
          @toggle="handleFaqToggle($event, item.q)"
        >
          <summary>{{ localize(item.q) }}</summary>
          <p>
            {{ localize(item.a) }}
            <NuxtLink v-if="item.link" :to="localize(item.link.href)" class="landing-faq-link">
              {{ localize(item.link.label) }} →
            </NuxtLink>
          </p>
        </details>
      </div>
    </section>

    <!-- Discord: one line, one button -->
    <section class="landing-band">
      <div class="landing-band-inner">
        <p>
          <Icon name="docs:discord" aria-hidden="true" />
          {{ localize(DISCORD.text) }}
        </p>
        <NuxtLink :to="DISCORD.url" target="_blank" rel="noopener noreferrer" class="landing-button">
          {{ localize(DISCORD.cta) }}
        </NuxtLink>
      </div>
    </section>

    <!-- Closing call -->
    <section class="landing-section landing-cta">
      <h2>{{ localize(CTA.title) }}</h2>
      <p>{{ localize(CTA.sub) }}</p>
      <div class="landing-actions">
        <NuxtLink
          :to="DOWNLOAD_PATH"
          target="_blank"
          rel="noopener noreferrer"
          class="landing-button landing-button-primary"
          @click="handleDownload('final-cta')"
        >
          <Icon name="lucide:download" aria-hidden="true" />
          {{ localize(CTA.download) }}
        </NuxtLink>
        <NuxtLink :to="docsPath" class="landing-button">{{ localize(CTA.docs) }}</NuxtLink>
      </div>
    </section>
  </div>
</template>

<style scoped>
/* Only the layer's tokens (README of @lupinum/ginko-docs, "Look and colours"), so the page follows its theme and the
   light/dark switch. */
.landing {
  --landing-gutter: var(--docs-gutter, 1rem);
  overflow-x: clip;
}
.landing-hero {
  border-bottom: 1px solid var(--border);
  background: var(--muted);
}
.landing-hero-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  max-width: 48rem;
  margin: 0 auto;
  padding: 5rem var(--landing-gutter) 4rem;
  text-align: center;
}
.landing-logo {
  width: min(430px, 80vw);
  height: auto;
}
.landing-title {
  margin: 2rem 0 0;
  font-size: clamp(2.25rem, 1.6rem + 2.6vw, 3rem);
  line-height: 1.08;
  font-weight: 700;
  letter-spacing: -0.02em;
  text-wrap: balance;
  color: var(--foreground);
}
.landing-lead {
  max-width: 56ch;
  margin: 1.5rem 0 0;
  font-size: 1.125rem;
  line-height: 1.75;
  color: var(--muted-foreground);
}
.landing-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  margin-top: 2rem;
}
.landing-button {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  min-height: 2.5rem;
  padding: 0 1rem;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--background);
  color: var(--foreground);
  font-size: 0.875rem;
  font-weight: 600;
  text-decoration: none;
  transition: background-color 150ms ease, border-color 150ms ease;
}
.landing-button:hover {
  background: var(--accent);
}
.landing-button-primary {
  border-color: var(--primary);
  background: var(--primary);
  color: var(--primary-foreground);
}
.landing-button-primary:hover {
  background: color-mix(in oklab, var(--primary) 88%, var(--foreground));
}
.landing-button:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
}
.landing-fine-print {
  margin: 1.25rem 0 0;
  font-size: 0.8125rem;
  color: var(--muted-foreground);
}
.landing-stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  max-width: 64rem;
  margin: 0 auto;
  border-top: 1px solid var(--border);
}
.landing-stat {
  padding: 1.25rem var(--landing-gutter);
  text-align: center;
}
.landing-stat + .landing-stat {
  border-left: 1px solid var(--border);
}
.landing-stat:nth-child(3) {
  border-left: 0;
}
.landing-stat:nth-child(n + 3) {
  border-top: 1px solid var(--border);
}
.landing-stats dd {
  margin: 0;
}
.landing-stat-value {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--foreground);
}
.landing-stat-label {
  margin-top: 0.25rem;
  font-size: 0.8125rem;
  color: var(--muted-foreground);
}
.landing-sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
.landing-section {
  max-width: 72rem;
  margin: 0 auto;
  padding: 5rem var(--landing-gutter);
}
.landing-section-narrow {
  max-width: 48rem;
}
.landing-heading {
  max-width: 42rem;
}
.landing-heading-center {
  margin: 0 auto;
  text-align: center;
}
.landing-section h2 {
  margin: 0;
  font-size: clamp(1.75rem, 1.4rem + 1.4vw, 2.25rem);
  line-height: 1.15;
  font-weight: 700;
  letter-spacing: -0.015em;
  color: var(--foreground);
}
.landing-heading p {
  margin: 0.75rem 0 0;
  line-height: 1.75;
  color: var(--muted-foreground);
}
.landing-card {
  min-width: 0;
  margin: 0;
  padding: 1.5rem;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--card);
}
.landing-features {
  display: grid;
  gap: 1rem;
  margin-top: 2.5rem;
}
.landing-features h3 {
  margin: 0;
  font-size: 1.0625rem;
  font-weight: 650;
  color: var(--foreground);
}
.landing-features p {
  margin: 0.5rem 0 0;
  font-size: 0.875rem;
  line-height: 1.6;
  color: var(--muted-foreground);
}
.landing-voices {
  columns: 1;
  column-gap: 1rem;
  margin-top: 3rem;
}
.landing-voice {
  margin-bottom: 1rem;
  padding: 1.25rem;
  break-inside: avoid;
}
.landing-voice figcaption {
  display: flex;
  align-items: center;
  gap: 0.875rem;
}
.landing-avatar {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--muted);
  color: var(--foreground);
  font-weight: 650;
}
.landing-voice-who {
  min-width: 0;
  font-size: 0.875rem;
  line-height: 1.25rem;
  color: var(--muted-foreground);
}
.landing-voice-who a {
  display: block;
  overflow: hidden;
  font-weight: 600;
  color: var(--primary);
  text-overflow: ellipsis;
  white-space: nowrap;
  text-decoration: none;
}
.landing-voice-who a:hover {
  text-decoration: underline;
}
.landing-voice blockquote {
  margin: 1rem 0 0;
  font-size: 0.875rem;
  line-height: 1.75;
  color: var(--foreground);
}
.landing-faq-title {
  margin: 0;
}
.landing-faq {
  margin-top: 2.5rem;
  border-top: 1px solid var(--border);
}
.landing-faq details {
  border-bottom: 1px solid var(--border);
}
.landing-faq summary {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 0.25rem;
  font-weight: 600;
  color: var(--foreground);
  cursor: pointer;
  list-style: none;
}
.landing-faq summary::-webkit-details-marker {
  display: none;
}
.landing-faq summary::before {
  content: "+";
  flex-shrink: 0;
  width: 1rem;
  color: var(--primary);
  font-weight: 700;
  text-align: center;
}
.landing-faq details[open] summary::before {
  content: "−";
}
.landing-faq summary:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
}
.landing-faq p {
  max-width: 64ch;
  margin: 0;
  padding: 0 0.25rem 1.25rem 2rem;
  font-size: 0.875rem;
  line-height: 1.6;
  color: var(--muted-foreground);
}
.landing-faq-link {
  display: block;
  width: fit-content;
  margin-top: 0.25rem;
  font-weight: 500;
  color: var(--primary);
  text-decoration: none;
}
.landing-faq-link:hover {
  text-decoration: underline;
}
.landing-band {
  border-block: 1px solid var(--border);
  background: var(--muted);
}
.landing-band-inner {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.75rem 1.75rem;
  max-width: 72rem;
  margin: 0 auto;
  padding: 0.75rem var(--landing-gutter);
}
.landing-band p {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin: 0;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--foreground);
}
.landing-band p :deep(svg) {
  flex-shrink: 0;
  width: 1.25rem;
  height: 1.25rem;
}
.landing-cta {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}
.landing-cta > p {
  margin: 0.75rem 0 0;
  font-size: 1.125rem;
  color: var(--muted-foreground);
}
@media (min-width: 40rem) {
  .landing-hero-inner {
    padding-top: 6rem;
    padding-bottom: 5rem;
  }
  .landing-stats {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
  .landing-stat:nth-child(3) {
    border-left: 1px solid var(--border);
  }
  .landing-stat:nth-child(n + 3) {
    border-top: 0;
  }
  .landing-section {
    padding-block: 6rem;
  }
  .landing-features {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .landing-band-inner {
    justify-content: space-between;
  }
}
@media (min-width: 48rem) {
  .landing-voices {
    columns: 2;
  }
}
@media (min-width: 64rem) {
  .landing-features {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .landing-voices {
    columns: 3;
  }
}
@media (prefers-reduced-motion: reduce) {
  .landing-button {
    transition: none;
  }
}
</style>
