/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        terracotta: {
          DEFAULT: '#C85A32',
          light: '#E07850',
          dark: '#A8461F',
        },
        amber: {
          DEFAULT: '#D97706',
        },
        sand: {
          DEFAULT: '#F5E6D3',
          light: '#FBF3E8',
        },
        espresso: {
          DEFAULT: '#1F1610',
          light: '#2E2117',
        },
      },
      backdropBlur: {
        xs: '2px',
      },
      boxShadow: {
        glass: '0 8px 32px 0 rgba(31, 22, 16, 0.25)',
      },
      fontFamily: {
        display: ['"Poppins"', 'system-ui', 'sans-serif'],
        body: ['"Inter"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
