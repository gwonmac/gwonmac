// The site: www.gwonmac.com in English (unprefixed) and German (/de). The bricks read Markdown from content/:
// content/docs (the player docs, also the launcher's Guide), content/posts (the blog, also the launcher's News and
// "What's new") and content/authors. Nothing comes from a CMS.
import { defineSite, f } from '@lupinum/ginko'
import { blogCollections, blogPages, components, docsCollection, homePages } from '@lupinum/ginko-docs/config'
import { redirects } from './redirects.ts'
import site from './site.json' with { type: 'json' }

const locales = ['en', 'de'] as const
const blog = blogCollections({ locales })

// The launcher reads these keys from the post files: app/shared/website-content.ts, the news feed generator
// (scripts/generate-launcher-news.mjs) and the app's news-v1 parser own their values. The website declares them so
// the files validate; it does not show them.
const launcherText = (label: string) => f.text(label, { optional: true, translate: false })

export default defineSite({
  site: 'gwonmac',
  name: site.name,
  url: site.url,
  timeZone: 'Europe/Vienna',
  locales,
  currency: 'EUR',
  seo: {
    description: site.description,
    // The home page's Organization JSON-LD (the publisher).
    organization: { logo: '/reforged-logo.webp', sameAs: [site.links.github, site.links.discord] },
    noindex: ['download'],
  },
  pages: {
    home: homePages({ locales }),
    blog: blogPages({ locales }),
    // A server route (server/routes/download.get.ts): the live redirect to the newest DMG. Listed so the link check
    // knows the address the pages link in both languages; out of the sitemap (seo.noindex).
    download: { en: '/download', de: '/download' },
  },
  components: {
    ...components,
    // Both are also drawn by the launcher's Guide from the same Markdown (app/shared/launcher-markdown.ts).
    'media-placeholder': {
      kind: 'block',
      label: 'Media to come',
      describe: 'A screenshot or video that is still to be made.',
      props: {
        type: f.choice('Type', { options: [{ value: 'image', label: 'Image' }, { value: 'video', label: 'Video' }], optional: true }),
      },
    },
    setting: {
      kind: 'inline',
      label: 'Setting',
      describe: 'A setting by name: the launcher\'s Guide opens it, the website shows the name.',
      props: { to: f.text('Settings section', { max: 60 }) },
    },
  },
  redirects,
  bricks: {
    docs: docsCollection({ locales }),
    posts: {
      ...blog.posts,
      fields: {
        ...blog.posts.fields,
        launcherId: launcherText('Launcher story id'),
        launcherSource: launcherText('Launcher source'),
        launcherChannel: launcherText('Launcher channel'),
        launcherFeatured: f.boolean('Featured in the launcher', { optional: true }),
        launcherExternalUrl: launcherText('Launcher link'),
        launcherStartsAt: launcherText('Shown in the launcher from'),
        launcherEndsAt: launcherText('Shown in the launcher until'),
      },
    },
    authors: blog.authors,
  },
})
