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
          bg: '#050711',
          card: '#0a0e24',
          surface: '#101738',
          border: '#1a2352',
          cyan: '#00f2fe',
          blue: '#4facfe',
          violet: '#7f00ff',
          magenta: '#f857a6',
          muted: '#8b9bb4',
        },
      },
      boxShadow: {
        glow: '0 0 25px -5px rgba(0, 242, 254, 0.25)',
        'glow-violet': '0 0 25px -5px rgba(127, 0, 255, 0.3)',
      },
    },
  },
  plugins: [],
};
