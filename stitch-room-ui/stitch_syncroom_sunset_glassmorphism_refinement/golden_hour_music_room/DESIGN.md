---
name: Golden Hour Music Room
colors:
  surface: '#1c110c'
  surface-dim: '#1c110c'
  surface-bright: '#453630'
  surface-container-lowest: '#160c07'
  surface-container-low: '#251913'
  surface-container: '#291d17'
  surface-container-high: '#342721'
  surface-container-highest: '#40322c'
  on-surface: '#f5ded5'
  on-surface-variant: '#e0c0b1'
  inverse-surface: '#f5ded5'
  inverse-on-surface: '#3b2d27'
  outline: '#a78b7d'
  outline-variant: '#584237'
  surface-tint: '#ffb690'
  primary: '#ffb690'
  on-primary: '#552100'
  primary-container: '#f97316'
  on-primary-container: '#582200'
  inverse-primary: '#9d4300'
  secondary: '#ffb783'
  on-secondary: '#4f2500'
  secondary-container: '#d97722'
  on-secondary-container: '#451f00'
  tertiary: '#ffb599'
  on-tertiary: '#5a1c00'
  tertiary-container: '#ff6d2c'
  on-tertiary-container: '#5d1d00'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#ffdbca'
  primary-fixed-dim: '#ffb690'
  on-primary-fixed: '#341100'
  on-primary-fixed-variant: '#783200'
  secondary-fixed: '#ffdcc5'
  secondary-fixed-dim: '#ffb783'
  on-secondary-fixed: '#301400'
  on-secondary-fixed-variant: '#713700'
  tertiary-fixed: '#ffdbce'
  tertiary-fixed-dim: '#ffb599'
  on-tertiary-fixed: '#370e00'
  on-tertiary-fixed-variant: '#7f2b00'
  background: '#1c110c'
  on-background: '#f5ded5'
  surface-variant: '#40322c'
typography:
  display-lg:
    fontFamily: Noto Serif
    fontSize: 40px
    fontWeight: '600'
    lineHeight: 48px
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Noto Serif
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
    letterSpacing: -0.01em
  headline-lg:
    fontFamily: Noto Serif
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Noto Serif
    fontSize: 20px
    fontWeight: '500'
    lineHeight: 28px
  title-md:
    fontFamily: DM Sans
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: DM Sans
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 22px
  body-md:
    fontFamily: DM Sans
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  label-lg:
    fontFamily: DM Sans
    fontSize: 13px
    fontWeight: '600'
    lineHeight: 18px
    letterSpacing: 0.02em
  label-md:
    fontFamily: DM Sans
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.04em
  label-sm:
    fontFamily: DM Sans
    fontSize: 10px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.06em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-lg: 1.5rem
  margin: 1.25rem
  margin-lg: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1.25rem
  space-xl: 1.75rem
  space-2xl: 2.5rem
---

## Brand & Style

This design system crafts an intimate, analog-inspired social listening sanctum bathed in twilight illumination. It evokes the feeling of a private penthouse listening lounge at sunset—where the tactile warmth of vinyl meets contemporary synchronized streaming. The aesthetic balances high-fidelity tactile skeuomorphism (grooved records, brushed champagne tonearms, glowing amber playback controls) with ultra-refined translucent glassmorphism (espresso smoke acrylic, frosted blur layers, and whisper-thin rim lighting).

Targeted at audiophiles, tastemakers, and social listeners who appreciate atmospheric depth over sterile flat utility, the design conveys intimacy, relaxation, and bespoke craftsmanship. Every surface feels luminous yet grounded, avoiding harsh neon gradients in favor of organic golden-hour flares, ember diffusions, and deep roasted-bronze shadows.

## Colors

The palette is rooted in deep roasted espresso tones (`#120905`, `#1a0f0a`), illuminated by radiant amber and sunset orange highlights (`#f97316`, `#fb923c`, `#ea580c`). 

- **Primary (`#f97316`)**: The core interactive accent. Drives primary action states, playback progress meters, active pill toggles, and warm radial highlights.
- **Secondary (`#fb923c`)**: The luminous highlight color. Used for active glowing rings, knob indicators, and hovered interactive states.
- **Tertiary (`#ea580c`)**: Deep rich amber. Applied to gradient tails, badge outlines, and pressed states to retain chromatic richness without washing out.
- **Neutral Surface Palette (`#1a0f0a`)**: The foundational dark bronze/espresso background, rendered through translucent layers (`rgba(25, 15, 10, 0.65)` to `rgba(32, 18, 12, 0.85)`).
- **Text & Accents**: Primary text sits in soft warm milk (`#fef3c7` / `#fbf5f0`), secondary metadata in muted warm taupe (`#a89a90`), and inactive glyphs in desaturated bronze (`#736357`). Synced connectivity indicators utilize a jewel emerald green (`#10b981`) with a subtle glowing halo to contrast gracefully against the amber canvas.

## Typography

The typographic hierarchy pairs an editorial, high-character serif for song titles, section banners, and room headers with a geometric, legible modern sans for data-dense UI, track scrubbers, and chat streams.

- **Headlines (`Noto Serif`)**: Brings organic vinyl record sleeve elegance and emotional gravitas to track titles and panel titles. It maintains clarity even at compact scales while delivering distinctive editorial charm.
- **Body & Labels (`DM Sans`)**: Ensures zero visual fatigue across rapid-fire real-time chat messages, queue lists, timestamps, and compact sidebar icons. It boasts balanced horizontal metrics and clear distinction between numbers and symbols.
- **Micro-Labels**: Track timing (`0:42`, `3:28`), host tags, and sync latency metrics utilize tabular figure settings with increased tracking for instant glancing.

## Layout & Spacing

