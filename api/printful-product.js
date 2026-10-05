import { printfulRequest } from './printful.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const id = String(req.query?.id || '').trim();
  if (!/^\d+$/.test(id)) {
    return res.status(400).json({ ok: false, error: 'Valid Printful product id required' });
  }

  try {
    const data = await printfulRequest(`/store/products/${id}`);
    const product = data?.result?.sync_product || null;
    const variants = Array.isArray(data?.result?.sync_variants)
      ? data.result.sync_variants.map((variant) => ({
          id: variant.id,
          external_id: variant.external_id || null,
          sync_product_id: variant.sync_product_id,
          name: variant.name,
          synced: Boolean(variant.synced),
          variant_id: variant.variant_id,
          retail_price: variant.retail_price || null,
          currency: variant.currency || null,
          sku: variant.sku || null,
          size: variant.size || null,
          color: variant.color || null,
          availability_status: variant.availability_status || null
        }))
      : [];

    return res.status(200).json({
      ok: true,
      product: product
        ? {
            id: product.id,
            external_id: product.external_id || null,
            name: product.name,
            variants: product.variants,
            synced: product.synced,
            is_ignored: Boolean(product.is_ignored)
          }
        : null,
      variants
    });
  } catch (error) {
    console.error('KROBS_PRINTFUL_PRODUCT_ERROR', error.message);
    return res.status(500).json({ ok: false, error: 'Printful product lookup failed' });
  }
}
