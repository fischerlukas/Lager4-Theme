---
name: lager4-theme
description: Create and edit customizable Shopify Online Store 2.0 sections in the Lager4 theme while following its visual language, responsive layout, theme-editor, accessibility, and base-theme integration conventions. Use for Liquid, section schema, scoped CSS, JavaScript interactions, metafield content, product templates, and cart behavior in the lager4-theme repository.
---

# Lager4 Theme Development

Use this skill to create or edit Lager4 theme functionality without having to
rediscover the stable theme foundations and design rules each time.

Do not encode knowledge of sections previously created with this skill. Inspect
the section involved in the current task from the repository. Keep this skill
limited to stable theme facts and reusable construction rules.

## Start With the Repository

1. Run `git status --short` and preserve existing staged and unstaged work.
2. Find the target section and every template instance with `rg`.
3. Read the target Liquid, associated CSS and JavaScript, relevant JSON
   templates, and the base-theme component it integrates with.
4. Determine whether the request is local to one section or intentionally
   changes global theme behavior.
5. Implement the complete path: markup, schema, styles, behavior, and existing
   template settings.
6. Validate syntax and inspect both staged and unstaged diffs.

Treat current source code and theme settings as authoritative. Recheck them
when a task depends on a value that may have changed.

## Stable Theme Foundation

The repository is a Shopify Online Store 2.0 theme based on Combine 2.2.2.
Verify the version in `config/settings_schema.json` and `layout/theme.liquid`.

The current global baseline in `config/settings_data.json` is:

| Role | Value |
|---|---|
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

Use generated theme variables instead of repeating global values:

- `--theme-max-width`
- `--gutter-container`
- `--grid-gap-original-base`
- `--container-vertical-space-base`
- the font and color variables from `snippets/head-variables.liquid`

Container gutters are responsive in `assets/theme.css`. Constrained sections
should use `var(--theme-max-width)` and `var(--gutter-container)`. Full-width
mode should remove the outer constraint and gutter intentionally.

Treat local colors, radii, typography, and animation values as component
settings. Do not infer that a value used by one custom section is a global
design token.

## Section Architecture

### Own a Unique Namespace

Give each new section its own wrapper, element classes, and custom-property
prefix. Copy visual declarations when designs should match, but never borrow
another section's classes or CSS variables.

For a section named `l4-example`, use names such as:

```text
.l4-example
.l4-example__card
.l4-example__heading
--l4-example-card-radius
--l4-example-heading-padding-top
```

Per-instance variables must be declared on the same root that contains the
styled descendants. Reusing a class from another section can make its expected
variables resolve to fallbacks or fail to resolve.

Multiple components may load the same asset file, but their selectors and
variables must remain independently scoped. Prefer a dedicated asset when a
shared file would create coupling.

### Build Editor-First

Expose the main visual decisions in the section schema and bind them to
section-specific custom properties. For a major section, normally provide:

- content and visibility settings;
- full-width versus constrained layout when relevant;
- desktop top and bottom padding;
- mobile top and bottom padding;
- optional additional left and right padding;
- heading padding on all four sides;
- colors, borders, radii, and typography when merchants need control;
- behavior toggles;
- editable labels for accessibility or interaction text.

Use `20px` as the normal starting default for section top and bottom padding
and `0px` for additional side padding. Preserve intentional values already
stored in template instances.

Do not make every small CSS detail editable. Expose meaningful design choices
and keep structural implementation details in CSS.

### Bind Settings on the Section Root

Use a unique section ID and output settings as local variables:

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
```

Define safe fallback values in the component CSS as well. Root all selectors at
the unique component class, ID, or custom element to avoid leaking into
Combine components and third-party apps.

### Keep Schema Predictable

Group schema settings in this order when the groups apply:

1. data or product source;
2. content;
3. feature behavior;
4. layout and responsive spacing;
5. typography;
6. colors and shape;
7. accessibility labels.

Use blocks for repeatable content and add `block.shopify_attributes` to the
block's outer rendered element. Add a useful preset. Restrict a section with
`enabled_on` only when it should not be available on other templates.

Use plain `text` for values that should not contain markup and escape them when
rendering. Use `inline_richtext` only when formatting is intended and preserve
its `strong`, `b`, `em`, and `i` styling.

## Layout Rules

Use CSS Grid or Flexbox for section layout. Do not use floats or coordinate
separate Shopify section wrappers through template order, negative positioning,
or fragile sibling selectors.

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
padding-right: calc(var(--gutter-container) + var(--l4-example-padding-right));
padding-left: calc(var(--gutter-container) + var(--l4-example-padding-left));
```

