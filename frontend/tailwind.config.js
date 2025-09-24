/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx}",
    "./src/components/**/*.{js,ts,jsx,tsx}",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        heading: ["Poppins", "Inter", "sans-serif"],
        sans: ["Inter", "ui-sans-serif", "system-ui"],
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.5rem",
      },
      boxShadow: {
        card: "0 10px 30px rgba(16,24,40,0.06)",
        hover: "0 15px 40px rgba(16,24,40,0.1)",
      },
      colors: {
        surface: "#ffffff",
        "text-primary": "#0F172A",
        "text-muted": "#6B7280",
        accent: "#6B5BFF",
      },
      gradientColorStops: {
        "grad-start": "#FDEBF0",
        "grad-end": "#EAF6FF",
      },
    },
  },
  plugins: [
    require("@tailwindcss/typography"),
    // optionally: require("@tailwindcss/line-clamp"),
  ],
};
