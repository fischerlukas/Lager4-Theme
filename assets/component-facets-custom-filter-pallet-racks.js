/* Custom Filter Pallet Racks facets for a dedicated product grid section.
 * Isolated from the original facets implementation:
 * - unique root IDs (#CollectionProductGridCustomFilterPalletRacks, #main-collection-product-grid-custom-filter-pallet-racks)
 * - unique custom element (<facet-filters-form-custom-filter-pallet-racks>)
 */

class FacetFiltersFormCustomFilterPalletRacks extends HTMLElement {
  constructor() {
    super();
    this.onActiveFilterClick = this.onActiveFilterClick.bind(this);
    this.debouncedOnSubmit = debounce((event) => {
      this.onSubmitHandler(event);
    }, 500);

    const facetForm = this.querySelector('form');
    facetForm?.addEventListener('input', this.debouncedOnSubmit.bind(this));
  }

  static setListeners() {
    const onHistoryChange = (event) => {
      const searchParams = event.state
        ? event.state.searchParams
        : FacetFiltersFormCustomFilterPalletRacks.searchParamsInitial;
      if (searchParams === FacetFiltersFormCustomFilterPalletRacks.searchParamsPrev) return;
      FacetFiltersFormCustomFilterPalletRacks.renderPage(searchParams, null, false);
    };
    window.addEventListener('popstate', onHistoryChange);
  }

  static toggleActiveFacets(disable = true) {
    document.querySelectorAll('.js-facet-remove').forEach((element) => {
      element.classList.toggle('disabled', disable);
    });
  }

  static renderPage(searchParams, event, updateURLHash = true) {
    FacetFiltersFormCustomFilterPalletRacks.searchParamsPrev = searchParams;
    const sections = FacetFiltersFormCustomFilterPalletRacks.getSections();

    const grid = document.getElementById('main-collection-product-grid-custom-filter-pallet-racks');
    grid?.classList.add('loading');

    sections.forEach((section) => {
      const url = `${window.location.pathname}?section_id=${section.section}&${searchParams}`;
      const filterDataUrl = (element) => element.url === url;
      FacetFiltersFormCustomFilterPalletRacks.filterData.some(filterDataUrl)
        ? FacetFiltersFormCustomFilterPalletRacks.renderSectionFromCache(filterDataUrl, event)
        : FacetFiltersFormCustomFilterPalletRacks.renderSectionFromFetch(url, event);
    });

    if (updateURLHash) FacetFiltersFormCustomFilterPalletRacks.updateURLHash(searchParams);
  }

  static renderSectionFromFetch(url, event) {
    fetch(url)
      .then((response) => response.text())
      .then((responseText) => {
        const html = responseText;
        FacetFiltersFormCustomFilterPalletRacks.filterData = [
          ...FacetFiltersFormCustomFilterPalletRacks.filterData,
          { html, url },
        ];
        FacetFiltersFormCustomFilterPalletRacks.renderFilters(html, event);
        FacetFiltersFormCustomFilterPalletRacks.renderProductGrid(html);
        FacetFiltersFormCustomFilterPalletRacks.renderProductCount(html);
      });
  }

  static renderSectionFromCache(filterDataUrl, event) {
    const html = FacetFiltersFormCustomFilterPalletRacks.filterData.find(filterDataUrl).html;
    FacetFiltersFormCustomFilterPalletRacks.renderFilters(html, event);
    FacetFiltersFormCustomFilterPalletRacks.renderProductGrid(html);
    FacetFiltersFormCustomFilterPalletRacks.renderProductCount(html);
  }

  static renderProductGrid(html) {
    const innerHTML = new DOMParser()
      .parseFromString(html, 'text/html')
      .getElementById('CollectionProductGridCustomFilterPalletRacks')?.innerHTML;
    if (!innerHTML) return;

    const target = document.getElementById('CollectionProductGridCustomFilterPalletRacks');
    if (!target) return;
    target.innerHTML = innerHTML;

    target.querySelectorAll('template').forEach((elm) => {
      elm.closest('form')?.append(elm.content.cloneNode(true));
    });
  }

