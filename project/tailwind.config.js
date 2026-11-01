/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brigade: {
          50: '#f0f5ff',
          100: '#dbe7ff',
          200: '#b8d0ff',
          300: '#8aaeff',
          400: '#5b86ff',
          500: '#3360ff',
          600: '#1d40f5',
          700: '#1a30e1',
          800: '#1c2cb8',
          900: '#1e2c93',
          950: '#161b54',
        },
      },
    },
  },
  plugins: [],
};
