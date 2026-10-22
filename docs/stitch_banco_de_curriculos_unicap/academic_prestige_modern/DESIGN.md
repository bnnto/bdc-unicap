---
name: Academic Prestige Modern
colors:
  surface: '#f9f9ff'
  surface-dim: '#cfdaf2'
  surface-bright: '#f9f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f0f3ff'
  surface-container: '#e7eeff'
  surface-container-high: '#dee8ff'
  surface-container-highest: '#d8e3fb'
  on-surface: '#111c2d'
  on-surface-variant: '#554243'
  inverse-surface: '#263143'
  inverse-on-surface: '#ecf1ff'
  outline: '#887173'
  outline-variant: '#dbc0c1'
  surface-tint: '#a03d4b'
  primary: '#4b0013'
  on-primary: '#ffffff'
  primary-container: '#6b1426'
  on-primary-container: '#f17c8a'
  inverse-primary: '#ffb2b8'
  secondary: '#795900'
  on-secondary: '#ffffff'
  secondary-container: '#fece67'
  on-secondary-container: '#765600'
  tertiary: '#001c57'
  on-tertiary: '#ffffff'
  tertiary-container: '#002f85'
  on-tertiary-container: '#799bff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdadb'
  primary-fixed-dim: '#ffb2b8'
  on-primary-fixed: '#40000f'
  on-primary-fixed-variant: '#812535'
  secondary-fixed: '#ffdea0'
  secondary-fixed-dim: '#eec05b'
  on-secondary-fixed: '#261a00'
  on-secondary-fixed-variant: '#5c4300'
  tertiary-fixed: '#dbe1ff'
  tertiary-fixed-dim: '#b4c5ff'
  on-tertiary-fixed: '#00174b'
  on-tertiary-fixed-variant: '#003ea8'
  background: '#f9f9ff'
  on-background: '#111c2d'
  surface-variant: '#d8e3fb'
typography:
  display-lg:
    fontFamily: Merriweather
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 52px
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Merriweather
    fontSize: 30px
    fontWeight: '700'
    lineHeight: 38px
    letterSpacing: -0.01em
  headline-lg:
    fontFamily: Merriweather
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 30px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 26px
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
  label-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 14px
    letterSpacing: 0.04em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  space-2xs: 0.25rem
  space-xs: 0.5rem
  space-sm: 0.75rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
  space-2xl: 3rem
  space-3xl: 4rem
  layout-margin-mobile: 1rem
  layout-margin-tablet: 2rem
  layout-margin-desktop: 3rem
  layout-gutter: 1.5rem
  layout-max-width: 1440px
---

## Brand & Style
The design system bridges established academic heritage with the dynamic pace of modern recruitment and career tracking. Built specifically for an institutional university career and talent ecosystem, the aesthetic projects authority, ethical prestige, rigorous structure, and forward-looking professional empowerment.

The visual direction combines **Corporate / Modern** enterprise discipline with subtle **Editorial Heritage** cues:
- **Tone:** Authoritative yet accessible, prestigious, structured, and goal-oriented.
- **Audience:** Undergraduate and graduate students, alumni, institutional career advisors, corporate hiring managers, and university enterprise partners.
- **Visual Tenets:** Crisp informational hierarchy, calibrated contrast meeting strict WCAG AA/AAA parameters, refined borders, and purposeful visual weight for metrics and stage progression (e.g., career matching scores, pipeline statuses).

## Colors
The palette balances institutional gravitas with functional UI state indicators:

- **Primary (`#6B1426`):** The signature Academic Wine (Bordô). Reserved for top-tier institutional framing, main navigation elements, primary calls-to-action, active selection indicators, and key structural anchors.
- **Secondary (`#C89D3C`):** Warm Academic Gold. Deployed selectively for high-value accents, verified credential badges, premium match percentages, and key milestones. Must be paired with high-contrast dark neutrals (`#1E293B`) or wine when used as background for text.
- **Tertiary / Informational (`#2563EB`):** Academic Slate Blue. Utilized for ongoing administrative tasks, open reviews, neutral informational callouts, and secondary system links.
- **Neutrals:**
  - Canvas / Background: `#F8F9FA` (light institutional gray) providing soft contrast against pure white `#FFFFFF` cards.
  - Borders: Crisp dividers at `#E2E8F0` and subtle bounding boxes at `#CBD5E1`.
  - Content Text: High-contrast Slate `#1E293B` for body copy, softening to `#64748B` for meta captions.
- **Operational & Matching Semantics:**
  - *High Match / Aprovado:* `#059669` (Dark Emerald) with `#ECFDF5` background.
  - *Screening / Médio Match:* `#D97706` (Amber Ochre) with `#FFFBEB` background.
  - *Disqualified / Reprovado:* `#DC2626` (Ruby Crimson) with `#FEF2F2` background.

## Typography
The typographic system pairs an authoritative, academic serif (`Merriweather`) for institutional headings with a clean, geometric humanist sans-serif (`Plus Jakarta Sans`) for data tables, metrics, application forms, and UI controls.

- **Merriweather** conveys institutional legacy, prestige, and gravitas. It is strictly applied to page-level headings, portal section titles, and candidate profile names in hero layouts.
- **Plus Jakarta Sans** provides functional clarity, high screen legibility, and modern interface pacing across all analytical dashboards, recruitment pipelines, resume builders, and interactive data grids.
- Ensure that form labels and table column headers strictly leverage `label-md` or `label-sm` with slight positive tracking to ensure rapid scanning by recruiters and candidates.

