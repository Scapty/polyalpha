# PolyAlpha Design System

## Direction: Sophistication & Trust

A fintech analytics product for prediction market analysis. Dense like a trading floor, precise like Stripe, quiet like Linear. Every pixel earns its place.

## Tokens

### Backgrounds
| Token | Value | Usage |
|-------|-------|-------|
| --bg-0 | #09090B | Main background |
| --bg-1 | #111113 | Cards, sections |
| --bg-2 | #18181B | Hover states, nested elements |
| --bg-3 | #1E1E22 | Modals, dropdowns, elevated surfaces |

### Borders
| Token | Value | Usage |
|-------|-------|-------|
| --border | #27272A | Default borders, 1px solid |
| --border-muted | #1E1E22 | Subtle separation |
| --border-focus | #4F46E5 | Focus rings, active states |

### Text
| Token | Value | Usage |
|-------|-------|-------|
| --t1 | #FAFAFA | Headings, primary text |
| --t2 | #A1A1AA | Body text, descriptions |
| --t3 | #71717A | Captions, timestamps, muted labels |
| --t4 | #52525B | Placeholders, disabled text |

### Semantic Colors (use sparingly)
| Token | Value | Usage |
|-------|-------|-------|
| --green | #10B981 | Positive P&L, success |
| --red | #EF4444 | Negative P&L, danger |
| --purple | #8B5CF6 | Bot classification |
| --blue | #3B82F6 | Human classification |
| --accent | #4F46E5 | THE accent color (indigo) |

### Typography
- Display/Headings: "DM Sans", weight 600, letter-spacing: -0.03em
- Body: "DM Sans", weight 400
- Monospace: "DM Mono", weight 400
- Load: `https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=DM+Mono:wght@400;500&display=swap`

### Spacing Grid
4px, 8px, 12px, 16px, 20px, 24px, 32px, 40px, 48px, 64px

### Border Radius
| Element | Value |
|---------|-------|
| Buttons | 6px |
| Cards | 8px |
| Inputs | 6px |
| Modals | 12px |
| Pills/Tags | 9999px |

## Patterns

### Card
```
bg-[#111113] border border-[#27272A] rounded-lg p-4
```

### Stat Card
```
bg-[#111113] border border-[#27272A] rounded-lg p-4
Label: 12px uppercase tracking-wider text-[#71717A]
Value: 24px DM Mono font-medium text-[#FAFAFA]
```

### Button Primary
```
bg-[#4F46E5] hover:bg-[#4338CA] text-white text-[13px] font-medium
h-[44px] px-5 rounded-[6px] transition-colors duration-150
```

### Input
```
bg-[#111113] border border-[#27272A] rounded-[6px] h-[44px] px-4
text-sm font-mono placeholder:text-[#52525B]
focus:border-[#4F46E5] focus:ring-2 focus:ring-[#4F46E5]/20
```

### Table
```
Border separators only (no alternating rows)
Header: text-[11px] uppercase tracking-wider text-[#71717A]
Cell: text-[13px] text-[#A1A1AA]
Row border: border-b border-[#1E1E22]
```

## Animations (ONLY these)
- Fade in on mount: opacity 0→1, translateY 8px→0, 300ms ease
- Hover transitions: 150ms ease
- Skeleton shimmer: background-position slide, 1.8s infinite
- Row stagger: 50ms delay per row (leaderboard only)

## Forbidden
- Emojis
- Gradient text (background-clip: text)
- Neon/glow (colored box-shadow, text-shadow)
- Glassmorphism (backdrop-filter: blur)
- Bounce/pulse/float animations
- Particle effects
- Multiple accent colors
- Promotional stat cards
