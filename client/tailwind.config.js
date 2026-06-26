/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  // Habilitar JIT (ya es default en Tailwind 3.x)
  // Esto genera solo las clases que se usan realmente
  theme: {
    extend: {
      colors: {
        primary: '#FF6B00',
        primaryLight: '#FF974D',
        primaryDark: '#B34B00',
        secondary: '#803600',
        accent: '#FFAE73',
        light: '#faf7f6',
        dark: '#1f1b1a'
      },
      fontFamily: {
        sans: ['Inter', 'Inter Var', 'system-ui', 'sans-serif'],
        serif: ['Playfair Display', 'serif'],
        heading: ['Plus Jakarta Sans', 'sans-serif'],
      },
      fontSize: {
        'xs': ['0.75rem', { lineHeight: '1rem' }],
        'sm': ['0.875rem', { lineHeight: '1.25rem' }],
        'base': ['1rem', { lineHeight: '1.5rem' }],
        'lg': ['1.125rem', { lineHeight: '1.75rem' }],
        'xl': ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
        '5xl': ['3rem', { lineHeight: '1' }],
      },
      animation: {
        'fadeIn': 'fadeIn 0.5s ease-in-out',
        'slideUp': 'slideUp 0.5s ease-out',
        'slideDown': 'slideDown 0.3s ease-out',
        'bounce-light': 'bounce 3s infinite',
        'pulse-soft': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'shimmer': 'shimmer 2s infinite',
        'scaleIn': 'scaleIn 0.3s ease-out',
        'slideLeft': 'slideLeft 0.35s ease-out forwards',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideLeft: {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-1000px 0' },
          '100%': { backgroundPosition: '1000px 0' },
        },
      },
      boxShadow: {
        'soft': '0 2px 8px rgba(0, 0, 0, 0.08)',
        'medium': '0 4px 12px rgba(0, 0, 0, 0.1)',
        'lg-soft': '0 10px 30px rgba(0, 0, 0, 0.1)',
      },
      backdropBlur: {
        'xs': '2px',
      },
    },
  },
  // Clases que se generan dinámicamente (no aparecen en el AST estático)
  // pero se usan en el código via template strings / condicionales
  safelist: [
    // Estados de pedidos
    'bg-yellow-50', 'text-yellow-800', 'border-yellow-200',
    'bg-blue-50', 'text-blue-800', 'border-blue-200',
    'bg-purple-50', 'text-purple-800', 'border-purple-200',
    'bg-green-50', 'text-green-800', 'border-green-200',
    'bg-red-50', 'text-red-800', 'border-red-200',
    'bg-orange-50', 'text-orange-800', 'border-orange-200',
    'bg-emerald-50', 'text-emerald-800', 'border-emerald-200',
    // Estados de validación
    'text-green-600', 'text-red-600',
  ],
  plugins: [],
}