## Layout & Spacing
The layout system is founded on an 8pt spatial cadence (`0.5rem` baseline increments) governed by a 12-column responsive fluid grid:

- **Desktop (1200px+):** 12 columns with `1.5rem` gutters and a maximum bounded container of `1440px`. Screen margins default to `3rem`. Kanban boards expand horizontally with sticky workflow headers.
- **Tablet (768px - 1199px):** 8 columns with `1rem` gutters and `2rem` screen margins. Multi-column forms and split profile/metric panels collapse into stacked 2-column or full-width groups.
- **Mobile (< 768px):** 4 columns with `0.75rem` gutters and `1rem` screen padding. Kanban columns convert to swipeable segmented tab views; complex tabular data switches to vertical list cards.
- **Density Standards:** Data tables and candidate review lists maintain a compact rhythm (`0.75rem` vertical cell padding), while marketing and portal landing sections breathe with `space-2xl` to `space-3xl` section separators.

## Elevation & Depth
Depth conveys priority, interaction viability, and spatial nesting rather than decorative novelty. The system uses a disciplined ambient shadow scheme tinted subtly with slate:

- **Level 0 (Flat / Canvas):** Applied to the main page canvas (`#F8F9FA`) and inline secondary containers. Border: 1px solid `#E2E8F0`.
- **Level 1 (Default Surface / Metrics & Cards):** Used for candidate profile cards, metric summaries, and pipeline cards. 
  - *Shadow:* `0 1px 3px 0 rgba(30, 41, 59, 0.05), 0 1px 2px -1px rgba(30, 41, 59, 0.03)`
  - *Border:* 1px solid `#E2E8F0`
- **Level 2 (Interactive Hover / Dragged State):** Used when hovering over career opportunities or dragging cards in the applicant pipeline.
  - *Shadow:* `0 4px 6px -1px rgba(30, 41, 59, 0.08), 0 2px 4px -2px rgba(30, 41, 59, 0.04)`
  - *Border:* 1px solid `#CBD5E1`
- **Level 3 (Overlays & Dialogs):** Candidate detail drawers, interview scheduling modals, and floating action toolbars.
  - *Shadow:* `0 20px 25px -5px rgba(107, 20, 38, 0.08), 0 8px 10px -6px rgba(30, 41, 59, 0.04)`
  - *Border:* 1px solid `#E2E8F0`

## Shapes
The design adopts a soft, structured, and institutional profile (`roundedness: 1`). Elements are defined by slight, controlled curves that balance enterprise formality with contemporary softness:

- Standard controls (inputs, buttons, select fields): `0.25rem` (4px).
- Surface cards, data panels, and modal containers: `0.5rem` (8px).
- Badges, status tags, and matching chips: `0.25rem` (4px) to retain a structured, editorial tag aesthetic rather than an overly casual pill style.
- Avatars: Full circular (`rounded-full`) for candidate photos; square with `0.25rem` radius for corporate partner logos.

## Components

### Buttons
- **Primary:** Background in Academic Wine (`#6B1426`), text in `#FFFFFF`, corner radius `0.25rem`. Hover state transitions to `#520F1D`. Focus ring uses a 2px offset with `#C89D3C` (Gold) halo.
- **Secondary:** Background in pure `#FFFFFF`, border in 1px `#6B1426`, text in `#6B1426`. Hover state fills with `#FDF2F4`.
- **Accent / Premium:** Background in Warm Gold (`#C89D3C`), text in `#1E293B`, subtle box shadow. Reserved for special institutional honors, exports, and critical actions.

### Badges & Chips
- Status indicators strictly adhere to tinted fills with high-contrast text:
  - **Aprovado / Strong Match (85%+):** Background `#ECFDF5`, text `#065F46`, border 1px solid `#A7F3D0`.
  - **Triagem / Medium Match (50-84%):** Background `#FFFBEB`, text `#92400E`, border 1px solid `#FDE68A`.
  - **Reprovado / Low Match (<50%):** Background `#FEF2F2`, text `#991B1B`, border 1px solid `#FECACA`.
  - **Em Andamento / Process:** Background `#EFF6FF`, text `#1E40AF`, border 1px solid `#BFDBFE`.

### Input Fields & Structured Resume Forms
- Standard background `#FFFFFF`, border 1px solid `#CBD5E1`, text `#1E293B`, radius `0.25rem`.
- Active focus displays a border transition to `#6B1426` alongside a dual-pixel outer glow of `rgba(107, 20, 38, 0.15)`.
- Label placed above the field in `label-md` Slate (`#334155`), with required asterisks styled in `#DC2626`.

### Cards & Metrics
- Metric overview cards feature a crisp white base, 1px border (`#E2E8F0`), and an optional left accent border (3px width) in `#6B1426` or `#C89D3C`.
- Data typography showcases numerical stats in `headline-lg` (`Merriweather`) with accompanying descriptive subtitles in `body-sm`.

### Data Tables & Kanban Boards
- **Tables:** Sticky header rows styled with background `#F8F9FA`, bottom border 2px solid `#E2E8F0`, and uppercase `label-sm` labels. Alternating row hovering in `#FBFBFC`.
- **Kanban Pipeline Columns:** Structural canvas filled with `#F1F5F9`, column header displaying card count in a neutral slate pill badge, and ghost drop zones styled with dashed borders in `#94A3B8`.