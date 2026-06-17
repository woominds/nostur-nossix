/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        nostur: {
          bg: "#080b10",
          panel: "#10151d",
          panel2: "#161d27",
          line: "#263142",
          orange: "#ff7a1a",
          orangeSoft: "#ff9b4a",
          text: "#f6f7fb",
          muted: "#9ca8ba"
        }
      }
    }
  },
  plugins: []
};