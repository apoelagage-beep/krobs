const textileGrid = document.querySelector('#textile-grid');
const catalogStatus = document.querySelector('#catalog-status');

const KROBS_PRODUCT_GALLERIES = [
  {
    match: /classic\s*[øo]\s*hoodie\s*white/i,
    images: [
      { url: '/assets/textile/classic-o-hoodie-white/front.svg', label: 'FACE', backgroundColor: '' },
      { url: '/assets/textile/classic-o-hoodie-white/back.svg', label: 'DOS', backgroundColor: '' },
      { url: '/assets/textile/classic-o-hoodie-white/left.svg', label: 'PROFIL G.', backgroundColor: '' },
      { url: '/assets/textile/classic-o-hoodie-white/right.svg', label: 'PROFIL D.', backgroundColor: '' },
      { url: '/assets/textile/classic-o-hoodie-white/detail-1.svg', label: 'DÉTAIL 1', backgroundColor: '' },
      { url: '/assets/textile/classic-o-hoodie-white/detail-2.svg', label: 'DÉTAIL 2', backgroundColor: '' }
    ]
  }
];

function getKrobsProductGallery(name = '') {
  const gallery = KROBS_PRODUCT_GALLERIES.find((item) => item.match.test(String(name)));
  return gallery ? gallery.images.map((image) => ({ ...image })) : null;
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatEuro(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '';
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR'
  }).format(number);
}

function normalizePlacement(value = '') {
  return String(value).trim().toLowerCase();
}

function findVariantPreview(variants, placement) {
  const wanted = normalizePlacement(placement);

  for (const variant of variants) {
    for (const file of variant?.files || []) {
      const filePlacement = normalizePlacement(file?.type || file?.placement);
      if (!filePlacement) continue;

      const matches = wanted === 'front'
        ? filePlacement === 'front' || filePlacement === 'default' || filePlacement.includes('front')
        : filePlacement === wanted || filePlacement.includes(wanted);

      if (!matches) continue;

      const url = file?.preview_url || file?.thumbnail_url || '';
      if (url) return url;
    }
  }

  return '';
}

function getProductImages(entry, syncProduct, variants) {
  const krobsGallery = getKrobsProductGallery(syncProduct?.name || '');
  if (krobsGallery?.length) return krobsGallery;

  const front = syncProduct.thumbnail_url
    || findVariantPreview(variants, 'front')
    || variants.find((variant) => variant?.files?.length)?.files?.find((file) => file?.preview_url)?.preview_url
    || '';

  const customBack = findVariantPreview(variants, 'back');
  const blankBack = entry?.krobs_gallery?.back?.url || '';
  const back = customBack || blankBack;
  const backBackground = customBack ? '' : (entry?.krobs_gallery?.back?.backgroundColor || '');

  const images = [];
  if (front) images.push({ url: front, label: 'FACE', backgroundColor: '' });
  if (back && back !== front) images.push({ url: back, label: 'DOS', backgroundColor: backBackground });

  return images;
}

function getProductData(entry) {
  const syncProduct = entry?.sync_product || entry || {};
  const variants = Array.isArray(entry?.sync_variants) ? entry.sync_variants : [];

  const prices = variants
    .map((variant) => Number(variant?.retail_price))
    .filter((price) => Number.isFinite(price) && price > 0);

  const sizeLabels = [...new Set(
    variants
      .map((variant) => variant?.size || variant?.product?.size || '')
      .filter(Boolean)
  )];

  const images = getProductImages(entry, syncProduct, variants);

  return {
    id: syncProduct.id || syncProduct.external_id || '',
    name: syncProduct.name || 'KRØBS TEXTILE',
    images,
    price: prices.length ? Math.min(...prices) : null,
    sizes: sizeLabels
  };
}

function renderGallery(product) {
  if (!product.images.length) {
    return '<div class="textile-image-placeholder">KRØBS</div>';
  }

  const slides = product.images.map((image, index) => {
    const style = image.backgroundColor
      ? ` style="background-color:${escapeHtml(image.backgroundColor)}"`
      : '';

    return `
      <div class="textile-gallery-slide" data-gallery-label="${escapeHtml(image.label)}"${style}>
        <img src="${escapeHtml(image.url)}" alt="${escapeHtml(product.name)} — ${escapeHtml(image.label.toLowerCase())}" loading="lazy"${index ? ' decoding="async"' : ''}>
      </div>
    `;
  }).join('');

  const controls = product.images.length > 1
    ? `
      <span class="textile-gallery-view" aria-hidden="true">FACE</span>
      <button class="textile-gallery-arrow textile-gallery-prev" type="button" aria-label="Voir l’image précédente">‹</button>
      <button class="textile-gallery-arrow textile-gallery-next" type="button" aria-label="Voir l’image suivante">›</button>
      <div class="textile-gallery-dots" aria-hidden="true">
        ${product.images.map((_, index) => `<span class="textile-gallery-dot${index === 0 ? ' is-active' : ''}"></span>`).join('')}
      </div>
    `
    : '';

  return `
    <div class="textile-gallery${product.images.length > 1 ? ' has-multiple' : ''}" data-gallery>
      <div class="textile-gallery-track">
        ${slides}
      </div>
      ${controls}
    </div>
  `;
}

