import { printfulRequest } from './printful.js';

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

async function getCatalogViews(product) {
  const variants = Array.isArray(product?.sync_variants) ? product.sync_variants : [];
  const catalogVariantId = variants.find((variant) => variant?.variant_id)?.variant_id;
  if (!catalogVariantId) return [];

  try {
    const response = await printfulRequest(
      `/v2/catalog-variants/${encodeURIComponent(catalogVariantId)}/images`
    );

    const groups = Array.isArray(response?.data) ? response.data : [];
    const matchingGroup = groups.find(
      (group) => String(group?.catalog_variant_id || '') === String(catalogVariantId)
    );
    const selectedGroups = matchingGroup ? [matchingGroup] : groups.slice(0, 1);

    const views = [];
    const seen = new Set();

    for (const group of selectedGroups) {
      for (const image of group?.images || []) {
        const url = image?.image_url || image?.background_image || '';
        if (!url || seen.has(url)) continue;
        seen.add(url);

        views.push({
          url,
          placement: normalizePlacement(image?.placement),
          label: placementLabel(image?.placement, views.length),
          backgroundColor: image?.background_color || group?.primary_hex_color || ''
        });
      }
    }

    return views.slice(0, 8);
  } catch (error) {
    console.warn('PRINTFUL_GALLERY_VIEW_ERROR', catalogVariantId, error.message);
    return [];
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  try {
    const list = await printfulRequest('/store/products?limit=100');
    const products = [];

    for (const product of list?.result || []) {
      const detail = await printfulRequest(`/store/products/${product.id}`);
      const fullProduct = detail?.result || product;
      const views = await getCatalogViews(fullProduct);

      if (views.length) {
        fullProduct.krobs_gallery = { views };
      }

      products.push(fullProduct);
    }

    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600');
    return res.status(200).json({ ok: true, products });
  } catch (error) {
    console.error('PRINTFUL_PRODUCTS_ERROR', error.message);
    return res.status(500).json({ ok: false, error: error.message });
  }
}
