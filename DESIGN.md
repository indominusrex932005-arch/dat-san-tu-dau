---
name: Sân Thể Thao
description: A restrained sports-booking interface built around deep forest ink, warm paper surfaces, and clear availability states.
colors:
  forest-ink: "#173f35"
  forest-green: "#2f6b57"
  deep-footer: "#0b3528"
  gold-selected: "#d9a520"
  brick-warning: "#b84a32"
  lime-accent: "#c7ed71"
  warm-canvas: "#f5f7ef"
  home-canvas: "#f7f8f2"
  surface: "#ffffff"
  soft-surface: "#edf2e7"
  line: "#d7dfd2"
  muted-ink: "#52675d"
  error-text: "#812424"
  error-surface: "#fff1ed"
typography:
  display:
    fontFamily: "Manrope, Segoe UI, Arial, sans-serif"
    fontSize: "clamp(42px, 5vw, 72px)"
    fontWeight: 800
    lineHeight: 1.02
    letterSpacing: "-0.055em"
  headline:
    fontFamily: "Manrope, Segoe UI, Arial, sans-serif"
    fontSize: "clamp(38px, 4vw, 54px)"
    fontWeight: 400
    lineHeight: 1.18
    letterSpacing: "-0.035em"
  title:
    fontFamily: "Manrope, Segoe UI, Arial, sans-serif"
    fontSize: "23px"
    fontWeight: 800
    lineHeight: 1.35
    letterSpacing: "-0.035em"
  body:
    fontFamily: "Manrope, Segoe UI, Arial, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.8
  label:
    fontFamily: "Manrope, Segoe UI, Arial, sans-serif"
    fontSize: "12px"
    fontWeight: 700
    lineHeight: 1.5
    letterSpacing: "0.08em"
rounded:
  sm: "6px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  card: "18px"
  pill: "999px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  section: "64px"
components:
  button-primary:
    backgroundColor: "{colors.forest-ink}"
    textColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "12px 16px"
    height: "48px"
  button-secondary:
    backgroundColor: "{colors.soft-surface}"
    textColor: "{colors.forest-ink}"
    rounded: "{rounded.md}"
    padding: "9px 14px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.forest-ink}"
    rounded: "{rounded.md}"
    height: "42px"
    padding: "0 12px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.forest-ink}"
    rounded: "{rounded.card}"
    padding: "24px"
---

# Design System: Sân Thể Thao

## Overview

**Creative North Star: "The Forest Operations Board"**

Sân Thể Thao is a quiet, dependable booking surface: warm paper backgrounds, deep forest typography, thin green-gray rules, and compact information blocks that make venue, date, time, price, and booking state easy to scan. The interface is professional and restrained rather than decorative; its strongest visual move is the contrast between a calm canvas and confident forest actions.

The shipped implementation uses Manrope throughout the visible system, with tabular numerals for money and time. Rounded cards and small shadows soften the operational density, while gold marks selection and important time states, muted green marks availability, and brick/red treatments communicate warnings and errors. The home page introduces the task with a split booking/search hero; courts and booking views continue the same vocabulary with filters, cards, slot grids, and a sticky summary.

**Key Characteristics:**
- Forest-ink actions and headings on warm, low-chroma surfaces.
- Editorial labels, clear numeric hierarchy, and 30-minute timetable states.
- Moderate rounded geometry with thin borders; depth is tonal and lightly shadowed.
- Vietnamese-first content with keyboard-visible focus and skip links.

**Provenance:** Derived from the shipped implementation in `views/home.ejs`, `views/courts.ejs`, `views/court-detail.ejs`, `public/css/design-system.css`, `public/css/home.css`, `public/css/courts.css`, `public/css/booking.css`, and incumbent `public/css/app.css`, `public/css/demo.css`, `public/css/media.css`, and `public/css/groups.css`. Surface brief: `.impeccable/surfaces/views-home-ejs.md` (version 1, seed reference `seed:501ae3719bb0b6cd`), checked against `PRODUCT.md`.

## Colors

