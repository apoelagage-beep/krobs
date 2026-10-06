import { printfulRequest } from './printful.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const list = await printfulRequest('/store/products?limit=100');
    const sourceProducts = Array.isArray(list?.result) ? list.result : [];

    const products = await Promise.all(
      sourceProducts.map(async (product) => {
        try {
          const detail = await printfulRequest(`/store/products/${product.id}`);
          return detail?.result || product;
        } catch (error) {
          console.warn('PRINTFUL_PRODUCT_DETAIL_ERROR', product.id, error.message);
          return product;
        }
      })
    );

    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600');
    return res.status(200).json({ ok: true, products });
  } catch (error) {
    console.error('PRINTFUL_PRODUCTS_ERROR', error.message);
    return res.status(500).json({ ok: false, error: error.message });
  }
}
