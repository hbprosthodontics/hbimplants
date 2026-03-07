/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        brand: {
          navy: '#1B3A5C',
          blue: '#2E6DA4',
          light: '#EBF2FA',
          gold: '#C9A84C',
        },
        neutral: {
          dark: '#1A1A1A',
          mid: '#4A4A4A',
          light: '#F8F9FA',
          border: '#E0E0E0',
        },
        surface: {
          1: '#FFFFFF',
          2: '#F7F6F3',
        },
        charcoal: '#111111',
        'mid-gray': '#666666',
        'border-light': '#E5E4E0',
      },
      fontFamily: {
        serif: ['Playfair Display', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
};
