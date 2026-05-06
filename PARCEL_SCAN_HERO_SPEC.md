# PermitPulse Parcel Scan Hero Animation Spec

## Purpose

Upgrade the PermitPulse landing page hero with a premium motion layer that makes the site feel more dimensional, memorable, and professional without hurting speed, readability, or mobile usability.

The animation should immediately communicate what PermitPulse does:

> One address goes in. Public record signals get scanned. A clearer permit/property picture comes out.

This should feel like civic intelligence, parcel-level research, and official-record clarity — not generic SaaS decoration.

---

## Brand Context

PermitPulse is a Los Angeles permit intelligence brand.

The site should feel:

- Dark
- Tactical
- Premium
- Editorial
- Technical
- Built for LA builders, investors, permit expeditors, remodelers, ADU operators, and serious property people

The animation should support the existing PermitPulse identity:

- Near-black background
- Blueprint blue grid and parcel linework
- Safety orange signal / scan accents
- White or cool-gray microcopy
- Subtle glow
- Serious, practical, civic-record feel

Avoid anything that feels:

- Generic SaaS
- Crypto dashboard
- Cyberpunk overload
- Sci-fi hologram
- Cheap neon
- Spinning globe
- AI blob
- Gaming HUD
- Overly busy dashboard
- Real map tile dependency
- External API dependency

---

## Primary Concept

## Parcel Scan

Create a subtle animated parcel-map / civic-grid visual that sits behind the homepage hero content.

The visual should look like an abstract public-record intelligence scan:

1. A dark parcel-grid environment is visible behind the hero.
2. Thin blueprint-blue parcel lines and lot outlines softly draw in or glow.
3. A scan pulse travels across the grid.
4. One parcel outline briefly highlights in safety orange.
5. Small professional micro-labels appear and fade.
6. A refined system confirmation appears once per loop:
   **PUBLIC RECORD SIGNAL FOUND**
7. The animation gently resets and loops.

The hero text and CTA must remain the focus.

---

## Desired User Feeling

When someone lands on the page, they should feel:

- “This looks serious.”
- “This is not another generic landing page.”
- “This product is about property records, permits, maps, and risk signals.”
- “This person/operator knows how to make messy public records feel clear.”
- “This feels premium enough to pay for.”

The animation should be impressive but restrained.

---

## Animation Details

### Background Layer

Create a near-black hero background with:

- Abstract parcel linework
- Subtle grid texture
- Irregular lot/block shapes
- Thin blueprint-blue strokes
- Very low opacity secondary lines
- Slight depth through opacity differences
- Optional faint noise/grain if already part of the site style

The grid should feel inspired by LA parcel/civic mapping, but it must not use real map tiles or imply exact parcel data.

### Scan Pulse

Add a scan pulse that moves across the background.

Preferred behavior:

- Moves left-to-right or diagonal across the parcel field
- Has a soft leading glow
- Feels like a scanner passing over official map layers
- Does not become too bright behind the text
- Loops every 10–12 seconds

The scan can be implemented as:

- Canvas gradient sweep
- WebGL plane/line effect
- CSS/canvas hybrid
- Lightweight Three.js effect only if truly justified

### Parcel Highlight

At one point in the loop:

- One parcel/lot outline becomes highlighted
- Highlight color should use safety orange
- Add a subtle glow or corner-lock effect
- Highlight should last briefly
- It should feel like the system found or matched a parcel

Avoid flashing. Avoid aggressive blinking.

### Micro-Labels

Small labels should appear and fade in a clean technical UI style.

Suggested labels:

- Parcel matched
- Permit history checked
- Zoning layer found
- Transit proximity flagged
- Risk notes detected

Label rules:

- Small
- Minimal
- Professional
- Not too many visible at once
- Positioned away from the main hero headline where possible
- Mobile-safe
- Subtle opacity
- Optional thin connector line or dot

Do not create big fake dashboard panels.

### Surprise and Delight Moment

Once per loop, after the parcel highlight, show a refined system confirmation:

**PUBLIC RECORD SIGNAL FOUND**

This should feel like a small premium permit-stamp / signal-confirmation moment.

Preferred treatment:

- Small to medium size
- Monospace or technical uppercase style if it matches the site
- Slight orange/blue accent
- Brief scale, fade, or stamp-in animation
- Should appear for less than 2 seconds
- Should not cover the primary CTA
- Should not feel like a gimmick

Optional alternate text if the first version feels too long:

- RECORD SIGNAL FOUND
- PARCEL SIGNAL FOUND
- PUBLIC RECORD MATCHED

Default preferred text:

**PUBLIC RECORD SIGNAL FOUND**

---

## Technical Requirements

### Performance

The implementation must be production-safe.

Requirements:

- Must not block first contentful paint
- Must not delay hero text rendering
- Must run smoothly on modern Android phones
- Must not create heavy CPU/GPU load
- Must pause, reduce, or simplify when offscreen if practical
- Must respect `prefers-reduced-motion`
- Must include fallback behavior if canvas/WebGL fails
- Must degrade gracefully on older devices
- Must avoid heavy dependencies unless absolutely necessary

### Implementation Preference

First inspect the current codebase.

Choose the lightest implementation that fits the existing stack.

Preferred order:

1. Lightweight canvas animation
2. CSS + canvas hybrid
3. Native WebGL only if needed
4. Three.js only if there is already a good reason or existing dependency

