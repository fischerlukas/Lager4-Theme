/* Lovable-style facets for a dedicated product grid section.
 * This is intentionally isolated from the original facets implementation:
 * - unique root IDs (#CollectionProductGridLovable, #main-collection-product-grid-lovable)
 * - unique custom element (<facet-filters-form-lovable>)
 */

class FacetFiltersFormLovable extends HTMLElement {
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
      const searchParams = event.state ? event.state.searchParams : FacetFiltersFormLovable.searchParamsInitial;
      if (searchParams === FacetFiltersFormLovable.searchParamsPrev) return;
      FacetFiltersFormLovable.renderPage(searchParams, null, false);
    };
    window.addEventListener('popstate', onHistoryChange);
  }

  static toggleActiveFacets(disable = true) {
    document.querySelectorAll('.js-facet-remove').forEach((element) => {
      element.classList.toggle('disabled', disable);
    });
  }

  static renderPage(searchParams, event, updateURLHash = true) {
    FacetFiltersFormLovable.searchParamsPrev = searchParams;
    const sections = FacetFiltersFormLovable.getSections();

    const grid = document.getElementById('main-collection-product-grid-lovable');
    grid?.classList.add('loading');

    sections.forEach((section) => {
      const url = `${window.location.pathname}?section_id=${section.section}&${searchParams}`;
      const filterDataUrl = (element) => element.url === url;
      FacetFiltersFormLovable.filterData.some(filterDataUrl)
        ? FacetFiltersFormLovable.renderSectionFromCache(filterDataUrl, event)
        : FacetFiltersFormLovable.renderSectionFromFetch(url, event);
    });

    if (updateURLHash) FacetFiltersFormLovable.updateURLHash(searchParams);
  }

  static renderSectionFromFetch(url, event) {
    fetch(url)
      .then((response) => response.text())
      .then((responseText) => {
        const html = responseText;
        FacetFiltersFormLovable.filterData = [...FacetFiltersFormLovable.filterData, { html, url }];
        FacetFiltersFormLovable.renderFilters(html, event);
        FacetFiltersFormLovable.renderProductGrid(html);
        FacetFiltersFormLovable.renderProductCount(html);
      });
  }

  static renderSectionFromCache(filterDataUrl, event) {
    const html = FacetFiltersFormLovable.filterData.find(filterDataUrl).html;
    FacetFiltersFormLovable.renderFilters(html, event);
    FacetFiltersFormLovable.renderProductGrid(html);
    FacetFiltersFormLovable.renderProductCount(html);
  }

  static renderProductGrid(html) {
    const innerHTML = new DOMParser()
      .parseFromString(html, 'text/html')
      .getElementById('CollectionProductGridLovable')?.innerHTML;
    if (!innerHTML) return;

    const target = document.getElementById('CollectionProductGridLovable');
    if (!target) return;
    target.innerHTML = innerHTML;

    target.querySelectorAll('template').forEach((elm) => {
      elm.closest('form')?.append(elm.content.cloneNode(true));
    });
  }

  static renderProductCount(html) {
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    const countEl = parsed.getElementById('CollectionProductCountLovable');
    if (!countEl) return;
    const target = document.getElementById('CollectionProductCountLovable');
    if (!target) return;
    target.innerHTML = countEl.innerHTML;
  }

  static renderFilters(html, event) {
    const parsedHTML = new DOMParser().parseFromString(html, 'text/html');

    const facetDetailsElements = parsedHTML.querySelectorAll(
      '#FacetFiltersFormLovable .js-filter, #FacetFiltersFormLovableMobile .js-filter'
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

    FacetFiltersFormLovable.renderActiveFacets(parsedHTML);

    if (countsToRender && event?.target?.closest?.('.js-filter')) {
      FacetFiltersFormLovable.renderCounts(countsToRender, event.target.closest('.js-filter'));
    }
  }

  static renderActiveFacets(html) {
    const activeFacetElementSelectors = ['.active-facets-lovable'];
    activeFacetElementSelectors.forEach((selector) => {
      const activeFacetsElement = html.querySelector(selector);
      if (!activeFacetsElement) return;
      const target = document.querySelector(selector);
      if (target) target.innerHTML = activeFacetsElement.innerHTML;
    });
    FacetFiltersFormLovable.toggleActiveFacets(false);
  }

  static renderCounts(source, target) {
    const countElementSelectors = ['.facets-lovable__selected'];
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
    const root = document.getElementById('main-collection-product-grid-lovable');
    if (!root) return [];
    return [
      {
        id: 'main-collection-product-grid-lovable',
        section: root.dataset.id,
      },
    ];
  }

  createSearchParams(form) {
    const formData = new FormData(form);
    return new URLSearchParams(formData).toString();
  }

  onSubmitForm(searchParams, event) {
    FacetFiltersFormLovable.renderPage(searchParams, event);
  }

  onSubmitHandler(event) {
    event.preventDefault();
    const sortFilterForms = document.querySelectorAll('facet-filters-form-lovable form');
    const forms = [];
    const isMobile = event.target?.closest?.('form')?.id === 'FacetFiltersFormLovableMobile';

    sortFilterForms.forEach((form) => {
      if (!isMobile) {
        if (form.id === 'FacetFiltersFormLovable') {
          const noJsElements = document.querySelectorAll('.no-js-list');
          noJsElements.forEach((el) => el.remove());
          forms.push(this.createSearchParams(form));
        }
      } else if (form.id === 'FacetFiltersFormLovableMobile') {
        forms.push(this.createSearchParams(form));
      }
    });

    this.onSubmitForm(forms.join('&'), event);
  }

  onActiveFilterClick(event) {
    event.preventDefault();
    FacetFiltersFormLovable.toggleActiveFacets();
    const href = event.currentTarget.href || '';
    const url = href.indexOf('?') === -1 ? '' : href.slice(href.indexOf('?') + 1);
    FacetFiltersFormLovable.renderPage(url);
  }
}

