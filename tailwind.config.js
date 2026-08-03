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
      keyframes: {
        'tools-jump': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'tools-jump-shadow': {
          '0%, 100%': { transform: 'scale(1)', opacity: '0.35' },
          '50%': { transform: 'scale(0.55)', opacity: '0.15' },
        },
      },
      animation: {
        'tools-jump': 'tools-jump 1s ease-in-out infinite',
        'tools-jump-shadow': 'tools-jump-shadow 1s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
