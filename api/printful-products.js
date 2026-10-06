import { printfulRequest } from './printful.js';

function supportsFrontBack(product) {
  const name = product?.sync_product?.name || product?.name || '';
  return /t-?shirt|tee|hoodie|sweat/i.test(name);
}

async function getBlankBackView(product) {
  const variants = Array.isArray(product?.sync_variants) ? product.sync_variants : [];
  const catalogVariantId = variants.find((variant) => variant?.variant_id)?.variant_id;
  if (!catalogVariantId) return null;

  try {
    const response = await printfulRequest(
      `/v2/catalog-variants/${encodeURIComponent(catalogVariantId)}/images?placement=back`
    );

    for (const variantImages of response?.data || []) {
      for (const image of variantImages?.images || []) {
        if (String(image?.placement || '').toLowerCase() !== 'back') continue;
        const url = image?.image_url || image?.background_image || '';
        if (!url) continue;

        return {
          url,
          backgroundColor: variantImages?.primary_hex_color || image?.background_color || ''
        };
      }
    }
  } catch (error) {
    console.warn('PRINTFUL_BACK_VIEW_ERROR', catalogVariantId, error.message);
  }

  return null;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  try {
    const list = await printfulRequest('/store/products?limit=100');
    const products = [];

    for (const product of list?.result || []) {
      const detail = await printfulRequest(`/store/products/${product.id}`);
      const fullProduct = detail?.result || product;

      if (supportsFrontBack(fullProduct)) {
        const back = await getBlankBackView(fullProduct);
        if (back) fullProduct.krobs_gallery = { back };
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