The layout is built around a structured panel canvas floating atop an ambient scene backdrop. The viewport is split into responsive spatial zones:
- **Left Navigation Rail**: Fixed compact vertical utility bar (`72px` to `80px`) accommodating global destinations and room connection health.
- **Center Stage (Vinyl Player & Turntable)**: Focal listening area providing expansive breathing room for the turntable platter, tonearm mechanics, track title typography, scrubber bar, and macro player controls.
- **Right Companion Panels**: Split columns for interactive social chat and the collaborative real-time queue.

### Breakpoints & Adaptations
- **Desktop (> 1280px)**: 4-pane simultaneous view (Nav Rail + Turntable Center Deck + Chat Pane + Queue Pane) with `gutter-lg` (`1.5rem`) gaps and `margin-lg` outer padding.
- **Tablet (768px – 1279px)**: Nav rail collapses or moves to bottom navigation; the player remains prominent, while Chat and Queue collapse into a unified tabbed glass panel.
- **Mobile (< 768px)**: Single-column stacked experience with a sticky floating player sheet, bottom navigation dock, and sliding swipeable sheets for Chat and Track Queue. Outer margins drop to `1rem`.

## Elevation & Depth

Visual hierarchy relies on warm glassmorphism, multi-stop luminous backdrops, and rim specular borders rather than harsh structural drop shadows.

- **Surface 0 (Atmosphere Canvas)**: Deep golden-hour photographic or animated dusk gradient, occluded by deep warm vignetting (`#0d0604`) at screen perimeters.
- **Surface 1 (Translucent Glass Panels)**: Base panels utilize `rgba(24, 13, 8, 0.60)` with a backdrop blur of `20px` to `24px`. Borders are defined by hairline highlights: `1px solid rgba(255, 255, 255, 0.07)` on top and sides, decaying to `rgba(255, 255, 255, 0.02)` along lower edges.
- **Surface 2 (Inset Cards & Input Shells)**: Chat containers and queue items sit at `rgba(18, 9, 6, 0.70)` with subtle `inset 0 1px 1px rgba(255, 255, 255, 0.04)`.
- **Surface 3 (Interactive Floating Elements & Vinyl Center Platter)**: The vinyl disc features realistic concentric physical textures with anisotropic light flares and ambient radial underglows: `box-shadow: 0 16px 40px -10px rgba(0, 0, 0, 0.7), 0 0 45px -5px rgba(249, 115, 22, 0.22)`.
- **Primary Action Glow**: Active playback controls and the main CTA utilize radiant amber halo effects: `box-shadow: 0 4px 24px rgba(249, 115, 22, 0.40), inset 0 1px 0 rgba(255, 255, 255, 0.35)`.

## Shapes

The shape vocabulary emphasizes softened structural silhouettes that evoke modern audio hardware and curved acoustic architecture.

- **Panels & Dashboard Tiles**: Use `rounded-xl` (`1.5rem` / `24px`) to establish a continuous, approachable glass container boundary.
- **Vinyl Platter & Playback Button**: Pure circular geometries (`rounded-full` / `50%`) anchor the visual flow and emphasize analog rotation.
- **Buttons & Action Pills**: Outer interactive action buttons (such as "Add Song" and navigation tabs) use pill curvature (`9999px` or `rounded-xl`) to provide comfortable touch targets.
- **Input Fields & Small Insets**: Employ `rounded-lg` (`0.75rem` / `12px`) for subtle internal harmony.

## Components

### Buttons & Playback Controls
- **Main Play/Pause Button**: Circular (`56px` to `64px`), finished with a radial warm gradient (`linear-gradient(135deg, #fde68a 0%, #f97316 60%, #c2410c 100%)`). Inset top rim highlight (`rgba(255, 255, 255, 0.45)`) and dark espresso glyph. Accompanied by a diffused amber ambient drop shadow.
- **Primary Action Button ("Add Song")**: Full-width or auto-width pill button featuring a rich sunset gradient (`linear-gradient(to right, #f97316, #ea580c)`), bold white typography, subtle drop-arrow divider, and `0 8px 24px rgba(249, 115, 22, 0.35)` shadow.
- **Icon / Transport Buttons**: Scrub, shuffle, and skip buttons use flat muted brass icons (`rgba(245, 230, 220, 0.7)`) that transition to bright amber (`#fb923c`) and scale to `1.08` on hover.

### Progress & Volume Scrubbers
- **Track Slider**: `4px` baseline track in translucent smoked glass (`rgba(255, 255, 255, 0.12)`). The active track fill is a glowing amber-to-gold gradient with a circular thumb (`12px`) outlined in white with a `0 0 10px #f97316` bloom.

### Navigation Rail
- **Item State**: Vertical stack with `rounded-xl` icon containers. Active state receives a translucent dark amber backing (`rgba(249, 115, 22, 0.15)`), a thin orange border (`rgba(249, 115, 22, 0.4)`), and amber-colored active iconography.
- **Sync Status Indicator**: Displays a glowing emerald dot (`#10b981`) alongside real-time ping readout (`Synced 28ms`) in muted typography.

### Chat & Queue Panels
- **Tabs**: Minimal text tabs ("Chat", "Listeners (1)") highlighted by a clean amber underline bar (`#f97316`, `2px` height) beneath the active selection.
- **Input Fields**: Ambient dark glass pill (`rgba(20, 11, 7, 0.65)`) with `1px solid rgba(255, 255, 255, 0.08)`, muted placeholder text, and emoji trigger button pinned to the right. Focus state reveals a gentle amber border glow (`rgba(249, 115, 22, 0.45)`).
- **Queue Empty State**: Centered musical glyph styled in amber line art with gentle opacity, paired with descriptive muted typography.