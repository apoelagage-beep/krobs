import { printfulRequest } from './printful.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  try {
    const list = await printfulRequest('/store/products?limit=100');
    const products = [];

    for (const product of list?.result || []) {
      const detail = await printfulRequest(`/store/products/${product.id}`);
      products.push(detail?.result || product);
    }

    return res.status(200).json({ ok: true, products });
  } catch (error) {
    console.error('PRINTFUL_PRODUCTS_ERROR', error.message);
    return res.status(500).json({ ok: false, error: error.message });
  }
}
