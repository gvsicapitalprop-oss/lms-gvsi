---
name: Serene Support
colors:
  surface: '#fbf8ff'
  surface-dim: '#dad9e5'
  surface-bright: '#fbf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f4f2ff'
  surface-container: '#eeecf9'
  surface-container-high: '#e8e7f3'
  surface-container-highest: '#e2e1ee'
  on-surface: '#1a1b24'
  on-surface-variant: '#434655'
  inverse-surface: '#2f3039'
  inverse-on-surface: '#f1effc'
  outline: '#747686'
  outline-variant: '#c4c5d7'
  surface-tint: '#2151db'
  primary: '#0037b0'
  on-primary: '#ffffff'
  primary-container: '#1c4ed8'
  on-primary-container: '#cad3ff'
  inverse-primary: '#b7c4ff'
  secondary: '#4d5b94'
  on-secondary: '#ffffff'
  secondary-container: '#b0befe'
  on-secondary-container: '#3d4b84'
  tertiary: '#7f2500'
  on-tertiary: '#ffffff'
  tertiary-container: '#a73400'
  on-tertiary-container: '#ffc9b7'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dce1ff'
  primary-fixed-dim: '#b7c4ff'
  on-primary-fixed: '#001551'
  on-primary-fixed-variant: '#0039b5'
  secondary-fixed: '#dde1ff'
  secondary-fixed-dim: '#b7c4ff'
  on-secondary-fixed: '#04164d'
  on-secondary-fixed-variant: '#35437b'
  tertiary-fixed: '#ffdbcf'
  tertiary-fixed-dim: '#ffb59c'
  on-tertiary-fixed: '#390c00'
  on-tertiary-fixed-variant: '#832700'
  background: '#fbf8ff'
  on-background: '#1a1b24'
  surface-variant: '#e2e1ee'
typography:
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 26px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  container-margin: 20px
  gutter: 16px
---

## Brand & Style

The design system is built on a foundation of empathy, reliability, and accessibility. It aims to reduce the cognitive load for users who may be seeking emotional or technical assistance within a community setting. 

The aesthetic identity is **Modern Humanist**, blending the precision of a professional SaaS tool with the warmth of a social wellness platform. By prioritizing generous whitespace and a clean, uncluttered interface, the design system ensures that the community's content remains the primary focus. The emotional response is one of safety and calm, achieved through soft-focus elements, a refined color palette, and clear visual hierarchies.

## Colors

The palette is anchored in **Vibrant Trust Blue** to establish a sense of professional stability with a more modern, energetic edge. This is balanced by **Muted Slate Indigo**, used for secondary supportive elements and sophisticated tonal variations. **Warm Terracotta** acts as the tertiary accent for high-importance highlights.

**Neutral Tones** utilize a balanced grey-stone variant to maintain a grounded atmosphere without feeling clinical. Backgrounds utilize very light off-white or soft tints to reduce screen glare and eye strain during long reading sessions.

- **Primary (Trust):** A bright, accessible blue (#436cf5) used for main actions, headers, and active navigation states.
- **Secondary (Balance):** A desaturated indigo-slate (#6674af) reserved for supporting information and growth-oriented features.
- **Surface:** High-reflectance neutrals to create a layered, "airy" feel.

## Typography

This design system utilizes **Inter** exclusively to leverage its exceptional legibility and systematic neutral tone. The typographic scale is optimized for readability in long-form community posts and quick-fire messaging.

- **Headlines:** Use tighter letter spacing and bolder weights to create a strong visual anchor.
- **Body Text:** Set with generous line heights (1.5x+) to prevent text crowding and improve the flow of reading.
- **Labels:** Used for metadata (timestamps, tags, categories), employing a slightly heavier weight to remain legible at smaller scales.

## Layout & Spacing

The layout philosophy follows a **Fluid Grid** model with high-margin "safe zones" to emphasize the mobile-first nature of the application. 

- **Vertical Rhythm:** Built on a 4px baseline grid. Most components should use `md` (16px) or `lg` (24px) padding to maintain the "generous whitespace" requirement.
- **Mobile Layout:** A single-column flow with 20px side margins. Elements should feel uncrowded; never place more than two primary actions in a horizontal row.
- **Safe Areas:** Ensure interactive elements are at least 44px in height for touch accessibility.

## Elevation & Depth

Hierarchy is established through **Ambient Shadows** and **Tonal Layers** rather than heavy borders.

- **Level 0 (Background):** Solid off-white (#fbfaff).
- **Level 1 (Cards/Surface):** Pure white background with a very soft, diffused shadow.
- **Level 2 (Modals/Floating Actions):** White background with a deeper shadow to suggest immediate interaction.

Avoid using pure black for shadows; use a neutral grey-blue tint at low opacity to keep the depth feeling natural and "airy."

## Shapes

The shape language is defined by **Rounded** corners, specifically targeting an 8px to 16px radius for primary containers. This removes visual "sharpness" and contributes to the friendly, approachable brand personality.

- **Standard Elements (Inputs, Buttons):** 8px radius.
- **Large Elements (Cards, Modals):** 16px to 24px radius.
- **Message Bubbles:** Use 16px radius with a sharp corner on the "tail" side to indicate the speaker.

## Components

### Buttons
Primary buttons use the Vibrant Trust Blue background with white text. Use a height of 48px or 56px for main calls to action. Secondary buttons should use a soft slate tint or the secondary indigo.

### Message Bubbles
- **Incoming:** Soft neutral grey background, aligned left.
- **Outgoing:** Vibrant Trust Blue background, white text, aligned right.
- Both use 16px corner radius and contain integrated timestamps in a `label-md` style.

### Cards
Cards are the primary container for community posts. They must feature 24px internal padding and a 16px border radius. Use subtle tonal layering only when the card is placed on a matching background color.

### Input Fields
Inputs should have an 8px border radius and a 1px stroke. When focused, the stroke transitions to Primary Blue with a 3px soft outer glow.

### Media Indicators
Use rounded icons with thick, friendly strokes (2px) for photo, video, and audio. Audio messages should display a simplified waveform visualizer using the Secondary Slate Indigo color to indicate active engagement.

### Chips/Tags
Small, pill-shaped tags used for community categories. They should use high-contrast text on very low-saturation background tints.