Do not add a large dependency just to create a simple background effect.

### Accessibility

Respect reduced motion:

```css
@media (prefers-reduced-motion: reduce) {
  /* Disable or heavily simplify animation */
}
```

If reduced motion is enabled:

- Show a static premium parcel-grid background
- No scanning pulse
- No moving labels
- No looping animation

### Fallback

If the animation cannot load:

- Show a static dark blueprint-style background
- Preserve hero readability
- Preserve layout
- Do not show broken canvases or console errors

### Mobile

Mobile is important.

Rules:

- Keep the animation subtle on small screens
- Reduce label count on mobile
- Keep labels away from the headline and CTA
- Dim background if text readability is reduced
- Avoid tiny unreadable labels cluttering the viewport
- Consider disabling some micro-labels under narrow widths
- Make sure tap targets and CTAs remain easy to use

### Layering

The animation should sit behind the hero content.

Expected structure:

- Hero section
  - Animated parcel scan layer
  - Dark readability overlay
  - Hero content layer

The hero content should have a higher z-index than the animation.

---

## Suggested Timing

Recommended full loop duration: 10–12 seconds.

Example loop:

- 0.0s: parcel grid softly visible
- 1.0s: subtle line glow begins
- 2.0s: scan pulse enters
- 3.5s: first micro-label appears
- 5.0s: selected parcel highlights
- 5.5s: second/third labels appear
- 6.5s: `PUBLIC RECORD SIGNAL FOUND` appears
- 8.0s: confirmation fades
- 9.0s: highlight fades
- 10–12s: reset smoothly

The loop should not feel abrupt.

---

## Visual Tuning Values

Use the existing site variables if available.

Suggested fallback colors:

```css
--pp-bg: #050608;
--pp-blue: #2f5bff;
--pp-blue-soft: rgba(47, 91, 255, 0.35);
--pp-orange: #ff5a1f;
--pp-orange-soft: rgba(255, 90, 31, 0.45);
--pp-text: #f5f7fb;
--pp-muted: rgba(245, 247, 251, 0.68);
```

Keep brightness restrained.

If the animation feels too loud, reduce:

- line opacity
- label opacity
- scan glow strength
- orange glow
- number of visible labels

---

## Files and Code Quality

Before implementing, inspect the current repo structure and identify:

- main landing page file
- hero component or hero markup
- global CSS file
- asset structure
- build system

Then implement cleanly.

Preferred deliverables:

- A reusable animation component or script
- Any required CSS in the correct existing stylesheet/component file
- No unnecessary package bloat
- No unrelated formatting changes
- No unrelated copy edits
- No broken routes
- No changes to analytics, Stripe, Formspree, or Worker routes unless needed

Keep comments minimal and useful.

---

## Acceptance Criteria

The implementation is successful when:

- The landing page hero immediately feels more premium
- The effect clearly reinforces PermitPulse as parcel/permit intelligence
- The animation does not overpower the offer
- The text and CTA remain readable
- It works on desktop
- It feels clean on mobile
- It respects reduced motion
- It has graceful fallback behavior
- It does not noticeably slow the page
- The `PUBLIC RECORD SIGNAL FOUND` moment feels refined, not cheesy

---

## Codex Task Prompt

Use this when starting the implementation:

```md
Read `PARCEL_SCAN_HERO_SPEC.md`.

Then inspect the current PermitPulse landing page structure and implement the Parcel Scan hero animation.

Before coding, provide a short implementation plan covering:
1. Which files you found that control the homepage hero
2. Whether you recommend canvas, CSS/canvas hybrid, native WebGL, or Three.js
3. How you will preserve mobile performance and text readability
4. How fallback and reduced-motion behavior will work

Then implement the feature.

Important:
- Keep the hero copy and CTA intact.
- Keep the animation behind the content.
- Do not introduce heavy dependencies unless absolutely necessary.
- Prefer a lightweight implementation.
- Add the refined once-per-loop confirmation: `PUBLIC RECORD SIGNAL FOUND`.
- Make the final result feel premium, serious, and restrained.
- Do not add generic SaaS visuals, AI blobs, fake dashboards, or sci-fi clutter.

After implementation, summarize:
- Files changed
- What was added
- How to tweak speed, labels, color intensity, scan brightness, and loop timing
- Any test command I should run
```

---

## Optional Polish Pass Prompt

After Codex builds the first version, run this as a second pass:

```md
Do a polish pass on the Parcel Scan hero animation.

Focus only on:
- smoother loop timing
- more refined parcel highlight behavior
- more premium micro-label styling
- cleaner `PUBLIC RECORD SIGNAL FOUND` moment
- better mobile composition
- stronger hero text readability
- lower CPU/GPU intensity if possible

Do not add clutter.
Do not add new sections.
Do not rewrite unrelated copy.
Do not introduce new dependencies unless required.

The goal is restrained premium motion design.
```

---

## Optional Performance Pass Prompt

Run this only if the animation feels heavy:

```md
Do a performance pass on the Parcel Scan hero animation.

Goals:
- reduce CPU/GPU usage
- avoid layout thrashing
- pause animation when not visible if practical
- simplify mobile animation
- preserve reduced-motion behavior
- keep the visual effect premium but lightweight

Do not change the core design concept.
Do not remove the static fallback.
```
