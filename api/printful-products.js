import { printfulRequest } from './printful.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  try {
    const list = await printfulRequest('/store/products?limit=100');
    const products = [];

    for (const product of list?.result || []) {
      const detail = await printfulRequest(`/store/products/${product.id}`);
      const full = detail?.result || product;
      const variants = Array.isArray(full?.sync_variants) ? full.sync_variants : [];
      const files = [];
      const seen = new Set();

      for (const variant of variants) {
        for (const file of variant?.files || []) {
          const key = `${file?.type || ''}|${file?.preview_url || ''}|${file?.thumbnail_url || ''}`;
          if (seen.has(key)) continue;
          seen.add(key);
          files.push({
            type: file?.type || null,
            preview_url: file?.preview_url || null,
            thumbnail_url: file?.thumbnail_url || null
          });
        }
      }

      products.push({
        id: full?.sync_product?.id || product.id,
        external_id: full?.sync_product?.external_id || product.external_id,
        name: full?.sync_product?.name || product.name,
        thumbnail_url: full?.sync_product?.thumbnail_url || product.thumbnail_url,
        files
      });
    }

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ ok: true, products });
  } catch (error) {
    console.error('PRINTFUL_PRODUCTS_DEBUG_ERROR', error.message);
    return res.status(500).json({ ok: false, error: error.message });
  }
}
