/* ==========================================================================
   Shelf Filter — vanilla custom element (<shelf-filter>)
   --------------------------------------------------------------------------
   Progressive enhancement layer over native form controls. It manages:
     - single-select-with-deselect for every filter group
     - the custom dropdowns (open/close, keyboard-free click model)
     - the sort dropdown (desktop + mobile, kept in sync)
     - the mobile bottom sheet (open/close + body scroll lock)
     - active-filter chips, "clear all", and the product count
     - the decorative "Made in Europe" star ring

   Shopify integration:
     Every selection is mirrored onto real <input type="radio"> controls and a
     bubbling `input` event is dispatched on the owning <form>. When this
     section lives inside the theme's <facet-filters-form> element, its
     debounced submit handler (assets/facet.js) picks the event up and
     re-renders the product grid + counts from the server. No extra glue code
     is required.
   ========================================================================== */

(function () {
  "use strict";

  /** Fallback chip-display order, used only when groups can't be read from the
      DOM. In practice the order is derived from the rendered inputs so it
      matches whatever Liquid emits from `collection.filters`. */
  const FALLBACK_GROUP_ORDER = ["laenge", "breite", "hoehe", "tiefe", "ebenen", "belastung", "auflage"];

  /** Default (German) count templates, overridable via attributes so the
      Liquid section can pass localized strings. `[count]`/`[total]` are
      substituted at render time. */
  const DEFAULT_COUNT_TPL = "[count] von [total] Produkten werden angezeigt";
  const DEFAULT_COUNT_TPL_ALL = "[count] Produkte werden angezeigt";

  const X_ICON =
    '<svg class="sf-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';

  class ShelfFilter extends HTMLElement {
    connectedCallback() {
      // Discover filter groups from the rendered controls so the element works
      // with whatever filters Liquid emits (no hard-coded param names needed).
      this.groups = this._collectGroups();

      // Central state: one selected value (or null) per group, hydrated from
      // any server-rendered `checked` inputs (so URL-applied filters persist).
      this.state = Object.create(null);
      this.groups.forEach((g) => {
        const checked = this.querySelector('[data-sf-input][data-sf-group="' + g + '"]:checked');
        this.state[g] = checked ? checked.value : null;
      });

      // Hydrate the sort value from the checked sort input, if any.
      const checkedSort = this.querySelector("[data-sf-sort-input]:checked");
      this.sortValue = checkedSort ? checkedSort.value : "Ausgewählt";
      this.sortLabel = checkedSort
        ? checkedSort.getAttribute("data-sf-sort-label") || checkedSort.value
        : this.sortValue;

      this.total = parseInt(this.getAttribute("data-total-products") || "0", 10) || 0;
      this.countMode = this.getAttribute("data-count-mode") || "optimistic";
      this.countTpl = this.getAttribute("data-count-template") || DEFAULT_COUNT_TPL;
      this.countTplAll = this.getAttribute("data-count-template-all") || DEFAULT_COUNT_TPL_ALL;

      this._onClick = this._onClick.bind(this);
      this._onDocClick = this._onDocClick.bind(this);
      this._onKeydown = this._onKeydown.bind(this);

      this.addEventListener("click", this._onClick);
      document.addEventListener("click", this._onDocClick);
      document.addEventListener("keydown", this._onKeydown);

      this._buildStarRing();
      this.render();
    }

    /** Unique `data-sf-group` values in DOM order. */
    _collectGroups() {
      const seen = [];
      this.querySelectorAll("[data-sf-input]").forEach((input) => {
        const g = input.getAttribute("data-sf-group");
        if (g && seen.indexOf(g) === -1) seen.push(g);
      });
      return seen.length ? seen : FALLBACK_GROUP_ORDER.slice();
    }

    disconnectedCallback() {
      document.removeEventListener("click", this._onDocClick);
      document.removeEventListener("keydown", this._onKeydown);
      document.body.style.removeProperty("overflow");
    }

    /* ----------------------------------------------------------------- */
    /* Event handling                                                    */
    /* ----------------------------------------------------------------- */

    _onClick(event) {
      const target = event.target;

      // Mobile sheet open / close
      if (target.closest("[data-sf-sheet-open]")) {
        this._openSheet();
        return;
      }
      if (target.closest("[data-sf-sheet-close]")) {
        this._closeSheet();
        return;
      }

      // Clear all active filters
      const clearBtn = target.closest("[data-sf-clear]");
      if (clearBtn) {
        event.preventDefault();
        // The desktop clear link sits outside any <form>, so fall back to the
        // main filter form to ensure the grid re-renders.
        const form =
          clearBtn.closest("form") ||
          this.querySelector("#FacetFiltersForm") ||
          this.querySelector("form");
        this._clearAll(form);
        return;
      }

      // Remove a single active filter (chip)
      const removeBtn = target.closest("[data-sf-remove]");
      if (removeBtn) {
        event.preventDefault();
        const group = removeBtn.getAttribute("data-sf-remove");
        this.state[group] = null;
        this.render();
        // Desktop chips live in the below-card summary, outside any <form>, so
        // fall back to the main filter form to make sure the grid re-renders.
        const form =
          removeBtn.closest("form") ||
          this.querySelector("#FacetFiltersForm") ||
          this.querySelector("form");
        this._emit(form);
        return;
      }

      // Dropdown trigger
      const ddTrigger = target.closest("[data-sf-dropdown-trigger]");
      if (ddTrigger) {
        this._toggleDropdown(ddTrigger.closest("[data-sf-dropdown]"));
        return;
      }

      // Sort trigger
      const sortTrigger = target.closest("[data-sf-sort-trigger]");
      if (sortTrigger) {
        this._toggleSort(sortTrigger.closest(".sf-sort"));
        return;
      }

      // Sort option
      const sortOption = target.closest(".sf-option");
      if (sortOption && sortOption.querySelector("[data-sf-sort-input]")) {
        event.preventDefault();
        const input = sortOption.querySelector("[data-sf-sort-input]");
        this.sortValue = input.value;
        this.sortLabel = input.getAttribute("data-sf-sort-label") || input.value;
        this._closeAll();
        this.render();
        this._emit(sortOption.closest("form"));
        return;
      }

      // Filter control (load pill, dropdown option, surface card)
      const control = target.closest(".sf-load, .sf-option, .sf-surface");
      if (control) {
        const input = control.querySelector("[data-sf-input]");
        if (!input) return;
        event.preventDefault();
        const group = input.getAttribute("data-sf-group");
        const value = input.value;
        this.state[group] = this.state[group] === value ? null : value;
        // Selecting from a dropdown closes the menu.
        if (control.classList.contains("sf-option")) {
          this._closeAll();
        }
        this.render();
        this._emit(control.closest("form"));
      }
    }

    _onDocClick(event) {
      // Close any open menu when clicking outside of its wrapper.
      this.querySelectorAll("[data-sf-dropdown]").forEach((wrap) => {
        if (!wrap.contains(event.target)) this._setDropdown(wrap, false);
      });
      this.querySelectorAll(".sf-sort").forEach((wrap) => {
        if (!wrap.contains(event.target)) this._setSort(wrap, false);
      });
    }

    _onKeydown(event) {
      if (event.key === "Escape") {
        this._closeAll();
        if (this.querySelector("[data-sf-sheet].is-open")) this._closeSheet();
      }
    }

    /* ----------------------------------------------------------------- */
    /* Dropdowns                                                         */
    /* ----------------------------------------------------------------- */

    _toggleDropdown(wrap) {
      const isOpen = wrap.querySelector("[data-sf-dropdown-trigger]").getAttribute("aria-expanded") === "true";
      this._closeAll();
      this._setDropdown(wrap, !isOpen);
    }

    _setDropdown(wrap, open) {
      const trigger = wrap.querySelector("[data-sf-dropdown-trigger]");
      const menu = wrap.querySelector("[data-sf-dropdown-menu]");
      trigger.setAttribute("aria-expanded", open ? "true" : "false");
      menu.hidden = !open;
      if (open) this._initDropdownFade(menu);
    }

    /** Toggle the bottom fade hint based on whether the option list can still
        scroll down. Bound once per list; recomputed each time it opens. */
    _initDropdownFade(menu) {
      const list = menu.querySelector(".sf-select__list");
      if (!list) return;
      const update = () => {
        const overflow = list.scrollHeight - list.clientHeight > 1;
        const atBottom = list.scrollTop + list.clientHeight >= list.scrollHeight - 1;
        menu.classList.toggle("is-scrollable", overflow && !atBottom);
      };
      if (!list._sfFadeBound) {
        list.addEventListener("scroll", update);
        list._sfFadeBound = true;
      }
      update();
    }

    _toggleSort(wrap) {
      const isOpen = wrap.querySelector("[data-sf-sort-trigger]").getAttribute("aria-expanded") === "true";
      this._closeAll();
      this._setSort(wrap, !isOpen);
    }

    _setSort(wrap, open) {
      const trigger = wrap.querySelector("[data-sf-sort-trigger]");
      const menu = wrap.querySelector("[data-sf-sort-menu]");
      trigger.setAttribute("aria-expanded", open ? "true" : "false");
      menu.hidden = !open;
    }

    _closeAll() {
      this.querySelectorAll("[data-sf-dropdown]").forEach((w) => this._setDropdown(w, false));
      this.querySelectorAll(".sf-sort").forEach((w) => this._setSort(w, false));
    }

    /* ----------------------------------------------------------------- */
    /* Mobile sheet                                                      */
    /* ----------------------------------------------------------------- */

    _openSheet() {
      const sheet = this.querySelector("[data-sf-sheet]");
      if (!sheet) return;
      sheet.classList.add("is-open");
      sheet.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
    }

    _closeSheet() {
      const sheet = this.querySelector("[data-sf-sheet]");
      if (!sheet) return;
      sheet.classList.remove("is-open");
      sheet.setAttribute("aria-hidden", "true");
      document.body.style.removeProperty("overflow");
    }

    /* ----------------------------------------------------------------- */
    /* Mutations                                                         */
    /* ----------------------------------------------------------------- */

    _clearAll(form) {
      this.groups.forEach((g) => (this.state[g] = null));
      this.render();
      this._emit(form);
    }

    /**
     * Dispatch a bubbling `input` event so a wrapping <facet-filters-form>
     * (Shopify theme) re-renders the product grid. Harmless when standalone.
     */
    _emit(form) {
      if (!form) return;
      form.dispatchEvent(new Event("input", { bubbles: true }));
      // The grid is re-rendered by the theme, but this section (and its count)
      // is not, so refresh the server-rendered count separately.
      this._scheduleCountRefresh();
    }

    /**
     * In `server` count mode the "X von Y Produkten" text is rendered by
     * Liquid. Since the theme only re-renders the product-grid section, fetch
     * this section with the current filter params and copy the fresh count.
     */
    _scheduleCountRefresh() {
      if (this.countMode !== "server") return;
      clearTimeout(this._countTimer);
      this._countTimer = setTimeout(() => this._refreshCount(), 550);
    }

    _refreshCount() {
      const sectionId = this.getAttribute("data-section-id");
      const mainForm = this.querySelector("#FacetFiltersForm");
      if (!sectionId || !mainForm) return;
      const params = new URLSearchParams(new FormData(mainForm)).toString();
      const url = window.location.pathname + "?section_id=" + encodeURIComponent(sectionId) + "&" + params;
      fetch(url)
        .then((r) => r.text())
        .then((html) => {
          const doc = new DOMParser().parseFromString(html, "text/html");
          const newFull = doc.querySelector("[data-sf-count-full]");
          this.querySelectorAll("[data-sf-count-full]").forEach((el) => {
            if (!newFull) return;
            el.textContent = newFull.textContent.trim();
            el.hidden = newFull.hasAttribute("hidden");
          });
          const newCount = doc.querySelector("[data-sf-count]");
          this.querySelectorAll("[data-sf-count]").forEach((el) => {
            if (newCount) el.textContent = newCount.textContent.trim();
          });
        })
        .catch(() => {});
    }

    /* ----------------------------------------------------------------- */
    /* Rendering (idempotent: derives the whole UI from state)           */
    /* ----------------------------------------------------------------- */

    render() {
      // 1. Sync every filter input + its label's active state.
      this.querySelectorAll("[data-sf-input]").forEach((input) => {
        const group = input.getAttribute("data-sf-group");
        const selected = this.state[group] === input.value;
        input.checked = selected;
        const label = input.closest(".sf-load, .sf-option, .sf-surface");
        if (label) {
          const cls = label.classList.contains("sf-option") ? "is-selected" : "is-active";
          label.classList.toggle(cls, selected);
        }
      });

      // 2. Update dropdown trigger labels.
      this.querySelectorAll("[data-sf-dropdown]").forEach((wrap) => {
        const input = wrap.querySelector("[data-sf-input]");
        if (!input) return;
        const group = input.getAttribute("data-sf-group");
        const value = this.state[group];
        const valueEl = wrap.querySelector("[data-sf-value]");
        const trigger = wrap.querySelector("[data-sf-dropdown-trigger]");
        // Show the human-readable option label, not the raw filter value
        // (which can be an opaque id such as "gid://shopify/...").
        const selected = value ? wrap.querySelector("[data-sf-input]:checked") : null;
        valueEl.textContent = selected
          ? this._controlLabel(selected) || selected.value
          : valueEl.getAttribute("data-placeholder");
        trigger.classList.toggle("is-filled", Boolean(value));
      });

      // 3. Sync sort dropdowns (desktop + mobile share one value).
      this.querySelectorAll("[data-sf-sort-value]").forEach((el) => {
        el.textContent = this.sortLabel;
      });
      this.querySelectorAll("[data-sf-sort-input]").forEach((input) => {
        const selected = input.value === this.sortValue;
        input.checked = selected;
        const option = input.closest(".sf-option");
        if (option) option.classList.toggle("is-selected", selected);
      });

      // 4. Active filters + count + visibility.
      const active = this._activeFilters();
      this._renderChips(active);
      this._renderCount(active.length);
      this._renderVisibility(active.length);
    }

    _activeFilters() {
      return this.groups
        .filter((g) => this.state[g])
        .map((g) => {
          const value = this.state[g];
          const input = this.querySelector('[data-sf-input][data-sf-group="' + g + '"]:checked');
          const label =
            (input && (input.getAttribute("data-sf-chip") || this._controlLabel(input))) || value;
          return { group: g, label: label };
        });
    }

    /** Human-readable label for a filter control, read from its rendered text
        so opaque filter values (e.g. "gid://shopify/...") are never shown. */
    _controlLabel(input) {
      const ctrl = input.closest(".sf-load, .sf-option, .sf-surface");
      if (!ctrl) return null;
      const el =
        ctrl.querySelector(".sf-load__text, .sf-surface__label") ||
        ctrl.querySelector("span:last-of-type");
      return el ? el.textContent.trim() : null;
    }

    _renderChips(active) {
      const html = active
        .map(
          (f) =>
            '<span class="sf-active-chip">' +
            this._escape(f.label) +
            '<button type="button" class="sf-active-chip__remove" data-sf-remove="' +
            f.group +
            '" aria-label="Filter entfernen">' +
            X_ICON +
            "</button></span>"
        )
        .join("");
      this.querySelectorAll("[data-sf-active-list]").forEach((el) => {
        el.innerHTML = html;
      });
    }

    _renderCount(count) {
      // In `server` mode the count text is rendered by Liquid / re-rendered by
      // the theme's facet form, so the client leaves it untouched.
      if (this.countMode === "server") return;

      const filtered = count > 0 ? Math.max(1, Math.round(this.total / (count * 3 + 1))) : this.total;
      const fill = (tpl) => tpl.replace("[count]", filtered).replace("[total]", this.total);

      // Below-card full count (only visible when filters are active).
      this.querySelectorAll("[data-sf-count-full]").forEach((el) => {
        el.textContent = fill(this.countTpl);
      });

      // Mobile bar count (always visible).
      this.querySelectorAll("[data-sf-count]").forEach((el) => {
        el.textContent = fill(count > 0 ? this.countTpl : this.countTplAll);
      });
    }

    _renderVisibility(count) {
      const hasFilters = count > 0;
      this.querySelectorAll("[data-sf-count-full]").forEach((el) => (el.hidden = !hasFilters));
      this.querySelectorAll(".sf-summary [data-sf-clear]").forEach((el) => (el.hidden = !hasFilters));
    }

    /* ----------------------------------------------------------------- */
    /* Decorative star ring                                              */
    /* ----------------------------------------------------------------- */

    _buildStarRing() {
      const ring = this.querySelector("[data-sf-eu-ring]");
      if (!ring) return;
      for (let i = 0; i < 12; i++) {
        const angle = (i * 30 - 90) * (Math.PI / 180);
        const x = 50 + 42 * Math.cos(angle);
        const y = 50 + 42 * Math.sin(angle);
        const star = document.createElement("span");
        star.className = "sf-badge__star";
        star.textContent = "★";
        star.style.left = x + "%";
        star.style.top = y + "%";
        ring.appendChild(star);
      }
    }

    /* ----------------------------------------------------------------- */
    /* Utils                                                             */
    /* ----------------------------------------------------------------- */

    _escape(str) {
      const div = document.createElement("div");
      div.textContent = str;
      return div.innerHTML;
    }
  }

  if (!customElements.get("shelf-filter")) {
    customElements.define("shelf-filter", ShelfFilter);
  }
})();
