(() => {
  const textileGrid = document.querySelector('#textile-grid');
  const catalogStatus = document.querySelector('#catalog-status');

  const KROBS_PRODUCT_GALLERIES = [
    {
      match: /classic\s*[øo]\s*hoodie\s*white/i,
      images: [
        { url: '/assets/textile/classic-o-hoodie-white/front.webp', label: 'FACE', backgroundColor: '' },
        { url: '/assets/textile/classic-o-hoodie-white/back.webp', label: 'DOS', backgroundColor: '' },
        { url: '/assets/textile/classic-o-hoodie-white/left.webp', label: 'PROFIL G.', backgroundColor: '' },
        { url: '/assets/textile/classic-o-hoodie-white/right.webp', label: 'PROFIL D.', backgroundColor: '' },
        { url: '/assets/textile/classic-o-hoodie-white/detail-1.webp', label: 'DÉTAIL 1', backgroundColor: '' },
        { url: '/assets/textile/classic-o-hoodie-white/detail-2.webp', label: 'DÉTAIL 2', backgroundColor: '' }
      ]
    },
    {
      match: /classic\s*[øo]\s*hoodie\s*black/i,
      images: [
        { url: '/assets/textile/classic-o-hoodie-black/front.webp', label: 'FACE', backgroundColor: '' },
        { url: '/assets/textile/classic-o-hoodie-black/back.webp', label: 'DOS', backgroundColor: '' },
        { url: '/assets/textile/classic-o-hoodie-black/left.webp', label: 'PROFIL G.', backgroundColor: '' },
        { url: '/assets/textile/classic-o-hoodie-black/right.webp', label: 'PROFIL D.', backgroundColor: '' },
        { url: '/assets/textile/classic-o-hoodie-black/detail-1.webp', label: 'DÉTAIL 1', backgroundColor: '' },
        { url: '/assets/textile/classic-o-hoodie-black/detail-2.webp', label: 'DÉTAIL 2', backgroundColor: '' }
      ]
    },
    {
      match: /classic\s*[øo]\s*(?:t[\s-]*shirt|tee)\s*white/i,
      images: [
        { url: '/assets/textile/classic-o-t-shirt-white/front.webp', label: 'FACE', backgroundColor: '' },
        { url: '/assets/textile/classic-o-t-shirt-white/back.webp', label: 'DOS', backgroundColor: '' },
        { url: '/assets/textile/classic-o-t-shirt-white/left.webp', label: 'PROFIL G.', backgroundColor: '' },
        { url: '/assets/textile/classic-o-t-shirt-white/folded.webp', label: 'PLIÉ', backgroundColor: '' },
        { url: '/assets/textile/classic-o-t-shirt-white/detail.webp', label: 'DÉTAIL', backgroundColor: '' },
        { url: '/assets/textile/classic-o-t-shirt-white/front-back.webp', label: 'FACE ET DOS', backgroundColor: '' }
      ]
    },
    {
      match: /classic\s*[øo]\s*(?:t[\s-]*shirt|tee)\s*black/i,
      images: [
        { url: '/assets/textile/classic-o-t-shirt-black/front.webp', label: 'FACE', backgroundColor: '' },
        { url: '/assets/textile/classic-o-t-shirt-black/back.webp', label: 'DOS', backgroundColor: '' },
        { url: '/assets/textile/classic-o-t-shirt-black/left.webp', label: 'PROFIL G.', backgroundColor: '' },
        { url: '/assets/textile/classic-o-t-shirt-black/right.webp', label: 'PROFIL D.', backgroundColor: '' },
        { url: '/assets/textile/classic-o-t-shirt-black/folded.webp', label: 'PLIÉ', backgroundColor: '' },
        { url: '/assets/textile/classic-o-t-shirt-black/detail.webp', label: 'DÉTAIL', backgroundColor: '' },
        { url: '/assets/textile/classic-o-t-shirt-black/front-back.webp', label: 'FACE ET DOS', backgroundColor: '' }
      ]
    },
    {
      match: /^kr[øo]bs\s+t[\s-]*shirt\s+white\s*$/i,
      images: [
        { url: '/assets/textile/krobs-t-shirt-white/front.webp', label: 'FACE', backgroundColor: '' },
        { url: '/assets/textile/krobs-t-shirt-white/back.webp', label: 'DOS', backgroundColor: '' },
        { url: '/assets/textile/krobs-t-shirt-white/left.webp', label: 'PROFIL G.', backgroundColor: '' },
        { url: '/assets/textile/krobs-t-shirt-white/right.webp', label: 'PROFIL D.', backgroundColor: '' },
        { url: '/assets/textile/krobs-t-shirt-white/folded.webp', label: 'PLIÉ', backgroundColor: '' },
        { url: '/assets/textile/krobs-t-shirt-white/detail.webp', label: 'DÉTAIL', backgroundColor: '' },
        { url: '/assets/textile/krobs-t-shirt-white/front-back.webp', label: 'FACE ET DOS', backgroundColor: '' }
      ]
    },
    {
      match: /^kr[øo]bs\s+t[\s-]*shirt\s+black\s*$/i,
      images: [
        { url: '/assets/textile/krobs-t-shirt-black/front.webp', label: 'FACE', backgroundColor: '' },
        { url: '/assets/textile/krobs-t-shirt-black/back.webp', label: 'DOS', backgroundColor: '' },
        { url: '/assets/textile/krobs-t-shirt-black/left.webp', label: 'PROFIL G.', backgroundColor: '' },
        { url: '/assets/textile/krobs-t-shirt-black/right.webp', label: 'PROFIL D.', backgroundColor: '' },
        { url: '/assets/textile/krobs-t-shirt-black/folded.webp', label: 'PLIÉ', backgroundColor: '' },
        { url: '/assets/textile/krobs-t-shirt-black/detail.webp', label: 'DÉTAIL', backgroundColor: '' },
        { url: '/assets/textile/krobs-t-shirt-black/front-back.webp', label: 'FACE ET DOS', backgroundColor: '' }
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
    const rawVariants = Array.isArray(entry?.sync_variants) ? entry.sync_variants : [];
    const variants = rawVariants
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
      .filter((variant) => Number.isFinite(variant.price) && variant.price > 0 && variant.currency === 'EUR');

    const prices = variants.map((variant) => variant.price);
    return {
      id: String(syncProduct.id || syncProduct.external_id || ''),
      name: syncProduct.name || 'KRØBS TEXTILE',
      images: getProductImages(entry, syncProduct, rawVariants),
      price: prices.length ? Math.min(...prices) : null,
      variants
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
        <div class="textile-gallery-track">${slides}</div>
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
        track.scrollTo({ left: nextIndex * track.clientWidth, behavior: 'smooth' });
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
        <option value="${escapeHtml(variant.id)}" data-size="${escapeHtml(variant.size)}" data-color="${escapeHtml(variant.color)}" data-price="${escapeHtml(variant.price)}">
          ${escapeHtml(optionLabel(variant))}
        </option>
      `).join('');

      return `
        <article class="textile-card" data-product-id="${escapeHtml(product.id)}" data-product-name="${escapeHtml(product.name)}">
          <div class="textile-image-wrap">${renderGallery(product)}</div>
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
                <select class="textile-variant-select" aria-label="Choisir taille et couleur">${options}</select>
              </label>
              <button class="textile-add-to-cart" type="button">AJOUTER AU PANIER</button>
            ` : '<button class="textile-add-to-cart" type="button" disabled>INDISPONIBLE</button>'}
          </div>
        </article>
      `;
    }).join('');

    initTextileGalleries();

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