  static renderProductCount(html) {
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    const countEl = parsed.getElementById('CollectionProductCountCustomFilterPalletRacks');
    if (!countEl) return;
    const target = document.getElementById('CollectionProductCountCustomFilterPalletRacks');
    if (!target) return;
    target.innerHTML = countEl.innerHTML;
  }

  static renderFilters(html, event) {
    const parsedHTML = new DOMParser().parseFromString(html, 'text/html');
    const facetDetailsElements = parsedHTML.querySelectorAll(
      '#FacetFiltersFormCustomFilterPalletRacks .js-filter, #FacetFiltersFormCustomFilterPalletRacksMobile .js-filter'
    );

    const matchesIndex = (element) => {
      if (event && event.target?.closest?.('.js-filter')) {
        return element.dataset.index === event.target.closest('.js-filter').dataset.index;
      }
    };

    const facetsToRender = Array.from(facetDetailsElements).filter((element) => !matchesIndex(element));
    const countsToRender = Array.from(facetDetailsElements).find(matchesIndex);

    facetsToRender.forEach((element) => {
      const target = document.querySelector(`.js-filter[data-index="${element.dataset.index}"]`);
      if (target) target.innerHTML = element.innerHTML;
    });

    FacetFiltersFormCustomFilterPalletRacks.renderActiveFacets(parsedHTML);

    if (countsToRender && event?.target?.closest?.('.js-filter')) {
      FacetFiltersFormCustomFilterPalletRacks.renderCounts(countsToRender, event.target.closest('.js-filter'));
    }
  }

  static renderActiveFacets(html) {
    const activeFacetElementSelectors = ['.active-facets-custom-filter-pallet-racks'];
    activeFacetElementSelectors.forEach((selector) => {
      const activeFacetsElement = html.querySelector(selector);
      if (!activeFacetsElement) return;
      const target = document.querySelector(selector);
      if (target) target.innerHTML = activeFacetsElement.innerHTML;
    });
    FacetFiltersFormCustomFilterPalletRacks.toggleActiveFacets(false);
  }

  static renderCounts(source, target) {
    const countElementSelectors = ['.facets-custom-filter-pallet-racks__selected'];
    countElementSelectors.forEach((selector) => {
      const targetElement = target.querySelector(selector);
      const sourceElement = source.querySelector(selector);
      if (sourceElement && targetElement) {
        target.querySelector(selector).outerHTML = source.querySelector(selector).outerHTML;
      }
    });
  }

  static updateURLHash(searchParams) {
    history.pushState({ searchParams }, '', `${window.location.pathname}${searchParams && '?'.concat(searchParams)}`);
  }

  static getSections() {
    const root = document.getElementById('main-collection-product-grid-custom-filter-pallet-racks');
    if (!root) return [];
    return [
      {
        id: 'main-collection-product-grid-custom-filter-pallet-racks',
        section: root.dataset.id,
      },
    ];
  }

  createSearchParams(form) {
    const formData = new FormData(form);
    return new URLSearchParams(formData).toString();
  }

  onSubmitForm(searchParams, event) {
    FacetFiltersFormCustomFilterPalletRacks.renderPage(searchParams, event);
  }

  onSubmitHandler(event) {
    event.preventDefault();
    const sortFilterForms = document.querySelectorAll('facet-filters-form-custom-filter-pallet-racks form');
    const forms = [];
    const isMobile = event.target?.closest?.('form')?.id === 'FacetFiltersFormCustomFilterPalletRacksMobile';

    sortFilterForms.forEach((form) => {
      if (!isMobile) {
        if (form.id === 'FacetFiltersFormCustomFilterPalletRacks') {
          const noJsElements = document.querySelectorAll('.no-js-list');
          noJsElements.forEach((el) => el.remove());
          forms.push(this.createSearchParams(form));
        }
      } else if (form.id === 'FacetFiltersFormCustomFilterPalletRacksMobile') {
        forms.push(this.createSearchParams(form));
      }
    });

    this.onSubmitForm(forms.join('&'), event);
  }

