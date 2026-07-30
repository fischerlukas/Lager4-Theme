(() => {
  const ELEMENT_NAME = "accessory-carousel";
  const DRAG_START_THRESHOLD = 6;
  const SWIPE_THRESHOLD = 40;
  const WHEEL_THRESHOLD = 30;
  const WHEEL_COOLDOWN = 350;

  class AccessoryCarousel extends HTMLElement {
    constructor() {
      super();

      this.page = 0;
      this.visibleCount = 1;
      this.containerWidth = 0;
      this.initialized = false;
      this.abortController = null;
      this.resizeObserver = null;
      this.autoplayTimer = null;
      this.pauseReasons = new Set();
      this.pointerId = null;
      this.pointerStartX = 0;
      this.pointerStartY = 0;
      this.pointerStartTime = 0;
      this.pointerDeltaX = 0;
      this.isDragging = false;
      this.suppressClick = false;
      this.suppressClickTimer = null;
      this.wheelDelta = 0;
      this.wheelResetTimer = null;
      this.lastWheelNavigation = 0;
      this.reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
      this.desktopMediaQuery = window.matchMedia("(min-width: 768px)");

      this.handleClick = this.handleClick.bind(this);
      this.handleInput = this.handleInput.bind(this);
      this.handleSubmit = this.handleSubmit.bind(this);
      this.handleKeydown = this.handleKeydown.bind(this);
      this.handlePointerEnter = this.handlePointerEnter.bind(this);
      this.handlePointerLeave = this.handlePointerLeave.bind(this);
      this.handlePointerDown = this.handlePointerDown.bind(this);
      this.handlePointerMove = this.handlePointerMove.bind(this);
      this.handlePointerUp = this.handlePointerUp.bind(this);
      this.handlePointerCancel = this.handlePointerCancel.bind(this);
      this.handleFocusIn = this.handleFocusIn.bind(this);
      this.handleFocusOut = this.handleFocusOut.bind(this);
      this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
      this.handleMotionPreferenceChange = this.handleMotionPreferenceChange.bind(this);
      this.handleWheel = this.handleWheel.bind(this);
      this.handleNativeDragStart = this.handleNativeDragStart.bind(this);
      this.measure = this.measure.bind(this);
    }

    connectedCallback() {
      if (!this.initialized) {
        this.initialize();
      }

      if (!this.initialized) {
        return;
      }

      this.connectListeners();
      this.measure();
      this.setAttribute("data-hydrated", "");
      this.syncAutoplay();
    }

    disconnectedCallback() {
      this.abortController?.abort();
      this.resizeObserver?.disconnect();
      this.reducedMotionQuery.removeEventListener("change", this.handleMotionPreferenceChange);
      this.desktopMediaQuery.removeEventListener("change", this.measure);
      this.clearAutoplay();
      window.clearTimeout(this.suppressClickTimer);
      window.clearTimeout(this.wheelResetTimer);
    }

    initialize() {
      this.track = this.querySelector("[data-carousel-track]");
      this.itemsContainer = this.querySelector("[data-carousel-items]");
      this.dotsContainer = this.querySelector("[data-carousel-dots]");
      this.previousButton = this.querySelector("[data-carousel-previous]");
      this.nextButton = this.querySelector("[data-carousel-next]");

      if (
        !this.track ||
        !this.itemsContainer ||
        !this.dotsContainer ||
        !this.previousButton ||
        !this.nextButton
      ) {
        return;
      }

      this.items = Array.from(this.itemsContainer.children).filter((element) =>
        element.matches("[data-carousel-item]"),
      );
      this.initialized = this.items.length > 0;
    }

    connectListeners() {
      this.abortController?.abort();
      this.resizeObserver?.disconnect();
      this.reducedMotionQuery.removeEventListener("change", this.handleMotionPreferenceChange);
      this.desktopMediaQuery.removeEventListener("change", this.measure);

      this.abortController = new AbortController();
      const options = { signal: this.abortController.signal };
      const wheelOptions = { ...options, passive: false };

      this.addEventListener("click", this.handleClick, options);
      this.addEventListener("input", this.handleInput, options);
      this.addEventListener("submit", this.handleSubmit, options);
      this.addEventListener("keydown", this.handleKeydown, options);
      this.addEventListener("pointerenter", this.handlePointerEnter, options);
      this.addEventListener("pointerleave", this.handlePointerLeave, options);
      this.addEventListener("focusin", this.handleFocusIn, options);
      this.addEventListener("focusout", this.handleFocusOut, options);

      this.track.addEventListener("pointerdown", this.handlePointerDown, options);
      this.track.addEventListener("pointermove", this.handlePointerMove, options);
      this.track.addEventListener("pointerup", this.handlePointerUp, options);
      this.track.addEventListener("pointercancel", this.handlePointerCancel, options);
      if (this.wheelNavigationEnabled) {
        this.track.addEventListener("wheel", this.handleWheel, wheelOptions);
      }
      this.track.addEventListener("dragstart", this.handleNativeDragStart, options);

      document.addEventListener("visibilitychange", this.handleVisibilityChange, options);
      this.reducedMotionQuery.addEventListener("change", this.handleMotionPreferenceChange);
      this.desktopMediaQuery.addEventListener("change", this.measure);

      this.resizeObserver = new ResizeObserver(this.measure);
      this.resizeObserver.observe(this.track);
    }

    get totalPages() {
      return Math.max(1, Math.ceil(this.items.length / this.visibleCount));
    }

    get autoplayEnabled() {
      return (
        this.dataset.autoplay === "true" &&
        !window.Shopify?.designMode &&
        !this.reducedMotionQuery.matches
      );
    }

    get wheelNavigationEnabled() {
      return this.dataset.mouseWheel === "true";
    }

    get autoplayInterval() {
      const configuredInterval = Number.parseInt(this.dataset.autoplayInterval, 10);
      return Math.max(3000, configuredInterval || 5000);
    }

    get pauseOnHover() {
      return this.dataset.pauseOnHover === "true";
    }

    get maxDesktopItems() {
      const configuredMaximum = Number.parseInt(this.dataset.maxDesktopItems, 10);
      return Math.max(1, configuredMaximum || 4);
    }

    measure() {
      if (!this.initialized) {
        return;
      }

      const styles = getComputedStyle(this);
      const cardWidth =
        Number.parseFloat(styles.getPropertyValue("--accessory-carousel-card-width")) || 280;
      const gap = Number.parseFloat(styles.getPropertyValue("--accessory-carousel-gap")) || 0;
      const step = cardWidth + gap;
      const nextContainerWidth = this.track.clientWidth;
      const availableVisibleCount = Math.max(
        1,
        Math.floor((nextContainerWidth + gap) / step),
      );
      const nextVisibleCount = this.desktopMediaQuery.matches
        ? Math.min(availableVisibleCount, this.maxDesktopItems)
        : availableVisibleCount;

      if (
        nextVisibleCount === this.visibleCount &&
        nextContainerWidth === this.containerWidth
      ) {
        return;
      }

      this.visibleCount = nextVisibleCount;
      this.containerWidth = nextContainerWidth;
      this.page = Math.min(this.totalPages - 1, Math.max(0, this.page));
      this.renderPages();
    }

    go(direction, { wrap = false, restartAutoplay = true } = {}) {
      let nextPage = this.page + direction;

      if (wrap) {
        nextPage = (nextPage + this.totalPages) % this.totalPages;
      }

      return this.goToPage(nextPage, { restartAutoplay });
    }

    goToPage(page, { restartAutoplay = true } = {}) {
      const parsedPage = Number.parseInt(page, 10);
      const nextPage = Math.min(
        this.totalPages - 1,
        Math.max(0, Number.isNaN(parsedPage) ? 0 : parsedPage),
      );

      if (nextPage === this.page) {
        this.updateTrackPosition();
        if (restartAutoplay) {
          this.syncAutoplay();
        }
        return false;
      }

      this.page = nextPage;
      this.updateTrackPosition();

      if (restartAutoplay) {
        this.syncAutoplay();
      }

      return true;
    }

    renderPages() {
      const fragment = document.createDocumentFragment();

      for (let pageIndex = 0; pageIndex < this.totalPages; pageIndex += 1) {
        const page = document.createElement("div");
        const start = pageIndex * this.visibleCount;
        const end = start + this.visibleCount;

        page.className = "accessory-carousel__page";
        page.dataset.carouselPanel = String(pageIndex);
        page.style.width = `${this.containerWidth}px`;
        this.items.slice(start, end).forEach((item) => page.append(item));
        fragment.append(page);
      }

      this.itemsContainer.replaceChildren(fragment);
      this.itemsContainer.style.width = `${this.containerWidth * this.totalPages}px`;
      this.updateTrackPosition();
      this.syncAutoplay();
    }

    updateTrackPosition(offset = 0, updateState = true) {
      const position = -this.page * this.containerWidth + offset;
      this.itemsContainer.style.transform = `translate3d(${position}px, 0, 0)`;

      if (updateState) {
        this.updatePageAccessibility();
        this.renderNavigation();
      }
    }

    updatePageAccessibility() {
      this.itemsContainer.querySelectorAll("[data-carousel-panel]").forEach((page, pageIndex) => {
        const isCurrent = pageIndex === this.page;

        page.setAttribute("aria-hidden", String(!isCurrent));
        page
          .querySelectorAll("a, button, input")
          .forEach((control) => (control.tabIndex = isCurrent ? 0 : -1));
      });
    }

    renderNavigation() {
      const fragment = document.createDocumentFragment();
      const pageLabel = this.dataset.pageLabel || "Seite [page] anzeigen";

      for (let index = 0; index < this.totalPages; index += 1) {
        const dot = document.createElement("button");
        dot.type = "button";
        dot.className = `accessory-carousel__dot${index === this.page ? " is-active" : ""}`;
        dot.dataset.carouselPage = String(index);
        dot.setAttribute("aria-label", pageLabel.replace("[page]", String(index + 1)));

        if (index === this.page) {
          dot.setAttribute("aria-current", "true");
        }

        fragment.append(dot);
      }

      this.dotsContainer.replaceChildren(fragment);
      this.previousButton.disabled = this.page === 0;
      this.nextButton.disabled = this.page === this.totalPages - 1;
      this.previousButton.classList.toggle("disabled", this.previousButton.disabled);
      this.nextButton.classList.toggle("disabled", this.nextButton.disabled);
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

      const button = event.target.closest("button");

      if (!button || !this.contains(button)) {
        return;
      }

      if (button.matches("[data-carousel-previous]")) {
        this.go(-1);
        return;
      }

      if (button.matches("[data-carousel-next]")) {
        this.go(1);
        return;
      }

      if (button.matches("[data-carousel-page]")) {
        this.goToPage(button.dataset.carouselPage);
        return;
      }

      if (button.matches("[data-quantity-change]")) {
        const input = button
          .closest(".accessory-carousel__quantity")
          ?.querySelector('input[type="number"]');

        if (!input) {
          return;
        }

        const currentValue = Number.parseInt(input.value, 10) || 1;
        const change = Number.parseInt(button.dataset.quantityChange, 10);
        input.value = String(Math.max(1, currentValue + change));
      }
    }

    handleInput(event) {
      if (!(event.target instanceof HTMLInputElement)) {
        return;
      }

      const input = event.target.closest('.accessory-carousel__quantity input[type="number"]');

      if (!input || !this.contains(input)) {
        return;
      }

      input.value = String(Math.max(1, Number.parseInt(input.value, 10) || 1));
    }

    async handleSubmit(event) {
      if (
        !(event.target instanceof HTMLFormElement) ||
        !event.target.matches(".accessory-carousel__purchase")
      ) {
        return;
      }

      event.preventDefault();

      const form = event.target;
      const submitButton = form.querySelector('.accessory-carousel__add-button[type="submit"]');

      if (!submitButton || submitButton.classList.contains("working")) {
        return;
      }

      this.clearCartError(form);
      this.setButtonLoading(submitButton, true);

      try {
        await this.addAccessory(form);

        try {
          await this.applyDiscountCode();
        } catch (error) {
          this.showCartError(form, error);
        }

        await this.refreshCartDrawer();
        this.openCartDrawer();
      } catch (error) {
        this.showCartError(form, error);
      } finally {
        this.setButtonLoading(submitButton, false);
      }
    }

    async addAccessory(form) {
      const cartAddUrl =
        window.KROWN?.settings?.routes?.cart_add_url ||
        `${this.shopifyRoot}cart/add`;
      const response = await fetch(`${cartAddUrl}.js`, {
        method: "POST",
        headers: {
          "X-Requested-With": "XMLHttpRequest",
        },
        body: new FormData(form),
      });
      const result = await response.json();

      if (!response.ok || result.status === 422) {
        throw new Error(result.description || result.message || "The accessory could not be added.");
      }
    }

    async applyDiscountCode() {
      const discountCode = this.dataset.discountCode?.trim();

      if (!discountCode) {
        return;
      }

      const response = await fetch(`${this.shopifyRoot}cart/update.js`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
        body: JSON.stringify({
          discount: discountCode,
        }),
      });
      const result = await response.json();

      if (!response.ok || result.status) {
        throw new Error(result.description || result.message || "The discount could not be applied.");
      }
    }

    async refreshCartDrawer() {
      const cartDrawer = document.getElementById("site-cart-sidebar");

      if (!cartDrawer) {
        return;
      }

      const response = await fetch("?section_id=helper-cart", {
        headers: {
          "X-Requested-With": "XMLHttpRequest",
        },
      });

      if (!response.ok) {
        throw new Error("The cart drawer could not be refreshed.");
      }

      const text = await response.text();
      const sectionDocument = new DOMParser().parseFromString(text, "text/html");
      const nextCartForm = sectionDocument.getElementById("AjaxCartForm");
      const nextCartSubtotal = sectionDocument.getElementById("AjaxCartSubtotal");
      const cartForm = document.getElementById("AjaxCartForm");
      const cartSubtotal = document.getElementById("AjaxCartSubtotal");

      if (!nextCartForm || !nextCartSubtotal || !cartForm || !cartSubtotal) {
        throw new Error("The cart drawer response was incomplete.");
      }

      cartForm.innerHTML = nextCartForm.innerHTML;
      cartSubtotal.innerHTML = nextCartSubtotal.innerHTML;

      if (typeof cartForm.ajaxifyCartItems === "function") {
        cartForm.ajaxifyCartItems();
      }

      const cartCount = cartForm.querySelector("[data-cart-count]");
      const cartTotal = cartForm.querySelector("[data-cart-total]");

      if (cartCount) {
        document.querySelectorAll("[data-header-cart-count]").forEach((element) => {
          element.textContent = cartCount.textContent;
        });
      }

      if (cartTotal) {
        document.querySelectorAll("[data-header-cart-total]").forEach((element) => {
          element.textContent = cartTotal.textContent;
        });
      }

      const recommendations = document.getElementById("cart-recommendations-sidebar");
      if (typeof recommendations?.generateRecommendations === "function") {
        recommendations.innerHTML = "";
        recommendations.generateRecommendations();
      }
    }

    openCartDrawer() {
      const cartDrawer = document.getElementById("site-cart-sidebar");

      if (cartDrawer && typeof cartDrawer.show === "function") {
        cartDrawer.show();
        return;
      }

      window.location.href = window.KROWN?.settings?.routes?.cart_url || `${this.shopifyRoot}cart`;
    }

    get shopifyRoot() {
      return window.Shopify?.routes?.root || "/";
    }

    setButtonLoading(button, isLoading) {
      button.classList.toggle("working", isLoading);
      button.setAttribute("aria-busy", String(isLoading));

      if (isLoading) {
        button.setAttribute("aria-disabled", "true");
      } else {
        button.removeAttribute("aria-disabled");
      }
    }

    clearCartError(form) {
      form.querySelector("[data-accessory-cart-error]")?.remove();
    }

    showCartError(form, error) {
      this.clearCartError(form);

      const alert = document.createElement("span");
      alert.className = "alert alert--error";
      alert.dataset.accessoryCartError = "";
      alert.setAttribute("role", "alert");
      alert.textContent =
        error instanceof Error ? error.message : "The request could not be completed.";
      form.append(alert);
    }

    handleKeydown(event) {
      if (
        event.target !== this.track &&
        !(event.target instanceof Element && event.target.matches("[data-carousel-page]"))
      ) {
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        this.go(-1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        this.go(1);
      } else if (event.key === "Home") {
        event.preventDefault();
        this.goToPage(0);
      } else if (event.key === "End") {
        event.preventDefault();
        this.goToPage(this.totalPages - 1);
      }
    }

    handlePointerEnter(event) {
      if (this.pauseOnHover && event.pointerType === "mouse") {
        this.pauseAutoplay("hover");
      }
    }

    handlePointerLeave(event) {
      if (event.pointerType === "mouse") {
        this.resumeAutoplay("hover");
      }
    }

    handleFocusIn() {
      this.pauseAutoplay("focus");
    }

    handleFocusOut(event) {
      if (!(event.relatedTarget instanceof Node) || !this.contains(event.relatedTarget)) {
        this.resumeAutoplay("focus");
      }
    }

    handleVisibilityChange() {
      if (document.hidden) {
        this.pauseAutoplay("visibility");
      } else {
        this.resumeAutoplay("visibility");
      }
    }

    handleMotionPreferenceChange() {
      this.syncAutoplay();
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
      this.pauseAutoplay("drag");
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

      this.updateTrackPosition(visualOffset, false);
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

      // Flush the drag transform before re-enabling the snap transition.
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
        this.go(distance < 0 ? 1 : -1);
      } else {
        this.updateTrackPosition();
        this.syncAutoplay();
      }

      if (wasDragging) {
        this.suppressClick = true;
        window.clearTimeout(this.suppressClickTimer);
        this.suppressClickTimer = window.setTimeout(() => {
          this.suppressClick = false;
        }, 100);
      }

      this.resumeAutoplay("drag");
    }

    handleWheel(event) {
      if (
        !this.wheelNavigationEnabled ||
        this.totalPages <= 1 ||
        event.ctrlKey ||
        event.metaKey ||
        (event.target instanceof Element &&
          event.target.closest("input, select, textarea"))
      ) {
        return;
      }

      let delta =
        Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;

      if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) {
        delta *= 16;
      } else if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
        delta *= this.containerWidth;
      }

      if (Math.abs(delta) < 1) {
        return;
      }

      const direction = delta > 0 ? 1 : -1;
      const canNavigate =
        direction > 0 ? this.page < this.totalPages - 1 : this.page > 0;

      // At either boundary, return wheel control to the document.
      if (!canNavigate) {
        this.wheelDelta = 0;
        return;
      }

      event.preventDefault();
      this.wheelDelta += delta;
      window.clearTimeout(this.wheelResetTimer);
      this.wheelResetTimer = window.setTimeout(() => {
        this.wheelDelta = 0;
      }, 180);

      const now = performance.now();
      if (
        Math.abs(this.wheelDelta) < WHEEL_THRESHOLD ||
        now - this.lastWheelNavigation < WHEEL_COOLDOWN
      ) {
        return;
      }

      this.lastWheelNavigation = now;
      this.wheelDelta = 0;
      this.go(direction);
    }

    handleNativeDragStart(event) {
      event.preventDefault();
    }

    pauseAutoplay(reason) {
      this.pauseReasons.add(reason);
      this.clearAutoplay();
    }

    resumeAutoplay(reason) {
      this.pauseReasons.delete(reason);
      this.syncAutoplay();
    }

    clearAutoplay() {
      window.clearTimeout(this.autoplayTimer);
      this.autoplayTimer = null;
    }

    syncAutoplay() {
      this.clearAutoplay();

      if (
        !this.autoplayEnabled ||
        this.totalPages <= 1 ||
        this.pauseReasons.size > 0 ||
        document.hidden
      ) {
        return;
      }

      this.autoplayTimer = window.setTimeout(() => {
        this.go(1, { wrap: true, restartAutoplay: false });
        this.syncAutoplay();
      }, this.autoplayInterval);
    }
  }

  if (!customElements.get(ELEMENT_NAME)) {
    customElements.define(ELEMENT_NAME, AccessoryCarousel);
  }
})();
