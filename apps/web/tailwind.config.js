/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        credav: {
          bg: '#03050d',
          surface: '#0a0f22',
          card: '#0c132c',
          border: '#162044',
          cyan: '#00d8ff',
          blue: '#0a64ff',
          violet: '#8a3dff',
          magenta: '#c04bff',
          muted: '#7e8fa6',
        },
      },
      boxShadow: {
        glow: '0 0 25px -5px rgba(0, 216, 255, 0.25)',
        'glow-violet': '0 0 25px -5px rgba(138, 61, 255, 0.3)',
      },
      backgroundImage: {
        'credav-gradient': 'linear-gradient(135deg, #00d8ff 0%, #0a64ff 50%, #8a3dff 100%)',
      },
    },
  },
  plugins: [],
};