The palette is a forest-and-paper system. Forest ink carries identity and primary actions; warm whites and pale greens keep dense booking information legible; gold is reserved for selected or important time states; brick red is reserved for warnings and errors.

### Primary
- **Forest Ink** (`#173f35`): Headings, navigation, primary buttons, selected controls, links, and the main booking action.
- **Forest Green** (`#2f6b57`): Hover state for primary actions and secondary depth within the green family.

### Secondary
- **Selected Gold** (`#d9a520`): Selected availability cells and selected booking slots; it is a state color, not a general decoration.
- **Lime Accent** (`#c7ed71`): Footer/brand accent and high-contrast accent on deep green surfaces.

### Tertiary
- **Brick Warning** (`#b84a32`): Product warning token; warnings in the shipped views also use the darker readable error text below.
- **Muted Moss** (`#8b9d4b`): Focus and small status accents in the home/courts surfaces.

### Neutral
- **Warm Canvas** (`#f5f7ef`): Global page canvas.
- **Home Canvas** (`#f7f8f2`): Home and courts surface background.
- **Surface White** (`#ffffff`): Cards, fields, and form interiors.
- **Soft Green Surface** (`#edf2e7`): Secondary controls, badges, and low-emphasis panels.
- **Structural Line** (`#d7dfd2`): Rules, card borders, dividers, and navigation boundaries.
- **Muted Ink** (`#52675d`): Supporting copy, labels, addresses, and help text.
- **Error Text / Surface** (`#812424` / `#fff1ed`): Form and filter error messaging.

### Named Rules
**The State-Color Rule.** Gold means selected or important; green means available or actionable; red/brick means a warning or failure. Do not use these colors as arbitrary decoration.

## Typography

**Display Font:** Manrope (with `Segoe UI`, Arial, sans-serif fallback)  
**Body Font:** Manrope (with `Segoe UI`, Arial, sans-serif fallback)  
**Label/Mono Font:** Manrope; time and price values additionally use tabular numerals.

**Character:** Manrope is compact, contemporary, and highly legible in Vietnamese. Heavy display weight and tight tracking establish confidence, while muted labels and generous line-height keep operational copy calm.

### Hierarchy
- **Display** (800, `clamp(42px, 5vw, 72px)`, 1.02): Home hero title, capped around 15 characters per line.
- **Headline** (400, `clamp(38px, 4vw, 54px)`, 1.18): Courts and major page introductions.
- **Title** (800, 22–23px, 1.35): Facility/court names and section titles.
- **Body** (400, 15–16px, 1.8–1.9): Descriptions, addresses, and explanatory copy.
- **Label** (700–800, 10–13px, uppercase with roughly 0.04–0.12em tracking): Eyebrows, field labels, tags, and status metadata.

### Named Rules
**The Numeric-Clarity Rule.** Prices, hours, slot times, and booking codes use tabular numerals so columns and totals scan cleanly.

## Layout

The primary container is centered and capped at 1184px, generally using `calc(100% - 48px)` or the home/courts `calc(100% - 80px)` width. Desktop home uses a two-column hero with roughly 1.1fr/1fr proportions and a 72px gap; the courts view uses a three-column card grid, collapsing to two columns below 1050px and one column below 700px. Booking uses a 1.8fr timetable / 1fr summary split and collapses to one column below 850px, with the summary losing its sticky position.

The rhythm is built from 8px increments, with 20–28px card interiors, 36–72px section breathing room, and 1px structural rules. Mobile surfaces reduce the shell to about 16–20px side gutters, stack forms and navigation, use two-column slot grids where space allows, and turn footer/navigation groups into vertical flows. Home booking fields stack below 700px; court filters stack below 768px.

## Elevation & Depth

Depth is a restrained hybrid: thin borders and pale tonal fills do most of the structural work, with low-opacity forest shadows used on cards, search panels, hero availability, and hover states. The shared vocabulary is `0 8px 24px rgba(23, 63, 53, .06)` at rest and `0 14px 34px rgba(23, 63, 53, .10)` for shared hover depth; feature surfaces use stronger but still diffuse shadows such as the home availability panel's `0 18px 44px rgba(23, 63, 53, .16)`.

