import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, LevelFormat, BorderStyle, WidthType,
  ShadingType, PageNumber, Header, Footer, PageBreak
} from 'docx';
import fs from 'fs';
import path from 'path';

const OUTPUT = path.resolve('scripts/Dental-Practice-Website-Build-Intake.docx');

// Colors
const NAVY = '1B3A5C';
const TEAL = '4A8FA0';
const LIGHT_BG = 'EBF2FA';
const LIGHT_GRAY = 'F7F6F3';
const WHITE = 'FFFFFF';
const TEXT = '1A1A1A';
const MID_GRAY = '4A4A4A';

// Borders
const noBorder = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };
const cellBorder = { style: BorderStyle.SINGLE, size: 1, color: 'D0D0D0' };
const cellBorders = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 160 },
    children: [new TextRun({ text, bold: true, color: WHITE, size: 32, font: 'Arial' })],
    shading: { fill: NAVY, type: ShadingType.CLEAR },
    indent: { left: 360, right: 360 },
  });
}

function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 280, after: 120 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: TEAL } },
    children: [new TextRun({ text, bold: true, color: NAVY, size: 26, font: 'Arial' })],
  });
}

function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 200, after: 80 },
    children: [new TextRun({ text, bold: true, color: TEAL, size: 22, font: 'Arial' })],
  });
}

function body(text, { bold = false, italic = false, spacing = { before: 0, after: 120 } } = {}) {
  return new Paragraph({
    spacing,
    children: [new TextRun({ text, bold, italic, color: TEXT, size: 22, font: 'Arial' })],
  });
}

function tip(text) {
  return new Paragraph({
    spacing: { before: 80, after: 120 },
    shading: { fill: LIGHT_BG, type: ShadingType.CLEAR },
    indent: { left: 360, right: 360 },
    children: [
      new TextRun({ text: 'Tip: ', bold: true, color: NAVY, size: 20, font: 'Arial' }),
      new TextRun({ text, color: MID_GRAY, size: 20, font: 'Arial', italics: true }),
    ],
  });
}

function bullet(text, level = 0) {
  return new Paragraph({
    numbering: { reference: 'bullets', level },
    spacing: { before: 40, after: 40 },
    children: [new TextRun({ text, color: TEXT, size: 22, font: 'Arial' })],
  });
}

function pageBreak() {
  return new Paragraph({ children: [new PageBreak()] });
}

function spacer(size = 120) {
  return new Paragraph({ spacing: { before: 0, after: size }, children: [] });
}

function sectionLabel(text) {
  return new Paragraph({
    spacing: { before: 0, after: 80 },
    shading: { fill: LIGHT_GRAY, type: ShadingType.CLEAR },
    indent: { left: 180 },
    children: [new TextRun({ text, bold: true, color: NAVY, size: 20, font: 'Arial', allCaps: true })],
  });
}

function twoColRow(left, right) {
  return new TableRow({
    children: [
      new TableCell({
        borders: cellBorders,
        width: { size: 3600, type: WidthType.DXA },
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        children: [new Paragraph({ children: [new TextRun({ text: left, bold: true, color: NAVY, size: 20, font: 'Arial' })] })],
      }),
      new TableCell({
        borders: cellBorders,
        width: { size: 5760, type: WidthType.DXA },
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        children: [new Paragraph({ children: [new TextRun({ text: right, color: MID_GRAY, size: 20, font: 'Arial' })] })],
      }),
    ],
  });
}

function twoColTable(rows) {
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [3600, 5760],
    rows: rows.map(([l, r]) => twoColRow(l, r)),
  });
}

function timelineRow(week, task, detail) {
  return new TableRow({
    children: [
      new TableCell({
        borders: cellBorders,
        width: { size: 1440, type: WidthType.DXA },
        shading: { fill: NAVY, type: ShadingType.CLEAR },
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        children: [new Paragraph({ children: [new TextRun({ text: week, bold: true, color: WHITE, size: 20, font: 'Arial' })] })],
      }),
      new TableCell({
        borders: cellBorders,
        width: { size: 2400, type: WidthType.DXA },
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        children: [new Paragraph({ children: [new TextRun({ text: task, bold: true, color: NAVY, size: 20, font: 'Arial' })] })],
      }),
      new TableCell({
        borders: cellBorders,
        width: { size: 5520, type: WidthType.DXA },
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        children: [new Paragraph({ children: [new TextRun({ text: detail, color: MID_GRAY, size: 20, font: 'Arial' })] })],
      }),
    ],
  });
}

// ─── DOCUMENT ────────────────────────────────────────────────────────────────

