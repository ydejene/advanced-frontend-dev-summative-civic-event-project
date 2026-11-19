/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './*.html',
    './pages/**/*.html',
    './js/**/*.js',
  ],
  theme: {
    extend: {
      colors: {
        'deep-teal':  '#163B3A',
        'teal':       '#247A70',
        'soft-mint':  '#D9EAE4',
        'off-white':  '#F5F7F5',
        'warm-amber': '#E6A756',
      },
      fontFamily: {
        heading: ['Manrope', 'system-ui', 'sans-serif'],
        body:    ['Inter', 'system-ui', 'sans-serif'],
      },
      maxWidth: {
        content: '1200px',
      },
    },
  },
  plugins: [],
};