Keep constrained and full-width behavior explicit. Verify mobile layouts with
long text, empty content, and the minimum supported viewport.

## Visual Language

Start with global theme tokens. When the requested design calls for the large
L4 information-card treatment, use this baseline in the section's own
namespace:

| Property | Baseline |
|---|---|
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

This is a reusable treatment, not a mandatory style for every card. Inspect the
requested context before applying it.

Use a semantic heading element and a section-specific heading class. Bind top,
right, bottom, and left heading padding separately. Do not use generic classes
such as `custom-heading` or `custom-tab-container` for new components.

Buttons should inherit the base theme's pill shape unless the design specifies
otherwise. Make borders and state colors editable when they are meaningful
merchant controls. Keep behavior-only changes from altering button height,
width, or layout.

For buttons whose icon appears on hover:

- center text and icon as one compact inline group;
- hide the icon before hover without reserving a large gap;
- move text slightly left and the icon slightly right;
- keep the final text-to-icon gap at or below about `20px`;
- make color feedback faster than the positional animation;
- restrict hover-only motion to `(hover: hover) and (pointer: fine)`;
- provide a clear keyboard focus state and respect reduced motion.

## Data and Liquid

Inspect a metafield's definition before comparing or formatting `.value`.
Scalar text, list text, references, files, measurements, and money values
require different handling.

For a Single line text (List), keep the value as a list:

```liquid
assign values = product.metafields.custom.example.value
assign display_value = values | join: ', '

if values contains section.settings.match_value
  # Render the matching configuration.
endif
```

Do not stringify a list with `append: ''` before comparison; it produces a
serialized representation such as `["Value"]`, which does not equal the plain
string `Value`.

Keep mappings and fallback behavior configurable when business data differs
between templates. Do not invent product handles, collection handles,
metafield keys, or fallback products. In Shopify design mode, prefer a concise
configuration diagnostic over silently rendering unrelated content.

## JavaScript and Base-Theme Integration

Inspect the existing Combine component before implementing equivalent
behavior. Reuse its public markup/state conventions while keeping new logic
scoped to the section.

For product and cart interactions, inspect:

- `assets/component-product-form.js`;
- `sections/helper-cart.liquid`;
- the cart drawer in `layout/theme.liquid`;
- the routes exposed through `window.KROWN.settings.routes`.

Use progressive enhancement and preserve a functional HTML fallback where
practical. Prevent duplicate submissions, use `try`/`catch`/`finally`, restore
loading state on every path, and render accessible inline errors.

When matching the theme's loading pattern, reuse `button--loader`,
`.button__text`, `.button__preloader`, and the `working` state. Do not change
button dimensions merely to add asynchronous behavior.

Treat prices rendered by Liquid as presentation unless the cart or checkout
platform enforces them. Configure actual discounts in Shopify or the relevant
app; never imply that crossed-out or calculated storefront prices change
checkout totals by themselves.

## Template Safety

- Search all relevant JSON templates for the section type before changing
  schema IDs or behavior.
- Preserve template-specific content, block order, metafield keys, and stored
  settings.
- Add new instance values deliberately; schema defaults cover omitted values.
- Do not reactivate or copy disabled legacy `custom-liquid` implementations.
- Prefer scoped section assets over adding more global rules to
  `assets/custom-main.css`.
- Make focused edits rather than reserializing an entire template.

Shopify JSON files may start with a comment, so plain `jq` can fail. Strip the
leading comment before parsing instead of assuming the file is invalid.

## Validation

Run checks proportional to the files changed:

```bash
git diff --check
git diff --cached --check
node --check path/to/changed-file.js
shopify theme check --path . --fail-level error --no-color
```

Parse changed JSON templates after removing Shopify's leading comment. Extract
and parse every changed section's `{% schema %}` JSON.

Distinguish new errors in touched files from pre-existing theme-check findings.
Do not claim a clean full-theme result when unrelated legacy errors remain.

For visual and behavior validation, cover the states relevant to the task:

- constrained and full-width layout;
- desktop and mobile spacing, including zero and maximum values;
- heading padding on all four sides;
- narrow viewport and long content;
- empty, missing, and unexpected data;
- mouse, keyboard, and touch interaction;
- focus visibility and reduced motion;
- loading, success, and error states;
- Shopify design mode and normal storefront mode.

Before handing off, inspect `git diff --stat`, `git diff`, and
`git diff --cached` so the report accurately separates the current task from
the user's existing work.