const doc = new Document({
  numbering: {
    config: [
      {
        reference: 'bullets',
        levels: [
          {
            level: 0,
            format: LevelFormat.BULLET,
            text: '\u2022',
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 540, hanging: 360 } } },
          },
          {
            level: 1,
            format: LevelFormat.BULLET,
            text: '\u25E6',
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 900, hanging: 360 } } },
          },
        ],
      },
    ],
  },
  styles: {
    default: {
      document: { run: { font: 'Arial', size: 22, color: TEXT } },
    },
    paragraphStyles: [
      {
        id: 'Heading1',
        name: 'Heading 1',
        basedOn: 'Normal',
        next: 'Normal',
        quickFormat: true,
        run: { size: 32, bold: true, color: WHITE, font: 'Arial' },
        paragraph: { spacing: { before: 360, after: 160 }, outlineLevel: 0 },
      },
      {
        id: 'Heading2',
        name: 'Heading 2',
        basedOn: 'Normal',
        next: 'Normal',
        quickFormat: true,
        run: { size: 26, bold: true, color: NAVY, font: 'Arial' },
        paragraph: { spacing: { before: 280, after: 120 }, outlineLevel: 1 },
      },
      {
        id: 'Heading3',
        name: 'Heading 3',
        basedOn: 'Normal',
        next: 'Normal',
        quickFormat: true,
        run: { size: 22, bold: true, color: TEAL, font: 'Arial' },
        paragraph: { spacing: { before: 200, after: 80 }, outlineLevel: 2 },
      },
    ],
  },
  sections: [
    {
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 },
        },
      },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: 'Dental Practice Website Build — Agency Intake & Deliverables Guide', color: NAVY, size: 18, font: 'Arial', bold: true }),
                new TextRun({ text: '\t', size: 18 }),
                new TextRun({ children: ['Page ', PageNumber.CURRENT, ' of ', PageNumber.TOTAL_PAGES], color: MID_GRAY, size: 18, font: 'Arial' }),
              ],
              tabStops: [{ type: 'right', position: 8280 }],
              border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: TEAL } },
            }),
          ],
        }),
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              children: [new TextRun({
                text: 'This document is confidential and prepared for the exclusive use of the prospective client. All costs and timelines are estimates and subject to a formal proposal.',
                color: MID_GRAY, size: 16, font: 'Arial', italics: true,
              })],
              alignment: AlignmentType.CENTER,
              border: { top: { style: BorderStyle.SINGLE, size: 2, color: TEAL } },
            }),
          ],
        }),
      },
      children: [

        // ─── COVER ───────────────────────────────────────────────────────────

        new Paragraph({
          spacing: { before: 720, after: 240 },
          alignment: AlignmentType.CENTER,
          shading: { fill: NAVY, type: ShadingType.CLEAR },
          children: [new TextRun({ text: 'DENTAL PRACTICE WEBSITE BUILD', bold: true, color: WHITE, size: 44, font: 'Arial', allCaps: true })],
        }),
        new Paragraph({
          spacing: { before: 0, after: 120 },
          alignment: AlignmentType.CENTER,
          shading: { fill: NAVY, type: ShadingType.CLEAR },
          children: [new TextRun({ text: 'Agency Intake & Deliverables Guide', color: LIGHT_BG, size: 30, font: 'Arial' })],
        }),
        new Paragraph({
          spacing: { before: 0, after: 480 },
          alignment: AlignmentType.CENTER,
          shading: { fill: NAVY, type: ShadingType.CLEAR },
          children: [new TextRun({ text: 'A Complete Reference for Client Onboarding, Deliverables & Growth Services', color: LIGHT_BG, size: 22, font: 'Arial', italics: true })],
        }),
        spacer(240),
        body('This document is your complete guide to working with us. It covers:'),
        bullet('Everything we need from you to build your website (Section 1)'),
        bullet('Every deliverable included in the baseline engagement (Section 2)'),
        bullet('Optional growth services available after launch (Section 3)'),
        bullet('How we handle migration from an existing website (Section 4)'),
        bullet('Your total ongoing cost of ownership after handoff (Section 5)'),
        bullet('A realistic week-by-week launch timeline (Section 6)'),
        spacer(120),
        tip('Read Section 1 first. The completeness of your intake submission is the single biggest factor controlling your launch date.'),
        spacer(240),

        pageBreak(),

        // ─── SECTION 1 ────────────────────────────────────────────────────────

        h1('SECTION 1 — CLIENT INTAKE: Everything We Need From You'),
        spacer(80),
        body('This section outlines everything we\'ll need from you to build your website from scratch. The more complete your intake submission, the faster we can build and launch. Nothing here is optional \u2014 missing items will delay your launch date.'),
        spacer(120),

        // 1.1
        h2('1.1 \u2014 Practice Basics'),
        twoColTable([
          ['Practice legal name', 'As it appears on your license'],
          ['Preferred display name', 'e.g. \u201CHuntington Beach Prosthodontics\u201D'],
          ['Street address', 'Full address including suite number'],
          ['City, State, ZIP', ''],
          ['Primary phone number', 'Patient-facing main line'],
          ['Secondary / after-hours phone', 'If applicable'],
          ['Primary contact email', 'Patient-facing (for website display)'],
          ['Internal / admin email', 'Receives contact form submissions'],
          ['Website domain', 'Current domain, or desired new domain'],
          ['Google Maps / Place ID', 'We\u2019ll look this up if unknown'],
          ['Hours of operation', 'Every day of the week, including \u201CClosed\u201D or \u201CBy Appointment\u201D'],
          ['Holiday closure policy', 'If any'],
          ['Languages spoken', 'At the practice'],
        ]),
        spacer(160),

        // 1.2
        h2('1.2 \u2014 Doctor & Team'),
        h3('For each doctor / provider:'),
        bullet('Full name and credentials (DDS, DMD, MS, FAGD, etc.)'),
        bullet('Title / role (e.g. \u201CBoard-Certified Prosthodontist\u201D)'),
        bullet('Short bio \u2014 3\u20135 sentences minimum (education, specialty training, philosophy)'),
        bullet('Long bio for About page \u2014 2\u20134 paragraphs'),
        bullet('Dental school name + graduation year'),
        bullet('Specialty residency or post-doctoral training (institution, years, specialty)'),
        bullet('Board certifications and professional memberships (ACP, ADA, CDA, etc.)'),
        bullet('Awards, publications, or recognition (if any)'),
        bullet('Fun personal detail (hobbies, family, what they do outside the office) \u2014 humanizes the bio'),
        bullet('Headshot photo \u2014 high-res, professional preferred, minimum 800\u00D7800px'),
        bullet('Additional candid / in-office photos (optional but recommended)'),
        spacer(80),
        h3('For support staff (optional but adds warmth):'),
        bullet('Names, roles, and short 1\u20132 sentence bios'),
        bullet('Group team photo or individual headshots'),
        spacer(160),

        // 1.3
        h2('1.3 \u2014 Services & Treatments'),
        body('For each service offered, provide:'),
        twoColTable([
          ['Service name', 'As you want it displayed on the website'],
          ['Category', 'e.g. Implants, Cosmetic, Restorative, General'],
          ['Short description', '2\u20133 sentences in patient-friendly language'],
          ['Long description', '3\u20135 paragraphs: what it is, who it\u2019s for, what to expect, how long it lasts, cost range'],
          ['FAQs', '3\u20136 Q&A pairs specific to this service'],
          ['Before & after photos', 'Labeled, with documented patient consent'],
          ['Page preference', 'Dedicated page, or mention on a hub page'],
        ]),
        spacer(80),
        tip('If you don\u2019t have written descriptions ready, just list the service names and we\u2019ll draft copy for your review.'),
        spacer(160),

        // 1.4
        h2('1.4 \u2014 Photos & Visual Assets'),
        h3('Office & Environment'),
        bullet('Exterior photo of building / signage'),
        bullet('Reception / waiting room (2\u20133 photos)'),
        bullet('Treatment room(s) (1\u20132 photos each)'),
        bullet('Technology or equipment highlights (cone beam CT, digital scanner, etc.)'),
        bullet('Any photos that convey the feel and quality of your practice'),
        spacer(80),
        h3('Team'),
        bullet('Individual headshots for each provider (professional preferred)'),
        bullet('Candid in-action shots (optional but highly effective)'),
        bullet('Group team photo'),
        spacer(80),
        h3('Before & After Gallery'),
        bullet('Before and after photo pairs for each treatment category'),
        bullet('Label each pair: procedure type, approximate patient age range, patient consent obtained'),
        bullet('Minimum: 6\u20138 pairs. More is better.'),
        bullet('Format: JPEG or PNG, high resolution'),
        spacer(80),
        h3('Logos & Brand Assets'),
        bullet('Current logo file (vector .AI, .EPS, or .SVG preferred; PNG acceptable)'),
        bullet('Logo in both color and white/reversed versions (if available)'),
        bullet('Any brand guidelines document (fonts, colors, dos/don\u2019ts)'),
        bullet('If no logo exists, note this \u2014 logo design is available as an add-on'),
        spacer(160),

        // 1.5
        h2('1.5 \u2014 Brand & Design Preferences'),
        twoColTable([
          ['Inspiration websites', '3\u20135 competitor or admired websites with notes on what you like'],
          ['Color preferences', 'Hex codes if known, or describe: \u201Cclean and modern,\u201D \u201Cwarm and approachable,\u201D etc.'],
          ['Font preferences', 'If any'],
          ['Tone of voice', 'Formal / conversational / technical / friendly'],
          ['Design directions to avoid', 'Colors, styles, directions you dislike'],
          ['Photography style', 'Professional / polished vs. personal / humanized'],
        ]),
        spacer(160),

        // 1.6
        h2('1.6 \u2014 Online Presence & Accounts'),
        body('Please provide login credentials or manager/admin access for the following:'),
        spacer(80),
        h3('Google'),
        bullet('Google Business Profile \u2014 manager/owner access (add us at business.google.com)'),
        bullet('Google Analytics \u2014 if existing property, or we\u2019ll create one'),
        bullet('Google Search Console \u2014 if existing, or we\u2019ll create one'),
        bullet('Google Ads \u2014 if currently running, or for future use'),
        bullet('Google Places API key \u2014 optional, for pulling live reviews onto the site'),
        spacer(80),
        h3('Social & Directories'),
        bullet('Yelp Business listing \u2014 URL + owner login or co-admin access'),
        bullet('Facebook Business Page \u2014 URL + page admin access'),
        bullet('Instagram handle (if applicable)'),
        bullet('Healthgrades profile URL'),
        bullet('Zocdoc profile URL'),
        bullet('Vitals, RateMDs, or any other claimed directory profiles'),
        spacer(80),
        h3('Domain & Hosting (existing site)'),
        bullet('Domain registrar \u2014 GoDaddy, Namecheap, Cloudflare, etc. \u2014 login or transfer access'),
        bullet('Current web host \u2014 PatientPop, Dex Knows, WordPress, Wix, etc.'),
        bullet('Current hosting login \u2014 so we can export any content worth keeping'),
        bullet('Email hosting setup \u2014 we will not break this; just need to know the configuration'),
        bullet('SSL certificate status'),
        spacer(160),

        // 1.7
        h2('1.7 \u2014 Reviews & Testimonials'),
        twoColTable([
          ['Google reviews link', 'Direct URL to your Google Business Profile reviews'],
          ['Written testimonials', 'Text testimonials with patient first name + city'],
          ['Video testimonials', 'File or YouTube link (if any)'],
          ['Current review count', 'Number of Google reviews and current star rating'],
          ['Display on website?', 'Are you comfortable showing your live Google rating on the site?'],
        ]),
        spacer(160),

        // 1.8
        h2('1.8 \u2014 Desired Pages & Content'),
        bullet('Specific pages you want beyond the standard set'),
        bullet('Promotions, specials, or limited-time offers to feature (include expiration date)'),
        bullet('Events to announce (CE courses, open houses, free consultation days)'),
        bullet('Awards, press mentions, or \u201Cas seen in\u201D media to display'),
        bullet('Affiliations, associations, and insurance plans accepted (list of insurers)'),
        bullet('Patient forms \u2014 PDF or online forms to embed or link'),
        bullet('HIPAA notice / privacy policy language (or we\u2019ll provide a template)'),
        bullet('Referral program details (if any)'),
        bullet('Geographic service area \u2014 cities and neighborhoods to emphasize for local SEO'),
        spacer(80),
        new Paragraph({
          spacing: { before: 80, after: 80 },
          shading: { fill: LIGHT_BG, type: ShadingType.CLEAR },
          indent: { left: 360, right: 360 },
          children: [
            new TextRun({ text: 'Nice to Have \u2014 Patient Case Study Pages: ', bold: true, color: NAVY, size: 20, font: 'Arial' }),
            new TextRun({ text: 'For each high-value procedure (implants, All-on-4, smile makeover), do you have 1\u20132 patients whose complete transformation story you could share? A case study includes: patient profile (age range, presenting condition), treatment performed, timeline, before and after photos (with written consent), and a brief patient-perspective narrative. These dedicated case study pages significantly improve conversion on high-investment treatments and are highly effective SEO assets. If you have any willing patients and photo documentation, please share it \u2014 we\u2019ll build the pages around them. This is optional at launch but strongly recommended as an early post-launch addition.', color: MID_GRAY, size: 20, font: 'Arial', italics: true }),
          ],
        }),
        spacer(160),

        // 1.9
        h2('1.9 \u2014 Goals & Target Audience'),
        twoColTable([
          ['Ideal patient', 'Demographics, procedure type, insurance status'],
          ['Top 3 highest-value procedures', 'What you most want to rank for in search'],
          ['Geographic service area', 'Cities and neighborhoods you serve'],
          ['Competitive differentiators', 'Why should a patient choose you over a competitor?'],
          ['Procedures NOT to market', 'Any treatments you don\u2019t want highlighted'],
          ['Accepting new patients?', 'Yes always / Yes with restrictions / Referral only'],
          ['Future plans', 'Planned expansions, new associates, or services coming soon'],
        ]),
        spacer(160),

        // 1.10
        h2('1.10 \u2014 Technical Preferences'),
        twoColTable([
          ['Form destination email', 'Where contact form submissions should be delivered'],
          ['Appointment booking integration', 'Zocdoc, Dentrix, Open Dental, etc. \u2014 or none'],
          ['Live chat widget', 'Yes / No (we can recommend options)'],
          ['Multilingual support', 'Languages needed on the site'],
          ['ADA / WCAG accessibility', 'Any specific accessibility requirements'],
          ['HIPAA constraints', 'Any constraints on form data handling or storage'],
        ]),
        spacer(160),

        pageBreak(),

        // ─── SECTION 2 ────────────────────────────────────────────────────────

        h1('SECTION 2 \u2014 WHAT YOU RECEIVE: Baseline Deliverables'),
        spacer(80),
        body('Every engagement includes the following. You own everything. No vendor lock-in. No recurring agency fees unless you choose ongoing services.'),
        spacer(120),

        // 2.1
        h2('2.1 \u2014 Infrastructure & Accounts (You Own Everything)'),
        spacer(80),
        h3('GitHub Account'),
        bullet('A personal GitHub account in your name (github.com)'),
        bullet('Your website\u2019s full source code lives here \u2014 hand it to any developer in the future'),
        bullet('Cost: Free'),
        spacer(80),
        h3('Cloudflare Account + Pages Hosting'),
        bullet('A personal Cloudflare account in your name'),
        bullet('Your website is deployed on Cloudflare Pages \u2014 the fastest static hosting available globally'),
        bullet('Automatic HTTPS / SSL included'),
        bullet('Cost: Free (Cloudflare Pages free tier is more than sufficient for a dental practice)'),
        spacer(80),
        h3('Domain (if purchasing new)'),
        bullet('Registered in your name at your chosen registrar (we recommend Cloudflare Registrar for simplicity)'),
        bullet('Typical cost: $10\u2013$15/year for a .com domain'),
        spacer(80),
        h3('Claude Code / AI Development Access (for future changes)'),
        bullet('We configure Claude Code so you or any future developer can make AI-assisted site changes'),
        bullet('Significantly reduces the cost of future updates'),
        bullet('Cost: Claude Pro subscription \u2014 ~$20/month if you want to make changes yourself'),
        spacer(80),
        new Paragraph({
          spacing: { before: 80, after: 80 },
          shading: { fill: LIGHT_BG, type: ShadingType.CLEAR },
          indent: { left: 360, right: 360 },
          children: [
            new TextRun({ text: 'Total ongoing infrastructure cost: ~$10\u2013$15/year (domain only). Everything else is free.', bold: true, color: NAVY, size: 22, font: 'Arial' }),
          ],
        }),
        spacer(160),

        // 2.2
        h2('2.2 \u2014 Website'),
        body('Complete multi-page website built with Astro v5 (static, extremely fast):'),
        spacer(80),
        h3('Pages Included'),
        bullet('Homepage \u2014 hero, services overview, testimonials, stats, FAQs, and CTA'),
        bullet('About page \u2014 doctor bio, team, practice story, credentials'),
        bullet('Individual service pages \u2014 one per major treatment category + sub-pages per procedure'),
        bullet('Before & After gallery with filtering and lightbox'),
        bullet('Blog \u2014 markdown-based CMS for ongoing posts'),
        bullet('FAQ page'),
        bullet('Financing & insurance page'),
        bullet('Patient resources / why a specialist page'),
        bullet('Appointment request / contact form (via Formspree \u2014 free tier sufficient)'),
        bullet('Thank you / confirmation page'),
        bullet('Services directory page'),
        bullet('Referral page (optional)'),
        bullet('Sitemap (auto-generated, submitted to Google)'),
        spacer(80),
        h3('Performance & Technical Quality'),
        bullet('Google PageSpeed score 90+ (fast loading is an SEO ranking factor)'),
        bullet('Mobile-first responsive design'),
        bullet('Images auto-compressed and served in modern WebP / AVIF format'),
        bullet('Zero JavaScript by default \u2014 pure static HTML (fastest possible load times)'),
        bullet('Semantic HTML5 markup'),
        spacer(160),

        // 2.3
        h2('2.3 \u2014 SEO Optimization (Standard)'),
        h3('Every page includes:'),
        bullet('Unique, keyword-optimized title tag and meta description'),
        bullet('H1/H2/H3 heading hierarchy aligned to target keywords'),
        bullet('Local SEO signals: NAP (name, address, phone) consistent across all pages'),
        bullet('Internal linking structure between related service pages'),
        bullet('Canonical URLs on every page'),
        bullet('Open Graph and Twitter Card meta tags (for social sharing previews)'),
        bullet('XML sitemap auto-generated and submitted to Google Search Console'),
        bullet('Robots.txt configured'),
        bullet('301 redirect map (if migrating from an existing site)'),
        bullet('Google Analytics 4 property created and connected'),
        bullet('Google Search Console configured and verified'),
        spacer(80),
        h3('Schema Markup (JSON-LD structured data) on every page:'),
        bullet('LocalBusiness / Dentist schema \u2014 name, address, phone, hours, specialties'),
        bullet('BreadcrumbList \u2014 navigation hierarchy for Google'),
        bullet('FAQPage schema on FAQ sections'),
        bullet('MedicalProcedure schema on treatment pages'),
        bullet('BlogPosting schema on all blog posts'),
        bullet('AggregateRating schema \u2014 pulls live Google review data at build time'),
        spacer(160),

        // 2.4
        h2('2.4 \u2014 AI / LLM SEO Optimization'),
        body('Beyond traditional SEO, your site is optimized to appear in AI-generated answers (ChatGPT, Google AI Overviews, Perplexity, Claude):'),
        spacer(80),
        bullet('Authoritative, factually rich content written to be cited by AI models'),
        bullet('Structured FAQs written in the question-answer format AI models prefer to excerpt'),
        bullet('Entity optimization \u2014 your practice is clearly defined as a local dental entity with consistent attributes'),
        bullet('sameAs schema links connecting your site to Google, Yelp, Healthgrades, and Zocdoc profiles'),
        bullet('Citations and clinical references where appropriate (builds topical authority)'),
        bullet('Clear, unambiguous NAP + specialty signals (prosthodontist, not just \u201Cdentist\u201D)'),
        spacer(160),

        // 2.5
        h2('2.5 \u2014 Google Business Profile Optimization'),
        bullet('Verify all business information is complete and accurate'),
        bullet('Ensure categories are correctly set (Prosthodontist as primary, Dentist as secondary)'),
        bullet('Add all services to GBP'),
        bullet('Upload provided photos to GBP'),
        bullet('Configure Q&A section'),
        bullet('Set up GBP post automation scripts (included in your codebase \u2014 post to GBP from the command line)'),
        spacer(160),

        // 2.6
        h2('2.6 \u2014 Optional Add-On: Logo Design'),
        bullet('If no logo exists, we design a clean, professional logo'),
        bullet('Delivered in: SVG, PNG (transparent), PNG (white/reversed)'),
        bullet('Includes basic brand guide: primary color, secondary color, font pairing'),
        bullet('Cost: quoted separately'),
        spacer(160),

        // 2.7
        h2('2.7 \u2014 Favicon'),
        bullet('Automatically generated from your logo in all required sizes'),
        bullet('Configured for browser tab, iOS home screen, and Android home screen'),
        bullet('Included at no extra cost'),
        spacer(160),

        pageBreak(),

        // ─── SECTION 3 ────────────────────────────────────────────────────────

        h1('SECTION 3 \u2014 OPTIONAL GROWTH SERVICES'),
        spacer(80),
        body('These services are not included in the baseline but are available as ongoing or one-time engagements after launch.'),
        spacer(120),

        // 3.1
        h2('3.1 \u2014 Content Creation System \u2014 Video-to-Everything Pipeline'),
        body('How it works: We give you a monthly prompt. You record a 60\u201390 second video on your phone responding to it. We turn that single video into:'),
        spacer(80),
        bullet('A short-form video (TikTok / Instagram Reels / YouTube Shorts) with captions'),
        bullet('A full blog post (800\u20131,200 words) optimized for the target keyword'),
        bullet('A Google Business Profile post (linked to the blog post)'),
        bullet('A social media caption (for Facebook / Instagram)'),
        bullet('An email newsletter snippet (if applicable)'),
        spacer(80),
        h3('Example Prompts'),
        bullet('\u201CExplain in plain English: what\u2019s the difference between a prosthodontist and a general dentist?\u201D'),
        bullet('\u201CWalk me through what happens on the day someone gets a dental implant placed.\u201D'),
        bullet('\u201CWhat are the 3 biggest myths patients believe about All-on-4?\u201D'),
        bullet('\u201CWho is NOT a good candidate for veneers, and what do we recommend instead?\u201D'),
        spacer(80),
        tip('This is the most efficient content strategy available: one 60-second effort produces a month of search-optimized, shareable content across every platform.'),
        spacer(80),
        body('Pricing: Monthly retainer \u2014 quoted based on volume (typically 1\u20134 videos/month)'),
        spacer(160),

        // 3.2
        h2('3.2 \u2014 Proactive Digital Lead Generation (Backlink Building)'),
        body('What it is: Earning links from reputable websites back to yours \u2014 the single most powerful signal for Google rankings. Purely digital, no cold calling.'),
        spacer(80),
        h3('Tactics Included'),
        bullet('Dental and medical directory submissions (Healthgrades, Zocdoc, Vitals, WebMD, US News Health, etc.)'),
        bullet('Local business directory submissions (Chamber of Commerce, BBB, local city directories)'),
        bullet('Guest article pitching to dental / health publications'),
        bullet('HARO / journalist sourcing responses'),
        bullet('Local sponsorship and community organization link opportunities'),
        bullet('Unlinked mention outreach \u2014 find sites that mention your practice name but don\u2019t link'),
        bullet('Competitor backlink gap analysis \u2014 target the same sources competitors are getting links from'),
        spacer(80),
        body('Pricing: Monthly retainer or one-time audit + submission package (quoted separately)'),
        spacer(160),

        // 3.3
        h2('3.3 \u2014 Site Maintenance & Management'),
        h3('What\u2019s Included'),
        bullet('Monthly health check: broken links, 404 errors, page speed regressions'),
        bullet('Dependency updates (Astro, Tailwind, npm packages)'),
        bullet('Content updates as you provide them (new team member, updated hours, new promo)'),
        bullet('Annual SEO audit: keyword ranking review, schema validation, Core Web Vitals check'),
        bullet('Google Business Profile management: weekly posts, review monitoring, Q&A responses'),
        bullet('Uptime monitoring'),
        bullet('Google Search Console: ensure no manual actions or crawl errors'),
        bullet('Annual review of page title tags and meta descriptions vs. ranking performance'),
        spacer(80),
        body('Pricing: Monthly retainer (quoted based on scope)'),
        spacer(160),

        // 3.4
        h2('3.4 \u2014 Ongoing Blog Content'),
        h3('What\u2019s Included'),
        bullet('Monthly keyword research to identify the highest-opportunity topics'),
        bullet('1\u20134 new blog posts per month, each 800\u20131,500 words'),
        bullet('Every post: keyword-optimized title, meta description, H2 structure, internal links, FAQPage schema'),
        bullet('Content covers: patient education, treatment comparisons, cost guides, local intent, procedure walkthroughs'),
        bullet('Each post submitted to Google Search Console for indexing'),
        spacer(80),
        tip('Blog posts compound over time. A post written today can generate organic leads 3 years from now at zero additional cost.'),
        spacer(80),
        body('Pricing: Per-post rate or monthly package (quoted separately)'),
        spacer(160),

        // 3.5
        h2('3.5 \u2014 Email Newsletter Setup & Management'),
        bullet('Mailchimp or Klaviyo account setup'),
        bullet('Patient welcome sequence (3-email series for new patients)'),
        bullet('Monthly newsletter template (practice news, new blog post, seasonal promo)'),
        bullet('List management and growth strategy'),
        spacer(80),
        body('Pricing: One-time setup + optional monthly management retainer'),
        spacer(160),

        pageBreak(),

        // ─── SECTION 4 ────────────────────────────────────────────────────────

        h1('SECTION 4 \u2014 MIGRATION FROM EXISTING WEBSITE'),
        spacer(80),
        body('If you currently have a website (PatientPop, Dex Knows, WordPress, Squarespace, Wix, etc.), the following is included in your engagement:'),
        spacer(120),

        h2('4.1 \u2014 What We Handle'),
        bullet('Full content export and review \u2014 we identify what\u2019s worth keeping'),
        bullet('URL mapping \u2014 every old URL redirects to the correct new URL so you don\u2019t lose SEO value'),
        bullet('Domain transfer or DNS cutover \u2014 zero downtime migration'),
        bullet('Google Analytics migration \u2014 preserve historical data'),
        bullet('Google Search Console re-verification'),
        bullet('Removal from old hosting after safe cutover window'),
        spacer(160),

        h2('4.2 \u2014 What You Need to Provide'),
        twoColTable([
          ['Current hosting / CMS login', 'So we can export existing content'],
          ['Domain registrar login', 'So we can manage the DNS cutover'],
          ['Vendor contract status', 'Confirm any exit terms or active contracts with current vendor'],
          ['Content to preserve', 'Blog posts, bios, service descriptions you want carried over'],
        ]),
        spacer(160),

        new Paragraph({
          spacing: { before: 80, after: 80 },
          shading: { fill: LIGHT_BG, type: ShadingType.CLEAR },
          indent: { left: 360, right: 360 },
          children: [
            new TextRun({ text: 'Timeline: Most migrations complete within 2\u20134 weeks of receiving all credentials.', bold: true, color: NAVY, size: 22, font: 'Arial' }),
          ],
        }),
        spacer(160),

        pageBreak(),

        // ─── SECTION 5 ────────────────────────────────────────────────────────

        h1('SECTION 5 \u2014 TOTAL COST OF OWNERSHIP'),
        spacer(80),
        body('One-time build cost: Quoted based on scope (number of service pages, complexity of design, migration needs).'),
        spacer(80),
        body('Ongoing costs after handoff \u2014 you manage these yourself:', { bold: true }),
        spacer(80),

        new Table({
          width: { size: 9360, type: WidthType.DXA },
          columnWidths: [4680, 2340, 2340],
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  borders: cellBorders,
                  width: { size: 4680, type: WidthType.DXA },
                  shading: { fill: NAVY, type: ShadingType.CLEAR },
                  margins: { top: 80, bottom: 80, left: 120, right: 120 },
                  children: [new Paragraph({ children: [new TextRun({ text: 'Service', bold: true, color: WHITE, size: 20, font: 'Arial' })] })],
                }),
                new TableCell({
                  borders: cellBorders,
                  width: { size: 2340, type: WidthType.DXA },
                  shading: { fill: NAVY, type: ShadingType.CLEAR },
                  margins: { top: 80, bottom: 80, left: 120, right: 120 },
                  children: [new Paragraph({ children: [new TextRun({ text: 'Cost', bold: true, color: WHITE, size: 20, font: 'Arial' })] })],
                }),
                new TableCell({
                  borders: cellBorders,
                  width: { size: 2340, type: WidthType.DXA },
                  shading: { fill: NAVY, type: ShadingType.CLEAR },
                  margins: { top: 80, bottom: 80, left: 120, right: 120 },
                  children: [new Paragraph({ children: [new TextRun({ text: 'Notes', bold: true, color: WHITE, size: 20, font: 'Arial' })] })],
                }),
              ],
            }),
            ...[
              ['Domain renewal', '~$12\u2013$15/year', 'You own the domain outright'],
              ['Cloudflare Pages hosting', 'Free', 'Free tier more than sufficient'],
              ['GitHub', 'Free', 'Free for public and private repos'],
              ['Formspree (contact forms)', 'Free / $10/month', 'Free up to 50 submissions/month'],
              ['Google Analytics', 'Free', ''],
              ['Claude Pro (AI-assisted edits)', '~$20/month', 'Cancel anytime; only if making changes yourself'],
            ].map(([svc, cost, note]) => new TableRow({
              children: [
                new TableCell({
                  borders: cellBorders,
                  width: { size: 4680, type: WidthType.DXA },
                  margins: { top: 80, bottom: 80, left: 120, right: 120 },
                  children: [new Paragraph({ children: [new TextRun({ text: svc, color: TEXT, size: 20, font: 'Arial' })] })],
                }),
                new TableCell({
                  borders: cellBorders,
                  width: { size: 2340, type: WidthType.DXA },
                  margins: { top: 80, bottom: 80, left: 120, right: 120 },
                  children: [new Paragraph({ children: [new TextRun({ text: cost, bold: true, color: TEAL, size: 20, font: 'Arial' })] })],
                }),
                new TableCell({
                  borders: cellBorders,
                  width: { size: 2340, type: WidthType.DXA },
                  margins: { top: 80, bottom: 80, left: 120, right: 120 },
                  children: [new Paragraph({ children: [new TextRun({ text: note, color: MID_GRAY, size: 18, font: 'Arial', italics: true })] })],
                }),
              ],
            })),
            new TableRow({
              children: [
                new TableCell({
                  borders: cellBorders,
                  width: { size: 4680, type: WidthType.DXA },
                  shading: { fill: LIGHT_GRAY, type: ShadingType.CLEAR },
                  margins: { top: 80, bottom: 80, left: 120, right: 120 },
                  children: [new Paragraph({ children: [new TextRun({ text: 'TOTAL MINIMUM ONGOING COST', bold: true, color: NAVY, size: 20, font: 'Arial' })] })],
                }),
                new TableCell({
                  borders: cellBorders,
                  width: { size: 2340, type: WidthType.DXA },
                  shading: { fill: LIGHT_GRAY, type: ShadingType.CLEAR },
                  margins: { top: 80, bottom: 80, left: 120, right: 120 },
                  children: [new Paragraph({ children: [new TextRun({ text: '~$12\u2013$15/year', bold: true, color: NAVY, size: 20, font: 'Arial' })] })],
                }),
                new TableCell({
                  borders: cellBorders,
                  width: { size: 2340, type: WidthType.DXA },
                  shading: { fill: LIGHT_GRAY, type: ShadingType.CLEAR },
                  margins: { top: 80, bottom: 80, left: 120, right: 120 },
                  children: [new Paragraph({ children: [new TextRun({ text: 'Domain only', color: MID_GRAY, size: 18, font: 'Arial', italics: true })] })],
                }),
              ],
            }),
          ],
        }),
        spacer(160),
        body('You own your GitHub repository, your Cloudflare account, your domain, and your Google accounts. If you ever want to switch developers or agencies, everything transfers instantly.'),
        spacer(160),

        pageBreak(),

        // ─── SECTION 6 ────────────────────────────────────────────────────────

        h1('SECTION 6 \u2014 LAUNCH TIMELINE'),
        spacer(80),
        body('Typical timeline from signed agreement to live site (assuming complete intake submission):'),
        spacer(120),

        new Table({
          width: { size: 9360, type: WidthType.DXA },
          columnWidths: [1440, 2400, 5520],
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  borders: cellBorders,
                  width: { size: 1440, type: WidthType.DXA },
                  shading: { fill: NAVY, type: ShadingType.CLEAR },
                  margins: { top: 80, bottom: 80, left: 120, right: 120 },
                  children: [new Paragraph({ children: [new TextRun({ text: 'Period', bold: true, color: WHITE, size: 20, font: 'Arial' })] })],
                }),
                new TableCell({
                  borders: cellBorders,
                  width: { size: 2400, type: WidthType.DXA },
                  shading: { fill: NAVY, type: ShadingType.CLEAR },
                  margins: { top: 80, bottom: 80, left: 120, right: 120 },
                  children: [new Paragraph({ children: [new TextRun({ text: 'Phase', bold: true, color: WHITE, size: 20, font: 'Arial' })] })],
                }),
                new TableCell({
                  borders: cellBorders,
                  width: { size: 5520, type: WidthType.DXA },
                  shading: { fill: NAVY, type: ShadingType.CLEAR },
                  margins: { top: 80, bottom: 80, left: 120, right: 120 },
                  children: [new Paragraph({ children: [new TextRun({ text: 'What Happens', bold: true, color: WHITE, size: 20, font: 'Arial' })] })],
                }),
              ],
            }),
            timelineRow('Week 1', 'Intake & Kickoff', 'You submit intake packet; we confirm receipt and clarify any questions'),
            timelineRow('Weeks 2\u20133', 'Content & Architecture', 'Content architecture and copywriting using your intake materials'),
            timelineRow('Weeks 3\u20134', 'Design & Development', 'Full site design and development'),
            timelineRow('Weeks 4\u20135', 'Review Round', 'You provide feedback; we revise'),
            timelineRow('Weeks 5\u20136', 'SEO & Performance', 'SEO configuration, schema setup, performance testing'),
            timelineRow('Weeks 6\u20137', 'Staging Review', 'Full site preview before go-live; final approvals'),
            timelineRow('Weeks 7\u20138', 'Launch', 'DNS cutover, Search Console submission, GBP update'),
          ],
        }),
        spacer(160),

        new Paragraph({
          spacing: { before: 80, after: 80 },
          shading: { fill: LIGHT_BG, type: ShadingType.CLEAR },
          indent: { left: 360, right: 360 },
          children: [
            new TextRun({ text: 'Total: 6\u20138 weeks from complete intake submission to live site. ', bold: true, color: NAVY, size: 22, font: 'Arial' }),
            new TextRun({ text: 'Incomplete intake = longer timeline.', color: MID_GRAY, size: 22, font: 'Arial', italics: true }),
          ],
        }),
        spacer(240),

      ],
    },
  ],
});

Packer.toBuffer(doc).then((buffer) => {
  fs.writeFileSync(OUTPUT, buffer);
  console.log('Created:', OUTPUT);
});
