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

function whatsappUrl(property, request = "") {
  const propertyDetails = property
    ? [
        property.reference ? `referência ${property.reference}` : property.title,
        property.neighborhood && `bairro ${property.neighborhood}`
      ].filter(Boolean).join(", ")
    : "";
  const message = property
    ? request === "visita"
      ? `Olá, Nei! Gostaria de agendar uma visita para conhecer o imóvel ${propertyDetails}.`
      : request
        ? `Olá, Nei! Gostaria de ${request} sobre o imóvel ${propertyDetails}.`
        : `Olá, Nei! Vi o imóvel ${property.title} no seu site e gostaria de mais informações.`
    : "Olá, Nei! Gostaria de conversar sobre meus planos imobiliários.";
  return `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
}

function adaptProperty(property) {
  return {
    ...property,
    type: property.property_type,
    purpose: property.purpose === "rent" ? "alugar" : property.purpose === "sale" ? "comprar" : property.purpose,
    location: [property.neighborhood, property.city].filter(Boolean).join(", "),
    bedrooms: property.bedrooms,
    bathrooms: property.bathrooms,
    parking: property.parking,
    area: property.total_area,
    features: property.features || [],
    images: property.images || []
  };
}

const propertySpecIcons = {
  bedrooms: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 19V8m0 7h18v4M3 12h18a2 2 0 0 1 2 2v1M7 12V9a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3"/></svg>',
  bathrooms: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h16v3a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5v-3ZM6 12V5a2 2 0 0 1 4 0M8 20v2m8-2v2"/></svg>',
  parking: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 20V4h6a5 5 0 0 1 0 10H7"/></svg>',
  area: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h16v16H4zM9 4v4m6-4v4m5 3h-4m4 5h-4M9 20v-4m-5-1h4m-4-5h4"/></svg>'
};
const propertyFavoriteStorageKey = "nei-carvalho-property-favorites";
let favoritePropertyIds = new Set();

function readFavoritePropertyIds() {
  try {
    const stored = JSON.parse(localStorage.getItem(propertyFavoriteStorageKey) || "[]");
    favoritePropertyIds = new Set(Array.isArray(stored) ? stored.filter((id) => typeof id === "string") : []);
  } catch (error) {
    console.error("Não foi possível carregar os imóveis favoritos salvos neste navegador.", error);
    favoritePropertyIds = new Set();
  }
}

function propertySpec(icon, label, value, suffix = "") {
  if (value === null || value === undefined || value === "" || Number(value) <= 0) return "";
  return `<span class="property-spec"><span class="property-spec-icon">${propertySpecIcons[icon]}</span><span>${escapeHtml(value)}${suffix ? ` ${suffix}` : ""} ${label}</span></span>`;
}

function propertyCard(property, index) {
  const roomSpecs = [
    propertySpec("bedrooms", "quartos", property.bedrooms),
    propertySpec("bathrooms", "banheiros", property.bathrooms),
    propertySpec("parking", "vagas", property.parking),
    propertySpec("area", "m²", property.area)
  ].filter(Boolean).join("");
  const image = property.images[0];
  const detailUrl = `imovel.html?id=${encodeURIComponent(property.id)}`;
  const purposeLabel = property.purpose === "alugar"
    ? "Aluguel"
    : property.purpose === "temporada" ? "Temporada" : "Venda";
  const location = [property.neighborhood, property.city].filter(Boolean).join(", ");
  const imageCount = property.images.length;
  return `
    <article class="property-card reveal is-visible" style="--card-index:${index}">
      <div class="property-photo">
        ${image ? `<img class="property-photo-image" src="${escapeHtml(image.src)}" alt="${escapeHtml(image.alt || property.title)}" loading="lazy">` : ""}
        <div class="property-photo-badges">
          ${property.featured ? '<span class="property-badge property-featured-badge">Destaque</span>' : ""}
          <span class="property-badge property-purpose-badge">${purposeLabel}</span>
        </div>
        <button class="property-favorite${favoritePropertyIds.has(String(property.id)) ? " is-favorite" : ""}" type="button"
          data-property-favorite="${escapeHtml(String(property.id))}"
          aria-label="${favoritePropertyIds.has(String(property.id)) ? "Remover dos favoritos" : "Adicionar aos favoritos"}"
          aria-pressed="${favoritePropertyIds.has(String(property.id))}">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.7a5.5 5.5 0 0 0-7.8 0L12 5.8l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.4 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z"/></svg>
        </button>
        ${imageCount ? `<span class="property-photo-count"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.5"/><path d="m21 15-5-5L5 19"/></svg>${imageCount}</span>` : ""}
      </div>
      <div class="property-body">
        <p class="property-location"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg><span>${escapeHtml(location)}</span></p>
        <h3><a class="property-card-link" href="${detailUrl}" aria-label="Ver detalhes de ${escapeHtml(property.title)}">${escapeHtml(property.title)}</a></h3>
        <div class="property-specs">${roomSpecs}</div>
        <a class="interest-link" href="${whatsappUrl(property)}" target="_blank" rel="noopener noreferrer">Tenho interesse <span aria-hidden="true">↗</span></a>
        <div class="property-bottom"><strong>${formatPrice(property.price, property)}</strong><a href="${detailUrl}">Ver imóvel <span aria-hidden="true">→</span></a></div>
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
  const pagination = document.querySelector("#catalogPagination");
  const emptyResults = document.querySelector("#emptyResults");
  const emptyTitle = document.querySelector("#emptyResultsTitle");
  const emptyMessage = document.querySelector("#emptyResultsMessage");
  const clearFilters = document.querySelector("#clearFilters");
  const pageSize = 9;
  let currentPage = 1;
  readFavoritePropertyIds();
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

  const renderPagination = (totalPages) => {
    if (!totalPages) {
      pagination.hidden = true;
      pagination.replaceChildren();
      return;
    }

    const pages = totalPages <= 7
      ? Array.from({ length: totalPages }, (_, index) => index + 1)
      : [
          1,
          ...(currentPage > 3 ? ["ellipsis-start"] : []),
          ...Array.from(
            { length: Math.min(totalPages - 1, currentPage + 1) - Math.max(2, currentPage - 1) + 1 },
            (_, index) => Math.max(2, currentPage - 1) + index
          ),
          ...(currentPage < totalPages - 2 ? ["ellipsis-end"] : []),
          totalPages
        ];
    const pageButton = (label, page, disabled = false, current = false, ariaLabel = label) => `
      <button class="catalog-page-button" type="button" data-page="${page}"
        aria-label="${escapeHtml(ariaLabel)}"${current ? ' aria-current="page"' : ""}${disabled ? " disabled" : ""}>${escapeHtml(label)}</button>`;

    pagination.innerHTML = [
      pageButton("Anterior", currentPage - 1, currentPage === 1, false, "Página anterior"),
      ...pages.map((page) => typeof page === "number"
        ? pageButton(String(page), page, false, page === currentPage, `Página ${page}`)
        : '<span class="catalog-page-ellipsis" aria-hidden="true">…</span>'),
      pageButton("Próxima", currentPage + 1, currentPage === totalPages, false, "Próxima página")
    ].join("");
    pagination.hidden = false;
  };

  const applyFilters = (resetPage = true) => {
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
    const totalPages = Math.ceil(filtered.length / pageSize);
    if (resetPage) currentPage = 1;
    else currentPage = Math.min(currentPage, Math.max(totalPages, 1));
    const start = (currentPage - 1) * pageSize;
    track.innerHTML = filtered.slice(start, start + pageSize).map(propertyCard).join("");
    viewport.hidden = filtered.length === 0;
    renderPagination(totalPages);
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
  };

  track.addEventListener("error", (event) => {
    if (event.target.matches(".property-photo-image")) event.target.remove();
  }, true);
  track.addEventListener("click", (event) => {
    const button = event.target.closest("[data-property-favorite]");
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    const id = button.dataset.propertyFavorite;
    if (favoritePropertyIds.has(id)) favoritePropertyIds.delete(id);
    else favoritePropertyIds.add(id);
    button.classList.toggle("is-favorite", favoritePropertyIds.has(id));
    button.setAttribute("aria-pressed", String(favoritePropertyIds.has(id)));
    button.setAttribute("aria-label", favoritePropertyIds.has(id) ? "Remover dos favoritos" : "Adicionar aos favoritos");
    try {
      localStorage.setItem(propertyFavoriteStorageKey, JSON.stringify([...favoritePropertyIds]));
    } catch (error) {
      console.error("Não foi possível salvar os imóveis favoritos neste navegador.", error);
    }
  });

  let catalogLoadError = false;
  const refreshProperties = async () => {
    try {
      const loaded = await fetchPublishedProperties();
      properties = loaded.map(adaptProperty);
      catalogLoadError = false;
      applyFilters(false);
    } catch (error) {
      catalogLoadError = true;
      track.replaceChildren();
      viewport.hidden = true;
      pagination.hidden = true;
      emptyTitle.textContent = "Não foi possível carregar os imóveis.";
      emptyMessage.textContent = `${error.message} Verifique a configuração e tente novamente.`;
      clearFilters.hidden = false;
      clearFilters.textContent = "Tentar novamente →";
      emptyResults.hidden = false;
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
  pagination.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-page]");
    if (!button || button.disabled) return;
    currentPage = Number(button.dataset.page);
    applyFilters(false);
    document.querySelector("#imoveis").scrollIntoView({ behavior: "smooth", block: "start" });
  });

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
  let propertyRecord;
  try {
    const loaded = await fetchPublishedProperty(id);
    if (!loaded) {
      showFallback("Este imóvel não está disponível.", "Ele pode ter sido removido ou não estar mais publicado. Explore o catálogo para encontrar outras opções.");
      document.title = "Imóvel não encontrado | Nei Carvalho";
      return;
    }
    propertyRecord = loaded;
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
  const numberValue = (value) => value === null || value === undefined || value === ""
    ? "—"
    : new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(value);
  const specifications = [
    { label: "Quartos", value: propertyRecord.bedrooms, icon: '<path d="M3 11V6a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v5"/><path d="M10 8h7a4 4 0 0 1 4 4v7h-2v-3H5v3H3v-8a2 2 0 0 1 2-2h5"/><path d="M3 13h18"/>' },
    { label: "Banheiros", value: propertyRecord.bathrooms, icon: '<path d="M4 12h16v3a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5v-3Z"/><path d="M6 12V5a2 2 0 0 1 4 0v1"/><path d="M8 20v2m8-2v2"/>' },
    { label: "Vagas", value: propertyRecord.parking, icon: '<path d="M5 19 3 12l2-7h14l2 7-2 7H5Z"/><path d="M7 12h10M8 8h8l1 4H7l1-4Zm0 7h.01M16 15h.01"/>' },
    { label: "Área total", value: propertyRecord.total_area, unit: "m²", icon: '<path d="M4 20V4m0 16h16"/><path d="M8 20v-3m4 3v-5m4 5v-3m4 3v-5M4 8h3m-3 4h5m-5 4h3"/>' }
  ];
  const specs = specifications.map(({ label, value, unit, icon }) => {
    const formattedValue = numberValue(value);
    const displayValue = formattedValue === "—" ? formattedValue : `${formattedValue}${unit ? ` ${unit}` : ""}`;
    return `<article class="detail-spec-card"><svg viewBox="0 0 24 24" aria-hidden="true">${icon}</svg><strong>${escapeHtml(displayValue)}</strong><span>${escapeHtml(label)}</span></article>`;
  }).join("");
  const hasValue = (value) => value !== null && value !== undefined && value !== "";
  const additionalDetails = [
    hasValue(property.reference) && ["Referência", property.reference],
    hasValue(property.suites) && ["Suítes", numberValue(property.suites)],
    hasValue(property.built_area) && ["Área construída", `${numberValue(property.built_area)} m²`],
    hasValue(property.condominium) && ["Condomínio", currency(property.condominium)],
    hasValue(property.iptu) && ["IPTU", currency(property.iptu)],
    hasValue(property.address) && ["Endereço", property.address]
  ].filter(Boolean);
  const propertyImages = property.images || [];
  const gallery = propertyImages.length ? `
    <section class="detail-gallery" aria-label="Galeria de fotos do imóvel">
      <div class="detail-gallery-grid" data-photo-count="${Math.min(propertyImages.length, 4)}">
        ${propertyImages.slice(0, 4).map((image, index) => `
          <button class="detail-gallery-photo${index === 0 ? " detail-gallery-photo-main" : ""}" type="button" data-open-image="${index}" aria-label="Abrir foto ${index + 1} de ${propertyImages.length}: ${escapeHtml(image.alt || property.title)}">
            <img src="${escapeHtml(image.src)}" alt="${escapeHtml(image.alt || property.title)}" loading="eager">
          </button>`).join("")}
        <button class="detail-gallery-all" type="button" data-open-image="0">Ver todas as ${propertyImages.length} ${propertyImages.length === 1 ? "foto" : "fotos"}</button>
      </div>
      <dialog class="detail-lightbox" data-photo-count="${propertyImages.length}" aria-label="Galeria de fotos">
        <div class="detail-lightbox-toolbar">
          <span class="detail-lightbox-counter" aria-live="polite" aria-atomic="true"></span>
          <button class="detail-lightbox-close" type="button" aria-label="Fechar galeria">×</button>
        </div>
        <div class="detail-lightbox-stage">
          <button class="detail-lightbox-arrow detail-lightbox-prev" type="button" aria-label="Foto anterior"><span aria-hidden="true">←</span></button>
          <img class="detail-lightbox-image" alt="">
          <button class="detail-lightbox-arrow detail-lightbox-next" type="button" aria-label="Próxima foto"><span aria-hidden="true">→</span></button>
        </div>
      </dialog>
    </section>` : `<div class="detail-gallery-empty">Este imóvel ainda não possui fotos cadastradas.</div>`;
  const whatsappIntent = whatsappUrl(property, "mais informações");
  const whatsappVisit = whatsappUrl(property, "visita");
  const purposeLabel = property.purpose === "alugar" ? "Aluguel" : "Venda";
  const propertyDetailRows = additionalDetails.map(([label, value]) => `
    <div class="detail-additional-item"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("");

  target.innerHTML = `
    <div class="detail-heading">
      <div class="detail-heading-main">
        <div class="detail-badges"><span>${escapeHtml(purposeLabel)}</span><span>${escapeHtml(property.type)}</span></div>
        <h1>${escapeHtml(property.title)}</h1>
        <p class="detail-location"><span aria-hidden="true">⌖</span>${escapeHtml(property.neighborhood)}, ${escapeHtml(property.city)}</p>
      </div>
      <div class="detail-heading-side">
        <div class="detail-price"><span>PREÇO</span><strong>${formatPrice(property.price, property)}</strong></div>
        <div class="detail-heading-actions">
          <button class="detail-round-button" type="button" data-share-property aria-label="Compartilhar imóvel" title="Compartilhar"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.7 10.7 6.6-4.4m-6.6 7 6.6 4.4"/></svg></button>
          <button class="detail-round-button" type="button" data-favorite-property aria-label="Favoritar imóvel" aria-pressed="false" title="Favoritar"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.8a5.5 5.5 0 0 0-7.8 0L12 5.9l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.3 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z"/></svg></button>
        </div>
        <span class="detail-action-feedback" role="status" aria-live="polite"></span>
      </div>
    </div>
    ${gallery}
    <div class="detail-layout">
      <div class="detail-information">
        <div class="detail-specs" aria-label="Características do imóvel">${specs}</div>
        <section class="detail-description"><p class="detail-eyebrow">SOBRE O IMÓVEL</p><h2>Um espaço para chamar de seu.</h2><p>${escapeHtml(property.description || "Descrição não informada.")}</p></section>
        ${additionalDetails.length ? `<section class="detail-additional"><h2>Informações adicionais</h2><dl>${propertyDetailRows}</dl></section>` : ""}
        ${property.features.length ? `<section class="detail-features"><h2>Características</h2><ul>${property.features.map((feature) => `<li><span aria-hidden="true">✓</span>${escapeHtml(feature)}</li>`).join("")}</ul></section>` : ""}
      </div>
      <aside class="contact-card" aria-label="Contato do corretor">
        <div class="contact-card-top"><img class="contact-avatar" src="assets/logo-trans.png" alt="Marca Nei Carvalho" width="72" height="72"><div><strong>Nei Carvalho</strong><span>Consultor imobiliário</span></div></div>
        <p>Estou à disposição para ajudar você a conhecer melhor este imóvel.</p>
        <a class="detail-contact-button detail-contact-whatsapp" href="${whatsappIntent}" target="_blank" rel="noopener noreferrer"><span aria-hidden="true">◉</span> Falar no WhatsApp</a>
        <a class="detail-contact-button detail-contact-outline" href="${whatsappVisit}" target="_blank" rel="noopener noreferrer">Agendar visita</a>
        <a class="contact-phone" href="tel:+5515996008542">+55 15 99600-8542</a>
      </aside>
    </div>
    <div class="detail-mobile-bar">
      <div><span>PREÇO</span><strong>${formatPrice(property.price, property)}</strong></div>
      <a href="${whatsappIntent}" target="_blank" rel="noopener noreferrer"><span aria-hidden="true">◉</span> WhatsApp</a>
    </div>`;

  if (propertyImages.length) {
    let activeImageIndex = 0;
    const lightbox = target.querySelector(".detail-lightbox");
    const lightboxImage = target.querySelector(".detail-lightbox-image");
    const lightboxCounter = target.querySelector(".detail-lightbox-counter");
    const closeButton = target.querySelector(".detail-lightbox-close");
    let lastGalleryTrigger;
    const preloadAdjacentImages = () => {
      if (propertyImages.length < 2) return;
      [-1, 1].forEach((offset) => {
        const image = new Image();
        image.src = propertyImages[(activeImageIndex + offset + propertyImages.length) % propertyImages.length].src;
      });
    };
    const showImage = (index) => {
      activeImageIndex = (index + propertyImages.length) % propertyImages.length;
      lightboxImage.src = propertyImages[activeImageIndex].src;
      lightboxImage.alt = propertyImages[activeImageIndex].alt || property.title;
      lightboxCounter.textContent = `${activeImageIndex + 1} / ${propertyImages.length}`;
      preloadAdjacentImages();
    };
    const openGallery = (index, trigger) => {
      lastGalleryTrigger = trigger;
      showImage(index);
      lightbox.showModal();
      closeButton.focus();
    };
    target.querySelectorAll("[data-open-image]").forEach((button) => {
      button.addEventListener("click", () => openGallery(Number(button.dataset.openImage), button));
    });
    closeButton.addEventListener("click", () => lightbox.close());
    target.querySelector(".detail-lightbox-prev")?.addEventListener("click", () => showImage(activeImageIndex - 1));
    target.querySelector(".detail-lightbox-next")?.addEventListener("click", () => showImage(activeImageIndex + 1));
    lightbox.addEventListener("click", (event) => {
      if (event.target === lightbox) lightbox.close();
    });
    lightbox.addEventListener("close", () => lastGalleryTrigger?.focus());
    document.addEventListener("keydown", (event) => {
      if (!lightbox.open) return;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        showImage(activeImageIndex - 1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        showImage(activeImageIndex + 1);
      } else if (event.key === "Escape") {
        event.preventDefault();
        lightbox.close();
      }
    });
  }
  target.querySelector("[data-share-property]").addEventListener("click", async (event) => {
    const shareData = { title: property.title, text: `${property.title} — ${property.neighborhood}, ${property.city}`, url: window.location.href };
    const feedback = target.querySelector(".detail-action-feedback");
    try {
      if (navigator.share) await navigator.share(shareData);
      else if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareData.url);
        feedback.textContent = "Link copiado.";
      } else {
        feedback.textContent = "Compartilhamento não disponível neste navegador.";
      }
    } catch (error) {
      if (error.name !== "AbortError") feedback.textContent = "Não foi possível compartilhar o imóvel.";
    }
  });
  target.querySelector("[data-favorite-property]").addEventListener("click", (event) => {
    const button = event.currentTarget;
    const isFavorite = button.getAttribute("aria-pressed") !== "true";
    button.setAttribute("aria-pressed", String(isFavorite));
    button.setAttribute("aria-label", isFavorite ? "Remover imóvel dos favoritos" : "Favoritar imóvel");
    button.classList.toggle("is-favorite", isFavorite);
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
