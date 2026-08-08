---
name: lager4-theme
description: >-
  Build and maintain Shopify Online Store 2.0 sections in the Lager4 theme. Use
  for Liquid, section schemas, scoped CSS, JavaScript interactions, metafields,
  product templates, and cart behavior while preserving responsive, accessible,
  editor-friendly theme conventions.
---

# Lager4 Theme Development

Use this skill for reusable Lager4 theme conventions. Treat the repository and
saved theme settings as authoritative for every task.

Do not preserve implementation details from sections created in earlier tasks.
Inspect the current section, its assets, template instances, and related Combine
components before making changes.

## Repository-First Workflow

1. Run `git status --short` and preserve all existing staged and unstaged work.
2. Locate the target section and every template instance with `rg`.
3. Read the relevant Liquid, CSS, JavaScript, JSON templates, snippets, and
   base-theme components.
4. Decide whether the requested behavior is section-scoped or intentionally
   global.
5. Implement the complete path: markup, schema, styles, behavior, and stored
   template settings.
6. Validate changed files and inspect staged and unstaged diffs before handoff.

Recheck any repository value that might have changed. Do not treat the baseline
below as a substitute for inspecting the current source.

## Theme Foundation

The theme is based on Combine 2.2.2. Verify the installed version in
`config/settings_schema.json` and `layout/theme.liquid`.

The expected baseline in `config/settings_data.json` is:

| Role | Value |
| --- | --- |
| Heading and body font | `avenir_next_rounded_n4` |
| Base heading size / line height | `30px` / `1.3` |
| Base body size | `16px` |
| Global accent | `#f25a38` |
| Secondary background | `#f2f2f2` |
| Header and card background | `#ffffff` |
| Main text | `#000000` |
| Theme maximum width | `2000px` |
| Base section vertical space | `140px` |
| Base grid gap | `32px` |
| Form border / radius | `3px` / `30px` |
| Button border / radius | `1px` / `30px` |
| Cart action | `overlay` |

Prefer generated theme variables over repeated global values:

- `--theme-max-width`
- `--gutter-container`
- `--grid-gap-original-base`
- `--container-vertical-space-base`
- font and color variables from `snippets/head-variables.liquid`

Constrained sections should use `var(--theme-max-width)` and
`var(--gutter-container)`. Full-width sections should remove the outer width
constraint and gutter deliberately.

Treat component colors, radii, typography, and animation values as local unless
the repository explicitly defines them as global tokens.

## Section Architecture

### Use an Independent Namespace

Give every section a unique root class, element namespace, and custom-property
prefix. Copy declarations when designs should match, but do not reuse another
section's selectors or custom properties.

For `l4-example`, use names such as:

```text
.l4-example
.l4-example__card
.l4-example__heading
--l4-example-card-radius
--l4-example-heading-padding-top
```

Declare per-instance custom properties on the root that contains the affected
elements. Root every selector at the section class, section ID, or a dedicated
custom element.

Components may share an asset only when the asset does not couple their
selectors, variables, or behavior. Otherwise, use a dedicated asset.

### Design for the Theme Editor

Expose meaningful merchant decisions, not every implementation detail. A major
section normally includes:

- content and visibility controls;
- constrained or full-width layout when relevant;
- desktop and mobile vertical spacing;
- optional additional horizontal spacing;
- heading spacing on all four sides when required by the design;
- relevant colors, borders, radii, and typography;
- behavior toggles;
- editable accessibility and interaction labels.

Use `20px` as the normal starting default for top and bottom spacing and `0px`
for additional side spacing. Preserve intentional values already stored in
JSON templates.

Use range, select, checkbox, color, URL, product, collection, and other typed
settings whenever they constrain values more safely than free-form text.

### Bind Settings on the Section Root

Use a unique ID and section-scoped variables. Keep the example complete so it
can be copied safely:

```liquid
<section
  id="L4Example-{{ section.id }}"
  class="l4-example"
  style="
    --l4-example-padding-top-mobile: {{ section.settings.padding_top_mobile }}px;
    --l4-example-padding-bottom-mobile: {{ section.settings.padding_bottom_mobile }}px;
    --l4-example-padding-top-desktop: {{ section.settings.padding_top }}px;
    --l4-example-padding-bottom-desktop: {{ section.settings.padding_bottom }}px;
    --l4-example-heading-padding-top: {{ section.settings.heading_padding_top }}px;
    --l4-example-heading-padding-right: {{ section.settings.heading_padding_right }}px;
    --l4-example-heading-padding-bottom: {{ section.settings.heading_padding_bottom }}px;
    --l4-example-heading-padding-left: {{ section.settings.heading_padding_left }}px;
  "
>
  <!-- Section content -->
</section>
```

Define safe CSS fallbacks for every custom property. Only interpolate values
from schema types that constrain the resulting CSS.

### Keep Schema Predictable

Group settings in this order when applicable:

1. data or product source;
2. content;
3. feature behavior;
4. layout and responsive spacing;
5. typography;
6. colors and shape;
7. accessibility labels.

Use blocks for repeatable content and include
`{{ block.shopify_attributes }}` on each block's outer rendered element. Add a
useful preset. Use `enabled_on` only when the section must be restricted to
specific template groups.

Use `text` for plain values and escape them when rendering. Use
`inline_richtext` only when formatting is intended; render it as rich text
rather than escaping its markup.

