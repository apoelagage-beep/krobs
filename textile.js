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

  const thumbnail = syncProduct.thumbnail_url
    || variants.find((variant) => variant?.files?.length)?.files?.find((file) => file?.preview_url)?.preview_url
    || '';

  return {
    id: syncProduct.id || syncProduct.external_id || '',
    name: syncProduct.name || 'KRØBS TEXTILE',
    thumbnail,
    price: prices.length ? Math.min(...prices) : null,
    sizes: sizeLabels
  };
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
          ${product.thumbnail
            ? `<img src="${escapeHtml(product.thumbnail)}" alt="${escapeHtml(product.name)}" loading="lazy">`
            : `<div class="textile-image-placeholder">KRØBS</div>`}
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