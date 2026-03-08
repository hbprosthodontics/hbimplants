import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  site: 'https://hbimplants.com',
  integrations: [
    sitemap({
      filter: (page) => !page.includes('/thank-you') && !page.includes('/referral'),
      serialize(item) {
        // Homepage: highest priority
        if (item.url === 'https://hbimplants.com/') {
          return { ...item, priority: 1.0, changefreq: 'weekly' };
        }
        // Main service hubs and key conversion pages
        const highPriority = ['/dental-implants/', '/all-on-x/', '/veneers/', '/schedule', '/about'];
        if (highPriority.some(p => item.url.endsWith(p) || item.url.endsWith(p + '/'))) {
          return { ...item, priority: 0.9, changefreq: 'weekly' };
        }
        // Blog index
        if (item.url.includes('/blog/') && !item.url.replace('https://hbimplants.com/blog/', '').includes('/')) {
          return { ...item, priority: 0.7, changefreq: 'weekly' };
        }
        // Blog posts
        if (item.url.includes('/blog/')) {
          return { ...item, priority: 0.6, changefreq: 'monthly' };
        }
        // All other treatment sub-pages
        return { ...item, priority: 0.8, changefreq: 'monthly' };
      },
    }),
    tailwind(),
  ],
});
