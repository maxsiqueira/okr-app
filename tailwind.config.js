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
                    DEFAULT: "hsl(var(--primary))",
                    foreground: "hsl(var(--primary-foreground))",
                },
                secondary: {
                    DEFAULT: "hsl(var(--secondary))",
                    foreground: "hsl(var(--secondary-foreground))",
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
                // Real Estate Template Colors
                realestate: {
                    primary: {
                        50: '#eff6ff',
                        100: '#dbeafe',
                        200: '#bfdbfe',
                        300: '#93c5fd',
                        400: '#60a5fa',
                        500: '#3b82f6', // Primary blue
                        600: '#2563eb',
                        700: '#1d4ed8',
                        800: '#1e40af',
                        900: '#1e3a8a',
                    },
                    purple: {
                        50: '#faf5ff',
                        100: '#f3e8ff',
                        200: '#e9d5ff',
                        300: '#d8b4fe',
                        400: '#c084fc',
                        500: '#a855f7', // Accent purple
                        600: '#9333ea',
                        700: '#7e22ce',
                        800: '#6b21a8',
                        900: '#581c87',
                    },
                    success: {
                        50: '#f0fdf4',
                        100: '#dcfce7',
                        200: '#bbf7d0',
                        300: '#86efac',
                        400: '#4ade80',
                        500: '#22c55e', // Success green
                        600: '#16a34a',
                        700: '#15803d',
                        800: '#166534',
                        900: '#14532d',
                    },
                    warning: {
                        50: '#fff7ed',
                        100: '#ffedd5',
                        200: '#fed7aa',
                        300: '#fdba74',
                        400: '#fb923c',
                        500: '#f97316', // Warning orange
                        600: '#ea580c',
                        700: '#c2410c',
                        800: '#9a3412',
                        900: '#7c2d12',
                    },
                    sidebar: {
                        DEFAULT: '#1e293b', // Dark slate for sidebar
                        light: '#334155',
                        dark: '#0f172a',
                    }
                },
                // FinLab-inspired vibrant colors (preserved)
                finlab: {
                    blue: {
                        50: '#f0f9ff',
                        100: '#e0f2fe',
                        200: '#bae6fd',
                        300: '#7dd3fc',
                        400: '#38bdf8',
                        500: '#0ea5e9',
                        600: '#0284c7',
                        700: '#0369a1',
                        800: '#075985',
                        900: '#0c4a6e',
                    },
                    cyan: {
                        400: '#22d3ee',
                        500: '#06b6d4',
                        600: '#0891b2',
                    },
                    purple: {
                        400: '#c084fc',
                        500: '#a855f7',
                        600: '#9333ea',
                    },
                    pink: {
                        400: '#f472b6',
                        500: '#ec4899',
                        600: '#db2777',
                    }
                },
                // Strategic Dashboard Colors (preserved)
                strategy: {
                    innovation: "#8B5CF6", // Violet
                    sustenance: "#10B981", // Emerald
                    improvement: "#F59E0B", // Amber
                }
            },
            borderRadius: {
                lg: "var(--radius)",
                md: "calc(var(--radius) - 2px)",
                sm: "calc(var(--radius) - 4px)",
                xl: "1rem",
                "2xl": "1.5rem",
            },
            boxShadow: {
                'glass': '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
                'glass-sm': '0 4px 16px 0 rgba(31, 38, 135, 0.25)',
                'finlab': '0 10px 40px rgba(14, 165, 233, 0.15)',
                'finlab-lg': '0 20px 60px rgba(14, 165, 233, 0.25)',
                'elevated': '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                'realestate': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                'realestate-lg': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                'realestate-xl': '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                'stat-card': '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
            },
            backdropBlur: {
                xs: '2px',
            },
            animation: {
                'fade-in': 'fadeIn 0.5s ease-in-out',
                'slide-in': 'slideIn 0.3s ease-out',
                'slide-up': 'slideUp 0.4s ease-out',
                'scale-in': 'scaleIn 0.3s ease-out',
                'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
            },
            keyframes: {
                fadeIn: {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                slideIn: {
                    '0%': { transform: 'translateX(-10px)', opacity: '0' },
                    '100%': { transform: 'translateX(0)', opacity: '1' },
                },
                slideUp: {
                    '0%': { transform: 'translateY(10px)', opacity: '0' },
                    '100%': { transform: 'translateY(0)', opacity: '1' },
                },
                scaleIn: {
                    '0%': { transform: 'scale(0.95)', opacity: '0' },
                    '100%': { transform: 'scale(1)', opacity: '1' },
                },
            },
            backgroundImage: {
                'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
                'gradient-finlab': 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
                'gradient-finlab-dark': 'linear-gradient(135deg, #0c4a6e 0%, #075985 100%)',
                'gradient-realestate-blue': 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                'gradient-realestate-purple': 'linear-gradient(135deg, #a855f7 0%, #9333ea 100%)',
                'gradient-realestate-green': 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                'gradient-realestate-orange': 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                'gradient-sidebar': 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)',
            },
        },
    },
    plugins: [],
}
