module.exports = {
  content: ['./src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        base:    { DEFAULT: '#080c18', light: '#f4f0e6' },
        surface: { DEFAULT: '#0e1525', light: '#fdfaf3' },
        card:    { DEFAULT: '#131d30', light: '#ffffff' },
        border:  { DEFAULT: '#1c2a42', light: '#ddd5c0' },
        gold:    {
          DEFAULT: '#c8a84b',
          hover:   '#e0bf6d',
          muted:   '#7d6730',
          light:   '#9a7520',
        },
        income:  { DEFAULT: '#3dd68c', light: '#1a9e5a' },
        expense: { DEFAULT: '#f26d6d', light: '#d64040' },
        warning: { DEFAULT: '#f0a429', light: '#c47d10' },
        tx: {
          food:      '#6b9df5',
          transport: '#9b74d9',
          shopping:  '#f0a429',
          housing:   '#30c4d8',
          health:    '#e87d3e',
          entertain: '#d468a4',
          edu:       '#5abf8a',
          utilities: '#8098c4',
          others:    '#5a7a6a',
        },
      },
      fontFamily: {
        display: ["'Playfair Display'", 'Georgia', 'serif'],
        sans:    ['Inter', 'DM Sans', 'sans-serif'],
      },
    },
  },
}