## Layout and Responsive Behavior

Use CSS Grid or Flexbox. Do not coordinate separate Shopify sections through
DOM order, negative positioning, floats, or fragile sibling selectors.

For two equal cards owned by one section:

```css
.l4-example__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 50px;
}

.l4-example__card {
  min-width: 0;
}

@media (max-width: 1050px) {
  .l4-example__grid {
    grid-template-columns: minmax(0, 1fr);
    gap: 40px;
  }
}
```

Apply constrained side spacing with the theme gutter plus the editor value:

```css
padding-inline: calc(
  var(--gutter-container) + var(--l4-example-padding-inline, 0px)
);
```

If separate left and right controls are required, bind and apply them
individually instead of using `padding-inline`.

Test constrained and full-width modes with long text, empty content, and the
minimum supported viewport.

## Visual Language

Start with the global theme tokens. When the requested design calls for the
large Lager4 information-card treatment, use this local baseline:

| Property | Baseline |
| --- | --- |
| Background | `#ffffff` |
| Border | `0 solid transparent` |
| Radius | `50px` |
| Shadow | `0 0 30px -10px rgb(0 0 0 / 30%)` |
| Mobile padding | `24px` |
| Desktop padding | `32px` |
| Content gap | `24px` |
| Heading color | `#1c1f24` |
| Heading size | `26px` |
| Heading weight | `200` |
| Heading line height | `1.375` |
| Heading alignment | `center` |

This treatment is optional, not a global requirement.

Use semantic heading elements and section-specific heading classes. Avoid
generic names such as `custom-heading` and `custom-tab-container`.

Buttons should inherit the base theme's pill geometry unless the design
requires otherwise. Keep behavior-only changes from shifting button dimensions
or surrounding layout.

For hover-revealed button icons:

- keep the label and icon in one compact inline group;
- avoid reserving a large empty gap before hover;
- restrict hover-only motion to `(hover: hover) and (pointer: fine)`;
- provide a visible keyboard focus state;
- disable nonessential motion under `prefers-reduced-motion: reduce`.

## Liquid and Data

Inspect a metafield's definition before reading, comparing, or formatting its
`.value`. Text, list, reference, file, measurement, and money values require
different handling.

For a list of single-line text values, preserve the list type:

```liquid
{% liquid
  assign values = product.metafields.custom.example.value
  assign display_value = values | join: ', '
%}

{% if values contains section.settings.match_value %}
  <!-- Render the matching configuration. -->
{% endif %}
```

Do not stringify a list with `append: ''` before comparison. That creates a
serialized representation rather than a plain string value.

Keep mappings and fallbacks configurable when business data differs between
templates. Do not invent product handles, collection handles, metafield keys,
or fallback products. In Shopify design mode, prefer a concise configuration
message over unrelated fallback content.

## JavaScript and Theme Integration

Inspect the existing Combine component before implementing similar behavior.
Reuse public markup and state conventions while keeping new logic scoped to the
section.

For product and cart interactions, inspect:

- `assets/component-product-form.js`;
- `sections/helper-cart.liquid`;
- the cart drawer integration in `layout/theme.liquid`;
- routes exposed through `window.KROWN.settings.routes`.

Use progressive enhancement and preserve a functional HTML fallback where
practical. Prevent duplicate submissions, handle rejected requests, restore
loading state on every exit path, and render accessible inline errors.

When matching the theme's loading pattern, reuse `button--loader`,
`.button__text`, `.button__preloader`, and the `working` state. Do not resize a
button solely to support asynchronous behavior.

Liquid-rendered prices are presentational unless Shopify or an installed app
enforces the price at cart or checkout. Do not imply that a crossed-out or
calculated storefront price changes the checkout total.

## Template Safety

- Search all relevant JSON templates before changing a section type, schema ID,
  or behavior.
- Preserve template-specific content, block order, metafield keys, and stored
  settings.
- Add new instance values only when a template needs an explicit override;
  otherwise rely on schema defaults.
- Do not reactivate or copy disabled legacy `custom-liquid` implementations.
- Prefer section-scoped assets over new global rules in
  `assets/custom-main.css`.
- Make focused edits instead of reserializing entire JSON templates.

Shopify JSON templates can contain a leading comment. Remove that comment in a
temporary parsing step rather than treating the file as invalid or rewriting
it wholesale.

## Validation

Run checks appropriate to the changed files:

```bash
git diff --check
git diff --cached --check
node --check path/to/changed-file.js
shopify theme check --path . --no-color
```

Run `node --check` only for changed JavaScript files. Use the repository's
Theme Check configuration and review every reported finding instead of hiding
or suppressing warnings globally.

Also:

- parse changed JSON templates after removing any Shopify leading comment;
- extract and parse every changed section's `{% schema %}` JSON;
- distinguish findings in touched files from unrelated pre-existing findings;
- do not claim a clean full-theme result when legacy findings remain.

Validate the states relevant to the task:

- constrained and full-width layout;
- desktop and mobile spacing, including minimum and maximum values;
- narrow viewports, long text, and empty content;
- missing and unexpected data;
- mouse, keyboard, and touch interaction;
- focus visibility and reduced motion;
- loading, success, and error states;
- Shopify design mode and the normal storefront.

Before handoff, inspect `git diff --stat`, `git diff`, and `git diff --cached`.
Report only the changes and validation results attributable to the current task.
