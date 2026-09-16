/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        beeline: {
          yellow: '#FFCC00',
          dark: '#1C1C1E',
          gray: '#2C2C2E',
          accent: '#FFD700'
        }
      }
    },
  },
  plugins: [],
}
