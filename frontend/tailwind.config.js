/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#F5F8FF',
          100: '#EBF1FF',
          500: '#2563EB',
          600: '#1D4ED8',
          700: '#1E40AF',
        },
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      boxShadow: {
        subtle: '0 1px 3px rgba(15,23,42,0.03), 0 4px 12px rgba(15,23,42,0.02)',
        card: '0 1px 3px rgba(0,0,0,0.04), 0 6px 16px rgba(0,0,0,0.03)',
        popover: '0 10px 25px -5px rgba(15,23,42,0.08), 0 8px 10px -6px rgba(15,23,42,0.04)',
      },
    },
  },
  plugins: [],
}
