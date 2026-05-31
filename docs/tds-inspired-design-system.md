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
- LG CI color system: https://www.lgcorp.com/about/ci/element
- LG U+ AI / ixi-O service context: https://www.lguplus.com/about/en/service/ai

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
- Brand expression: use LG RED as the primary anchor, restrained ixi-O digital purple only as a secondary accent, and keep the base UI neutral/TDS-like so the page does not become a one-color marketing screen.

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
--brand-secondary
--brand-secondary-weak
--brand-accent-warm
--brand-focus-ring
```

Current mapping:

```css
--brand-primary: #a50034; /* LG RED, based on LG CI RGB 165 0 52 */
--brand-primary-hover: #87002a;
--brand-primary-weak: #fff0f5;
--brand-primary-weak-border: #f1bad0;
--brand-secondary: #6f2cff; /* ixi-O digital accent, not an official locked value */
--brand-secondary-weak: #f4f0ff;
--brand-accent-warm: #f0406d;
--brand-focus-ring: rgba(165, 0, 52, 0.24);
```

The screenshot asset used in the showcase has also been recolored from the
earlier teal prototype accents to this LG U+ / ixi-O palette:

```text
apps/local-web/public/assets/ixi-o-agent-voice-bridge.png
apps/showcase-static/assets/ixi-o-agent-voice-bridge.png
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
If LG U+ or ixi-O supplies exact event-safe brand values, replace the token
values above and regenerate the screenshot asset from the local dashboard.