  onActiveFilterClick(event) {
    event.preventDefault();
    FacetFiltersFormCustomFilterPalletRacks.toggleActiveFacets();
    const href = event.currentTarget.href || '';
    const url = href.indexOf('?') === -1 ? '' : href.slice(href.indexOf('?') + 1);
    FacetFiltersFormCustomFilterPalletRacks.renderPage(url);
  }
}

FacetFiltersFormCustomFilterPalletRacks.filterData = [];
FacetFiltersFormCustomFilterPalletRacks.searchParamsInitial = window.location.search.slice(1);
FacetFiltersFormCustomFilterPalletRacks.searchParamsPrev = window.location.search.slice(1);

if (!customElements.get('facet-filters-form-custom-filter-pallet-racks')) {
  customElements.define('facet-filters-form-custom-filter-pallet-racks', FacetFiltersFormCustomFilterPalletRacks);
  FacetFiltersFormCustomFilterPalletRacks.setListeners();
}

// AJAX-handle "remove facet" links in this section (avoid full reload).
document.addEventListener(
  'click',
  (event) => {
    const link = event.target?.closest?.('a.js-facet-remove');
    if (!link) return;

    const inCustom =
      link.closest('#CollectionProductGridCustomFilterPalletRacks') ||
      link.closest('facet-filters-form-custom-filter-pallet-racks') ||
      link.closest('#site-filters-sidebar-custom-filter-pallet-racks');
    if (!inCustom) return;

    event.preventDefault();
    FacetFiltersFormCustomFilterPalletRacks.toggleActiveFacets();
    const href = link.getAttribute('href') || '';
    const params = href.indexOf('?') === -1 ? '' : href.slice(href.indexOf('?') + 1);
    FacetFiltersFormCustomFilterPalletRacks.renderPage(params, null, true);
  },
  { capture: true }
);

// Close open dropdowns on outside click (only our dropdowns).
document.addEventListener(
  'click',
  (e) => {
    const open = document.querySelectorAll('.facets-custom-filter-pallet-racks__disclosure[open]');
    open.forEach((d) => {
      if (!d.contains(e.target)) d.removeAttribute('open');
    });
  },
  { capture: true }
);

// Lovable-style dropdown interactions + picking options
document.addEventListener(
  'click',
  (event) => {
    const toggle = event.target?.closest?.('[data-cpr-dropdown-toggle]');
    if (toggle) {
      const wrap = toggle.closest('[data-cpr-dropdown]');
      if (!wrap) return;
      const isOpen = wrap.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      return;
    }

    const pick = event.target?.closest?.('[data-cpr-pick]');
    if (pick) {
      try {
        const name = pick.getAttribute('data-name');
        const value = pick.getAttribute('data-value');
        if (!name) return;

        // Find matching hidden radio input without CSS.escape dependency
        const wrap = pick.closest('[data-cpr-dropdown]') || pick.closest('form');
        const candidates = wrap ? wrap.querySelectorAll(`input[type="radio"][name="${name.replace(/"/g, '\\"')}"]`) : [];
        let input = null;
        candidates.forEach((el) => {
          if (input) return;
          if (el.value === (value || '')) input = el;
        });

        if (input) {
          input.checked = true;
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }

        // Close dropdown
        const dd = pick.closest('[data-cpr-dropdown]');
        const btn = dd?.querySelector?.('[data-cpr-dropdown-toggle]');
        if (dd) dd.classList.remove('is-open');
        if (btn) btn.setAttribute('aria-expanded', 'false');
      } catch (e) {
        // Fail closed: do not break all filter JS if dropdown code errors
        console.error('[custom-filter-pallet-racks] dropdown pick failed', e);
      }
      return;
    }

    // Outside click closes any open custom dropdowns
    const openDropdowns = document.querySelectorAll('[data-cpr-dropdown].is-open');
    openDropdowns.forEach((dd) => {
      if (!dd.contains(event.target)) {
        dd.classList.remove('is-open');
        dd.querySelector?.('[data-cpr-dropdown-toggle]')?.setAttribute('aria-expanded', 'false');
      }
    });
  },
  { capture: true }
);

