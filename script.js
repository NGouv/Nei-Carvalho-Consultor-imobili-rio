import { escapeHtml, fetchPublishedProperties, fetchPublishedProperty, supabase } from "./supabase.js";

let properties = [];

const whatsappNumber = "5515996008542";
const formatPrice = (price, property) => {
  const formatted = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0
  }).format(price);
  if (property?.purpose === "alugar") return `${formatted}/mês`;
  if (property?.purpose === "temporada") return `${formatted}/diária`;
  return formatted;
};

function whatsappUrl(property) {
  const message = property
    ? `Olá, Nei! Vi o imóvel ${property.title} no seu site e gostaria de mais informações.`
    : "Olá, Nei! Gostaria de conversar sobre meus planos imobiliários.";
  return `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
}

function adaptProperty(property) {
  return {
    ...property,
    type: property.property_type,
    purpose: property.purpose === "rent" ? "alugar" : "comprar",
    location: [property.neighborhood, property.city].filter(Boolean).join(", "),
    bedrooms: property.bedrooms ?? 0,
    bathrooms: property.bathrooms ?? 0,
    parking: property.parking ?? 0,
    area: property.total_area,
    features: property.features || [],
    images: property.images || []
  };
}

function propertyCard(property, index) {
  const roomSpecs = property.type === "Terreno"
    ? `<span>${property.area ? `${escapeHtml(property.area)} m²` : "Área não informada"}</span><span>Condomínio</span>`
    : `<span>${property.bedrooms || "—"} quartos</span><span>${property.bathrooms || "—"} banheiros</span><span>${property.parking || "—"} vagas</span>${property.area ? `<span>${escapeHtml(property.area)} m²</span>` : ""}`;
  const image = property.images[0];
  return `
    <article class="property-card reveal is-visible" style="--card-index:${index}">
      <div class="property-photo">
        ${image ? `<img src="${escapeHtml(image.src)}" alt="${escapeHtml(image.alt)}" loading="lazy">` : ""}
        ${property.featured ? '<span class="property-badge">Destaque</span>' : ""}
        <a class="photo-arrow" href="imovel.html?id=${encodeURIComponent(property.id)}" aria-label="Ver ${escapeHtml(property.title)}">↗</a>
      </div>
      <div class="property-body">
        <p class="property-type">${escapeHtml(property.type)} <span>·</span> ${escapeHtml(property.neighborhood)}</p>
        <h3>${escapeHtml(property.title)}</h3>
        <p class="property-location"><span aria-hidden="true">⌖</span> ${escapeHtml(property.city)}</p>
        <div class="property-specs">${roomSpecs}</div>
        <div class="property-bottom"><strong>${formatPrice(property.price, property)}</strong><a href="imovel.html?id=${encodeURIComponent(property.id)}">Ver imóvel <span aria-hidden="true">→</span></a></div>
        <a class="interest-link" href="${whatsappUrl(property)}" target="_blank" rel="noopener noreferrer">Tenho interesse <span aria-hidden="true">↗</span></a>
      </div>
    </article>`;
}

function matchesPriceRange(price, range, purpose) {
  if (purpose === "alugar") {
    if (range === "ate800") return price <= 5000;
    if (range === "800a1500") return price > 5000 && price <= 7500;
    if (range === "1500a2500") return price > 7500;
    return true;
  }
  if (purpose === "temporada") {
    if (range === "ate800") return price <= 1000;
    if (range === "800a1500") return price > 1000 && price <= 1500;
    if (range === "1500a2500") return price > 1500;
    return true;
  }
  if (range === "ate800") return price <= 800000;
  if (range === "800a1500") return price > 800000 && price <= 1500000;
  if (range === "1500a2500") return price > 1500000 && price <= 2500000;
  if (range === "acima2500") return price > 2500000;
  return true;
}

function initializeCatalog() {
  const form = document.querySelector("#propertySearch");
  const track = document.querySelector("#propertyTrack");
  const viewport = document.querySelector("#carouselViewport");
  if (!form || !track || !viewport) return;

  const typeFilter = document.querySelector("#typeFilter");
  const priceFilter = document.querySelector("#priceFilter");
  const purposeFilter = document.querySelector("#purposeFilter");
  const previous = document.querySelector("#carouselPrev");
  const next = document.querySelector("#carouselNext");
  const emptyResults = document.querySelector("#emptyResults");
  const emptyTitle = document.querySelector("#emptyResultsTitle");
  const emptyMessage = document.querySelector("#emptyResultsMessage");
  const progress = document.querySelector("#carouselProgress");
  const clearFilters = document.querySelector("#clearFilters");
  const defaultPriceOptions = [
    { value: "todos", label: "Qualquer valor" },
    { value: "ate800", label: "Até R$ 800 mil" },
    { value: "800a1500", label: "R$ 800 mil a R$ 1,5 mi" },
    { value: "1500a2500", label: "R$ 1,5 mi a R$ 2,5 mi" },
    { value: "acima2500", label: "Acima de R$ 2,5 mi" }
  ];
  const purposePriceOptions = {
    alugar: [
      { value: "todos", label: "Qualquer valor" },
      { value: "ate800", label: "Até R$ 5 mil/mês" },
      { value: "800a1500", label: "R$ 5 mil a R$ 7,5 mil/mês" },
      { value: "1500a2500", label: "Acima de R$ 7,5 mil/mês" }
    ],
    temporada: [
      { value: "todos", label: "Qualquer valor" },
      { value: "ate800", label: "Até R$ 1.000/diária" },
      { value: "800a1500", label: "R$ 1.000 a R$ 1.500/diária" },
      { value: "1500a2500", label: "Acima de R$ 1.500/diária" }
    ]
  };
  const updatePriceOptions = () => {
    const options = purposePriceOptions[purposeFilter.value] || defaultPriceOptions;
    const selected = priceFilter.value;
    priceFilter.replaceChildren(...options.map(({ value, label }) => new Option(label, value)));
    if (options.some((option) => option.value === selected)) priceFilter.value = selected;
  };

  const updateControls = () => {
    const maxScroll = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
    previous.disabled = viewport.scrollLeft <= 2;
    next.disabled = viewport.scrollLeft >= maxScroll - 2;
    progress.style.width = `${maxScroll ? (viewport.scrollLeft / maxScroll) * 100 : 100}%`;
  };

  const applyFilters = () => {
    const type = typeFilter.value;
    const range = priceFilter.value;
    const filtered = properties.filter((property) => {
      const matchesType = type === "todos"
        || property.type === type
        || (type === "Casa" && property.type.toLowerCase().startsWith("casa"));
      const purpose = purposeFilter.value;
      const matchesPurpose = purpose === "todos" || property.purpose === purpose;
      return matchesType && matchesPriceRange(property.price, range, property.purpose) && matchesPurpose;
    });
    track.innerHTML = filtered.map(propertyCard).join("");
    viewport.scrollTo({ left: 0, behavior: "smooth" });
    viewport.hidden = filtered.length === 0;
    document.querySelector(".carousel-controls").hidden = filtered.length === 0;
    document.querySelector(".carousel-progress").hidden = filtered.length === 0;
    document.querySelector(".carousel-hint").hidden = filtered.length === 0;
    emptyResults.hidden = filtered.length !== 0;
    if (!filtered.length && !catalogLoadError) {
      emptyTitle.textContent = properties.length
        ? "Nenhum imóvel encontrado com esses filtros."
        : "Nenhum imóvel disponível no momento.";
      emptyMessage.textContent = properties.length
        ? "Experimente ajustar a busca para ver outras opções."
        : "Novas opções poderão ser publicadas em breve.";
      clearFilters.hidden = properties.length === 0;
      clearFilters.textContent = "Limpar filtros →";
    }
    updateControls();
  };

  let catalogLoadError = false;
  const refreshProperties = async () => {
    try {
      const loaded = await fetchPublishedProperties();
      properties = loaded.map(adaptProperty);
      catalogLoadError = false;
      applyFilters();
    } catch (error) {
      catalogLoadError = true;
      track.replaceChildren();
      viewport.hidden = true;
      document.querySelector(".carousel-controls").hidden = true;
      document.querySelector(".carousel-progress").hidden = true;
      document.querySelector(".carousel-hint").hidden = true;
      emptyTitle.textContent = "Não foi possível carregar os imóveis.";
      emptyMessage.textContent = `${error.message} Verifique a configuração e tente novamente.`;
      clearFilters.hidden = false;
      clearFilters.textContent = "Tentar novamente →";
      emptyResults.hidden = false;
      updateControls();
    }
  };

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    applyFilters();
    document.querySelector("#imoveis").scrollIntoView({ behavior: "smooth", block: "start" });
  });
  typeFilter.addEventListener("change", applyFilters);
  priceFilter.addEventListener("change", applyFilters);
  purposeFilter.addEventListener("change", () => {
    updatePriceOptions();
    applyFilters();
  });
  clearFilters.addEventListener("click", () => {
    if (catalogLoadError) {
      void refreshProperties();
      return;
    }
    typeFilter.value = "todos";
    priceFilter.value = "todos";
    purposeFilter.value = "todos";
    updatePriceOptions();
    applyFilters();
  });
  previous.addEventListener("click", () => {
    const card = track.querySelector(".property-card");
    viewport.scrollBy({ left: -(card ? card.getBoundingClientRect().width + 24 : viewport.clientWidth), behavior: "smooth" });
  });
  next.addEventListener("click", () => {
    const card = track.querySelector(".property-card");
    viewport.scrollBy({ left: card ? card.getBoundingClientRect().width + 24 : viewport.clientWidth, behavior: "smooth" });
  });
  viewport.addEventListener("scroll", updateControls, { passive: true });

  let pointerStart = null;
  viewport.addEventListener("pointerdown", (event) => {
    if (event.pointerType !== "mouse" || event.target.closest("a, button")) return;
    pointerStart = { x: event.clientX, scrollLeft: viewport.scrollLeft };
    viewport.classList.add("is-dragging");
    viewport.setPointerCapture(event.pointerId);
  });
  viewport.addEventListener("pointermove", (event) => {
    if (!pointerStart) return;
    viewport.scrollLeft = pointerStart.scrollLeft - (event.clientX - pointerStart.x);
  });
  const stopDragging = () => {
    pointerStart = null;
    viewport.classList.remove("is-dragging");
  };
  viewport.addEventListener("pointerup", stopDragging);
  viewport.addEventListener("pointercancel", stopDragging);

  void refreshProperties();
  if (supabase) {
    supabase.channel("public-property-updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "properties" }, () => {
        void refreshProperties();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "property_images" }, () => {
        void refreshProperties();
      })
      .subscribe((status, error) => {
        if (status === "CHANNEL_ERROR") console.error("Falha na atualização em tempo real dos imóveis.", error);
      });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") void refreshProperties();
    });
  }
}

async function initializeDetailPage() {
  const target = document.querySelector("#detailContent");
  if (!target) return;
  const id = new URLSearchParams(window.location.search).get("id");
  const showFallback = (heading, message) => {
    target.innerHTML = `
      <div class="detail-fallback">
        <p class="eyebrow eyebrow-dark"><span class="eyebrow-mark"></span> Imóvel indisponível</p>
        <h1>${escapeHtml(heading)}</h1>
        <p>${escapeHtml(message)}</p>
        <a class="button button-navy" href="index.html#imoveis">Voltar aos imóveis <span aria-hidden="true">→</span></a>
      </div>`;
  };

  if (!id) {
    showFallback("Este imóvel não está disponível.", "O endereço pode estar incorreto. Explore os imóveis publicados para conhecer outras opções.");
    document.title = "Imóvel não encontrado | Nei Carvalho";
    return;
  }

  let property;
  try {
    const loaded = await fetchPublishedProperty(id);
    if (!loaded) {
      showFallback("Este imóvel não está disponível.", "Ele pode ter sido removido ou não estar mais publicado. Explore o catálogo para encontrar outras opções.");
      document.title = "Imóvel não encontrado | Nei Carvalho";
      return;
    }
    property = adaptProperty(loaded);
  } catch (error) {
    showFallback("Não foi possível carregar este imóvel.", `${error.message} Tente novamente em instantes ou volte ao catálogo.`);
    document.title = "Falha ao carregar imóvel | Nei Carvalho";
    return;
  }

  document.title = `${property.title} | Nei Carvalho`;
  const currency = (value) => value === null || value === undefined
    ? ""
    : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 }).format(value);
  const specs = property.type === "Terreno"
    ? `<div><strong>${property.area ? `${escapeHtml(property.area)} m²` : "—"}</strong><span>Área total</span></div><div><strong>Terreno</strong><span>Tipo de imóvel</span></div>`
    : `<div><strong>${property.bedrooms || "—"}</strong><span>Quartos</span></div><div><strong>${property.bathrooms || "—"}</strong><span>Banheiros</span></div><div><strong>${property.parking || "—"}</strong><span>Vagas</span></div><div><strong>${property.area ? `${escapeHtml(property.area)} m²` : "—"}</strong><span>Área total</span></div>`;
  const additionalDetails = [
    property.reference && ["Referência", property.reference],
    property.suites > 0 && ["Suítes", property.suites],
    property.built_area && ["Área construída", `${property.built_area} m²`],
    property.condominium !== null && ["Condomínio", currency(property.condominium)],
    property.iptu !== null && ["IPTU", currency(property.iptu)],
    property.address && ["Endereço", property.address]
  ].filter(Boolean);
  const propertyImages = property.images || [];
  const gallery = propertyImages.length ? `
    <div class="detail-gallery">
      <div class="gallery-main">
        <img id="galleryMainImage" src="${escapeHtml(propertyImages[0].src)}" alt="${escapeHtml(propertyImages[0].alt)}">
        ${propertyImages.length > 1 ? '<button class="gallery-arrow gallery-prev" type="button" aria-label="Foto anterior"><span aria-hidden="true">←</span></button><button class="gallery-arrow gallery-next" type="button" aria-label="Próxima foto"><span aria-hidden="true">→</span></button>' : ""}
        <span class="gallery-counter" aria-live="polite">01 <span>/</span> ${String(propertyImages.length).padStart(2, "0")}</span>
      </div>
      <div class="gallery-thumbnails" aria-label="Fotografias do imóvel">
        ${propertyImages.map((image, index) => `<button class="gallery-thumb${index === 0 ? " is-active" : ""}" type="button" data-image-index="${index}" aria-label="Exibir foto ${index + 1}: ${escapeHtml(image.alt)}" aria-pressed="${index === 0}"><img src="${escapeHtml(image.src)}" alt="" loading="lazy"></button>`).join("")}
      </div>
    </div>` : "";

  target.innerHTML = `
    <div class="detail-heading">
      <div><p class="eyebrow eyebrow-dark"><span class="eyebrow-mark"></span> ${escapeHtml(property.type)} <span class="eyebrow-divider">·</span> ${property.purpose === "alugar" ? "Aluguel" : "Venda"}</p><h1>${escapeHtml(property.title)}</h1><p class="detail-location"><span aria-hidden="true">⌖</span> ${escapeHtml(property.neighborhood)}, ${escapeHtml(property.city)}</p></div>
      <div class="detail-price"><span>${property.purpose === "alugar" ? "Valor do aluguel" : "Preço"}</span><strong>${formatPrice(property.price, property)}</strong></div>
    </div>
    ${gallery}
    <div class="detail-layout">
      <div class="detail-information">
        <div class="detail-specs">${specs}</div>
        <section class="detail-description"><p class="eyebrow eyebrow-dark"><span class="eyebrow-mark"></span> Sobre o imóvel</p><h2>Um espaço para chamar de <em>seu.</em></h2><p>${escapeHtml(property.description || "Entre em contato para saber mais sobre este imóvel.")}</p></section>
        ${additionalDetails.length ? `<section class="detail-features"><p class="eyebrow eyebrow-dark"><span class="eyebrow-mark"></span> Informações adicionais</p><ul>${additionalDetails.map(([label, value]) => `<li><span aria-hidden="true">·</span>${escapeHtml(label)}: ${escapeHtml(value)}</li>`).join("")}</ul></section>` : ""}
        ${property.features.length ? `<section class="detail-features"><p class="eyebrow eyebrow-dark"><span class="eyebrow-mark"></span> Características</p><ul>${property.features.map((feature) => `<li><span aria-hidden="true">✓</span>${escapeHtml(feature)}</li>`).join("")}</ul></section>` : ""}
      </div>
      <aside class="contact-card">
        <div class="contact-card-top"><img class="contact-logo" src="assets/logo-trans.png" alt="" width="58" height="58"><div><strong>Nei Carvalho</strong><span>Consultor Imobiliário</span></div></div>
        <p>Converse sobre seus planos e receba orientação personalizada para esta opção.</p>
        <a class="button button-navy button-full" href="${whatsappUrl(property)}" target="_blank" rel="noopener noreferrer">Tenho interesse neste imóvel <span aria-hidden="true">↗</span></a>
        <a class="contact-phone" href="tel:+5515996008542">+55 15 99600-8542</a>
        <p class="contact-disclaimer">Disponibilidade e condições sujeitas à confirmação.</p>
      </aside>
    </div>`;

  if (!propertyImages.length) return;
  const mainImage = target.querySelector("#galleryMainImage");
  const counter = target.querySelector(".gallery-counter");
  let activeImageIndex = 0;
  const showImage = (index) => {
    activeImageIndex = (index + propertyImages.length) % propertyImages.length;
    mainImage.src = propertyImages[activeImageIndex].src;
    mainImage.alt = propertyImages[activeImageIndex].alt;
    counter.innerHTML = `${String(activeImageIndex + 1).padStart(2, "0")} <span>/</span> ${String(propertyImages.length).padStart(2, "0")}`;
    target.querySelectorAll(".gallery-thumb").forEach((thumbnail, thumbnailIndex) => {
      const active = thumbnailIndex === activeImageIndex;
      thumbnail.classList.toggle("is-active", active);
      thumbnail.setAttribute("aria-pressed", String(active));
    });
  };
  target.querySelector(".gallery-prev")?.addEventListener("click", () => showImage(activeImageIndex - 1));
  target.querySelector(".gallery-next")?.addEventListener("click", () => showImage(activeImageIndex + 1));
  target.querySelectorAll(".gallery-thumb").forEach((button) => {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.imageIndex);
      showImage(index);
    });
  });
}

function initializeNavigation() {
  const header = document.querySelector("#siteHeader");
  const toggle = document.querySelector(".menu-toggle");
  const nav = document.querySelector("#primaryNav");
  if (!header || !toggle || !nav) return;

  const mobileViewport = window.matchMedia("(max-width: 720px)");
  const setMenuOpen = (isOpen) => {
    const shouldOpen = isOpen && mobileViewport.matches;
    toggle.setAttribute("aria-expanded", String(shouldOpen));
    toggle.setAttribute("aria-label", shouldOpen ? "Fechar menu" : "Abrir menu");
    nav.classList.toggle("is-open", shouldOpen);
    nav.inert = mobileViewport.matches && !shouldOpen;
    nav.setAttribute("aria-hidden", String(mobileViewport.matches && !shouldOpen));
    document.body.classList.toggle("menu-open", shouldOpen);
  };
  const updateHeader = () => header.classList.toggle("is-scrolled", window.scrollY > 24);
  setMenuOpen(false);
  updateHeader();
  window.addEventListener("scroll", updateHeader, { passive: true });
  toggle.addEventListener("click", () => {
    const isOpen = toggle.getAttribute("aria-expanded") === "true";
    setMenuOpen(!isOpen);
  });
  nav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => setMenuOpen(false));
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setMenuOpen(false);
  });
  mobileViewport.addEventListener("change", (event) => {
    if (!event.matches) setMenuOpen(false);
  });
}

function initializeReveals() {
  const items = document.querySelectorAll(".reveal");
  if (!("IntersectionObserver" in window)) {
    items.forEach((item) => item.classList.add("is-visible"));
    return;
  }
  const observer = new IntersectionObserver((entries, currentObserver) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-visible");
      currentObserver.unobserve(entry.target);
    });
  }, { threshold: 0.12 });
  items.forEach((item, index) => {
    item.style.setProperty("--reveal-index", String(index % 6));
    observer.observe(item);
  });
}

function initializeSite() {
  initializeNavigation();
  initializeCatalog();
  initializeDetailPage();
  initializeReveals();
  document.querySelectorAll("[data-current-year]").forEach((element) => {
    element.textContent = String(new Date().getFullYear());
  });
  document.documentElement.classList.add("reveal-ready");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeSite, { once: true });
} else {
  initializeSite();
}