FacetFiltersFormLovable.filterData = [];
FacetFiltersFormLovable.searchParamsInitial = window.location.search.slice(1);
FacetFiltersFormLovable.searchParamsPrev = window.location.search.slice(1);

if (!customElements.get('facet-filters-form-lovable')) {
  customElements.define('facet-filters-form-lovable', FacetFiltersFormLovable);
  FacetFiltersFormLovable.setListeners();
}

// Reuse existing components if present; otherwise define minimal versions.
if (!customElements.get('facet-remove')) {
  class FacetRemoveLovable extends HTMLElement {
    constructor() {
      super();
      const facetLink = this.querySelector('a');
      facetLink?.setAttribute('role', 'button');
      facetLink?.addEventListener('click', this.closeFilter.bind(this));
      facetLink?.addEventListener('keyup', (event) => {
        event.preventDefault();
        if (event.code.toUpperCase() === 'SPACE') this.closeFilter(event);
      });
    }
    closeFilter(event) {
      event.preventDefault();
      const form =
        this.closest('facet-filters-form-lovable') || document.querySelector('facet-filters-form-lovable');
      form?.onActiveFilterClick(event);
    }
  }
  customElements.define('facet-remove', FacetRemoveLovable);
}

if (!customElements.get('price-range')) {
  class PriceRangeLovable extends HTMLElement {
    constructor() {
      super();
      this.querySelectorAll('input').forEach((element) => {
        element.addEventListener('change', this.onRangeChange.bind(this));
        element.addEventListener('input', this.maxCheck.bind(this));
      });

      this.setMinAndMaxValues();

      const inputMin = this.querySelector('input[name="filter.v.price.gte"]');
      const inputMax = this.querySelector('input[name="filter.v.price.lte"]');
      let inputTimer = null;

      if (this.parentElement?.querySelector('[data-js-price-range-slider]') && window.rangeSlider) {
        window.rangeSlider(this.parentElement.querySelector('[data-js-price-range-slider]'), {
          min: Number(inputMin?.getAttribute('min') || 0),
          max: Number(inputMax?.getAttribute('max') || 0),
          value: [
            inputMin?.value || Number(inputMin?.getAttribute('placeholder') || 0),
            inputMax?.value || Number(inputMax?.getAttribute('placeholder') || 0),
          ],
          onInput: (values) => {
            if (inputMin) inputMin.value = `${values[0]}`;
            if (inputMax) inputMax.value = `${values[1]}`;
            clearTimeout(inputTimer);
            inputTimer = setTimeout(() => {
              const formEl = document.querySelector('facet-filters-form-lovable');
              formEl?.onSubmitHandler({
                target: inputMin,
                preventDefault: () => {
                  return;
                },
              });
              formEl?.onSubmitHandler({
                target: inputMax,
                preventDefault: () => {
                  return;
                },
              });
              this.onRangeChange({ currentTarget: inputMin });
              this.onRangeChange({ currentTarget: inputMax });
            }, 500);
          },
        });
      }
    }

    onRangeChange(event) {
      if (!event?.currentTarget) return;
      this.adjustToValidValues(event.currentTarget);
      this.setMinAndMaxValues();
    }

    setMinAndMaxValues() {
      const inputs = this.querySelectorAll('input');
      const minInput = inputs[0];
      const maxInput = inputs[1];
      if (!minInput || !maxInput) return;

      if (maxInput.value) minInput.setAttribute('max', maxInput.value);
      if (minInput.value) maxInput.setAttribute('min', minInput.value);
      if (minInput.value === '') maxInput.setAttribute('min', 0);
      if (maxInput.value === '') minInput.setAttribute('max', maxInput.getAttribute('max'));
    }

    adjustToValidValues(input) {
      const value = Number(input.value);
      const min = Number(input.getAttribute('min'));
      const max = Number(input.getAttribute('max'));

      if (value < min) input.value = min;
      if (value > max) input.value = max;
    }

    maxCheck(object) {
      const max = parseInt(object.target.max, 10);
      const value = parseInt(object.target.value, 10);
      if (value > max) object.target.value = max;
    }
  }
  customElements.define('price-range', PriceRangeLovable);
}

// AJAX-handle "remove facet" links in this section (avoid full reload).
document.addEventListener(
  'click',
  (event) => {
    const link = event.target?.closest?.('a.js-facet-remove');
    if (!link) return;
    // Only intercept within the lovable section UI.
    const inLovable =
      link.closest('#CollectionProductGridLovable') ||
      link.closest('facet-filters-form-lovable') ||
      link.closest('#site-filters-sidebar-lovable');
    if (!inLovable) return;

    event.preventDefault();
    FacetFiltersFormLovable.toggleActiveFacets();
    const href = link.getAttribute('href') || '';
    const params = href.indexOf('?') === -1 ? '' : href.slice(href.indexOf('?') + 1);
    FacetFiltersFormLovable.renderPage(params, null, true);
  },
  { capture: true }
);

// Close open dropdowns on outside click.
document.addEventListener(
  'click',
  (e) => {
    const open = document.querySelectorAll('.facets-lovable__disclosure[open]');
    open.forEach((d) => {
      if (!d.contains(e.target)) d.removeAttribute('open');
    });
  },
  { capture: true }
);

