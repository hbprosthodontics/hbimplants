# Footer vs Sitemap Audit

## Category Mapping (Confirmed)

| Category | Hub URL | Notes |
|----------|---------|-------|
| **Smile Restoration** | `/veneers` | Veneers is the hub; category also includes cosmetic, whitening, bonding, aligners |
| **Crowns & Dentures** | `/restorative-dentistry` | Restorative dentistry is the hub; category also includes dentures, implant restorations |

---

## Footer Structure (Current)

**Column 1:** NAP (address, phone, email, hours, Google Review)

**Column 2:** Dental Implants + Smile Restoration
- Dental Implants: hub, single-tooth, all-on-4, all-on-6, full-arch, bone-grafting (6 links)
- Smile Restoration: porcelain, smile-makeover, cosmetic-dentistry, clear-aligners (4 links, no hub)

**Column 3:** Crowns & Dentures + About & Resources
- Crowns & Dentures: dentures, snap-on, implant crowns, implant bridges, general (5 links, no hub)
- About & Resources: services, about, blog, gallery, faq, consultation (6 links)

**Column 4:** Quick Links
- Book Appointment, Call, Free Consultation, FAQ, Gallery, About (6 links)

---

## Inconsistencies

### 1. Footer doesn't use `serviceCategories` config
Footer links are hardcoded. Nav and services page use the config. Adding/removing services requires updating 3 places.

### 2. Missing hub links
- **Smile Restoration:** No link to `/veneers` (hub)
- **Crowns & Dentures:** No link to `/restorative-dentistry` (hub). Has `/dentures` but that's a sub-hub.

### 3. Missing services (vs config)
| Category | In footer | Missing |
|----------|-----------|---------|
| Dental Implants | 6 | Full Mouth Reconstruction, Implant Placement, Free Consultation |
| Smile Restoration | 4 | Veneers hub, Teeth Whitening, Composite Bonding |
| Crowns & Dentures | 5 | Restorative hub, Dental Crowns, Dental Bridges, Full Dentures, Partial Dentures |

### 4. Duplicate links
- **Free Consultation** — in About & Resources and Quick Links
- **Gallery** — in About & Resources and Quick Links
- **About** — "About Us" and "About Our Practice" (same page)

### 5. Missing from footer entirely
- Why a Prosthodontist (`/why-a-prosthodontist`)
- Financing (`/financing`)
- Schedule (`/schedule`) — Book Appointment goes to Dentrix; schedule is the request form
- Locations — 7 location pages exist but no footer link

### 6. Column order / naming
- Column 2 comment says "Treatments" but contains service categories
- Column 3 mixes "Crowns & Dentures" (services) with "About & Resources" (non-services)

---

## Recommendations

1. **Use `serviceCategories` in Footer** — Single source of truth; footer stays in sync with nav/services.
2. **Add hub links** — "Dental Implants" (hub), "Veneers" or "Smile Restoration" (hub), "Restorative Dentistry" (hub) at top of each category.
3. **Remove duplicates** — Keep Free Consultation, Gallery, About in one place only.
4. **Add About & Resources** — Why a Prosthodontist, Financing. Consider Schedule if you want both booking options.
5. **Simplify Quick Links** — Book Appointment, Call, FAQ. Remove duplicates from About & Resources.
6. **Locations** — Add "Locations" or "Serving Areas" linking to a locations index if you create one, or omit.
