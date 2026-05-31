# TDS-Inspired Design System Notes

ixi-O Agent applies Toss Design System ideas as product design principles, not as copied UI Kit assets.

## Source Review

- Apps in Toss TDS overview: https://developers-apps-in-toss.toss.im/design/components.html
- Apps in Toss Figma/TDS Mobile UI Kit license: https://developers-apps-in-toss.toss.im/design/prepare/figma-ui-license.html
- TDS Mobile Button: https://tossmini-docs.toss.im/tds-mobile/components/button/
- TDS Mobile Badge: https://tossmini-docs.toss.im/tds-mobile/components/badge/
- TDS Mobile ListRow: https://tossmini-docs.toss.im/tds-mobile/components/ListRow/list-row-overview/
- TDS Mobile Segmented Control: https://tossmini-docs.toss.im/tds-mobile/components/segmented-control/
- TDS Mobile Colors: https://tossmini-docs.toss.im/tds-mobile/foundation/colors/

## License Boundary

The Apps in Toss Figma/TDS Mobile UI Kit license restricts use of the UI Kit and its components outside Apps in Toss. For this project:

- Do not import, copy, modify, redraw, or redistribute Toss UI Kit components or assets.
- Use only the public docs to understand component intent and interaction patterns.
- Keep ixi-O Agent components implemented from scratch with our own class names, spacing, tokens, and markup.

## Local Interpretation

- Button hierarchy: use a strong fill button only for the primary next action, and weak buttons for navigation or secondary actions.
- Badge: keep status labels short and scannable, especially for local processing, review, masking, and handoff states.
- ListRow: represent artifacts and handoff payloads as left context, center meaning, and right status/action.
- Segmented control: use a two-option control for Enterprise and Personal modes because only one path is active at a time.
- Colors: use semantic variables first, then map brand colors to variables. Avoid hardcoded brand values inside components.

## Token Locations

Public Vercel static page:

```text
apps/showcase-static/styles.css
```

Local Next.js app and `/showcase` route:

```text
apps/local-web/src/app/styles.css
```

The main brand-editable tokens are:

```css
--brand-primary
--brand-primary-hover
--brand-primary-weak
--brand-primary-weak-border
--brand-focus-ring
```

Neutral UI tokens are intentionally separate:

```css
--color-background
--color-surface
--color-surface-muted
--color-border
--color-text
--color-text-secondary
--color-text-muted
```

This lets the final ixi-O Agent brand color change later without revisiting every component.
