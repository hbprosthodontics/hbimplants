// Navigation link structure for Header.astro
// Edit this file to change the site's navigation menu.
// Structure: Treatments | About | Get Started (patient journey)

import { site } from './site';

export interface NavDropdownItem {
  label: string;
  href: string;
  desc?: string;
  dividerBefore?: boolean;
}

export interface NavLink {
  label: string;
  href: string;
  avatar?: string;
  dropdown?: NavDropdownItem[];
  external?: boolean;
}

export const navLinks: NavLink[] = [
  {
    label: 'Treatments',
    href: '/services',
    dropdown: [
      { label: 'All Services', href: '/services', desc: 'Complete list of treatments we offer' },
      { label: 'Dental Implants', href: '/dental-implants', desc: 'Replace missing teeth permanently', dividerBefore: true },
      { label: 'Single Tooth Implant', href: '/dental-implants/single-tooth', desc: 'Replace one missing tooth' },
      { label: 'All-on-4 Implants', href: '/all-on-x/all-on-4', desc: 'Full arch on just 4 implants' },
      { label: 'All-on-6 Implants', href: '/all-on-x/all-on-6', desc: 'Maximum stability for a full arch' },
      { label: 'Full Arch Implants', href: '/all-on-x/full-arch', desc: 'Replace an entire row of teeth' },
      { label: 'Bone Grafting', href: '/dental-implants/bone-grafting', desc: 'Build the foundation for implants' },
      { label: 'Smile Restoration', href: '/veneers', desc: 'Veneers, makeovers & cosmetic care', dividerBefore: true },
      { label: 'Porcelain Veneers', href: '/veneers/porcelain', desc: 'Transform shape, color & symmetry' },
      { label: 'Smile Makeover', href: '/veneers/smile-makeover', desc: 'Complete aesthetic transformation' },
      { label: 'Cosmetic Dentistry', href: '/cosmetic-dentistry', desc: 'Whitening, bonding & more' },
      { label: 'Clear Aligners', href: '/clear-aligners', desc: 'Straighten teeth discreetly' },
      { label: 'Crowns & Dentures', href: '/restorative-dentistry', desc: 'Restore function & appearance', dividerBefore: true },
      { label: 'Dentures', href: '/dentures', desc: 'Modern full & partial dentures' },
      { label: 'Snap-on Dentures', href: '/implant-restorations/snap-on', desc: 'Implant-secured, removable' },
      { label: 'Implant Crowns', href: '/implant-restorations/crowns', desc: 'Single tooth implant restoration' },
      { label: 'Implant Bridges', href: '/implant-restorations/bridges', desc: 'Fixed multi-tooth replacement' },
      { label: 'General Dentistry', href: '/general-dentistry', desc: 'Cleanings & routine care' },
    ],
  },
  {
    label: 'About',
    href: '/about',
    avatar: '/images/team/dr-favian-cheong.webp',
    dropdown: [
      { label: 'About Us', href: '/about', desc: 'Meet Dr. Cheong & our practice' },
      { label: 'Why a Prosthodontist', href: '/why-a-prosthodontist', desc: 'How specialist care is different' },
      { label: 'Before & After Gallery', href: '/gallery', desc: 'Real patient results' },
    ],
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
