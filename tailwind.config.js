/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  darkMode: 'class',
  theme: {
    extend: {
      spacing: {
        '1': '4px', '2': '8px', '3': '12px', '4': '16px',
        '6': '24px', '8': '32px', '12': '48px',
      },
      colors: {
        unios: {
          'primary-light': '#0F172A',
          'primary-dark': '#F8FAFC',
          'secondary-dark': 'rgba(248, 250, 252, 0.60)',
          'tertiary-dark': 'rgba(248, 250, 252, 0.15)',
          'bg-dark': '#090D16',
          'card-dark': '#131B2E',
        },
        attendance: {
          safe: '#059669',     // Emerald (>= 80%)
          amber: '#D97706',    // Amber (75-79%)
          recovery: '#4F46E5', // Muted Indigo (< 75%)
          exempt: '#0284C7',   // Sky (Duty Leave)
        },
      },
    },
  },
};
