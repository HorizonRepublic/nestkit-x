import { themes as prismThemes } from 'prism-react-renderer';

import type * as Preset from '@docusaurus/preset-classic';
import type { Config } from '@docusaurus/types';

const config: Config = {
  baseUrl: '/',
  favicon: 'logo/favicon.png',

  // Internationalization (можете розширити пізніше)
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },
  onBrokenLinks: 'throw',

  onBrokenMarkdownLinks: 'warn',

  // GitHub pages deployment config
  organizationName: 'HorizonRepublic',
  presets: [
    [
      'classic',
      {
        blog: {
          blogDescription: 'Latest updates and tutorials for NestKit X',
          blogTitle: 'NestKit X Blog',
          editUrl: 'https://github.com/HorizonRepublic/nestkit-x/tree/main/apps/docs/',
          feedOptions: {
            copyright: `Copyright © ${new Date().getFullYear()} HorizonRepublic`,
            description: 'Stay updated with NestKit X developments',
            language: 'en',
            title: 'NestKit X Blog',
            type: ['rss', 'atom'],
          },
          postsPerPage: 'ALL',
          showReadingTime: true,
        },
        docs: {
          editUrl: 'https://github.com/HorizonRepublic/nestkit-x/tree/main/apps/docs/',
          routeBasePath: 'docs',
          showLastUpdateAuthor: true,
          showLastUpdateTime: true,
          sidebarPath: './sidebars.ts',
        },
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  projectName: 'nestkit-x',
  tagline: 'Powerful NestJS toolkit for enterprise applications',

  themeConfig: {
    // Color mode
    colorMode: {
      defaultMode: 'dark',
      disableSwitch: false,
      respectPrefersColorScheme: true,
    },

    footer: {
      copyright: `Copyright © ${new Date().getFullYear()} HorizonRepublic. Built with Docusaurus.`,
      links: [
        {
          items: [
            {
              label: 'Getting Started',
              to: '/docs/intro',
            },
            {
              label: 'API Reference',
              to: '/docs/api',
            },
            {
              label: 'Examples',
              to: '/docs/examples',
            },
          ],
          title: 'Documentation',
        },
        {
          items: [
            {
              href: 'https://github.com/HorizonRepublic/nestkit-x/discussions',
              label: 'GitHub Discussions',
            },
            {
              href: 'https://github.com/HorizonRepublic/nestkit-x/issues',
              label: 'Issues',
            },
          ],
          title: 'Community',
        },
        {
          items: [
            // {
            //   label: 'Blog',
            //   to: '/blog',
            // },
            {
              href: 'https://github.com/HorizonRepublic/nestkit-x',
              label: 'GitHub',
            },
            {
              href: 'https://www.npmjs.com/org/nestkit-x',
              label: 'NPM',
            },
          ],
          title: 'More',
        },
      ],
      style: 'dark',
    },

    // Social card for sharing
    image: 'logo/nestkit-x-social-card.jpg',

    // Metadata
    metadata: [
      { content: 'nestjs, typescript, framework, toolkit, enterprise', name: 'keywords' },
      { content: 'summary_large_image', name: 'twitter:card' },
      { content: '@HorizonRepublic', name: 'twitter:site' },
      { content: 'website', name: 'og:type' },
    ],

    navbar: {
      hideOnScroll: true,
      items: [
        {
          label: 'Documentation',
          position: 'left',
          sidebarId: 'tutorialSidebar',
          type: 'docSidebar',
        },
        // {
        //   label: 'Blog',
        //   position: 'left',
        //   to: '/blog',
        // },
        {
          position: 'right',
          type: 'search',
        },
        {
          href: 'https://github.com/HorizonRepublic/nestkit-x',
          label: 'GitHub',
          position: 'right',
        },
        // {
        //   items: [
        //     {
        //       href: 'https://github.com/HorizonRepublic/nestkit-x/discussions',
        //       label: 'Discussions',
        //     },
        //     {
        //       href: 'https://github.com/HorizonRepublic/nestkit-x/issues',
        //       label: 'Issues',
        //     },
        //   ],
        //   label: 'Community',
        //   position: 'right',
        //   type: 'dropdown',
        // },
      ],
      logo: {
        alt: 'NestKit X Logo',
        height: 32,
        src: 'logo/header-logo.webp',
        srcDark: 'logo/header-logo.webp',
        width: 32,
      },
      title: 'NestKit X',
    },

    prism: {
      darkTheme: prismThemes.dracula,
      theme: prismThemes.github,
    },
  } satisfies Preset.ThemeConfig,

  title: 'NestKit X',

  // GitHub Pages URL structure
  url: 'https://horizonrepublic.github.io',
};

export default config;
