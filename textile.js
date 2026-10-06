(() => {
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

  function variantAvailable(variant) {
    if (!variant?.id || !variant?.synced || variant?.is_ignored) return false;
    const status = String(variant?.availability_status || '').toLowerCase();
    return !['discontinued', 'out_of_stock', 'temporary_out_of_stock'].includes(status);
  }

  function variantDetails(variant) {
    let size = String(variant?.size || variant?.product?.size || '').trim();
    let color = String(variant?.color || variant?.product?.color || '').trim();

    if (!size || !color) {
      const productName = String(variant?.product?.name || '').trim();
      const variantName = String(variant?.name || '').trim();
      const parenthesized = productName.match(/\(([^()]+)\)\s*$/)?.[1] || '';
      const suffix = parenthesized || variantName.split(' - ').pop() || '';
      const parts = suffix.split('/').map((part) => part.trim()).filter(Boolean);

      if (parts.length >= 2) {
        color ||= parts[0];
        size ||= parts[parts.length - 1];
      }
    }

    return { size, color };
  }

  function getProductData(entry) {
    const syncProduct = entry?.sync_product || entry || {};
    const variants = Array.isArray(entry?.sync_variants)
      ? entry.sync_variants
        .filter(variantAvailable)
        .map((variant) => {
          const details = variantDetails(variant);
          return {
            id: String(variant.id),
            size: details.size,
            color: details.color,
            price: Number(variant.retail_price),
            currency: String(variant.currency || 'EUR').toUpperCase()
          };
        })
        .filter((variant) => Number.isFinite(variant.price) && variant.price > 0 && variant.currency === 'EUR')
      : [];

    const prices = variants.map((variant) => variant.price);
    const thumbnail = syncProduct.thumbnail_url
      || entry?.sync_variants?.find((variant) => variant?.files?.length)?.files?.find((file) => file?.preview_url)?.preview_url
      || '';

    return {
      id: String(syncProduct.id || ''),
      name: syncProduct.name || 'KRØBS TEXTILE',
      thumbnail,
      price: prices.length ? Math.min(...prices) : null,
      variants
    };
  }

  function optionLabel(variant) {
    const detail = [variant.size, variant.color].filter(Boolean).join(' / ') || 'VARIANTE';
    return `${detail} — ${formatEuro(variant.price)}`;
  }

  function renderProducts(products) {
    if (!textileGrid) return;

    const normalized = products
      .map(getProductData)
      .filter((product) => product.id && product.name);

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
      const available = product.variants.length > 0;
      const options = product.variants.map((variant) => `
        <option
          value="${escapeHtml(variant.id)}"
          data-size="${escapeHtml(variant.size)}"
          data-color="${escapeHtml(variant.color)}"
          data-price="${escapeHtml(variant.price)}"
        >${escapeHtml(optionLabel(variant))}</option>
      `).join('');

      return `
        <article
          class="textile-card"
          data-product-id="${escapeHtml(product.id)}"
          data-product-name="${escapeHtml(product.name)}"
        >
          <div class="textile-image-wrap">
            ${product.thumbnail
              ? `<img src="${escapeHtml(product.thumbnail)}" alt="${escapeHtml(product.name)}" loading="lazy">`
              : '<div class="textile-image-placeholder">KRØBS</div>'}
          </div>
          <div class="textile-card-body">
            <p class="textile-kicker">PRINTFUL / KRØBS</p>
            <h3>${escapeHtml(product.name)}</h3>
            <div class="textile-meta">
              <span>${available ? `${product.variants.length} VARIANTE${product.variants.length > 1 ? 'S' : ''}` : 'INDISPONIBLE'}</span>
              <strong>${product.price !== null ? `À PARTIR DE ${formatEuro(product.price)}` : 'PRIX À CONFIRMER'}</strong>
            </div>
            ${available ? `
              <label class="textile-variant-label">
                <span>TAILLE / COULEUR</span>
                <select class="textile-variant-select" aria-label="Choisir taille et couleur">
                  ${options}
                </select>
              </label>
              <button class="textile-add-to-cart" type="button">AJOUTER AU PANIER</button>
            ` : '<button class="textile-add-to-cart" type="button" disabled>INDISPONIBLE</button>'}
          </div>
        </article>
      `;
    }).join('');

    if (catalogStatus) {
      catalogStatus.textContent = `${normalized.length} PRODUIT${normalized.length > 1 ? 'S' : ''}`;
    }

    textileGrid.querySelectorAll('.textile-card').forEach((card) => {
      const select = card.querySelector('.textile-variant-select');
      const button = card.querySelector('.textile-add-to-cart');
      if (!select || !button) return;

      button.addEventListener('click', () => {
        const option = select.selectedOptions?.[0];
        if (!option || !window.KROBS_CART?.addItem) return;

        const price = Number(option.dataset.price);
        const added = window.KROBS_CART.addItem({
          type: 'printful',
          id: `printful-${card.dataset.productId}`,
          productId: card.dataset.productId,
          syncVariantId: option.value,
          name: card.dataset.productName,
          size: option.dataset.size || '',
          color: option.dataset.color || '',
          unitAmount: Math.round(price * 100),
          qty: 1
        });

        if (added) {
          const original = button.textContent;
          button.textContent = 'AJOUTÉ ✓';
          window.setTimeout(() => {
            button.textContent = original;
          }, 900);
        }
      });
    });
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
})();
