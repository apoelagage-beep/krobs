import Stripe from 'stripe';
import { db, ensure } from './db.js';
import { printfulRequest } from './printful.js';

const DECK = {
  id: 'block-01-deck',
  name: 'BLOCK 01 DECK',
  price: 7490,
  sizes: ['8.25']
};

function base(req) {
  return process.env.PUBLIC_BASE_URL?.replace(/\/$/, '')
    || `https://${req.headers['x-forwarded-host'] || req.headers.host}`;
}

function quantity(value) {
  return Math.max(1, Math.min(10, Number(value) || 1));
}

function euroCents(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) throw new Error('Prix textile invalide');
  return Math.round(number * 100);
}

function compactCart(cart) {
  const encoded = JSON.stringify(cart);
  if (encoded.length > 480) throw new Error('Panier trop volumineux');
  return encoded;
}

async function resolvePrintfulItem(item) {
  const productId = String(item?.productId || '').trim();
  const syncVariantId = String(item?.syncVariantId || '').trim();

  if (!/^\d+$/.test(productId) || !/^\d+$/.test(syncVariantId)) {
    throw new Error('Variante textile invalide');
  }

  const data = await printfulRequest(`/store/variants/${syncVariantId}`);
  const variant = data?.result;

  if (!variant || String(variant.sync_product_id) !== productId) {
    throw new Error('Variante textile introuvable');
  }

  if (!variant.synced || variant.is_ignored) {
    throw new Error('Variante textile indisponible');
  }

  const unavailable = new Set(['discontinued', 'out_of_stock', 'temporary_out_of_stock']);
  if (unavailable.has(String(variant.availability_status || '').toLowerCase())) {
    throw new Error('Variante textile temporairement indisponible');
  }

  const currency = String(variant.currency || 'EUR').toUpperCase();
  if (currency !== 'EUR') throw new Error('Devise textile non prise en charge');

  return {
    type: 'printful',
    productId,
    syncVariantId,
    name: variant.name || item.name || 'KRØBS TEXTILE',
    size: variant.size || item.size || '',
    color: variant.color || item.color || '',
    qty: quantity(item.qty),
    price: euroCents(variant.retail_price)
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const sql = db();
    await ensure(sql);

    const input = Array.isArray(req.body?.cart) ? req.body.cart : [];
    if (!input.length) throw new Error('Panier vide');

    let hasDeck = false;
    const metadataCart = [];
    const lines = [];

    for (const item of input) {
      const qty = quantity(item?.qty);

      if (item?.type === 'printful' || item?.syncVariantId) {
        const textile = await resolvePrintfulItem(item);
        metadataCart.push({
          t: 'p',
          v: textile.syncVariantId,
          q: textile.qty
        });

        const detail = [textile.size, textile.color].filter(Boolean).join(' / ');
        lines.push({
          quantity: textile.qty,
          price_data: {
            currency: 'eur',
            unit_amount: textile.price,
            product_data: {
              name: detail ? `${textile.name} — ${detail}` : textile.name,
              metadata: {
                krobs_type: 'printful',
                printful_product_id: textile.productId,
                printful_sync_variant_id: textile.syncVariantId
              }
            }
          }
        });
        continue;
      }

      if (item?.id !== DECK.id || !DECK.sizes.includes(String(item?.size))) {
        throw new Error('Produit invalide');
      }

      const row = await sql`
        SELECT stock FROM krobs_inventory
        WHERE product_id=${DECK.id} AND size=${String(item.size)}
      `;

      if (!row.length || qty > Number(row[0].stock)) {
        throw new Error('Stock insuffisant');
      }

      hasDeck = true;
      metadataCart.push({ t: 'd', q: qty });
      lines.push({
        quantity: qty,
        price_data: {
          currency: 'eur',
          unit_amount: DECK.price,
          product_data: {
            name: `${DECK.name} — ${item.size}`,
            metadata: {
              krobs_type: 'deck',
              krobs_product_id: DECK.id,
              krobs_size: String(item.size)
            }
          }
        }
      });
    }

    if (hasDeck) {
      lines.push({
        quantity: 1,
        price_data: {
          currency: 'eur',
          unit_amount: 990,
          product_data: { name: 'Livraison deck — France' }
        }
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: lines,
      billing_address_collection: 'required',
      shipping_address_collection: { allowed_countries: ['FR'] },
      phone_number_collection: { enabled: true },
      customer_creation: 'always',
      allow_promotion_codes: true,
      success_url: `${base(req)}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base(req)}/cancel`,
      metadata: {
        brand: 'KRØBS',
        drop: 'BLOCK 01',
        fulfillment: metadataCart.some((item) => item.t === 'p') ? 'printful_draft' : 'deck',
        shipping_rule: hasDeck ? 'deck_fr_990' : 'textile_price_only',
        cart: compactCart(metadataCart)
      }
    });

    return res.status(200).json({ url: session.url });
  } catch (error) {
    console.error('KROBS_CHECKOUT_ERROR', error.message);
    return res.status(400).json({ error: error.message });
  }
}
