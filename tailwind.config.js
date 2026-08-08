/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        harbor: {
          DEFAULT: '#12857B',
          light: '#3AA89C',
          dark: '#0B5F58',
        },
        brass: {
          DEFAULT: '#C79A3D',
          100: '#F6EAC7',
        },
        mist: {
          DEFAULT: '#F0EEE6',
          light: '#F8F6F1',
        },
        ink: {
          DEFAULT: '#16212B',
          light: '#22303D',
        },
      },
      backdropBlur: {
        xs: '2px',
      },
      boxShadow: {
        glass: '0 8px 32px 0 rgba(22, 33, 43, 0.25)',
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
        'glow-pulse': {
          '0%, 100%': { opacity: '0.55', backgroundPosition: '0% 50%' },
          '50%': { opacity: '1', backgroundPosition: '100% 50%' },
        },
      },
      animation: {
        'tools-jump': 'tools-jump 1s ease-in-out infinite',
        'tools-jump-shadow': 'tools-jump-shadow 1s ease-in-out infinite',
        'glow-pulse': 'glow-pulse 3s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
