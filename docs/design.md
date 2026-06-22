---
name: Minimalist Dark System
colors:
  surface: '#131313'
  surface-dim: '#131313'
  surface-bright: '#393939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1c1b1b'
  surface-container: '#20201f'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353535'
  on-surface: '#e5e2e1'
  on-surface-variant: '#c4c7c9'
  inverse-surface: '#e5e2e1'
  inverse-on-surface: '#313030'
  outline: '#8e9193'
  outline-variant: '#444749'
  surface-tint: '#c4c7c9'
  primary: '#ffffff'
  on-primary: '#2d3133'
  primary-container: '#e0e3e5'
  on-primary-container: '#626567'
  inverse-primary: '#5c5f61'
  secondary: '#a4c9ff'
  on-secondary: '#00315d'
  secondary-container: '#0267b8'
  on-secondary-container: '#d6e5ff'
  tertiary: '#ffffff'
  on-tertiary: '#003731'
  tertiary-container: '#62fae3'
  on-tertiary-container: '#007165'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#e0e3e5'
  primary-fixed-dim: '#c4c7c9'
  on-primary-fixed: '#191c1e'
  on-primary-fixed-variant: '#444749'
  secondary-fixed: '#d4e3ff'
  secondary-fixed-dim: '#a4c9ff'
  on-secondary-fixed: '#001c39'
  on-secondary-fixed-variant: '#004883'
  tertiary-fixed: '#62fae3'
  tertiary-fixed-dim: '#3cddc7'
  on-tertiary-fixed: '#00201c'
  on-tertiary-fixed-variant: '#005047'
  background: '#131313'
  on-background: '#e5e2e1'
  surface-variant: '#353535'
typography:
  display:
    fontFamily: Geist
    fontSize: 48px
    fontWeight: '600'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Geist
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.2'
  headline-lg-mobile:
    fontFamily: Geist
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.2'
  headline-md:
    fontFamily: Geist
    fontSize: 24px
    fontWeight: '500'
    lineHeight: '1.3'
  body-lg:
    fontFamily: Geist
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Geist
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  label-md:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '500'
    lineHeight: '1.4'
    letterSpacing: 0.02em
  label-sm:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: '1.4'
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 8px
  container-max-width: 1280px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 40px
  stack-xs: 4px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 32px
  stack-xl: 64px
---

## Brand & Style

This design system is built on the principles of **Sophisticated Minimalism** and **Technical Precision**. It targets a professional audience that values focus, clarity, and a premium digital experience. The aesthetic avoids the harshness of pure black-and-white interfaces, opting instead for a "low-fatigue" dark mode that feels expansive and calm.

The emotional response should be one of quiet confidence. By utilizing generous whitespace (or "dark space") and a restrained color palette, the UI recedes into the background, allowing the user's content and data to remain the primary focus. The style is influenced by modern developer tools and high-end productivity software, emphasizing functional elegance over decorative flair.

## Colors

The color strategy for this design system revolves around a deep charcoal base (`#1A1A1A`), providing a softer, more professional foundation than pure black. This reduces eye strain and allows for more nuanced depth through tonal layering.

- **Primary:** A crisp, high-contrast off-white used for core typography and critical actions.
- **Secondary/Tertiary:** Soft blues and teals used sparingly for status indicators, active states, and focus rings to maintain a monochromatic feel with functional highlights.
- **Neutrals:** A strictly neutral grey scale ensures that the UI components remain subservient to the data they house. Borders and dividers use low-contrast greys to define structure without creating visual noise.

## Typography

The typography in this design system leverages **Geist** for its exceptional clarity and technical aesthetic. Its geometric yet humanist qualities provide the "professional minimalist" look required. 

- **Headlines:** Use tighter letter spacing and bold weights to create a strong visual hierarchy against the dark background.
- **Body Text:** Standardized at 16px for optimal readability. The line height is intentionally generous (1.5 - 1.6) to ensure text-heavy views don't feel claustrophobic on dark surfaces.
- **Technical Labels:** **JetBrains Mono** is introduced for small labels, metadata, and code-like elements to lean into the precise, tool-like nature of the interface.

## Layout & Spacing

This design system utilizes a **Fixed Grid** model for desktop environments to maintain tight control over information density, transitioning to a **Fluid Grid** for mobile devices. 

The layout is governed by a strict 8px rhythm. 
- **Desktop:** 12-column grid with a maximum width of 1280px. This ensures readability on ultra-wide monitors by preventing line lengths from becoming excessive.
- **Tablet:** 8-column grid with 24px gutters.
- **Mobile:** 4-column grid with 16px margins. 

Vertical rhythm is maintained through standardized "stack" variables, ensuring that the distance between sections is consistent throughout the application.

## Elevation & Depth

Depth in this design system is achieved through **Tonal Layering** rather than traditional shadows. Because the base surface is a deep charcoal (`#1A1A1A`), we communicate hierarchy by shifting the background color of containers "closer" to the light source (making them lighter).

- **Level 0 (Background):** `#121212` - The lowest plane.
- **Level 1 (Surface):** `#1A1A1A` - The primary canvas for content.
- **Level 2 (Containers/Cards):** `#262626` - Used for distinct modules or cards.
- **Level 3 (Popovers/Modals):** `#333333` - The highest visual plane.

To maintain a minimalist aesthetic, shadows are used only on Level 3 elements. They should be ultra-diffused, with 0% offset and a soft 20px blur, acting more like a subtle glow to separate the modal from the darkened background.

## Shapes

The shape language is "Soft" (0.25rem), providing just enough rounding to feel modern and approachable without losing the precision of the technical aesthetic. 

- **Small Components:** Buttons, input fields, and tags use the base `rounded` (4px).
- **Large Components:** Cards and modals use `rounded-lg` (8px) to soften the overall layout.
- **Iconography:** Icons should follow a 1.5px or 2px stroke width with slightly rounded terminals to match the component radius.

## Components

- **Buttons:** The primary button is a solid off-white (`#F8FAFC`) with dark text, creating a clear "call to power." Secondary buttons use a ghost style with a `#333333` border and a subtle hover state that lightens the background to `#262626`.
- **Input Fields:** Use a `#1A1A1A` fill with a subtle `#333333` border. On focus, the border transitions to the secondary blue (`#60A5FA`) with a 2px outer glow.
- **Cards:** Cards are defined by their background color (`#262626`) rather than a border, creating a seamless "tiled" look. 
- **Chips/Badges:** Use a "Surface Variant" background with text color inherited from the category (e.g., a Teal text for a "Success" tag).
- **Lists:** Dividers between list items should be extremely subtle—use `#262626` or `#333333` at 50% opacity to ensure the UI doesn't look "striped."
- **Checkboxes/Radios:** These components use a heavy stroke when unchecked and a solid secondary color fill when checked, ensuring high visibility on dark surfaces.
