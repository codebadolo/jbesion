/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Open Sans', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        brand: {
          deep:  '#162C54',   // Arrière-plans sombres, sidebar
          night: '#1A4278',   // Titres, structure
          mid:   '#3475BB',   // Corps de texte, pictos
          light: '#37B6E9',   // Boutons, surlignages, icônes
        },
      },
    },
  },
  plugins: [],
}
