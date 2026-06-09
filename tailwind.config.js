/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        night: '#07111f',
        charcoal: '#101820',
        gold: '#d9a441',
        amberSoft: '#f6c76b'
      },
      boxShadow: {
        luxury: '0 24px 70px rgba(0, 0, 0, 0.35)'
      }
    }
  },
  plugins: []
};
