/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Muted lavender: primary actions and selected states
        primary: {
          DEFAULT: '#B8A1D9',
          50: '#faf7fd',
          100: '#f2edf9',
          200: '#e4dbf1',
          300: '#d0c2e8',
          400: '#c4b0e0',
          500: '#B8A1D9',
          600: '#9d86c4',
          700: '#7d64a6',
          800: '#65508a',
          900: '#4f3f6c',
        },
        // Soft blush: gentle accents and highlights
        accent: {
          DEFAULT: '#F4DCE5',
          50: '#fdf9fa',
          100: '#fbf1f5',
          200: '#f8e8ee',
          300: '#F4DCE5',
          400: '#e8c2d0',
          500: '#d6a3b6',
          600: '#b98297',
        },
        // Sage: wellness and positive states
        success: {
          DEFAULT: '#DCE8DC',
          50: '#f7faf7',
          100: '#eff6ef',
          200: '#DCE8DC',
          300: '#c5d9c6',
          400: '#a9c6ab',
          500: '#8aaa8e',
          600: '#6b8b6f',
          700: '#557158',
        },
        // Deep plum: text
        ink: {
          DEFAULT: '#49384F',
          muted: '#7d6e82',
          'muted-dark': '#b9abbd',
        },
        // Warm ivory and white surfaces
        bg: {
          DEFAULT: '#FFFAF7',
          dark: '#1d181d',
          card: '#ffffff',
          'card-dark': '#261f27',
        },
        secondary: {
          DEFAULT: '#F3EFF7',
          50: '#fbfafd',
          100: '#f6f3fa',
          200: '#eee9f5',
          300: '#e0d8ec',
          400: '#c9bddb',
          500: '#B8A1D9',
        },
        warning: {
          DEFAULT: '#d9b38c',
          50: '#fdf9f4',
          100: '#f8eee2',
          200: '#efdcc3',
          300: '#e2c49f',
          400: '#d9b38c',
          500: '#c09566',
          600: '#a77d4d',
        },
        error: {
          DEFAULT: '#c98a8f',
          50: '#fdf6f6',
          100: '#f7e7e8',
          200: '#efd2d4',
          300: '#e2b3b7',
          400: '#c98a8f',
          500: '#b56f76',
          600: '#9c5a61',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['Fraunces', 'Georgia', 'serif'],
      },
      borderRadius: {
        DEFAULT: '0.75rem',
        lg: '1rem',
        xl: '1.25rem',
        '2xl': '1.5rem',
      },
      boxShadow: {
        soft: '0 1px 2px rgba(73, 56, 79, 0.04), 0 4px 16px -4px rgba(73, 56, 79, 0.07)',
        lift: '0 12px 28px -10px rgba(73, 56, 79, 0.16)',
      },
    },
  },
  plugins: [],
};