import { PAGE_CONTENT } from '../../data/pageContent.js'

/**
 * Registry of public pages managed from Admin → Website Content.
 *
 * Every page is made of one or more *blocks* (sections). Each block maps to an
 * existing `contentBlocks/{id}` document — no new collections and no parallel
 * CMS. Fields are the real copy rendered by the public pages; defaults live in
 * `src/data/pageContent.js`.
 *
 * Block ids must match Firestore's `[a-z0-9-]` restriction (the adapter rejects
 * anything else on save), hence kebab-case everywhere.
 *
 * A block may declare:
 *   - `fields`: simple text values
 *   - `lists` : repeatable groups of fields (FAQ items, values, steps …) stored
 *               as a JSON string in the same content block.
 *
 * `manage` links point at the existing admin CRUD screens that own individual
 * entity records (fighters, events, news, gallery …).
 */
export const CONTENT_PAGES = [
  /* ------------------------------ HOME ------------------------------ */
  {
    id: 'home',
    label: 'Home',
    route: '/',
    description: 'Landing hero, section headings, support areas, testimonials and impact statistics.',
    manage: [
      { label: 'Manage Fighters', to: '/admin/athletes' },
      { label: 'Manage Events', to: '/admin/events' },
      { label: 'Manage News', to: '/admin/news' },
    ],
    blocks: [
      {
        id: 'homepage',
        title: 'Hero',
        fields: [
          { key: 'heroEyebrow', label: 'Hero Eyebrow', rows: 1 },
          { key: 'heroTitle', label: 'Hero Title', rows: 3, richText: true },
          { key: 'heroParagraph', label: 'Hero Paragraph', rows: 3 },
          { key: 'heroPrimaryCta', label: 'Primary Button Label' },
          { key: 'heroSecondaryCta', label: 'Secondary Button Label' },
        ],
      },
      {
        id: 'home-about',
        title: 'About Preview',
        fields: [
          { key: 'aboutEyebrow', label: 'Eyebrow', rows: 1 },
          { key: 'aboutTitle', label: 'Heading', rows: 2, richText: true },
          { key: 'aboutText', label: 'Paragraph', rows: 4 },
          { key: 'aboutCtaLabel', label: 'Button Label' },
        ],
        lists: [
          {
            key: 'valueCards',
            label: 'Value Cards',
            itemLabel: 'title',
            addLabel: 'Add value card',
            newItem: { title: 'New value', text: '' },
            fields: [
              { key: 'title', label: 'Title' },
              { key: 'text', label: 'Description', rows: 2 },
            ],
          },
        ],
      },
      {
        id: 'home-sections',
        title: 'Section Headings & Cards',
        fields: [
          { key: 'risingEyebrow', label: 'Fighters — Eyebrow', rows: 1 },
          { key: 'risingTitle', label: 'Fighters — Heading', richText: true },
          { key: 'risingLinkLabel', label: 'Fighters — Link Label' },
          { key: 'impactEyebrow', label: 'Impact — Eyebrow', rows: 1 },
          { key: 'impactTitle', label: 'Impact — Heading', richText: true },
          { key: 'supportEyebrow', label: 'Support — Eyebrow', rows: 1 },
          { key: 'supportTitle', label: 'Support — Heading', richText: true },
          { key: 'supportSubtitle', label: 'Support — Subtitle', rows: 2 },
          { key: 'eventsEyebrow', label: 'Events — Eyebrow', rows: 1 },
          { key: 'eventsTitle', label: 'Events — Heading', richText: true },
          { key: 'eventsSubtitle', label: 'Events — Subtitle', rows: 2 },
          { key: 'sponsorsEyebrow', label: 'Sponsors — Eyebrow', rows: 1 },
          { key: 'sponsorsTitle', label: 'Sponsors — Heading', richText: true },
          { key: 'testimonialsEyebrow', label: 'Testimonials — Eyebrow', rows: 1 },
          { key: 'testimonialsTitle', label: 'Testimonials — Heading', richText: true },
          { key: 'newsEyebrow', label: 'News — Eyebrow', rows: 1 },
          { key: 'newsTitle', label: 'News — Heading', richText: true },
          { key: 'newsLinkLabel', label: 'News — Link Label' },
        ],
        lists: [
          {
            key: 'supportCategories',
            label: 'Support Areas',
            itemLabel: 'title',
            addLabel: 'Add support area',
            newItem: { title: 'New support area', description: '' },
            fields: [
              { key: 'title', label: 'Title' },
              { key: 'description', label: 'Description', rows: 2 },
            ],
          },
          {
            key: 'testimonials',
            label: 'Testimonials',
            itemLabel: 'name',
            addLabel: 'Add testimonial',
            newItem: { name: 'New name', role: '', quote: '' },
            fields: [
              { key: 'name', label: 'Name' },
              { key: 'role', label: 'Role' },
              { key: 'quote', label: 'Quote', rows: 2 },
            ],
          },
        ],
      },
      {
        id: 'home-final-cta',
        title: 'Closing Call To Action',
        fields: [
          { key: 'finalCtaTitle', label: 'Heading', rows: 2, richText: true },
          { key: 'finalCtaParagraph', label: 'Paragraph', rows: 2 },
          { key: 'finalCtaPrimaryCta', label: 'Primary Button Label' },
          { key: 'finalCtaSecondaryCta', label: 'Secondary Button Label' },
        ],
      },
      {
        id: 'stats',
        title: 'Impact Statistics',
        layout: 'grid',
        fields: [
          { key: 'livesImpacted', label: 'Lives Impacted' },
          { key: 'athletesSupported', label: 'Fighters Supported' },
          { key: 'countriesReached', label: 'Countries Reached' },
          { key: 'eventsOrganized', label: 'Events Organized' },
          { key: 'activeSponsors', label: 'Active Sponsors' },
          { key: 'volunteers', label: 'Volunteers' },
          { key: 'projects', label: 'Projects' },
          { key: 'communities', label: 'Communities' },
        ],
      },
    ],
  },

  /* ------------------------------ ABOUT ----------------------------- */
  {
    id: 'about',
    label: 'About',
    route: '/about',
    description: 'Hero, introduction, mission, vision, values, story, impact, leadership and closing CTA.',
    blocks: [
      {
        id: 'about',
        title: 'Page Header & Introduction',
        fields: [
          { key: 'heroEyebrow', label: 'Hero Eyebrow', rows: 1 },
          { key: 'heroTitle', label: 'Hero Title', rows: 2, richText: true },
          { key: 'heroSubtitle', label: 'Hero Subtitle', rows: 2 },
          { key: 'whoEyebrow', label: 'Introduction Eyebrow', rows: 1 },
          { key: 'whoTitle', label: 'Introduction Heading', richText: true },
          { key: 'intro', label: 'Introduction Paragraph', rows: 4 },
          { key: 'whoParagraph2', label: 'Second Paragraph', rows: 4 },
        ],
      },
      {
        id: 'about-mission',
        title: 'Mission, Vision & Values',
        fields: [
          { key: 'missionEyebrow', label: 'Mission Eyebrow', rows: 1 },
          { key: 'missionTitle', label: 'Mission Heading', richText: true },
          { key: 'missionText', label: 'Mission Text', rows: 3 },
          { key: 'visionEyebrow', label: 'Vision Eyebrow', rows: 1 },
          { key: 'visionTitle', label: 'Vision Heading', richText: true },
          { key: 'visionText', label: 'Vision Text', rows: 3 },
          { key: 'valuesEyebrow', label: 'Values Eyebrow', rows: 1 },
          { key: 'valuesTitle', label: 'Values Heading', richText: true },
        ],
        lists: [
          {
            key: 'values',
            label: 'Our Values',
            itemLabel: 'title',
            addLabel: 'Add value',
            newItem: { title: 'New value', text: '' },
            fields: [
              { key: 'title', label: 'Title' },
              { key: 'text', label: 'Description', rows: 2 },
            ],
          },
        ],
      },
      {
        id: 'about-story',
        title: 'Our Story & Impact',
        fields: [
          { key: 'storyEyebrow', label: 'Story Eyebrow', rows: 1 },
          { key: 'storyTitle', label: 'Story Heading', richText: true },
          { key: 'purposeTitle', label: 'Purpose Card Title' },
          { key: 'purposeText', label: 'Purpose Card Text', rows: 3 },
          { key: 'impactEyebrow', label: 'Impact Eyebrow', rows: 1 },
          { key: 'impactTitle', label: 'Impact Heading', richText: true },
        ],
        lists: [
          {
            key: 'timeline',
            label: 'Timeline',
            itemLabel: 'year',
            addLabel: 'Add timeline entry',
            newItem: { year: 'Year', text: '' },
            fields: [
              { key: 'year', label: 'Year' },
              { key: 'text', label: 'Text', rows: 2 },
            ],
          },
          {
            key: 'impactNumbers',
            label: 'Impact Numbers',
            itemLabel: 'value',
            addLabel: 'Add number',
            newItem: { value: '0', label: '' },
            fields: [
              { key: 'value', label: 'Number' },
              { key: 'label', label: 'Description', rows: 2 },
            ],
          },
        ],
      },
      {
        id: 'about-team',
        title: 'Leadership & Closing CTA',
        fields: [
          { key: 'teamEyebrow', label: 'Team Eyebrow', rows: 1 },
          { key: 'teamTitle', label: 'Team Heading', richText: true },
          { key: 'teamSubtitle', label: 'Team Subtitle', rows: 2 },
          { key: 'ctaTitle', label: 'CTA Heading', rows: 2, richText: true },
          { key: 'ctaText', label: 'CTA Paragraph', rows: 2 },
          { key: 'ctaPrimaryCta', label: 'Primary Button Label' },
          { key: 'ctaSecondaryCta', label: 'Secondary Button Label' },
        ],
        lists: [
          {
            key: 'team',
            label: 'Team Members',
            itemLabel: 'name',
            addLabel: 'Add team member',
            newItem: { name: 'New member', role: '', initials: '' },
            fields: [
              { key: 'name', label: 'Name' },
              { key: 'role', label: 'Role' },
              { key: 'initials', label: 'Initials' },
            ],
          },
        ],
      },
    ],
  },

  /* ---------------------------- FIGHTERS ---------------------------- */
  {
    id: 'athletes',
    label: 'Fighters',
    route: '/athletes',
    description: 'Directory hero copy, search/filter labels and empty states. Individual fighter records are managed separately.',
    manage: [{ label: 'Manage Fighters', to: '/admin/athletes' }],
    blocks: [
      {
        id: 'athletes',
        title: 'Directory',
        fields: [
          { key: 'heroEyebrow', label: 'Hero Eyebrow', rows: 1 },
          { key: 'heroTitle', label: 'Hero Title', rows: 1, richText: true },
          { key: 'heroSubtitle', label: 'Hero Subtitle', rows: 2 },
          { key: 'searchPlaceholder', label: 'Search Placeholder' },
          { key: 'disciplineLabel', label: 'Discipline Filter Label' },
          { key: 'allDisciplinesLabel', label: 'All Disciplines Label' },
          { key: 'locationLabel', label: 'Location Filter Label' },
          { key: 'allLocationsLabel', label: 'All Locations Label' },
          { key: 'loadingLabel', label: 'Loading Message' },
          { key: 'errorTitle', label: 'Error Title' },
          { key: 'errorDescription', label: 'Error Description', rows: 2 },
          { key: 'emptyTitle', label: 'Empty Title' },
          { key: 'emptyDescription', label: 'Empty Description', rows: 2 },
        ],
      },
    ],
  },

  /* ------------------------- SPONSORSHIPS HUB ----------------------- */
  {
    id: 'sponsorships',
    label: 'Sponsorships',
    route: '/sponsorships',
    description: 'Sponsorship hub hero, ways to support, process, support areas, benefits and closing CTA.',
    manage: [{ label: 'Manage Sponsorships', to: '/admin/sponsorships' }],
    blocks: [
      {
        id: 'sponsorships',
        title: 'Hero & Ways to Support',
        fields: [
          { key: 'heroEyebrow', label: 'Hero Eyebrow', rows: 1 },
          { key: 'heroTitle', label: 'Hero Title', rows: 1, richText: true },
          { key: 'heroSubtitle', label: 'Hero Subtitle', rows: 3 },
          { key: 'heroSponsorCta', label: 'Hero — Sponsor Button' },
          { key: 'heroSeekCta', label: 'Hero — Seek Button' },
          { key: 'heroDonateCta', label: 'Hero — Donate Button' },
          { key: 'waysEyebrow', label: 'Ways — Eyebrow', rows: 1 },
          { key: 'waysTitle', label: 'Ways — Heading', richText: true },
          { key: 'waysSubtitle', label: 'Ways — Subtitle', rows: 2 },
        ],
        lists: [
          {
            key: 'supportWays',
            label: 'Ways to Support',
            itemLabel: 'title',
            addLabel: 'Add way to support',
            newItem: { title: 'New way', text: '', linkLabel: '' },
            fields: [
              { key: 'title', label: 'Title' },
              { key: 'text', label: 'Description', rows: 2 },
              { key: 'linkLabel', label: 'Link Label' },
            ],
          },
        ],
      },
      {
        id: 'sponsorships-how',
        title: 'Process, Support Areas & Benefits',
        fields: [
          { key: 'howEyebrow', label: 'Process Eyebrow', rows: 1 },
          { key: 'howTitle', label: 'Process Heading', richText: true },
          { key: 'howSubtitle', label: 'Process Subtitle', rows: 2 },
          { key: 'goesEyebrow', label: 'Support Areas Eyebrow', rows: 1 },
          { key: 'goesTitle', label: 'Support Areas Heading', richText: true },
          { key: 'goesSubtitle', label: 'Support Areas Subtitle', rows: 3 },
          { key: 'whyEyebrow', label: 'Why Sponsor Eyebrow', rows: 1 },
          { key: 'whyTitle', label: 'Why Sponsor Heading', rows: 2, richText: true },
          { key: 'whyText', label: 'Why Sponsor Text', rows: 2 },
          { key: 'ctaEyebrow', label: 'CTA Eyebrow', rows: 1 },
          { key: 'ctaTitle', label: 'CTA Heading', rows: 2, richText: true },
          { key: 'ctaText', label: 'CTA Paragraph', rows: 2 },
          { key: 'ctaSponsorCta', label: 'CTA — Sponsor Button' },
          { key: 'ctaSeekCta', label: 'CTA — Seek Button' },
          { key: 'ctaDonateCta', label: 'CTA — Donate Button' },
        ],
        lists: [
          {
            key: 'process',
            label: 'Process Steps',
            itemLabel: 'title',
            addLabel: 'Add step',
            newItem: { title: 'New step', text: '' },
            fields: [
              { key: 'title', label: 'Title' },
              { key: 'text', label: 'Description', rows: 2 },
            ],
          },
          {
            key: 'supportAreas',
            label: 'Where Support Goes',
            itemLabel: 'title',
            addLabel: 'Add support area',
            newItem: { title: 'New area', text: '' },
            fields: [
              { key: 'title', label: 'Title' },
              { key: 'text', label: 'Description', rows: 2 },
            ],
          },
          {
            key: 'benefits',
            label: 'Sponsor Benefits',
            itemLabel: 'title',
            addLabel: 'Add benefit',
            newItem: { title: 'New benefit', text: '' },
            fields: [
              { key: 'title', label: 'Title' },
              { key: 'text', label: 'Description', rows: 2 },
            ],
          },
        ],
      },
    ],
  },

  /* ------------------- SPONSORSHIP OPPORTUNITIES ------------------- */
  {
    id: 'sponsorship-opportunities',
    label: 'Sponsorship Opportunities',
    route: '/sponsorships/opportunities',
    description: 'Open opportunities hero copy, type labels and empty states. Opportunities are managed separately.',
    manage: [{ label: 'Manage Sponsorships', to: '/admin/sponsorships' }],
    blocks: [
      {
        id: 'sponsorship-opportunities',
        title: 'Opportunities Listing',
        fields: [
          { key: 'heroEyebrow', label: 'Hero Eyebrow', rows: 1 },
          { key: 'heroTitle', label: 'Hero Title', rows: 1, richText: true },
          { key: 'heroSubtitle', label: 'Hero Subtitle', rows: 2 },
          { key: 'typeFighterLabel', label: 'Type — Fighter' },
          { key: 'typeGroupLabel', label: 'Type — Group' },
          { key: 'typeEventLabel', label: 'Type — Event' },
          { key: 'typeGeneralLabel', label: 'Type — General' },
          { key: 'anyAmountLabel', label: 'Any Amount Label' },
          { key: 'closesLabel', label: 'Closes Label' },
          { key: 'loadingLabel', label: 'Loading Message' },
          { key: 'errorTitle', label: 'Error Title' },
          { key: 'errorDescription', label: 'Error Description', rows: 2 },
          { key: 'emptyTitle', label: 'Empty Title' },
          { key: 'emptyDescription', label: 'Empty Description', rows: 2 },
        ],
      },
    ],
  },

  /* --------------------- SPONSORSHIPS PROVIDED --------------------- */
  {
    id: 'sponsorships-provided',
    label: 'Sponsorships Provided',
    route: '/sponsorships/provided',
    description:
      'Transparent impact record hero, toolbar and table labels. Records come from the payments/sponsorship system.',
    manage: [{ label: 'Manage Sponsorships', to: '/admin/sponsorships' }],
    blocks: [
      {
        id: 'sponsorships-provided',
        title: 'Impact Record',
        fields: [
          { key: 'heroEyebrow', label: 'Hero Eyebrow', rows: 1 },
          { key: 'heroTitle', label: 'Hero Title', rows: 1, richText: true },
          { key: 'heroSubtitle', label: 'Hero Subtitle', rows: 2 },
          { key: 'searchPlaceholder', label: 'Search Placeholder' },
          { key: 'statusLabel', label: 'Status Filter Label' },
          { key: 'allStatusesLabel', label: 'All Statuses Label' },
          { key: 'statusActiveLabel', label: 'Status — Active' },
          { key: 'statusFailedLabel', label: 'Status — Failed' },
          { key: 'statusRefundedLabel', label: 'Status — Refunded' },
          { key: 'viewCardsLabel', label: 'View — Cards' },
          { key: 'viewTableLabel', label: 'View — Table' },
          { key: 'amountLabel', label: 'Card — Amount Label' },
          { key: 'dateLabel', label: 'Card — Date Label' },
          { key: 'eventLabel', label: 'Card — Event Label' },
          { key: 'typeLabel', label: 'Card — Type Label' },
          { key: 'statusRowLabel', label: 'Card — Status Label' },
          { key: 'colDonor', label: 'Table — Donor Column' },
          { key: 'colFighter', label: 'Table — Fighter Column' },
          { key: 'colAmount', label: 'Table — Amount Column' },
          { key: 'colDate', label: 'Table — Date Column' },
          { key: 'colEvent', label: 'Table — Event Column' },
          { key: 'colStatus', label: 'Table — Status Column' },
          { key: 'loadingLabel', label: 'Loading Message' },
          { key: 'errorTitle', label: 'Error Title' },
          { key: 'errorDescription', label: 'Error Description', rows: 2 },
          { key: 'emptyTitle', label: 'Empty Title' },
          { key: 'emptyDescription', label: 'Empty Description', rows: 2 },
        ],
      },
    ],
  },

  /* ------------------------------ NEWS ------------------------------ */
  {
    id: 'news',
    label: 'News',
    route: '/news',
    description: 'News listing hero, filter labels and empty states. Individual stories are managed separately.',
    manage: [{ label: 'Manage News', to: '/admin/news' }],
    blocks: [
      {
        id: 'news',
        title: 'News Listing',
        fields: [
          { key: 'heroEyebrow', label: 'Hero Eyebrow', rows: 1 },
          { key: 'heroTitle', label: 'Hero Title', rows: 1, richText: true },
          { key: 'heroSubtitle', label: 'Hero Subtitle', rows: 2 },
          { key: 'categoryLabel', label: 'Category Filter Label' },
          { key: 'allCategoriesLabel', label: 'All Categories Label' },
          { key: 'categoryAnnouncementLabel', label: 'Category — Announcement' },
          { key: 'categoryStoryLabel', label: 'Category — Fighter Stories' },
          { key: 'categoryEventsLabel', label: 'Category — Events' },
          { key: 'loadingLabel', label: 'Loading Message' },
          { key: 'errorTitle', label: 'Error Title' },
          { key: 'errorDescription', label: 'Error Description', rows: 2 },
          { key: 'emptyTitle', label: 'Empty Title' },
          { key: 'emptyDescription', label: 'Empty Description', rows: 2 },
        ],
      },
    ],
  },

  /* ----------------------------- EVENTS ----------------------------- */
  {
    id: 'events',
    label: 'Events',
    route: '/events',
    description: 'Events listing hero and empty states. Individual events are managed separately.',
    manage: [{ label: 'Manage Events', to: '/admin/events' }],
    blocks: [
      {
        id: 'events',
        title: 'Events Listing',
        fields: [
          { key: 'heroEyebrow', label: 'Hero Eyebrow', rows: 1 },
          { key: 'heroTitle', label: 'Hero Title', rows: 1, richText: true },
          { key: 'heroSubtitle', label: 'Hero Subtitle', rows: 2 },
          { key: 'loadingLabel', label: 'Loading Message' },
          { key: 'errorTitle', label: 'Error Title' },
          { key: 'errorDescription', label: 'Error Description', rows: 2 },
          { key: 'emptyTitle', label: 'Empty Title' },
          { key: 'emptyDescription', label: 'Empty Description', rows: 2 },
          { key: 'dayTbaLabel', label: 'Fallback Day' },
          { key: 'monthTbaLabel', label: 'Fallback Month' },
          { key: 'dateUnknownLabel', label: 'Fallback Date' },
        ],
      },
    ],
  },

  /* ----------------------------- GALLERY ---------------------------- */
  {
    id: 'gallery',
    label: 'Gallery',
    route: '/gallery',
    description: 'Gallery hero, filter/empty states and event-filter note. Individual media is managed separately.',
    manage: [{ label: 'Manage Gallery', to: '/admin/gallery' }],
    blocks: [
      {
        id: 'gallery',
        title: 'Gallery Listing',
        fields: [
          { key: 'heroEyebrow', label: 'Hero Eyebrow', rows: 1 },
          { key: 'heroTitle', label: 'Hero Title', rows: 1, richText: true },
          { key: 'heroSubtitle', label: 'Hero Subtitle', rows: 2 },
          { key: 'eventNote', label: 'Event Filter Note', rows: 1 },
          { key: 'viewAllMediaLabel', label: 'View All Media Label' },
          { key: 'allCategoryLabel', label: 'All Categories Label' },
          { key: 'loadingLabel', label: 'Loading Message' },
          { key: 'errorTitle', label: 'Error Title' },
          { key: 'errorDescription', label: 'Error Description', rows: 2 },
          { key: 'emptyEventTitle', label: 'Event Empty Title' },
          { key: 'emptyEventDescription', label: 'Event Empty Description', rows: 2 },
          { key: 'emptyTitle', label: 'Empty Title' },
          { key: 'emptyDescription', label: 'Empty Description', rows: 2 },
        ],
      },
    ],
  },

  /* ----------------------------- DONATE ----------------------------- */
  {
    id: 'donate',
    label: 'Donate',
    route: '/donate',
    description: 'Donate hero, why-support section, donation form copy and confirmation messaging.',
    manage: [{ label: 'Manage Sponsorships', to: '/admin/sponsorships' }],
    blocks: [
      {
        id: 'donate',
        title: 'Hero & Why Support',
        fields: [
          { key: 'heroEyebrow', label: 'Hero Eyebrow', rows: 1 },
          { key: 'heroTitle', label: 'Hero Title', rows: 1, richText: true },
          { key: 'heroSubtitle', label: 'Hero Subtitle', rows: 2 },
          { key: 'whyEyebrow', label: 'Why — Eyebrow', rows: 1 },
          { key: 'whyTitle', label: 'Why — Heading', richText: true },
          { key: 'whySubtitle', label: 'Why — Subtitle', rows: 2 },
        ],
        lists: [
          {
            key: 'impacts',
            label: 'Reasons to Support',
            itemLabel: 'title',
            addLabel: 'Add reason',
            newItem: { title: 'New reason', text: '' },
            fields: [
              { key: 'title', label: 'Title' },
              { key: 'text', label: 'Description', rows: 2 },
            ],
          },
        ],
      },
      {
        id: 'donate-form',
        title: 'Donation Form & Confirmation',
        fields: [
          { key: 'formTitle', label: 'Form Title' },
          { key: 'formSubtitle', label: 'Form Subtitle', rows: 2 },
          { key: 'pledgeEyebrow', label: 'Pledge Eyebrow', rows: 1 },
          { key: 'pledgeTitle', label: 'Pledge Heading', richText: true },
          { key: 'customAmountLabel', label: 'Custom Amount Label' },
          { key: 'customAmountPlaceholder', label: 'Custom Amount Placeholder' },
          { key: 'customOptionLabel', label: 'Custom Option Label' },
          { key: 'contributionLabel', label: 'Contribution Label' },
          { key: 'oneTimeLabel', label: 'One-Time Label' },
          { key: 'monthlyLabel', label: 'Monthly Label' },
          { key: 'detailsEyebrow', label: 'Details Eyebrow', rows: 1 },
          { key: 'detailsTitle', label: 'Details Heading', richText: true },
          { key: 'nameLabel', label: 'Name Label' },
          { key: 'namePlaceholder', label: 'Name Placeholder' },
          { key: 'emailLabel', label: 'Email Label' },
          { key: 'emailPlaceholder', label: 'Email Placeholder' },
          { key: 'phoneLabel', label: 'Phone Label' },
          { key: 'phonePlaceholder', label: 'Phone Placeholder' },
          { key: 'messageLabel', label: 'Message Label' },
          { key: 'messagePlaceholder', label: 'Message Placeholder', rows: 2 },
          { key: 'consentText', label: 'Consent Text', rows: 2 },
          { key: 'noteStrong', label: 'Note — Emphasis' },
          { key: 'noteOnlineText', label: 'Note — Online Payment Text' },
          { key: 'notePledgeText', label: 'Note — Pledge Text', rows: 2 },
          { key: 'submitProcessingLabel', label: 'Submitting Label' },
          { key: 'footnote', label: 'Footnote' },
          { key: 'refundLinkLabel', label: 'Refund Policy Link Label' },
          { key: 'successTitle', label: 'Success Title' },
          { key: 'successPaidText', label: 'Success — Paid Text', rows: 2 },
          { key: 'successPledgeText', label: 'Success — Pledge Text', rows: 2 },
          { key: 'anotherDonationLabel', label: 'Another Donation Button' },
          { key: 'anotherPledgeLabel', label: 'Another Pledge Button' },
        ],
      },
    ],
  },

  /* ------------------------ SEEK SPONSORSHIP ----------------------- */
  {
    id: 'seeking-sponsorship',
    label: 'Seek Sponsorship',
    route: '/seeking-sponsorship',
    description: 'Seek sponsorship hero, application paths, process, eligibility, documents and closing CTA.',
    blocks: [
      {
        id: 'seeking-sponsorship',
        title: 'Hero, Application Paths & Process',
        fields: [
          { key: 'heroEyebrow', label: 'Hero Eyebrow', rows: 1 },
          { key: 'heroTitle', label: 'Hero Title', rows: 2, richText: true },
          { key: 'heroSubtitle', label: 'Hero Subtitle', rows: 2 },
          { key: 'applyEyebrow', label: 'Paths Eyebrow', rows: 1 },
          { key: 'applyTitle', label: 'Paths Heading', richText: true },
          { key: 'applySubtitle', label: 'Paths Subtitle', rows: 2 },
          { key: 'fighterCardTitle', label: 'Fighter Path Title' },
          { key: 'fighterCardText', label: 'Fighter Path Text', rows: 2 },
          { key: 'fighterCardCta', label: 'Fighter Path Button' },
          { key: 'academyCardTitle', label: 'Academy Path Title' },
          { key: 'academyCardText', label: 'Academy Path Text', rows: 2 },
          { key: 'academyCardCta', label: 'Academy Path Button' },
          { key: 'processEyebrow', label: 'Process Eyebrow', rows: 1 },
          { key: 'processTitle', label: 'Process Heading', richText: true },
          { key: 'processSubtitle', label: 'Process Subtitle', rows: 2 },
        ],
        lists: [
          {
            key: 'steps',
            label: 'Process Steps',
            itemLabel: 'title',
            addLabel: 'Add step',
            newItem: { title: 'New step', text: '' },
            fields: [
              { key: 'title', label: 'Title' },
              { key: 'text', label: 'Description', rows: 2 },
            ],
          },
        ],
      },
      {
        id: 'seeking-sponsorship-eligibility',
        title: 'Eligibility, Documents & Closing CTA',
        fields: [
          { key: 'eligibilityEyebrow', label: 'Eligibility Eyebrow', rows: 1 },
          { key: 'eligibilityTitle', label: 'Eligibility Heading', richText: true },
          { key: 'eligibilitySubtitle', label: 'Eligibility Subtitle', rows: 2 },
          { key: 'docsEyebrow', label: 'Documents Eyebrow', rows: 1 },
          { key: 'docsTitle', label: 'Documents Heading', richText: true },
          { key: 'ctaTitle', label: 'CTA Heading', rows: 2, richText: true },
          { key: 'ctaText', label: 'CTA Paragraph', rows: 2 },
          { key: 'ctaFighterCta', label: 'CTA — Fighter Button' },
          { key: 'ctaAcademyCta', label: 'CTA — Academy Button' },
          { key: 'ctaAskCta', label: 'CTA — Ask Button' },
        ],
        lists: [
          {
            key: 'eligibility',
            label: 'Eligibility Criteria',
            itemLabel: 'title',
            addLabel: 'Add criteria',
            newItem: { title: 'New criteria', text: '' },
            fields: [
              { key: 'title', label: 'Title' },
              { key: 'text', label: 'Description', rows: 2 },
            ],
          },
          {
            key: 'requiredDocs',
            label: 'Required Documents',
            itemLabel: 'title',
            addLabel: 'Add document',
            newItem: { title: 'New document', text: '' },
            fields: [
              { key: 'title', label: 'Title' },
              { key: 'text', label: 'Description', rows: 2 },
            ],
          },
        ],
      },
    ],
  },

  /* ---------------------------- CONTACT ---------------------------- */
  {
    id: 'contact',
    label: 'Contact',
    route: '/contact',
    description: 'Contact hero, contact details, form copy, labels and confirmation messaging.',
    blocks: [
      {
        id: 'contact',
        title: 'Contact Details & Form',
        fields: [
          { key: 'heroEyebrow', label: 'Hero Eyebrow', rows: 1 },
          { key: 'heroTitle', label: 'Hero Title', rows: 1, richText: true },
          { key: 'heroSubtitle', label: 'Hero Subtitle', rows: 2 },
          { key: 'email', label: 'Email Address' },
          { key: 'phone', label: 'Phone Number' },
          { key: 'address', label: 'Address', rows: 2 },
          { key: 'emailCardTitle', label: 'Email Card Title' },
          { key: 'phoneCardTitle', label: 'Phone Card Title' },
          { key: 'addressCardTitle', label: 'Address Card Title' },
          { key: 'formEyebrow', label: 'Form Eyebrow', rows: 1 },
          { key: 'formTitle', label: 'Form Heading', richText: true },
          { key: 'formText', label: 'Form Text', rows: 2 },
          { key: 'nameLabel', label: 'Name Label' },
          { key: 'namePlaceholder', label: 'Name Placeholder' },
          { key: 'emailLabel', label: 'Email Label' },
          { key: 'emailPlaceholder', label: 'Email Placeholder' },
          { key: 'phoneLabel', label: 'Phone Label' },
          { key: 'phonePlaceholder', label: 'Phone Placeholder' },
          { key: 'subjectLabel', label: 'Subject Label' },
          { key: 'subjectPlaceholder', label: 'Subject Placeholder' },
          { key: 'messageLabel', label: 'Message Label' },
          { key: 'messagePlaceholder', label: 'Message Placeholder', rows: 2 },
          { key: 'consentText', label: 'Consent Text', rows: 2 },
          { key: 'submitLabel', label: 'Submit Button Label' },
          { key: 'submittingLabel', label: 'Submitting Label' },
          { key: 'successTitle', label: 'Success Title' },
          { key: 'successText', label: 'Success Text', rows: 2 },
          { key: 'sendAnotherLabel', label: 'Send Another Button' },
        ],
      },
    ],
  },

  /* ------------------------------ FAQ ------------------------------ */
  {
    id: 'faq',
    label: 'FAQ',
    route: '/faq',
    description: 'FAQ hero, question categories/entries and closing CTA.',
    blocks: [
      {
        id: 'faq',
        title: 'Questions & Answers',
        fields: [
          { key: 'heroEyebrow', label: 'Hero Eyebrow', rows: 1 },
          { key: 'heroTitle', label: 'Hero Title', rows: 1, richText: true },
          { key: 'heroSubtitle', label: 'Hero Subtitle', rows: 2 },
          { key: 'closingEyebrow', label: 'Closing Eyebrow', rows: 1 },
          { key: 'closingTitle', label: 'Closing Heading', richText: true },
          { key: 'closingSubtitle', label: 'Closing Subtitle', rows: 2 },
          { key: 'closingCta', label: 'Closing Button Label' },
        ],
        lists: [
          {
            key: 'faqs',
            label: 'FAQ Entries',
            itemLabel: 'q',
            addLabel: 'Add question',
            newItem: { category: 'General', q: 'New question', a: '' },
            fields: [
              { key: 'category', label: 'Category' },
              { key: 'q', label: 'Question', rows: 1 },
              { key: 'a', label: 'Answer', rows: 3 },
            ],
          },
        ],
      },
    ],
  },

  /* ----------------------------- PRIVACY --------------------------- */
  {
    id: 'privacy',
    label: 'Privacy',
    route: '/privacy',
    description: 'Privacy policy hero, policy sections and closing CTA.',
    blocks: [
      {
        id: 'privacy',
        title: 'Privacy Policy',
        fields: [
          { key: 'heroEyebrow', label: 'Hero Eyebrow', rows: 1 },
          { key: 'heroTitle', label: 'Hero Title', rows: 1, richText: true },
          { key: 'heroSubtitle', label: 'Hero Subtitle', rows: 2 },
          { key: 'lastUpdatedEyebrow', label: 'Closing Eyebrow', rows: 1 },
          { key: 'lastUpdatedTitle', label: 'Closing Heading', richText: true },
          { key: 'lastUpdatedSubtitle', label: 'Closing Subtitle', rows: 2 },
          { key: 'closingCta', label: 'Closing Button Label' },
        ],
        lists: [
          {
            key: 'sections',
            label: 'Policy Sections',
            itemLabel: 'heading',
            addLabel: 'Add section',
            newItem: { heading: 'New section', body: '' },
            fields: [
              { key: 'heading', label: 'Heading' },
              { key: 'body', label: 'Body', rows: 4 },
            ],
          },
        ],
      },
    ],
  },

  /* ------------------------------ TERMS ---------------------------- */
  {
    id: 'terms',
    label: 'Terms',
    route: '/terms',
    description: 'Terms & conditions hero, sections and closing CTA.',
    blocks: [
      {
        id: 'terms',
        title: 'Terms & Conditions',
        fields: [
          { key: 'heroEyebrow', label: 'Hero Eyebrow', rows: 1 },
          { key: 'heroTitle', label: 'Hero Title', rows: 1, richText: true },
          { key: 'heroSubtitle', label: 'Hero Subtitle', rows: 2 },
          { key: 'lastUpdatedEyebrow', label: 'Closing Eyebrow', rows: 1 },
          { key: 'lastUpdatedTitle', label: 'Closing Heading', richText: true },
          { key: 'lastUpdatedSubtitle', label: 'Closing Subtitle', rows: 2 },
          { key: 'closingCta', label: 'Closing Button Label' },
        ],
        lists: [
          {
            key: 'sections',
            label: 'Terms Sections',
            itemLabel: 'heading',
            addLabel: 'Add section',
            newItem: { heading: 'New section', body: '' },
            fields: [
              { key: 'heading', label: 'Heading' },
              { key: 'body', label: 'Body', rows: 4 },
            ],
          },
        ],
      },
    ],
  },

  /* ---------------------- REFUND & CANCELLATION -------------------- */
  {
    id: 'refund-cancellation',
    label: 'Refund & Cancellation',
    route: '/refund-cancellation',
    description: 'Refund & cancellation policy hero, sections and closing CTA.',
    blocks: [
      {
        id: 'refund-cancellation',
        title: 'Refund & Cancellation Policy',
        fields: [
          { key: 'heroEyebrow', label: 'Hero Eyebrow', rows: 1 },
          { key: 'heroTitle', label: 'Hero Title', rows: 1, richText: true },
          { key: 'heroSubtitle', label: 'Hero Subtitle', rows: 2 },
          { key: 'lastUpdatedEyebrow', label: 'Closing Eyebrow', rows: 1 },
          { key: 'lastUpdatedTitle', label: 'Closing Heading', richText: true },
          { key: 'lastUpdatedSubtitle', label: 'Closing Subtitle', rows: 2 },
          { key: 'closingCta', label: 'Closing Button Label' },
        ],
        lists: [
          {
            key: 'sections',
            label: 'Policy Sections',
            itemLabel: 'heading',
            addLabel: 'Add section',
            newItem: { heading: 'New section', body: '' },
            fields: [
              { key: 'heading', label: 'Heading' },
              { key: 'body', label: 'Body', rows: 4 },
            ],
          },
        ],
      },
    ],
  },

  /* --------------------------- NOT FOUND --------------------------- */
  {
    id: 'not-found',
    label: 'Page Not Found (404)',
    route: '/404',
    description: 'The 404 page messaging and buttons.',
    blocks: [
      {
        id: 'not-found',
        title: '404 Page',
        fields: [
          { key: 'heroEyebrow', label: 'Hero Eyebrow', rows: 1 },
          { key: 'heroTitle', label: 'Hero Title', rows: 1, richText: true },
          { key: 'heroSubtitle', label: 'Hero Subtitle', rows: 2 },
          { key: 'code', label: 'Error Code' },
          { key: 'message', label: 'Message', rows: 2 },
          { key: 'primaryCta', label: 'Primary Button Label' },
          { key: 'secondaryCta', label: 'Secondary Button Label' },
        ],
      },
    ],
  },
]

export function getContentPage(pageId) {
  return CONTENT_PAGES.find((page) => page.id === pageId) ?? null
}

/** Defaults for a block, falling back to an empty object. */
export function blockDefaults(blockId) {
  return PAGE_CONTENT[blockId] ?? {}
}
