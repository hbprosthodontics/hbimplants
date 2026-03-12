// Navigation link structure for Header.astro
// Edit this file to change the site's navigation menu.
// Order: About | Services | Get Started

import { site } from './site';
import { serviceCategories } from './services';

export interface NavDropdownItem {
  label: string;
  href: string;
  desc?: string;
  dividerBefore?: boolean;
}

export interface NavDropdownGroup {
  label: string;
  href: string;
  desc?: string;
  children: { label: string; href: string; desc?: string }[];
}

export interface NavLink {
  label: string;
  href: string;
  avatar?: string;
  dropdown?: NavDropdownItem[];
  dropdownGroups?: NavDropdownGroup[];
  external?: boolean;
}

// Services dropdown: All, 3 category groups (hover for sub-items), Gallery
const servicesGroups: NavDropdownGroup[] = [
  { label: 'All Services', href: '/services', desc: 'Complete list of treatments we offer', children: [] },
  ...serviceCategories.map((cat) => ({
    label: cat.heading,
    href: cat.href,
    desc: cat.desc,
    children: cat.services.map((s) => ({ label: s.name, href: s.href, desc: s.desc })),
  })),
  { label: 'Before & After Gallery', href: '/gallery', desc: 'Real patient results', children: [] },
];

export const navLinks: NavLink[] = [
  {
    label: 'About',
    href: '/about',
    avatar: '/images/team/dr-favian-cheong.webp',
    dropdown: [
      { label: 'About Us', href: '/about', desc: 'Meet Dr. Cheong & our practice' },
      { label: 'Why a Prosthodontist', href: '/why-a-prosthodontist', desc: 'How specialist care is different' },
    ],
  },
  {
    label: 'Services',
    href: '/services',
    dropdownGroups: servicesGroups,
  },
  {
    label: 'Get Started',
    href: site.bookingUrl,
    external: true,
    dropdown: [
      { label: 'Financing & Insurance', href: '/financing', desc: 'Payment plans, insurance & cost guides' },
      { label: 'Common Questions', href: '/faq', desc: 'Implants, insurance & getting started' },
      { label: 'Free Consultation', href: '/dental-implants/consultation', desc: 'No-cost exam & treatment plan' },
      { label: 'Patient Blog', href: '/blog', desc: 'Education & treatment guides' },
    ],
  },
];
