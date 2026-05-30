// Central source of truth for practice information.
// Import from here instead of hardcoding values in components or pages.

export const site = {
  name: 'Huntington Beach Prosthodontics',
  url: 'https://hbimplants.com',
  phone: '(714) 846-1386',
  phoneDigits: '7148461386',
  email: 'hbprosth@gmail.com',
  googleReviewLink: 'https://g.page/r/CU4itT3RNhmQEBM/review',
  googleProfileLink: 'https://g.page/r/CU4itT3RNhmQEBM',
  /** Direct online booking (Dentrix Ascend) — use for "Book Appointment" CTAs */
  bookingUrl: 'https://bookit.dentrixascend.com/soe/new/dental?pid=ASC14000000000144&mode=externalLink',
};

export const doctor = {
  name: 'Dr. Favian Cheong',
  firstName: 'Favian',
  lastName: 'Cheong',
  credentials: 'DDS, MS',
};

export const address = {
  street: '16141 Bolsa Chica St # C',
  city: 'Huntington Beach',
  state: 'CA',
  zip: '92649',
  country: 'US',
  full: '16141 Bolsa Chica St # C, Huntington Beach, CA 92649',
  mapsQuery: '16141+Bolsa+Chica+St+%23+C,+Huntington+Beach,+CA+92649',
  mapsUrl: 'https://maps.google.com/?q=16141+Bolsa+Chica+St+%23+C+Huntington+Beach+CA+92649',
  mapsEmbedUrl: 'https://maps.google.com/maps?q=16141+Bolsa+Chica+St+%23+C,+Huntington+Beach,+CA+92649&output=embed',
};

export const hours = {
  display: [
    { day: 'Mon', time: '9am – 5pm' },
    { day: 'Tue', time: 'Closed' },
    { day: 'Wed', time: '9am – 5pm' },
    { day: 'Thu', time: '9am – 5pm' },
    { day: 'Fri', time: '9am – 5pm' },
    { day: 'Sat', time: 'By Appointment' },
    { day: 'Sun', time: 'Closed' },
  ],
  schema: ['Mo 09:00-17:00', 'We 09:00-17:00', 'Th 09:00-17:00', 'Fr 09:00-17:00'],
};

// Base LocalBusiness schema — used on every page.
// For pages that need to add aggregateRating or sameAs, spread this object:
//   { ...localBusinessSchema, aggregateRating: { ... } }
export const localBusinessSchema = {
  '@context': 'https://schema.org',
  '@type': 'Dentist',
  'name': site.name,
  'url': site.url,
  'telephone': site.phone,
  'address': {
    '@type': 'PostalAddress',
    'streetAddress': address.street,
    'addressLocality': address.city,
    'addressRegion': address.state,
    'postalCode': address.zip,
    'addressCountry': address.country,
  },
  'openingHours': hours.schema,
  'priceRange': '$$$$',
  'medicalSpecialty': 'Prosthodontics',
  'sameAs': [
    site.googleProfileLink,
    'https://www.yelp.com/biz/huntington-beach-prosthodontics',
    'https://www.healthgrades.com/dentists/huntington-beach-prosthodontics',
    'https://www.zocdoc.com/practice/huntington-beach-prosthodontics',
  ],
};