### Named Rules
**The Soft-Lift Rule.** Shadows should clarify a card, search panel, or sticky summary's separation from the canvas; they should never become a hard outline or a decorative glow.

## Shapes

The shipped form language is gently rounded rather than geometric: 6–8px for fields and compact controls, 11–12px for buttons, 16–20px for cards, and pill geometry for counts, tags, and reset controls. Cards are bordered and clipped for image covers; the home availability panel is a dark rounded rectangle, while the home visual treatment uses a distinctive tall arch silhouette. Focus rings are external, high-contrast, and offset from the control.

## Components

### Buttons
- **Shape:** Compact rounded rectangles, normally 8–12px radius.
- **Primary:** Forest-ink fill with white text, 48–54px minimum height, bold Manrope, and 12–16px vertical padding.
- **Hover / Focus:** Hover shifts to forest green; focus-visible uses a 3px high-contrast outline with an offset; active buttons move down 1px where implemented.
- **Secondary / Ghost:** Pale green fill or white surface with a green border and forest text; reset actions use pill geometry.

### Chips
- **Style:** Pale green or pale gold fill with small borders, 6–10px radius for selected booking chips, and pill geometry for count/status chips.
- **State:** Selected time chips use gold; availability badges and low-emphasis metadata stay green-gray.

### Cards / Containers
- **Corner Style:** 16–20px for content cards; 18px is the shared system default.
- **Background:** White on the warm canvas, with pale green panels for counts, notices, and secondary information.
- **Shadow Strategy:** Low diffuse shadow at rest; stronger shadow and a slight lift on hover for facility/court cards.
- **Border:** 1px structural green-gray line; dashed lines indicate empty states or upload affordances.
- **Internal Padding:** 20–28px for cards, 24px as the common content-card value.

### Inputs / Fields
- **Style:** White field, 1px muted-green border, 7–10px radius, inherited Manrope, and 42–48px height depending on surface.
- **Focus:** Forest border or a forest-tinted 3px focus halo; all interactive fields retain a visible keyboard focus.
- **Error / Disabled:** Error panels use pale red with dark red text; disabled slots are muted, non-interactive, and visually differentiated by status fill and cursor.

### Navigation
- **Style:** Centered, flex-wrapped navigation with a bottom rule and compact green text. The brand is bold with a forest mark; active page links use a bottom underline or stronger forest color.
- **Mobile:** Navigation wraps into a full-width row below the brand, with smaller type and reduced gaps rather than hiding core routes.

### Availability Grid
- **Style:** Tabular 30-minute cells in a four-column home preview or responsive booking grid. Cells use a 1px separation, tabular numerals, and strong status contrast.
- **State:** Available is light green/white, selected is gold, held is muted and struck through, booked is pale green and locked, and unavailable is gray and disabled.

## Do's and Don'ts

### Do:
- **Do** keep primary actions, headings, and navigation in Forest Ink and reserve Gold for a real selection or important time state.
- **Do** preserve the booking vocabulary: 30-minute cells, explicit date/time labels, prices, and visible status legends.
- **Do** use thin borders, moderate radii, and low diffuse shadows to organize dense operational information.
- **Do** keep focus-visible outlines, skip links, semantic labels, `aria-live` summaries, and `role="alert"` error surfaces intact.
- **Do** honor the Vietnamese-first product language and the server-backed truth of availability and pricing.

### Don't:
- **Don't** introduce a second display family or a decorative type treatment; the visible system is Manrope-led.
- **Don't** use gold, lime, or brick as general decoration; they communicate state and priority.
- **Don't** replace the timetable and filter hierarchy with nested ornamental cards or hidden status meanings.
- **Don't** remove the reduced-motion behavior, print simplification, or keyboard focus treatment.
- **Don't** canonize the unused Playfair stylesheet links or the brief's flatter “no nested cards” aspiration over the rounded, lightly elevated implementation that actually shipped.
