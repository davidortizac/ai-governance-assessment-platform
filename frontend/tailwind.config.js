/** @type {import('tailwindcss').Config} */
export default {
    content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
    theme: {
        extend: {
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
            },
            colors: {
                // Gamma Ingenieros corporate palette
                primary: {
                    50: '#F3F0FF',
                    100: '#E8E0FF',
                    200: '#D1C4F0',
                    300: '#B5A0E0',
                    400: '#9B7DD0',
                    500: '#7B5EA7',
                    600: '#634B8C',
                    700: '#4A3871',
                    800: '#312556',
                    900: '#1E163A',
                    950: '#0F0B1F',
                },
                surface: {
                    50: '#F0EDF5',
                    100: '#E0DAF0',
                    200: '#C4B8D9',
                    300: '#A695BE',
                    400: '#8876A0',
                    500: '#6A5A82',
                    600: '#524568',
                    700: '#3B3250',
                    800: '#262040',
                    900: '#181230',
                    950: '#0D0A1E',
                },
                accent: {
                    cyan: '#06B6D4',
                    violet: '#8B5CF6',
                    purple: '#7B5EA7',
                    lavender: '#C4B5E0',
                },
                gamma: {
                    purple: '#7B5EA7',
                    dark: '#2D2E4A',
                    lavender: '#C4B5E0',
                    light: '#E8E0F5',
                    navy: '#1E163A',
                }
            },
            boxShadow: {
                glass: '0 8px 32px rgba(123, 94, 167, 0.08)',
                card: '0 4px 24px rgba(123, 94, 167, 0.05)',
                elevated: '0 20px 60px rgba(123, 94, 167, 0.12)',
                glow: '0 0 40px rgba(123, 94, 167, 0.15)',
            },
        },
    },
    plugins: [],
};
