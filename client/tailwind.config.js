import typography from "@tailwindcss/typography";

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        page: "var(--page)",
        canvas: "var(--canvas)",
        surface: "var(--surface)",
        inset: "var(--inset)",
        hover: "var(--hover)",
        "hover-2": "var(--hover-2)",
        ink: "var(--ink)",
        "ink-2": "var(--ink-2)",
        "ink-3": "var(--ink-3)",
        line: "var(--line)",
        "line-strong": "var(--line-strong)",
        field: "var(--field)",
        accent: "var(--bui-accent)",
        "accent-ink": "var(--accent-ink)",
        "accent-tint": "var(--accent-tint)",
        green: "var(--bui-green)",
        "green-tint": "var(--green-tint)",
        orange: "var(--bui-orange)",
        "orange-tint": "var(--orange-tint)",
        red: "var(--bui-red)",
        "red-tint": "var(--red-tint)",
      },
      borderRadius: {
        chip: "6px",
        control: "8px",
        card: "10px",
      },
      boxShadow: {
        hairline: "var(--shadow-hairline)",
        btn: "var(--shadow-btn)",
        card: "var(--shadow-card)",
        raised: "var(--shadow-raised)",
        overlay: "var(--shadow-overlay)",
      },
      maxWidth: {
        95: "23.75rem",
        105: "26.25rem",
        110: "27.5rem",
      },
      size: {
        3.5: "0.875rem",
        4.5: "1.125rem",
        5.5: "1.375rem",
        6.5: "1.625rem",
        7.5: "1.875rem",
      },
      height: {
        4.5: "1.125rem",
        5.5: "1.375rem",
        6.5: "1.625rem",
        7.5: "1.875rem",
      },
      width: {
        4.5: "1.125rem",
        5.5: "1.375rem",
      },
      minWidth: {
        4.5: "1.125rem",
      },
    },
  },
  plugins: [typography],
};