function initTextileGalleries() {
  document.querySelectorAll('[data-gallery]').forEach((gallery) => {
    const track = gallery.querySelector('.textile-gallery-track');
    const slides = [...gallery.querySelectorAll('.textile-gallery-slide')];
    const dots = [...gallery.querySelectorAll('.textile-gallery-dot')];
    const label = gallery.querySelector('.textile-gallery-view');
    const previous = gallery.querySelector('.textile-gallery-prev');
    const next = gallery.querySelector('.textile-gallery-next');

    if (!track || slides.length < 2) return;

    let currentIndex = 0;
    let scrollFrame = null;

    const updateState = (index) => {
      currentIndex = Math.max(0, Math.min(index, slides.length - 1));
      dots.forEach((dot, dotIndex) => dot.classList.toggle('is-active', dotIndex === currentIndex));
      if (label) label.textContent = slides[currentIndex]?.dataset.galleryLabel || '';
    };

    const goTo = (index) => {
      const nextIndex = (index + slides.length) % slides.length;
      track.scrollTo({
        left: nextIndex * track.clientWidth,
        behavior: 'smooth'
      });
      updateState(nextIndex);
    };

    previous?.addEventListener('click', () => goTo(currentIndex - 1));
    next?.addEventListener('click', () => goTo(currentIndex + 1));

    track.addEventListener('scroll', () => {
      if (scrollFrame) cancelAnimationFrame(scrollFrame);
      scrollFrame = requestAnimationFrame(() => {
        const width = track.clientWidth || 1;
        updateState(Math.round(track.scrollLeft / width));
      });
    }, { passive: true });
  });
}

function renderProducts(products) {
  if (!textileGrid) return;

  const normalized = products
    .map(getProductData)
    .filter((product) => product.name);

  if (!normalized.length) {
    textileGrid.innerHTML = `
      <div class="catalog-empty">
        <strong>AUCUN PRODUIT TEXTILE DISPONIBLE.</strong>
        <span>Vérifie la synchronisation Printful.</span>
      </div>
    `;
    if (catalogStatus) catalogStatus.textContent = '0 PRODUIT';
    return;
  }

  textileGrid.innerHTML = normalized.map((product) => {
    const sizes = product.sizes.length
      ? product.sizes.join(' / ')
      : 'TAILLES SELON VARIANTE';

    return `
      <article class="textile-card">
        <div class="textile-image-wrap">
          ${renderGallery(product)}
        </div>
        <div class="textile-card-body">
          <p class="textile-kicker">PRINTFUL / KRØBS</p>
          <h3>${escapeHtml(product.name)}</h3>
          <div class="textile-meta">
            <span>${escapeHtml(sizes)}</span>
            <strong>${product.price !== null ? `À PARTIR DE ${formatEuro(product.price)}` : 'PRIX À CONFIRMER'}</strong>
          </div>
          <button class="textile-coming-soon" type="button" disabled>AJOUT AU PANIER — PROCHAINE ÉTAPE</button>
        </div>
      </article>
    `;
  }).join('');

  initTextileGalleries();

  if (catalogStatus) {
    catalogStatus.textContent = `${normalized.length} PRODUIT${normalized.length > 1 ? 'S' : ''}`;
  }
}

async function loadTextileProducts() {
  try {
    const response = await fetch('/api/printful-products', { cache: 'no-store' });
    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.error || 'Connexion Printful impossible');
    }

    renderProducts(Array.isArray(data.products) ? data.products : []);
  } catch (error) {
    console.error('KROBS_TEXTILE_LOAD_ERROR', error);
    if (catalogStatus) catalogStatus.textContent = 'CONNEXION PRINTFUL À VÉRIFIER';
    if (textileGrid) {
      textileGrid.innerHTML = `
        <div class="catalog-empty">
          <strong>LE CATALOGUE TEXTILE N’A PAS PU ÊTRE CHARGÉ.</strong>
          <span>Le site skate reste disponible pendant la vérification.</span>
        </div>
      `;
    }
  }
}

loadTextileProducts();
