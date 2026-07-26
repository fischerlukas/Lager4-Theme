/**
 * The section is server-rendered by Liquid. The custom element is deliberately
 * behavior-free and exists as an isolated extension point for future features.
 * Newly rendered theme-editor sections are upgraded automatically.
 */
(() => {
  if (customElements.get("l4-discount-section")) return;

  class L4DiscountSection extends HTMLElement {}

  customElements.define("l4-discount-section", L4DiscountSection);
})();
