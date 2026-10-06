import { stats } from './siteContent.js'

/**
 * Page-level content defaults, keyed by `contentBlocks/{id}` document id.
 *
 * These are the *actual strings and repeated items currently rendered* by each
 * public page. Public pages merge the stored content block over these defaults,
 * so editing a block in Admin → Website Content overrides the copy below without
 * ever leaving a page blank.
 *
 * Values are either:
 *   - strings, or
 *   - arrays of objects (repeated sections such as FAQ entries, values, team,
 *     process steps …). Repeated arrays are persisted as JSON strings because
 *     `contentBlocks` stores a flat string map — the admin editor serialises and
 *     the `usePageContent` hook parses them back transparently.
 *
 * Titles use a tiny text convention understood by `renderRichText`:
 *   `**word**` → accent-coloured span, `\n` → line break.
 */
export const PAGE_CONTENT = {
  /* ----------------------------- HOME ----------------------------- */
  homepage: {
    heroEyebrow: 'Empowering Fighters',
    heroTitle: 'STRONG BODY.\nSTRONG MIND.\n**STRONG FUTURE.**',
    heroParagraph:
      'USSCOS Trust supports dedicated fighters — from boxing to Muay Thai, kickboxing, and wrestling — with sponsorship, training, and opportunity: building champions on and off the arena.',
    heroPrimaryCta: 'SPONSOR A FIGHTER',
    heroSecondaryCta: 'EXPLORE FIGHTERS',
  },
  'home-about': {
    aboutEyebrow: 'About Us',
    aboutTitle: 'Building Champions.\nBuilding **Tomorrow.**',
    aboutText:
      'USSCOS Trust is a nonprofit combat sports organization committed to empowering fighters. Through sponsorship, world-class training, and mentorship, we help dedicated competitors overcome barriers and reach their full potential — on and off the arena.',
    aboutCtaLabel: 'LEARN MORE ABOUT US',
    valueCards: [
      {
        title: 'Our Mission',
        text: 'To empower young fighters by removing financial and structural barriers to excellence.',
      },
      {
        title: 'Our Vision',
        text: 'A future where every talented fighter has the opportunity to compete at the highest level.',
      },
      {
        title: 'Our Values',
        text: 'Integrity, transparency, dedication, and an unwavering belief in the power of combat sport.',
      },
    ],
  },
  'home-sections': {
    risingEyebrow: 'Rising Stars',
    risingTitle: 'Meet Our **Fighters**',
    risingLinkLabel: 'VIEW ALL FIGHTERS',
    impactEyebrow: 'Our Impact',
    impactTitle: 'Changing Lives, **Creating Impact**',
    supportEyebrow: 'Support Areas',
    supportTitle: 'How Your Support **Helps**',
    supportSubtitle: 'Every contribution is directed toward programs that directly empower fighters.',
    eventsEyebrow: 'Upcoming Events',
    eventsTitle: "Don't Miss **What's Next**",
    eventsSubtitle: 'Catch our fighters in action at upcoming national and international competitions.',
    sponsorsEyebrow: 'Our Sponsors',
    sponsorsTitle: 'Partners Who Believe **in Champions**',
    testimonialsEyebrow: 'Testimonials',
    testimonialsTitle: 'What People **Say**',
    newsEyebrow: 'News & Updates',
    newsTitle: 'Latest From **USSCOS**',
    newsLinkLabel: 'ALL NEWS',
    supportCategories: [
      {
        title: 'Training & Coaching',
        description:
          'Access to elite coaches, structured training programs, and sparring partners to sharpen every skill.',
      },
      {
        title: 'Nutrition & Health',
        description:
          'Personalized nutrition plans, dietary supplements, and physiotherapy for peak performance and recovery.',
      },
      {
        title: 'Equipment & Gear',
        description:
          'High-quality training gear, competition uniforms, and specialized equipment tailored to each discipline.',
      },
      {
        title: 'Travel & Exposure',
        description:
          'Competition travel, registration fees, and opportunities to compete at national and international levels.',
      },
      {
        title: 'Education & Career',
        description:
          'Academic support, career guidance, and life-skills programs that build champions beyond the arena.',
      },
    ],
    testimonials: [
      {
        name: 'Kru Vikram Singh',
        role: 'Coach, Tiger Muay Thai',
        quote:
          'USSCOS Trust removed the financial hurdles that were holding back some of my most promising fighters. Their support changes lives.',
      },
      {
        name: 'Priya S.',
        role: 'BJJ Fighter',
        quote:
          'Without the sponsorship, I would not have been able to afford my competition travel. USSCOS Trust believed in me when it mattered most.',
      },
      {
        name: 'Rahul Sharma',
        role: 'Corporate Sponsor',
        quote:
          "Partnering with USSCOS Trust has been incredibly rewarding. Knowing our investment directly supports a fighter's dream is priceless.",
      },
      {
        name: 'Coach Rajan Pillai',
        role: 'MMA & Kickboxing Coach',
        quote:
          'The trust provides not just funding but genuine mentorship. Their programs are building complete fighters — mentally and physically.',
      },
    ],
  },
  'home-final-cta': {
    finalCtaTitle: 'BE A CHAMPION BEHIND\n**THE CHAMPIONS.**',
    finalCtaParagraph:
      'Your sponsorship turns potential into performance. Join us in empowering the next generation of fighters.',
    finalCtaPrimaryCta: 'SPONSOR NOW',
    finalCtaSecondaryCta: 'GET INVOLVED',
  },
  stats: {
    livesImpacted: stats.livesImpacted,
    athletesSupported: stats.athletesSupported,
    countriesReached: stats.countriesReached,
    eventsOrganized: stats.eventsOrganized,
    activeSponsors: stats.activeSponsors,
    volunteers: stats.volunteers,
    projects: stats.projects,
    communities: stats.communities,
  },

  /* ----------------------------- ABOUT ----------------------------- */
  about: {
    heroEyebrow: 'About Us',
    heroTitle: 'Building Champions.\nBuilding **Tomorrow.**',
    heroSubtitle:
      'USSCOS Trust is a nonprofit combat sports organization empowering fighters through sponsorship, world-class training, and mentorship.',
    whoEyebrow: 'Who We Are',
    whoTitle: 'A Trust Built on **Fighter Dreams**',
    intro:
      'USSCOS Trust is a nonprofit combat sports organization focused on empowering fighters from all backgrounds. We provide financial sponsorship, world-class training, and mentorship to help them train, compete, and reach their full potential — in boxing, MMA, Muay Thai, kickboxing, wrestling, and beyond.',
    whoParagraph2:
      'We work closely with coaches, academies, and corporate partners to identify talented fighters, understand their needs, and create personalized support plans. From ranking fees to international travel, we remove the barriers between potential and performance.',
  },
  'about-mission': {
    missionEyebrow: 'Our Mission',
    missionTitle: 'Empower. Equip. **Elevate.**',
    missionText:
      'To empower young fighters by removing financial and structural barriers — providing the sponsorship, coaching, and mentorship they need to train, compete, and win at every level.',
    visionEyebrow: 'Our Vision',
    visionTitle: 'Champions Beyond **the Arena**',
    visionText:
      'A world where every determined fighter has the resources, opportunity, and belief to train, compete, and excel at the highest level — building character, discipline, and leadership that last a lifetime.',
    valuesEyebrow: 'Our Values',
    valuesTitle: 'What We **Stand For**',
    values: [
      {
        title: 'Integrity',
        text: 'We operate with complete transparency. Every rupee raised is accounted for and directed toward fighter development.',
      },
      {
        title: 'Dedication',
        text: 'We match the discipline of the fighters we support — showing up consistently and committing to long-term impact.',
      },
      {
        title: 'Excellence',
        text: 'We pursue the highest standards in coaching, nutrition, equipment, and opportunities we provide to our fighters.',
      },
      {
        title: 'Community',
        text: 'We believe combat sport unites people. Our network of coaches, sponsors, volunteers, and fighters form a powerful family.',
      },
    ],
  },
  'about-story': {
    storyEyebrow: 'Our Story',
    storyTitle: 'A Decade of **Impact**',
    purposeTitle: 'Purpose-Driven',
    purposeText:
      'Our journey began around one belief: financial background should never decide who gets to compete. Today, that belief powers sponsorship programs, training camps, and competitions across the globe.',
    impactEyebrow: 'Our Impact',
    impactTitle: 'The Numbers Behind **the Mission**',
    timeline: [
      { year: '2016', text: 'USSCOS Trust is founded with a mission to support young fighters.' },
      { year: '2018', text: 'First national sponsorship program launched — 25 fighters supported in the debut cycle.' },
      { year: '2021', text: 'Crossed 100 fighters supported, deepening our boxing, Muay Thai, kickboxing, and wrestling programs.' },
      { year: '2024', text: 'Established our flagship training camps and international exposure program for fighters.' },
      { year: '2025', text: '250+ fighters supported across 20+ countries with a growing community of sponsors.' },
    ],
    impactNumbers: [
      { value: '10K+', label: 'Lives impacted through programs and community initiatives.' },
      { value: '250+', label: 'Fighters supported across every sponsorship cycle since 2018.' },
      { value: '50+', label: 'Events organized — camps, galas, and competitions nationwide.' },
      { value: '20+', label: 'Communities and countries reached through our programs.' },
    ],
  },
  'about-team': {
    teamEyebrow: 'Leadership',
    teamTitle: 'The People Behind **USSCOS**',
    teamSubtitle:
      'A dedicated team of combat sports professionals, coaches, mentors, and volunteers driving fighter development.',
    ctaTitle: 'Join the **Movement.**',
    ctaText: "Whether you want to sponsor a fighter, volunteer, or partner with us — there's a place for you.",
    ctaPrimaryCta: 'GET IN TOUCH',
    ctaSecondaryCta: 'LEARN MORE',
    team: [
      { name: 'Rajesh Nair', role: 'Founder & Chairperson', initials: 'RN' },
      { name: 'Dr. Kavita Iyer', role: 'Vice Chairperson', initials: 'KI' },
      { name: 'Sandeep Menon', role: 'Director of Programs', initials: 'SM' },
      { name: 'Anjali Kulkarni', role: 'Head of Sponsorships', initials: 'AK' },
      { name: 'Marcus D’Souza', role: 'Head of Training', initials: 'MD' },
      { name: 'Neha Bhat', role: 'Fighter Welfare Lead', initials: 'NB' },
    ],
  },

  /* ---------------------------- FIGHTERS --------------------------- */
  athletes: {
    heroEyebrow: 'Combat Sports Directory',
    heroTitle: 'Our **Fighters**',
    heroSubtitle:
      'Fighters supported by USSCOS Trust — from boxing and Muay Thai to kickboxing, wrestling, and more.',
    searchPlaceholder: 'Search fighters...',
    disciplineLabel: 'Discipline',
    allDisciplinesLabel: 'All Disciplines',
    locationLabel: 'Location',
    allLocationsLabel: 'All Locations',
    loadingLabel: 'Loading fighters',
    errorTitle: 'Error loading fighters',
    errorDescription: 'Please try again later.',
    emptyTitle: 'No fighters found',
    emptyDescription: 'Try adjusting your search or filters.',
  },

  /* ------------------------- SPONSORSHIPS HUB ---------------------- */
  sponsorships: {
    heroEyebrow: 'Sponsorship at USSCOS',
    heroTitle: 'Supporting the Journey **Behind Every Round**',
    heroSubtitle:
      'USSCOS Trust connects supporters with boxers and fighters. Sponsorship provides the training, equipment, travel, and competition opportunities fighters need to develop and compete — and gives every sponsor a direct role in that journey.',
    heroSponsorCta: 'Become a Sponsor',
    heroSeekCta: 'Seek Sponsorship',
    heroDonateCta: 'Donate',
    waysEyebrow: 'Ways to Support',
    waysTitle: 'Three Ways to **Support the Sport**',
    waysSubtitle:
      'Choose the kind of support that fits your goals — each one gives a boxer or program a direct boost.',
    supportWays: [
      {
        title: 'Become a Sponsor',
        text: "Partner with a boxer or program by funding training, equipment, travel, and competition. Choose your level of support and make a direct impact on a fighter's journey.",
        linkLabel: 'Become a Sponsor',
      },
      {
        title: 'Seek Sponsorship',
        text: 'Are you a boxer or fighter looking for support? Apply for sponsorship to get the training, gear, travel, and competition backing you need.',
        linkLabel: 'Seek Sponsorship',
      },
      {
        title: 'Donate',
        text: 'Make a one-time or recurring donation to power fighter development, boxing programs, and events across USSCOS — and help grow the next generation of boxers.',
        linkLabel: 'Donate',
      },
    ],
  },
  'sponsorships-how': {
    howEyebrow: 'How It Works',
    howTitle: 'From **Explore** to Impact',
    howSubtitle:
      'A clear path from finding the right opportunity to seeing the difference your support makes.',
    goesEyebrow: 'Where Your Support Goes',
    goesTitle: 'Every Contribution **Has a Purpose**',
    goesSubtitle:
      "The exact use of any contribution depends on the sponsorship purpose you select. Support most often funds a boxer's development and the programs around them — from daily preparation to stepping into the ring.",
    whyEyebrow: 'Why Sponsor USSCOS',
    whyTitle: 'Boxing development depends on committed, **consistent support**.',
    whyText:
      'When you sponsor a USSCOS boxer or program, you invest in the preparation and determination that build fighters on and off the arena.',
    ctaEyebrow: 'Step Into the Ring With Us',
    ctaTitle: 'Your Support Builds the **Next Generation of Boxers**',
    ctaText:
      'From training camps to competition day, sponsorship turns potential into performance — and gives you a direct role in a boxer’s journey.',
    ctaSponsorCta: 'Become a Sponsor',
    ctaSeekCta: 'Seek Sponsorship',
    ctaDonateCta: 'Donate',
    process: [
      {
        title: 'Explore',
        text: 'Browse boxer profiles and available sponsorship opportunities to find a fighter, event, or program you want to support.',
      },
      {
        title: 'Choose & Support',
        text: 'Select the boxer, event, or program that matters to you and choose a contribution level that fits your goals. Secure online payment is being introduced through our website.',
      },
      {
        title: 'Make an Impact',
        text: 'Your contribution goes toward the purpose you selected — supporting training, competition, or development. Sponsors stay informed through transparent reporting.',
      },
    ],
    supportAreas: [
      {
        title: 'Training & Coaching',
        text: 'Structured coaching, sparring, and skill work that help boxers prepare and improve.',
      },
      {
        title: 'Equipment & Gear',
        text: 'Gloves, boots, protective gear, and competition kits boxers need to train and compete.',
      },
      {
        title: 'Competition & Travel',
        text: 'Entry fees, travel, and accommodation that let fighters attend tournaments and championships.',
      },
      {
        title: 'Training Camps & Preparation',
        text: 'Focused camps and preparation blocks that build fitness, technique, and readiness.',
      },
      {
        title: 'Fighter Development',
        text: "Long-term development and guidance that support a fighter's growth beyond any single event.",
      },
      {
        title: 'Boxing Programs & Events',
        text: 'Programs and events that grow the sport and open pathways for more young boxers.',
      },
    ],
    benefits: [
      {
        title: 'Direct Impact',
        text: "Your support goes directly toward a boxer's training, equipment, travel, and competition needs — with clear reporting on how it is used.",
      },
      {
        title: 'Community Growth',
        text: 'Supporting boxers lifts the wider community — inspiring young people, strengthening local clubs, and building a healthier sporting culture.',
      },
      {
        title: 'Long-term Partnerships',
        text: 'Sponsorship is most powerful when it is ongoing. Sustained support gives fighters and coaches the stability to plan training, camps, and competitions ahead.',
      },
    ],
  },

  /* ------------------- SPONSORSHIP OPPORTUNITIES ------------------- */
  'sponsorship-opportunities': {
    heroEyebrow: 'Sponsorships',
    heroTitle: 'Available **Opportunities**',
    heroSubtitle:
      'Browse open sponsorship opportunities for fighters, groups, and teams. Your support directly fuels their training, competition, and development.',
    loadingLabel: 'Loading sponsorship opportunities',
    errorTitle: 'Error loading opportunities',
    errorDescription: 'Please try again later.',
    emptyTitle: 'No open opportunities',
    emptyDescription: 'New sponsorship opportunities will appear here once they are published.',
    typeFighterLabel: 'Fighter Sponsorship',
    typeGroupLabel: 'Group Sponsorship',
    typeEventLabel: 'Event Sponsorship',
    typeGeneralLabel: 'General Sponsorship',
    anyAmountLabel: 'Any amount',
    closesLabel: 'Closes',
  },

  /* --------------------- SPONSORSHIPS PROVIDED --------------------- */
  'sponsorships-provided': {
    heroEyebrow: 'Sponsorships Provided',
    heroTitle: 'Transparent **Impact**',
    heroSubtitle:
      'A public record of sponsorships given to boxers and fighters — our commitment to transparency.',
    searchPlaceholder: 'Search donor, fighter, discipline...',
    statusLabel: 'Status',
    allStatusesLabel: 'All Statuses',
    statusActiveLabel: 'Active',
    statusFailedLabel: 'Failed',
    statusRefundedLabel: 'Refunded',
    viewCardsLabel: 'Cards',
    viewTableLabel: 'Table',
    loadingLabel: 'Loading sponsorship records',
    errorTitle: 'Error loading sponsorship records',
    errorDescription: 'Please try again later.',
    emptyTitle: 'No sponsorship records found',
    emptyDescription: 'Sponsorships will appear here once they are created by the payment server.',
    amountLabel: 'Amount',
    dateLabel: 'Date',
    eventLabel: 'Event',
    typeLabel: 'Type',
    statusRowLabel: 'Status',
    colDonor: 'Donor',
    colFighter: 'Fighter',
    colAmount: 'Amount',
    colDate: 'Date',
    colEvent: 'Event',
    colStatus: 'Status',
  },

  /* ------------------------------ NEWS ----------------------------- */
  news: {
    heroEyebrow: 'News & Updates',
    heroTitle: 'The Latest From **USSCOS**',
    heroSubtitle: 'Stories, announcements, and updates from the heart of fighter development.',
    categoryLabel: 'Category',
    allCategoriesLabel: 'All Categories',
    categoryAnnouncementLabel: 'Announcement',
    categoryStoryLabel: 'Fighter Stories',
    categoryEventsLabel: 'Events',
    loadingLabel: 'Loading news',
    errorTitle: 'Error loading news',
    errorDescription: 'Please try again later.',
    emptyTitle: 'No articles found',
    emptyDescription: 'No articles have been published yet.',
  },

  /* ----------------------------- EVENTS ---------------------------- */
  events: {
    heroEyebrow: 'Events',
    heroTitle: 'See Our Fighters **In Action**',
    heroSubtitle:
      'Upcoming tournaments, championships, camps, and programs from USSCOS and its partner academies.',
    loadingLabel: 'Loading events',
    errorTitle: 'Error loading events',
    errorDescription: 'There was a problem connecting. Please try again later.',
    emptyTitle: 'No events found',
    emptyDescription: 'No events are scheduled right now. Check back soon.',
    dayTbaLabel: 'TBA',
    monthTbaLabel: 'DATE',
    dateUnknownLabel: 'Date to be announced',
  },

  /* ----------------------------- GALLERY --------------------------- */
  gallery: {
    heroEyebrow: 'Gallery',
    heroTitle: 'Moments of **Glory**',
    heroSubtitle: 'A visual journey through competitions, training camps, and the fighters we support.',
    eventNote: 'Showing media for this event.',
    viewAllMediaLabel: 'View all media',
    allCategoryLabel: 'All',
    loadingLabel: 'Loading gallery',
    errorTitle: 'Error loading gallery',
    errorDescription: 'Please try again later.',
    emptyEventTitle: 'No media for this event yet',
    emptyEventDescription: 'Photos and videos linked to this event will appear here.',
    emptyTitle: 'No media found',
    emptyDescription: 'No media has been uploaded yet.',
  },

  /* ----------------------------- DONATE ---------------------------- */
  donate: {
    heroEyebrow: 'Donate',
    heroTitle: 'Fuel the **Fight** Within',
    heroSubtitle:
      'Your contribution directly supports training, equipment, travel, and competition for young fighters.',
    whyEyebrow: 'Why Support Fighters',
    whyTitle: 'Why Your **Support Matters**',
    whySubtitle: 'Talented fighters often miss their shot not because of ability, but because of resources.',
    impacts: [
      { title: 'Direct Support', text: 'Every pledge is directed straight to fighter development programs.' },
      {
        title: 'Community Building',
        text: 'Your support strengthens a growing family of fighters, coaches, and mentors.',
      },
      { title: 'Real Results', text: 'Sponsored fighters have won national medals and international selection.' },
    ],
  },
  'donate-form': {
    formTitle: 'Make a Donation Pledge',
    formSubtitle:
      'Choose an amount to support the next generation of champions. One-time donations are completed securely online; monthly donations are arranged by our team.',
    pledgeEyebrow: 'Pledge Options',
    pledgeTitle: 'Choose Your **Amount**',
    customAmountLabel: 'Custom Amount (₹)',
    customAmountPlaceholder: 'Enter amount',
    customOptionLabel: 'Custom',
    contributionLabel: 'Contribution',
    oneTimeLabel: 'One-Time',
    monthlyLabel: 'Monthly',
    detailsEyebrow: 'Your Details',
    detailsTitle: 'Donor **Information**',
    nameLabel: 'Full Name',
    namePlaceholder: 'Your name',
    emailLabel: 'Email',
    emailPlaceholder: 'you@example.com',
    phoneLabel: 'Phone',
    phonePlaceholder: '000 000 0000',
    messageLabel: 'Message (optional)',
    messagePlaceholder: 'Leave a note of encouragement for our fighters...',
    consentText:
      'I consent to USSCOS contacting me about this donation pledge. Donations support fighter development programs.',
    noteStrong: '100% of donations go toward fighter development programs.',
    noteOnlineText: 'One-time donations are completed securely right now.',
    notePledgeText:
      'Your pledge is recorded with a reference ID and our team will guide you through completing the contribution.',
    submitProcessingLabel: 'PROCESSING...',
    footnote: '100% of donations go toward fighter development programs.',
    refundLinkLabel: 'Refund & Cancellation Policy',
    successTitle: 'Thank You for Your Support!',
    successPaidText: 'A receipt will be issued by email shortly.',
    successPledgeText:
      'Our team will be in touch to arrange the transfer. 100% of your contribution goes directly to fighter development programs.',
    anotherDonationLabel: 'MAKE ANOTHER DONATION',
    anotherPledgeLabel: 'MAKE ANOTHER PLEDGE',
  },

  /* ------------------------ SEEK SPONSORSHIP ----------------------- */
  'seeking-sponsorship': {
    heroEyebrow: 'Seeking Sponsorship',
    heroTitle: 'Get **Sponsored.**\nCompete at Your **Best.**',
    heroSubtitle:
      'USSCOS Trust supports dedicated fighters with the resources they need to train, compete, grow, and win.',
    applyEyebrow: 'Apply for Sponsorship',
    applyTitle: 'Choose Your **Application**',
    applySubtitle: 'Select the path that applies to you. Both applications are reviewed on a rolling basis.',
    fighterCardTitle: 'Individual Fighter',
    fighterCardText: 'For fighters seeking personal sponsorship for training, travel, equipment, and competition.',
    fighterCardCta: 'APPLY AS A FIGHTER',
    academyCardTitle: 'Academy / Training Center',
    academyCardText:
      'For academies, gyms, and training centers seeking sponsorship for equipment, facilities, programming, and their fighters.',
    academyCardCta: 'APPLY AS AN ACADEMY',
    processEyebrow: 'The Process',
    processTitle: 'How Sponsorship **Works**',
    processSubtitle: 'A transparent, four-step journey from application to fighter support.',
    steps: [
      {
        title: 'Submit Application',
        text: 'Complete our online application with your personal, combat sport, and achievement details.',
      },
      {
        title: 'Application Review',
        text: 'Our review committee evaluates every application based on potential, dedication, and need.',
      },
      {
        title: 'Approval',
        text: 'Approved fighters receive a personalized sponsorship plan tailored to their goals.',
      },
      {
        title: 'Sponsorship Support',
        text: 'Funding is directed toward training, equipment, travel, and competition — with full transparency.',
      },
    ],
  },
  'seeking-sponsorship-eligibility': {
    eligibilityEyebrow: 'Eligibility',
    eligibilityTitle: 'Who Can **Apply**',
    eligibilitySubtitle:
      "We're looking for determined fighters ready to take the next step in their journey.",
    docsEyebrow: 'Required Documents',
    docsTitle: "What You'll **Need**",
    ctaTitle: 'Ready to Take the **Next Step?**',
    ctaText: 'Applications are reviewed on a rolling basis. Start yours today.',
    ctaFighterCta: 'APPLY AS A FIGHTER',
    ctaAcademyCta: 'APPLY AS AN ACADEMY',
    ctaAskCta: 'ASK A QUESTION',
    eligibility: [
      {
        title: 'Age 14–28',
        text: 'Open to young fighters across boxing, Muay Thai, kickboxing, wrestling, and more — whether you are already competing or aspiring to.',
      },
      {
        title: 'Competitive History',
        text: 'Demonstrated participation in at least one district-level or higher competition in your discipline.',
      },
      {
        title: 'Financial Need',
        text: 'Sponsorship is prioritized for fighters facing genuine financial barriers to competition.',
      },
      {
        title: 'Coach Recommendation',
        text: 'A recommendation or reference from a recognized coach, academy, or federation is required.',
      },
    ],
    requiredDocs: [
      { title: 'Fighter Photo', text: 'A recent headshot or action photo used for your public profile.' },
      { title: 'Proof of Identity', text: 'Government-issued ID, age proof, or birth certificate.' },
      { title: 'Achievement Certificates', text: 'Copies of competition certificates or ranking documents.' },
      { title: 'Coach Reference', text: 'A short letter or reference from your coach or academy.' },
      { title: 'Medical Fitness Certificate', text: 'A recent medical sign-off confirming you are fit to compete.' },
    ],
  },

  /* ---------------------------- CONTACT ---------------------------- */
  contact: {
    heroEyebrow: 'Contact',
    heroTitle: "Let's **Connect**",
    heroSubtitle: "Have a question, partnership idea, or want to get involved? We'd love to hear from you.",
    email: 'hello@usscos.org',
    phone: '+91 98765 43210',
    address: '42 Combat Square, Sector 12, New Delhi, India 110001',
    emailCardTitle: 'Email',
    phoneCardTitle: 'Phone',
    addressCardTitle: 'Address',
    formEyebrow: 'Send a Message',
    formTitle: "We'd Love to **Hear From You**",
    formText:
      'Reach out for sponsorship inquiries, partnerships, volunteering, or general questions. Our team responds within 1–2 business days.',
    nameLabel: 'Name',
    namePlaceholder: 'Your name',
    emailLabel: 'Email',
    emailPlaceholder: 'you@example.com',
    phoneLabel: 'Phone',
    phonePlaceholder: '000 000 0000',
    subjectLabel: 'Subject',
    subjectPlaceholder: 'How can we help?',
    messageLabel: 'Message',
    messagePlaceholder: 'Write your message...',
    consentText:
      'I consent to the USSCOS contacting me about this enquiry, and agree to the processing of my contact details for that purpose.',
    submitLabel: 'SEND MESSAGE',
    submittingLabel: 'SENDING...',
    successTitle: 'Message Sent!',
    successText: "We'll get back to you within 1–2 business days.",
    sendAnotherLabel: 'SEND ANOTHER MESSAGE',
  },

  /* ------------------------------ FAQ ------------------------------ */
  faq: {
    heroEyebrow: 'FAQ',
    heroTitle: 'Frequently Asked **Questions**',
    heroSubtitle: 'Answers to common questions about USSCOS, sponsorships, donations, and getting involved.',
    closingEyebrow: 'Still Have Questions?',
    closingTitle: "We're Here to **Help**",
    closingSubtitle:
      "Didn't find the answer you were looking for? Reach out and our team will be glad to assist.",
    closingCta: 'CONTACT US',
    faqs: [
      {
        category: 'General',
        q: 'What is USSCOS and what does it do?',
        a: 'USSCOS (Uganda Secondary Schools Sports Council) Trust empowers young fighters by providing sponsorship, training, equipment, travel support, and competition opportunities — helping them grow on and off the arena.',
      },
      {
        category: 'General',
        q: 'Who can benefit from USSCOS programs?',
        a: 'Talented secondary school fighters who show promise in their discipline and are in need of resources to pursue their goals. USSCOS focuses on combat sports — from boxing, Muay Thai, kickboxing, and wrestling to taekwondo and jiu-jitsu.',
      },
      {
        category: 'General',
        q: 'Are USSCOS programs free to join?',
        a: 'Yes. There are no fees for fighters seeking sponsorship. Our mission is to remove financial barriers so young talent can develop and compete.',
      },
      {
        category: 'Fighters & Sponsorship',
        q: 'How do I apply for sponsorship as a fighter?',
        a: 'Head to the Apply page and complete the multi-step application form. You will provide your background, sport details, achievements, and the required supporting documents.',
      },
      {
        category: 'Fighters & Sponsorship',
        q: 'What documents do I need to apply?',
        a: 'Typically a completed application form, proof of school enrolment, sporting achievements or selection letters, and any additional documents requested in the application steps.',
      },
      {
        category: 'Fighters & Sponsorship',
        q: 'How long does the sponsorship decision take?',
        a: 'Our team reviews applications as they are received. You will be notified of the outcome once your application has been reviewed and assessed.',
      },
      {
        category: 'Fighters & Sponsorship',
        q: 'How are sponsorship funds used?',
        a: 'Funds are directed to fighter development — training, equipment, travel, and competition entry — ensuring every contribution goes toward the fighter’s growth.',
      },
      {
        category: 'Fighters & Sponsorship',
        q: 'I made a mistake on my application. What should I do?',
        a: 'Contact us through the Contact page with your application details and we will help you update or correct your submission.',
      },
      {
        category: 'Donations & Giving',
        q: 'How can I donate?',
        a: 'You can donate through the Donate page by choosing a preset amount or entering a custom contribution, then providing your details.',
      },
      {
        category: 'Donations & Giving',
        q: 'Is my donation tax-deductible?',
        a: 'As a registered trust, donations may be eligible for tax relief depending on your local regulations. Please consult your tax advisor for confirmation.',
      },
      {
        category: 'Donations & Giving',
        q: 'Can I sponsor a specific fighter?',
        a: 'Yes. If you would like to sponsor a particular fighter, reach out via the Contact page and our team will connect you with the relevant profile.',
      },
      {
        category: 'Donations & Giving',
        q: 'How do I know my donation was received?',
        a: 'After a successful donation you will receive a confirmation with a reference ID for your records.',
      },
      {
        category: 'Partners & General Support',
        q: 'I am a company. How can I partner with USSCOS?',
        a: 'We welcome corporate partners, sponsors, and volunteers. Use the Contact page to start a conversation about partnership opportunities.',
      },
      {
        category: 'Partners & General Support',
        q: 'Can I volunteer or get involved?',
        a: 'Absolutely. From coaching to mentorship and event support, there are many ways to contribute. Get in touch through the Contact page.',
      },
      {
        category: 'Partners & General Support',
        q: 'How can I follow USSCOS news and updates?',
        a: 'Browse the News page for the latest stories, announcements, and impact updates from across our programs.',
      },
    ],
  },

  /* ----------------------------- LEGAL ----------------------------- */
  privacy: {
    heroEyebrow: 'Legal',
    heroTitle: 'Privacy **Policy**',
    heroSubtitle: 'How USSCOS collects, uses, and protects your personal information.',
    lastUpdatedEyebrow: 'Last Updated',
    lastUpdatedTitle: 'Stay **Informed**',
    lastUpdatedSubtitle: 'This policy is reviewed periodically. Check back for the latest version.',
    closingCta: 'CONTACT US',
    sections: [
      {
        heading: '1. Information We Collect',
        body: 'We may collect personal information you provide directly, such as your name, email address, phone number, and details submitted through application, contact, or donation forms. We also collect basic usage data to help us improve the website.',
      },
      {
        heading: '2. How We Use Your Information',
        body: 'Your information is used to process applications, respond to enquiries, manage sponsorships and donations, and keep you informed about USSCOS programs and updates. We do not sell your personal information to third parties.',
      },
      {
        heading: '3. Storage & Security',
        body: 'We take reasonable measures to protect your personal information from unauthorised access, alteration, disclosure, or destruction. However, no method of transmission over the internet is completely secure, and we cannot guarantee absolute security.',
      },
      {
        heading: '4. Sharing of Information',
        body: 'We only share personal information where necessary to operate our services, comply with legal obligations, or protect the rights and safety of USSCOS, our fighters, and the public.',
      },
      {
        heading: '5. Cookies & Analytics',
        body: 'This website may use cookies and similar technologies to improve functionality and understand site usage. You can control cookies through your browser settings, though disabling them may affect your experience.',
      },
      {
        heading: '6. Your Rights',
        body: 'Depending on applicable law, you may have the right to access, correct, update, or delete the personal information we hold about you. To exercise these rights, please contact us through the Contact page.',
      },
      {
        heading: '7. Third-Party Links',
        body: 'This website may contain links to external websites with their own privacy policies. We are not responsible for the privacy practices or content of those third-party sites.',
      },
      {
        heading: '8. Changes to This Policy',
        body: 'We may update this Privacy Policy from time to time. Any changes will be posted on this page, and continued use of the website constitutes acceptance of the updated policy.',
      },
      {
        heading: '9. Contact Us',
        body: 'If you have any questions about this Privacy Policy or how we handle your information, please reach out to us through the Contact page.',
      },
    ],
  },
  terms: {
    heroEyebrow: 'Legal',
    heroTitle: 'Terms & **Conditions**',
    heroSubtitle: 'The terms governing your use of the USSCOS website and its services.',
    lastUpdatedEyebrow: 'Last Updated',
    lastUpdatedTitle: 'Stay **Informed**',
    lastUpdatedSubtitle: 'These terms are reviewed periodically. Check back for the latest version.',
    closingCta: 'CONTACT US',
    sections: [
      {
        heading: '1. Acceptance of Terms',
        body: 'By accessing or using the USSCOS website, you agree to be bound by these Terms & Conditions and all applicable laws and regulations. If you do not agree with any part of these terms, you may not use this website.',
      },
      {
        heading: '2. Use of the Website',
        body: 'This website is provided for informational purposes about USSCOS programs, fighters, sponsorship, and donations. You agree to use the website only for lawful purposes and in a way that does not infringe the rights of, or restrict or inhibit the use of, the website by any third party.',
      },
      {
        heading: '3. Intellectual Property',
        body: 'All content on this website, including text, graphics, logos, imagery, and design, is the property of USSCOS or its licensors and is protected by applicable intellectual property laws. You may not reproduce, distribute, or create derivative works from any content without prior written permission.',
      },
      {
        heading: '4. Applications & Sponsorships',
        body: 'Submitting an application does not guarantee sponsorship. Decisions are made at the sole discretion of USSCOS based on eligibility and available resources. You must provide accurate and truthful information in any application or submission.',
      },
      {
        heading: '5. Donations',
        body: 'Donations are made voluntarily to support USSCOS programs. We aim to direct all contributions toward fighter development. Donation pledges submitted through the website are recorded with a reference ID; the actual transfer is coordinated by our team.',
      },
      {
        heading: '6. Limitation of Liability',
        body: 'USSCOS makes every effort to keep the information on this website accurate and up to date, but we make no representations or warranties of any kind, express or implied, about the completeness, accuracy, reliability, suitability, or availability of the website or the information it contains.',
      },
      {
        heading: '7. External Links',
        body: 'This website may contain links to external websites that are not operated by USSCOS. We have no control over the content and assume no responsibility for third-party sites or their practices.',
      },
      {
        heading: '8. Changes to These Terms',
        body: 'We may update these Terms & Conditions from time to time. Any changes will be posted on this page. Continued use of the website after changes are made constitutes acceptance of the revised terms.',
      },
      {
        heading: '9. Contact',
        body: 'If you have any questions about these Terms & Conditions, please reach out to us through the Contact page and our team will be happy to assist.',
      },
    ],
  },
  'refund-cancellation': {
    heroEyebrow: 'Policy',
    heroTitle: 'Refund & **Cancellation**',
    heroSubtitle: 'Our policy regarding refunds, cancellations, and donation-related adjustments.',
    lastUpdatedEyebrow: 'Need Help?',
    lastUpdatedTitle: 'Have **Questions**?',
    lastUpdatedSubtitle:
      'Contact our team for any questions about refunds, cancellations, or your donation.',
    closingCta: 'CONTACT US',
    sections: [
      {
        heading: '1. Donations',
        body: 'Donations made to USSCOS are voluntary contributions in support of fighter development programs. As a general rule, donations are non-refundable once processed.',
      },
      {
        heading: '2. When Refunds May Apply',
        body: 'In limited circumstances, such as a duplicate or erroneous transaction, we may review and process a refund. Requests must be raised promptly, with supporting details of the transaction.',
      },
      {
        heading: '3. How to Request a Refund',
        body: 'To request a refund, please contact us through the Contact page with the relevant transaction reference ID, the amount, the date, and a brief explanation. Our team will review your request and respond within a reasonable timeframe.',
      },
      {
        heading: '4. Sponsorship & Application Cancellation',
        body: 'Applications for sponsorship may be withdrawn at any time before a decision is made by contacting us. Once a sponsorship has been awarded, cancellation terms are assessed on a case-by-case basis.',
      },
      {
        heading: '5. Processing Time',
        body: 'Approved refunds are typically processed back to the original payment method within a reasonable number of business days, subject to the policies of the payment provider.',
      },
      {
        heading: '6. Contact',
        body: 'For any questions about refunds or cancellations, please reach out to us through the Contact page and our team will be happy to assist.',
      },
    ],
  },

  /* --------------------------- NOT FOUND --------------------------- */
  'not-found': {
    heroEyebrow: 'Error 404',
    heroTitle: 'Page Not **Found**',
    heroSubtitle: "The page you're looking for doesn't exist or has moved.",
    code: '404',
    message: "Looks like you've wandered off the track. Let's get you back to the podium.",
    primaryCta: 'GO HOME',
    secondaryCta: 'EXPLORE FIGHTERS',
  },
}
