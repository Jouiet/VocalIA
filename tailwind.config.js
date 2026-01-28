/** @type {import('tailwindcss').Config} */
module.exports = {
    content: ["./website/**/*.{html,js}"],
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                vocalia: {
                    50: '#f0f7ff',
                    100: '#e0effe',
                    200: '#bae0fd',
                    300: '#7cc8fc',
                    400: '#36aaf8',
                    500: '#0c8ee9',
                    600: '#0070c7',
                    700: '#0159a1',
                    800: '#064b85',
                    900: '#0b406e',
                    950: '#072849'
                }
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
                mono: ['JetBrains Mono', 'monospace']
            },
            animation: {
                'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                'float': 'float 6s ease-in-out infinite',
                'glow': 'glow 2s ease-in-out infinite alternate'
            },
            keyframes: {
                float: {
                    '0%, 100%': { transform: 'translateY(0px)' },
                    '50%': { transform: 'translateY(-20px)' }
                },
                glow: {
                    '0%': { boxShadow: '0 0 20px rgba(12, 142, 233, 0.3)' },
                    '100%': { boxShadow: '0 0 40px rgba(12, 142, 233, 0.6)' }
                }
            }
        }
    },
    plugins: [],
}
