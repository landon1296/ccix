/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        accent: '#ff6b2b',
        'accent-dark': '#e05520',
        bg: '#0f0f0f',
        surface: '#1a1a1a',
        'surface-2': '#252525',
        border: '#2d2d2d',
      },
    },
  },
  plugins: [],
};
