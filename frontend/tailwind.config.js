/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx}",
    "./src/components/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        surface: "#ffffff",
        "bg-start": "#FDEBF0",
        "bg-end": "#EAF6FF",
        "text-primary": "#0F172A",
        "text-muted": "#6B7280",
        accent: "#6B5BFF",
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.5rem",
      },
      boxShadow: {
        card: "0 10px 30px rgba(16,24,40,0.06)",
      },
    },
  },
  plugins: [
    require("@tailwindcss/typography")
  ],
};
