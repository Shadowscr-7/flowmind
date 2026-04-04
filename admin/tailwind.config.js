/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0efff',
          100: '#dddcff',
          200: '#bbb8ff',
          300: '#9994ff',
          400: '#8078ff',
          500: '#6C63FF',
          600: '#5a4ff0',
          700: '#4a3fdb',
          800: '#3a31b0',
          900: '#302a8c',
        },
        accent: {
          50: '#e0f8f3',
          100: '#b3ede1',
          200: '#80e1cd',
          300: '#4dd5b9',
          400: '#26cbaa',
          500: '#00BFA6',
          600: '#00a891',
          700: '#00917c',
          800: '#007a67',
          900: '#005645',
        },
      },
    },
  },
  plugins: [],
};
