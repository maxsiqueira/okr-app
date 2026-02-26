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
                border: "hsl(var(--border))",
                input: "hsl(var(--input))",
                ring: "hsl(var(--ring))",
                background: "hsl(var(--background))",
                foreground: "hsl(var(--foreground))",
                primary: {
                    DEFAULT: "var(--primary-color, #FF4200)", // ION Orange (Dynamic)
                    foreground: "#FFFFFF",
                },
                secondary: {
                    DEFAULT: "var(--secondary-color, #333333)", // ION Dark Gray (Dynamic)
                    foreground: "#FFFFFF",
                },
                destructive: {
                    DEFAULT: "hsl(var(--destructive))",
                    foreground: "hsl(var(--destructive-foreground))",
                },
                muted: {
                    DEFAULT: "hsl(var(--muted))",
                    foreground: "hsl(var(--muted-foreground))",
                },
                accent: {
                    DEFAULT: "hsl(var(--accent))",
                    foreground: "hsl(var(--accent-foreground))",
                },
                popover: {
                    DEFAULT: "hsl(var(--popover))",
                    foreground: "hsl(var(--popover-foreground))",
                },
                card: {
                    DEFAULT: "hsl(var(--card))",
                    foreground: "hsl(var(--card-foreground))",
                },
                // ION Brand Specific
                ion: {
                    orange: "var(--primary-color, #FF4200)",
                    dark: "var(--secondary-color, #333333)",
                    light: "#F7F7F7",
                },
                // Template compatibility
                realestate: {
                    primary: {
                        50: '#fff7ed',
                        100: '#ffedd5',
                        200: '#fed7aa',
                        300: '#fdba74',
                        400: '#fb923c',
                        500: 'var(--primary-color, #FF4200)',
                        600: '#ea580c',
                        700: '#c2410c',
                        800: '#9a3412',
                        900: '#7c2d12',
                    }
                },
                sidebar: {
                    DEFAULT: '#1e293b',
                    light: '#334155',
                    dark: '#0f172a',
                }
            },
            fontFamily: {
                sans: ['Poppins', 'Inter', 'sans-serif'],
                poppins: ['Poppins', 'sans-serif'],
            },
            borderRadius: {
                lg: "var(--radius)",
                md: "calc(var(--radius) - 2px)",
                sm: "calc(var(--radius) - 4px)",
                xl: "1rem",
                "2xl": "1.5rem",
                "pill": "30px",
            },
            boxShadow: {
                'glass': '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
                'finlab': '0 10px 40px rgba(255, 66, 0, 0.15)',
                'elevated': '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
                'stat-card': '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
            },
            animation: {
                'fade-in': 'fadeIn 0.5s ease-in-out',
                'slide-up': 'slideUp 0.4s ease-out',
            },
            keyframes: {
                fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
                slideUp: { '0%': { transform: 'translateY(10px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
            },
            backgroundImage: {
                'gradient-ion': 'linear-gradient(135deg, #FF4200 0%, #E63B00 100%)',
            },
        },
    },
    plugins: [],
}
