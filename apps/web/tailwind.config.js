/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Direct brand tokens
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
        // Semantic design system mappings
        surface: {
          DEFAULT: '#0a0f22',
          card: '#0c132c',
          elevated: '#101736',
          muted: '#070b18',
        },
        border: {
          DEFAULT: '#162044',
          subtle: 'rgba(22, 32, 68, 0.6)',
          glow: 'rgba(0, 216, 255, 0.3)',
        },
        muted: {
          DEFAULT: '#7e8fa6',
          foreground: '#94a3b8',
        },
        accent: {
          DEFAULT: '#00d8ff',
          cyan: '#00d8ff',
          blue: '#0a64ff',
          violet: '#8a3dff',
          magenta: '#c04bff',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 25px -5px rgba(0, 216, 255, 0.25)',
        'glow-violet': '0 0 25px -5px rgba(138, 61, 255, 0.3)',
        'glow-subtle': '0 0 15px -3px rgba(0, 216, 255, 0.15)',
        card: '0 4px 20px -2px rgba(3, 5, 13, 0.7)',
      },
      backgroundImage: {
        'credav-gradient': 'linear-gradient(135deg, #00d8ff 0%, #0a64ff 50%, #8a3dff 100%)',
        'credav-gradient-subtle': 'linear-gradient(135deg, rgba(0, 216, 255, 0.1) 0%, rgba(138, 61, 255, 0.1) 100%)',
      },
      maxWidth: {
        content: '1200px',
      },
    },
  },
  plugins: [],
};
