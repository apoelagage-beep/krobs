const textileGrid = document.querySelector('#textile-grid');
const catalogStatus = document.querySelector('#catalog-status');

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

function placementLabel(placement = '', index = 0) {
  const normalized = normalizePlacement(placement);
  const labels = {
    front: 'FACE',
    default: 'FACE',
    back: 'DOS',
    left: 'PROFIL G.',
    right: 'PROFIL D.',
    sleeve_left: 'MANCHE G.',
    sleeve_right: 'MANCHE D.',
    chest_left: 'POITRINE',
    chest_right: 'POITRINE',
    embroidery_chest_left: 'POITRINE',
    embroidery_chest_right: 'POITRINE'
  };

  return labels[normalized] || `DÉTAIL ${index + 1}`;
}

function collectVariantPreviews(variants) {
  const images = [];
  const seenUrls = new Set();

  for (const variant of variants) {
    for (const file of variant?.files || []) {
      const url = file?.preview_url || file?.thumbnail_url || '';
      if (!url || seenUrls.has(url)) continue;

      const placement = normalizePlacement(file?.type || file?.placement);
      if (!placement || placement === 'preview') continue;

      seenUrls.add(url);
      images.push({
        url,
        placement,
        label: placementLabel(placement, images.length),
        backgroundColor: ''
      });
    }
  }

  return images;
}

function getProductImages(entry, syncProduct, variants) {
  const images = [];
  const seenUrls = new Set();
  const seenPlacements = new Set();

  const addImage = (image, options = {}) => {
    const url = image?.url || '';
    if (!url || seenUrls.has(url)) return;

    const placement = normalizePlacement(image?.placement || options.placement);
    const label = image?.label || placementLabel(placement, images.length);

    seenUrls.add(url);
    if (placement) seenPlacements.add(placement);
    images.push({
      url,
      placement,
      label,
      backgroundColor: image?.backgroundColor || ''
    });
  };

  const front = syncProduct.thumbnail_url || '';
  if (front) {
    addImage({ url: front, placement: 'front', label: 'FACE' });
  }

  for (const image of collectVariantPreviews(variants)) {
    addImage(image);
  }

  const catalogViews = Array.isArray(entry?.krobs_gallery?.views)
    ? entry.krobs_gallery.views
    : [];

  for (const view of catalogViews) {
    const placement = normalizePlacement(view?.placement);

    // Les mockups synchronisés du produit restent prioritaires. Les vues catalogue
    // complètent uniquement les angles qui ne sont pas déjà présents.
    if (placement && seenPlacements.has(placement)) continue;

    addImage({
      url: view?.url || '',
      placement,
      label: view?.label || placementLabel(placement, images.length),
      backgroundColor: view?.backgroundColor || ''
    });
  }

  return images.slice(0, 8);
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
        <img src="${escapeHtml(image.url)}" alt="${escapeHtml(product.name)} — ${escapeHtml(image.label.toLowerCase())}" loading="${index === 0 ? 'eager' : 'lazy'}" decoding="async">
      </div>
    `;
  }).join('');

  const controls = product.images.length > 1
    ? `
      <span class="textile-gallery-view" aria-hidden="true">${escapeHtml(product.images[0].label)}</span>
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

    dots.forEach((dot, dotIndex) => {
      dot.style.pointerEvents = 'auto';
      dot.style.cursor = 'pointer';
      dot.addEventListener('click', () => goTo(dotIndex));
    });

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
