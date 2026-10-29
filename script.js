const properties = [
  {
    id: "casa-moderna-01",
    title: "Casa contemporânea com jardim",
    type: "Casa",
    purpose: "comprar",
    location: "Jardim Europa, Sorocaba",
    price: 1280000,
    bedrooms: 3,
    bathrooms: 3,
    parking: 2,
    area: 218,
    description: "Uma residência de linhas contemporâneas, pensada para equilibrar conforto e convivência. Os ambientes sociais se conectam ao jardim e recebem boa iluminação natural, criando um espaço acolhedor para a rotina e para receber.",
    features: ["Jardim privativo", "Sala integrada", "Suíte principal", "Cozinha planejada", "Área de serviço"],
    featured: true,
    images: [
      { src: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1400&q=85", alt: "Fachada contemporânea com jardim" },
      { src: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1400&q=85", alt: "Sala de estar integrada e iluminada" },
      { src: "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=1400&q=85", alt: "Espaço externo para convivência" }
    ]
  },
  {
    id: "apartamento-premium-01",
    title: "Apartamento na planta com vista para a cidade",
    type: "Apartamento",
    purpose: "planta",
    location: "Campolim, Sorocaba",
    price: 1090000,
    bedrooms: 3,
    bathrooms: 3,
    parking: 2,
    area: 142,
    description: "Uma oportunidade demonstrativa de apartamento na planta, com projeto contemporâneo, ambientes amplos e vista aberta da cidade. A área social integra sala de estar e jantar, enquanto a varanda amplia as possibilidades de convivência.",
    features: ["Varanda ampla", "Suíte principal", "Sala integrada", "Condomínio com lazer", "Duas vagas cobertas"],
    featured: true,
    images: [
      { src: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1400&q=85", alt: "Sala ampla de apartamento sofisticado" },
      { src: "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1400&q=85", alt: "Área social com decoração contemporânea" },
      { src: "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=1400&q=85", alt: "Ambiente de convivência elegante" }
    ]
  },
  {
    id: "casa-condominio-01",
    title: "Casa com piscina para temporada",
    type: "Casa em condomínio",
    purpose: "temporada",
    location: "Ibiti, Sorocaba",
    price: 1200,
    bedrooms: 4,
    bathrooms: 4,
    parking: 3,
    area: 286,
    description: "Uma casa demonstrativa em condomínio, preparada para estadias de temporada. A área externa com piscina e espaço gourmet convida aos encontros, com ambientes internos integrados e acabamento contemporâneo.",
    features: ["Piscina", "Área gourmet", "Condomínio fechado", "Suíte com closet", "Sala integrada"],
    featured: true,
    images: [
      { src: "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=1400&q=85", alt: "Casa com piscina e área externa" },
      { src: "https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&w=1400&q=85", alt: "Fachada de residência moderna" },
      { src: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1400&q=85", alt: "Sala de estar ampla" }
    ]
  },
  {
    id: "apartamento-jardim-01",
    title: "Apartamento para locação com varanda ampla",
    type: "Apartamento",
    purpose: "alugar",
    location: "Jardim Faculdade, Sorocaba",
    price: 4800,
    bedrooms: 2,
    bathrooms: 2,
    parking: 2,
    area: 106,
    description: "Um apartamento demonstrativo para locação, funcional e confortável, com varanda generosa e integração entre os principais ambientes. Uma opção para quem valoriza praticidade sem abrir mão de espaço.",
    features: ["Varanda ampla", "Ambientes integrados", "Armários planejados", "Condomínio com lazer"],
    featured: false,
    images: [
      { src: "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1400&q=85", alt: "Interior contemporâneo com varanda" },
      { src: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1400&q=85", alt: "Sala confortável com luz natural" },
      { src: "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=1400&q=85", alt: "Área comum de convivência" }
    ]
  },
  {
    id: "casa-terrea-01",
    title: "Casa térrea para locação com área de lazer",
    type: "Casa",
    purpose: "alugar",
    location: "Parque Campolim, Sorocaba",
    price: 6200,
    bedrooms: 3,
    bathrooms: 2,
    parking: 2,
    area: 194,
    description: "Casa térrea demonstrativa para locação, com circulação prática, espaços acolhedores e área externa para aproveitar bons momentos. O projeto valoriza a integração e a entrada de luz natural.",
    features: ["Casa térrea", "Área de lazer", "Quintal privativo", "Cozinha integrada", "Suíte"],
    featured: false,
    images: [
      { src: "https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&w=1400&q=85", alt: "Casa térrea de arquitetura contemporânea" },
      { src: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1400&q=85", alt: "Sala de estar de uma casa moderna" },
      { src: "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=1400&q=85", alt: "Espaço externo de lazer" }
    ]
  },
  {
    id: "terreno-vista-01",
    title: "Terreno em condomínio com vista",
    type: "Terreno",
    purpose: "comprar",
    location: "Condomínio Vista Verde, Sorocaba",
    price: 420000,
    bedrooms: 0,
    bathrooms: 0,
    parking: 0,
    area: 420,
    description: "Terreno demonstrativo com topografia e vista que inspiram um projeto residencial personalizado. Localizado em condomínio com áreas verdes e espaços compartilhados.",
    features: ["420 m²", "Condomínio fechado", "Vista aberta", "Área verde", "Portaria"],
    featured: false,
    images: [
      { src: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1400&q=85", alt: "Terreno amplo em paisagem verde" },
      { src: "https://images.unsplash.com/photo-1449158743715-0a90ebb6d2d8?auto=format&fit=crop&w=1400&q=85", alt: "Área verde e arborizada" },
      { src: "https://images.unsplash.com/photo-1510798831971-661eb04b3739?auto=format&fit=crop&w=1400&q=85", alt: "Paisagem residencial com natureza" }
    ]
  }
];

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
    ? `Olá, Nei! Vi a prévia do imóvel ${property.title} no seu site e gostaria de mais informações.`
    : "Olá, Nei! Gostaria de conversar sobre meus planos imobiliários.";
  return `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
}

function propertyCard(property, index) {
  const roomSpecs = property.type === "Terreno"
    ? `<span>${property.area} m²</span><span>Condomínio</span>`
    : `<span>${property.bedrooms} quartos</span><span>${property.bathrooms} banheiros</span><span>${property.parking} vagas</span><span>${property.area} m²</span>`;
  return `
    <article class="property-card reveal is-visible" style="--card-index:${index}">
      <div class="property-photo">
        <img src="${property.images[0].src}" alt="${property.images[0].alt}" loading="lazy">
        ${property.featured ? '<span class="property-badge">Destaque</span>' : ""}
        <a class="photo-arrow" href="imovel.html?id=${encodeURIComponent(property.id)}" aria-label="Ver ${property.title}">↗</a>
      </div>
      <div class="property-body">
        <p class="property-type">${property.type} <span>·</span> ${property.location.split(",")[0]}</p>
        <h3>${property.title}</h3>
        <p class="property-location"><span aria-hidden="true">⌖</span> Sorocaba, SP</p>
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
        || (type === "Casa" && property.type === "Casa em condomínio");
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
    updateControls();
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

  applyFilters();
}

function initializeDetailPage() {
  const target = document.querySelector("#detailContent");
  if (!target) return;
  const id = new URLSearchParams(window.location.search).get("id");
  const property = properties.find((item) => item.id === id);

  if (!property) {
    target.innerHTML = `
      <div class="detail-fallback">
        <p class="eyebrow eyebrow-dark"><span class="eyebrow-mark"></span> Página não encontrada</p>
        <h1>Este imóvel não está disponível nesta prévia.</h1>
        <p>O endereço pode estar incorreto ou o imóvel demonstrativo não existe. Explore o catálogo para conhecer outras opções.</p>
        <a class="button button-navy" href="index.html#imoveis">Voltar ao catálogo <span aria-hidden="true">→</span></a>
      </div>`;
    document.title = "Imóvel não encontrado | Nei Carvalho";
    return;
  }

  document.title = `${property.title} | Nei Carvalho`;
  const specs = property.type === "Terreno"
    ? `<div><strong>${property.area} m²</strong><span>Área total</span></div><div><strong>Condomínio</strong><span>Tipo de terreno</span></div>`
    : `<div><strong>${property.bedrooms}</strong><span>Quartos</span></div><div><strong>${property.bathrooms}</strong><span>Banheiros</span></div><div><strong>${property.parking}</strong><span>Vagas</span></div><div><strong>${property.area} m²</strong><span>Área</span></div>`;

  target.innerHTML = `
    <div class="detail-heading">
      <div><p class="eyebrow eyebrow-dark"><span class="eyebrow-mark"></span> ${property.type} <span class="eyebrow-divider">·</span> Prévia demonstrativa</p><h1>${property.title}</h1><p class="detail-location"><span aria-hidden="true">⌖</span> ${property.location}</p></div>
      <div class="detail-price"><span>Valor demonstrativo</span><strong>${formatPrice(property.price, property)}</strong></div>
    </div>
    <div class="detail-gallery">
      <div class="gallery-main">
        <img id="galleryMainImage" src="${property.images[0].src}" alt="${property.images[0].alt}">
        ${property.images.length > 1 ? '<button class="gallery-arrow gallery-prev" type="button" aria-label="Foto anterior"><span aria-hidden="true">←</span></button><button class="gallery-arrow gallery-next" type="button" aria-label="Próxima foto"><span aria-hidden="true">→</span></button>' : ""}
        <span class="gallery-counter" aria-live="polite">01 <span>/</span> 0${property.images.length}</span>
      </div>
      <div class="gallery-thumbnails" aria-label="Fotografias do imóvel">
        ${property.images.map((image, index) => `<button class="gallery-thumb${index === 0 ? " is-active" : ""}" type="button" data-image-index="${index}" aria-label="Exibir foto ${index + 1}: ${image.alt}" aria-pressed="${index === 0}"><img src="${image.src}" alt="" loading="lazy"></button>`).join("")}
      </div>
    </div>
    <div class="detail-layout">
      <div class="detail-information">
        <div class="detail-specs">${specs}</div>
        <section class="detail-description"><p class="eyebrow eyebrow-dark"><span class="eyebrow-mark"></span> Sobre o imóvel</p><h2>Um espaço para chamar de <em>seu.</em></h2><p>${property.description}</p></section>
        <section class="detail-features"><p class="eyebrow eyebrow-dark"><span class="eyebrow-mark"></span> Características</p><ul>${property.features.map((feature) => `<li><span aria-hidden="true">✓</span>${feature}</li>`).join("")}</ul></section>
      </div>
      <aside class="contact-card">
        <div class="contact-card-top"><img class="contact-logo" src="assets/logo-trans.png" alt="" width="58" height="58"><div><strong>Nei Carvalho</strong><span>Consultor Imobiliário</span></div></div>
        <p>Converse sobre seus planos e receba orientação personalizada para esta opção.</p>
        <a class="button button-navy button-full" href="${whatsappUrl(property)}" target="_blank" rel="noopener noreferrer">Tenho interesse neste imóvel <span aria-hidden="true">↗</span></a>
        <a class="contact-phone" href="tel:+5515996008542">+55 15 99600-8542</a>
        <p class="contact-disclaimer">Prévia demonstrativa com informações e valores fictícios.</p>
      </aside>
    </div>`;

  const mainImage = target.querySelector("#galleryMainImage");
  const counter = target.querySelector(".gallery-counter");
  let activeImageIndex = 0;
  const showImage = (index) => {
    activeImageIndex = (index + property.images.length) % property.images.length;
    mainImage.src = property.images[activeImageIndex].src;
    mainImage.alt = property.images[activeImageIndex].alt;
    counter.innerHTML = `0${activeImageIndex + 1} <span>/</span> 0${property.images.length}`;
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
