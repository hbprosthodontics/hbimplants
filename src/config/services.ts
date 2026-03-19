// Service categories for homepage, services page, and nav consistency.
// Single source of truth for treatment structure.

export interface ServiceItem {
  name: string;
  href: string;
  desc?: string;
}

export interface ServiceCategory {
  heading: string;
  href: string;
  desc: string;
  services: ServiceItem[];
}

export const serviceCategories: ServiceCategory[] = [
  {
    heading: 'Dental Implants',
    href: '/dental-implants',
    desc: 'Replace missing teeth permanently.',
    services: [
      { name: 'Single Tooth Implant', href: '/dental-implants/single-tooth', desc: 'Replace one missing tooth permanently' },
      { name: 'All-on-4 Implants', href: '/all-on-x/all-on-4', desc: 'Full arch on just 4 implants' },
      { name: 'All-on-6 Implants', href: '/all-on-x/all-on-6', desc: 'Maximum stability for a full arch' },
      { name: 'Full Arch Implants', href: '/all-on-x/full-arch', desc: 'Replace an entire row of teeth' },
      { name: 'Full Mouth Reconstruction', href: '/all-on-x/full-mouth-reconstruction', desc: 'Complete rehabilitation of all teeth' },
      { name: 'Bone Grafting', href: '/dental-implants/bone-grafting', desc: 'Build the foundation for implants' },
      { name: 'Implant Placement', href: '/dental-implants/implant-placement', desc: 'Precision surgical placement' },
      { name: 'Consultation', href: '/dental-implants/consultation', desc: 'Exam & personalized treatment plan' },
    ],
  },
  {
    heading: 'Smile Restoration',
    href: '/veneers',
    desc: 'Transform the look of your smile.',
    services: [
      { name: 'Porcelain Veneers', href: '/veneers/porcelain', desc: 'Transform shape, color & symmetry' },
      { name: 'Smile Makeover', href: '/veneers/smile-makeover', desc: 'Complete aesthetic transformation' },
      { name: 'Cosmetic Dentistry', href: '/cosmetic-dentistry', desc: 'Whitening, bonding & more' },
      { name: 'Teeth Whitening', href: '/cosmetic-dentistry/whitening', desc: 'Professional-grade whitening' },
      { name: 'Composite Bonding', href: '/cosmetic-dentistry/bonding', desc: 'Repair chips, close gaps' },
      { name: 'Clear Aligners', href: '/clear-aligners', desc: 'Straighten teeth discreetly' },
    ],
  },
  {
    heading: 'Crowns & Dentures',
    href: '/restorative-dentistry',
    desc: 'Repair damaged teeth, replace missing ones.',
    services: [
      { name: 'Dental Crowns', href: '/restorative-dentistry/crowns', desc: 'Restore damaged or weakened teeth' },
      { name: 'Dental Bridges', href: '/restorative-dentistry/bridges', desc: 'Fixed prosthetic for missing teeth' },
      { name: 'Maryland Bridge', href: '/restorative-dentistry/bridges#maryland-bridge', desc: 'Conservative resin-bonded bridge, no tooth grinding' },
      { name: 'Full Dentures', href: '/dentures/full', desc: 'Complete removable replacement' },
      { name: 'Partial Dentures', href: '/dentures/partial', desc: 'Replace multiple missing teeth' },
      { name: 'Snap-on Dentures', href: '/implant-restorations/snap-on', desc: 'Implant-secured, removable' },
      { name: 'Implant Crowns', href: '/implant-restorations/crowns', desc: 'Single tooth implant restoration' },
      { name: 'Implant Bridges', href: '/implant-restorations/bridges', desc: 'Fixed multi-tooth replacement' },
      { name: 'General Dentistry', href: '/general-dentistry', desc: 'Cleanings & routine care' },
    ],
  },
];
