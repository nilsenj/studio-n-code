# Studio N application design

Reference: [Studio N agency site](https://studio-n.work/ua), captured 2026-10-26 with Firecrawl branding and inspected through the supplied desktop screenshot and [served CSS](https://studio-n.work/assets/index-B9Wb1qDZ.css). Other viewport/animation states were not reviewed.

| Role | Extracted site value | Application use |
| --- | --- | --- |
| Typeface | Geist, --font-sans | UI and Git views; code font stays configurable |
| Ink | --cn-ink: #1a1a1a | Header, rails and panels |
| Night | --cn-night: #0b0b0c | Editor background |
| Quiet text | #a5a5a5 | Metadata |
| Light surface | #ebebeb | Primary action fill |
| Pastel | 95deg: #c7b6ff, #fff4b3 at 30%, #ffd3ee at 58%, #b7d3ff | Active tab underline and icon edge |
| CTA ring | #8b6cff to #5aa2ff | Site outline reference |
| Logo | Inline N SVG, red #ef3b45 dot | App icon and project widget |
| Pill radius | 999px on navigation/buttons | Project/branch/run controls |

The site has floating pill navigation, a large gradient headline and a blurred dark hero, followed by light cards. Its inline logo uses viewBox 392x426. Geist Latin/Cyrillic fonts and the agency mark are included with attribution. Portfolio photos are not app assets.

The desktop adaptation uses compact 48px chrome, solid dark surfaces, restrained borders and lavender focus states for legible code. The 13px UI type, dense Git rows and 16px popovers are app choices, not measured website dimensions. Syntax/status colors remain semantic. The native theme, workbench CSS, Git CSS and SVG/PNG/ICO assets share this palette.

Desktop screenshot review was declined by the user. Styling is checked through source/assets and isolated Git-view tests; pixel-perfect desktop fidelity is not claimed.
