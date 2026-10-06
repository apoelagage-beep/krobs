import { printfulRequest } from './printful.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  try {
    const list = await printfulRequest('/store/products?limit=100');
    const products = (list?.result || []).map((product, index) => ({
      index,
      id: product.id,
      external_id: product.external_id,
      name: product.name,
      thumbnail_url: product.thumbnail_url
    }));
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ ok: true, products });
  } catch (error) {
    console.error('PRINTFUL_PRODUCTS_DEBUG_ERROR', error.message);
    return res.status(500).json({ ok: false, error: error.message });
  }
}
