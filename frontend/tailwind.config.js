/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ml: {
          yellow: '#FFE600',
          yellowDark: '#E6CF00',
          blue: '#2D3277',
          blueLight: '#3483FA',
          gray: '#333333',
          bg: '#F5F5F5',
        }
      }
    },
  },
  plugins: [],
}
