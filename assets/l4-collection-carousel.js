(() => {
  const ELEMENT_NAME = "l4-collection-carousel";
  const DRAG_START_THRESHOLD = 6;
  const SWIPE_THRESHOLD = 40;

  class L4CollectionCarousel extends HTMLElement {
    constructor() {
      super();

      this.page = 0;
      this.visibleCount = 1;
      this.containerWidth = 0;
      this.pointerId = null;
      this.pointerStartX = 0;
      this.pointerStartY = 0;
      this.pointerStartTime = 0;
      this.pointerDeltaX = 0;
      this.isDragging = false;
      this.suppressClick = false;
      this.suppressClickTimer = null;
      this.abortController = null;
      this.resizeObserver = null;

      this.measure = this.measure.bind(this);
      this.handleClick = this.handleClick.bind(this);
      this.handleKeydown = this.handleKeydown.bind(this);
      this.handlePointerDown = this.handlePointerDown.bind(this);
      this.handlePointerMove = this.handlePointerMove.bind(this);
      this.handlePointerUp = this.handlePointerUp.bind(this);
      this.handlePointerCancel = this.handlePointerCancel.bind(this);
      this.handleBlockSelect = this.handleBlockSelect.bind(this);
    }

    connectedCallback() {
      if (!this.initialize()) {
        return;
      }

      this.connectListeners();
      this.measure();
      this.setAttribute("data-hydrated", "");
    }

    disconnectedCallback() {
      this.abortController?.abort();
      this.resizeObserver?.disconnect();
      window.clearTimeout(this.suppressClickTimer);
    }

    initialize() {
      if (this.initialized) {
        return true;
      }

      this.track = this.querySelector("[data-l4-collection-track]");
      this.itemsContainer = this.querySelector("[data-l4-collection-items]");
      this.dotsContainer = this.querySelector("[data-l4-collection-dots]");
      this.previousButton = this.querySelector("[data-l4-collection-previous]");
      this.nextButton = this.querySelector("[data-l4-collection-next]");

      if (
        !this.track ||
        !this.itemsContainer ||
        !this.dotsContainer ||
        !this.previousButton ||
        !this.nextButton
      ) {
        return false;
      }

      this.items = Array.from(
        this.itemsContainer.querySelectorAll(":scope > [data-l4-collection-item]"),
      );
      this.initialized = this.items.length > 0;
      return this.initialized;
    }

    connectListeners() {
      this.abortController?.abort();
      this.resizeObserver?.disconnect();

      this.abortController = new AbortController();
      const options = { signal: this.abortController.signal };

      this.addEventListener("click", this.handleClick, options);
      this.addEventListener("keydown", this.handleKeydown, options);
      this.addEventListener("shopify:block:select", this.handleBlockSelect, options);
      this.track.addEventListener("pointerdown", this.handlePointerDown, options);
      this.track.addEventListener("pointermove", this.handlePointerMove, options);
      this.track.addEventListener("pointerup", this.handlePointerUp, options);
      this.track.addEventListener("pointercancel", this.handlePointerCancel, options);
      this.track.addEventListener("dragstart", (event) => event.preventDefault(), options);

      this.resizeObserver = new ResizeObserver(this.measure);
      this.resizeObserver.observe(this.track);
    }

    get totalPages() {
      return Math.max(1, Math.ceil(this.items.length / this.visibleCount));
    }

    getResponsiveVisibleCount() {
      let value = this.dataset.desktopColumns;

      if (window.matchMedia("(max-width: 474px)").matches) {
        value = this.dataset.palmColumns;
      } else if (window.matchMedia("(max-width: 767px)").matches) {
        value = this.dataset.lapColumns;
      } else if (window.matchMedia("(max-width: 1023px)").matches) {
        value = this.dataset.portableColumns;
      }

      return Math.max(1, Number.parseInt(value, 10) || 1);
    }

    measure() {
      const nextWidth = this.track.clientWidth;
      const nextVisibleCount = this.getResponsiveVisibleCount();

      if (
        nextWidth <= 0 ||
        (nextWidth === this.containerWidth && nextVisibleCount === this.visibleCount)
      ) {
        return;
      }

      this.containerWidth = nextWidth;
      this.visibleCount = nextVisibleCount;
      this.page = Math.min(this.page, this.totalPages - 1);
      this.renderPages();
    }

    renderPages() {
      const fragment = document.createDocumentFragment();
      const renderedItems = new Set();

      for (let pageIndex = 0; pageIndex < this.totalPages; pageIndex += 1) {
        const page = document.createElement("div");
        const regularStart = pageIndex * this.visibleCount;
        const itemsRemaining = this.items.length - regularStart;
        const isIncompleteLastPage =
          pageIndex === this.totalPages - 1 && itemsRemaining < this.visibleCount;
        const start = isIncompleteLastPage
          ? Math.max(0, this.items.length - this.visibleCount)
          : regularStart;
        const end = Math.min(start + this.visibleCount, this.items.length);

        page.className = "l4-collection-carousel__page";
        page.dataset.l4CollectionPage = String(pageIndex);
        page.style.width = `${this.containerWidth}px`;
        page.style.setProperty(
          "--l4-collection-carousel-visible-columns",
          String(this.visibleCount),
        );
        this.items.slice(start, end).forEach((item) => {
          const pageItem = renderedItems.has(item) ? this.cloneItem(item) : item;
          renderedItems.add(item);
          page.append(pageItem);
        });
        fragment.append(page);
      }

      this.itemsContainer.replaceChildren(fragment);
      this.itemsContainer.style.width = `${this.containerWidth * this.totalPages}px`;
      this.updatePosition();
    }

    cloneItem(item) {
      const clone = item.cloneNode(true);

      clone.dataset.l4CollectionClone = "";
      clone.removeAttribute("id");
      clone.removeAttribute("data-shopify-editor-block");
      clone.querySelectorAll("[id]").forEach((element) => element.removeAttribute("id"));
      clone
        .querySelectorAll("[data-shopify-editor-block]")
        .forEach((element) => element.removeAttribute("data-shopify-editor-block"));

      return clone;
    }

    goToPage(page) {
      const nextPage = Math.min(this.totalPages - 1, Math.max(0, page));

      if (nextPage === this.page) {
        this.updatePosition();
        return;
      }

      this.page = nextPage;
      this.updatePosition();
    }

    updatePosition(offset = 0, updateState = true) {
      const position = -this.page * this.containerWidth + offset;
      this.itemsContainer.style.transform = `translate3d(${position}px, 0, 0)`;

      if (updateState) {
        this.updateAccessibility();
        this.renderNavigation();
      }
    }

    updateAccessibility() {
      this.itemsContainer
        .querySelectorAll("[data-l4-collection-page]")
        .forEach((page, pageIndex) => {
          const isCurrent = pageIndex === this.page;
          page.setAttribute("aria-hidden", String(!isCurrent));
          page
            .querySelectorAll("a, button, input, select, textarea")
            .forEach((control) => (control.tabIndex = isCurrent ? 0 : -1));
        });
    }

    renderNavigation() {
      const fragment = document.createDocumentFragment();
      const pageLabel = this.dataset.pageLabel || "Page [page]";
      const hasMultiplePages = this.totalPages > 1;

      for (let index = 0; index < this.totalPages; index += 1) {
        const dot = document.createElement("button");
        dot.type = "button";
        dot.className = `l4-collection-carousel__dot${index === this.page ? " is-active" : ""}`;
        dot.dataset.l4CollectionPageButton = String(index);
        dot.setAttribute("aria-label", pageLabel.replace("[page]", String(index + 1)));

        if (index === this.page) {
          dot.setAttribute("aria-current", "true");
        }

        fragment.append(dot);
      }

      this.dotsContainer.replaceChildren(fragment);
      this.previousButton.disabled = this.page === 0;
      this.nextButton.disabled = this.page === this.totalPages - 1;
      this.querySelector("[data-l4-collection-navigation]").hidden = !hasMultiplePages;
    }

    handleClick(event) {
      if (this.suppressClick) {
        event.preventDefault();
        event.stopImmediatePropagation();
        this.suppressClick = false;
        return;
      }

      if (!(event.target instanceof Element)) {
        return;
      }

      const pageButton = event.target.closest("[data-l4-collection-page-button]");

      if (pageButton) {
        this.goToPage(Number.parseInt(pageButton.dataset.l4CollectionPageButton, 10));
      } else if (event.target.closest("[data-l4-collection-previous]")) {
        this.goToPage(this.page - 1);
      } else if (event.target.closest("[data-l4-collection-next]")) {
        this.goToPage(this.page + 1);
      }
    }

    handleKeydown(event) {
      if (event.target !== this.track) {
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        this.goToPage(this.page - 1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        this.goToPage(this.page + 1);
      } else if (event.key === "Home") {
        event.preventDefault();
        this.goToPage(0);
      } else if (event.key === "End") {
        event.preventDefault();
        this.goToPage(this.totalPages - 1);
      }
    }

    handleBlockSelect(event) {
      const selectedIndex = this.items.findIndex((item) => item.contains(event.target));

      if (selectedIndex >= 0) {
        this.goToPage(Math.floor(selectedIndex / this.visibleCount));
      }
    }

    handlePointerDown(event) {
      if (
        this.totalPages <= 1 ||
        !event.isPrimary ||
        (event.pointerType === "mouse" && event.button !== 0) ||
        !(event.target instanceof Element) ||
        event.target.closest("button, input, select, textarea, label")
      ) {
        return;
      }

      this.pointerId = event.pointerId;
      this.pointerStartX = event.clientX;
      this.pointerStartY = event.clientY;
      this.pointerStartTime = performance.now();
      this.pointerDeltaX = 0;
      this.isDragging = false;
      this.track.setPointerCapture(event.pointerId);
    }

    handlePointerMove(event) {
      if (event.pointerId !== this.pointerId) {
        return;
      }

      const deltaX = event.clientX - this.pointerStartX;
      const deltaY = event.clientY - this.pointerStartY;

      if (!this.isDragging) {
        if (
          Math.abs(deltaX) < DRAG_START_THRESHOLD &&
          Math.abs(deltaY) < DRAG_START_THRESHOLD
        ) {
          return;
        }

        if (Math.abs(deltaY) > Math.abs(deltaX)) {
          this.finishPointerInteraction(true);
          return;
        }

        this.isDragging = true;
        this.setAttribute("data-dragging", "");
      }

      event.preventDefault();
      this.pointerDeltaX = deltaX;

      let visualOffset = deltaX;
      const pullingPastStart = this.page === 0 && deltaX > 0;
      const pullingPastEnd = this.page === this.totalPages - 1 && deltaX < 0;

      if (pullingPastStart || pullingPastEnd) {
        visualOffset *= 0.25;
      }

      this.updatePosition(visualOffset, false);
    }

    handlePointerUp(event) {
      if (event.pointerId === this.pointerId) {
        this.finishPointerInteraction(false);
      }
    }

    handlePointerCancel(event) {
      if (event.pointerId === this.pointerId) {
        this.finishPointerInteraction(true);
      }
    }

    finishPointerInteraction(cancelled) {
      if (this.pointerId === null) {
        return;
      }

      const pointerId = this.pointerId;
      const distance = this.pointerDeltaX;
      const duration = Math.max(1, performance.now() - this.pointerStartTime);
      const velocity = Math.abs(distance) / duration;
      const wasDragging = this.isDragging;

      if (this.track.hasPointerCapture(pointerId)) {
        this.track.releasePointerCapture(pointerId);
      }

      this.pointerId = null;
      this.pointerDeltaX = 0;
      this.isDragging = false;
      this.removeAttribute("data-dragging");

      void this.itemsContainer.offsetWidth;

      const distanceThreshold = Math.min(
        SWIPE_THRESHOLD,
        Math.max(20, this.containerWidth * 0.12),
      );
      const shouldNavigate =
        !cancelled &&
        wasDragging &&
        (Math.abs(distance) >= distanceThreshold ||
          (Math.abs(distance) >= 12 && velocity >= 0.45));

      if (shouldNavigate) {
        this.goToPage(this.page + (distance < 0 ? 1 : -1));
      } else {
        this.updatePosition();
      }

      if (wasDragging) {
        this.suppressClick = true;
        window.clearTimeout(this.suppressClickTimer);
        this.suppressClickTimer = window.setTimeout(() => {
          this.suppressClick = false;
        }, 100);
      }
    }
  }

  if (!customElements.get(ELEMENT_NAME)) {
    customElements.define(ELEMENT_NAME, L4CollectionCarousel);
  }
})();
