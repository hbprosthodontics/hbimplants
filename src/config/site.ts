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
};

export const doctor = {
  name: 'Dr. Favian Cheong',
  firstName: 'Favian',
  lastName: 'Cheong',
  credentials: 'DDS, MS',
};

export const address = {
  street: '16141 Bolsa Chica St., Suite C',
  city: 'Huntington Beach',
  state: 'CA',
  zip: '92649',
  country: 'US',
  full: '16141 Bolsa Chica St., Suite C, Huntington Beach, CA 92649',
};

export const hours = {
  display: [
    { day: 'Mon', time: '9am – 5pm' },
    { day: 'Tue', time: 'By Appointment' },
    { day: 'Wed', time: '9am – 5pm' },
    { day: 'Thu', time: 'By Appointment' },
    { day: 'Fri', time: '9am – 5pm' },
    { day: 'Sat', time: '10am – 2pm' },
    { day: 'Sun', time: 'Closed' },
  ],
  schema: ['Mo 09:00-17:00', 'We 09:00-17:00', 'Fr 09:00-17:00', 'Sa 10:00-14:00'],
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
