import Stripe from 'stripe';
import { db, ensure } from './db.js';
import { printfulRequest } from './printful.js';

const DECK = {
  id: 'block-01-deck',
  name: 'BLOCK 01 DECK',
  price: 7490,
  sizes: ['8.25']
};

const DECK_SHIPPING_CENTS = 990;

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

function shippingCents(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw new Error('Tarif de livraison invalide');
  return Math.round(number * 100);
}

function compactCart(cart) {
  const encoded = JSON.stringify(cart);
  if (encoded.length > 480) throw new Error('Panier trop volumineux');
  return encoded;
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

function variantBaseName(variant, fallback, details) {
  let name = String(variant?.name || fallback || 'KRØBS TEXTILE').trim();
  const variantSuffix = [details.color, details.size].filter(Boolean).join(' / ');

  if (variantSuffix && name.endsWith(` - ${variantSuffix}`)) {
    name = name.slice(0, -(variantSuffix.length + 3)).trim();
  }

  if (details.size && name.endsWith(` / ${details.size}`)) {
    name = name.slice(0, -(details.size.length + 3)).trim();
  }

  return name || String(fallback || 'KRØBS TEXTILE').trim();
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

  const catalogVariantId = String(variant.variant_id || variant?.product?.variant_id || '').trim();
  if (!/^\d+$/.test(catalogVariantId)) {
    throw new Error('Variante catalogue Printful invalide');
  }

  const details = variantDetails(variant);

  return {
    type: 'printful',
    productId,
    syncVariantId,
    catalogVariantId,
    name: variantBaseName(variant, item.name, details),
    size: details.size || String(item.size || ''),
    color: details.color || String(item.color || ''),
    qty: quantity(item.qty),
    price: euroCents(variant.retail_price)
  };
}

async function resolvePrintfulShipping(items) {
  if (!items.length) return null;

  const quantities = new Map();
  for (const item of items) {
    const key = String(item.catalogVariantId);
    quantities.set(key, (quantities.get(key) || 0) + item.qty);
  }

  const data = await printfulRequest('/shipping/rates', {
    method: 'POST',
    body: {
      recipient: { country_code: 'FR' },
      items: [...quantities.entries()].map(([variantId, qty]) => ({
        variant_id: Number(variantId),
        quantity: qty
      })),
      currency: 'EUR',
      locale: 'en_US'
    }
  });

  const rates = (Array.isArray(data?.result) ? data.result : [])
    .map((rate) => ({
      id: String(rate?.id || '').trim(),
      name: String(rate?.name || '').trim(),
      currency: String(rate?.currency || 'EUR').toUpperCase(),
      amount: shippingCents(rate?.rate)
    }))
    .filter((rate) => rate.id && rate.currency === 'EUR');

  if (!rates.length) {
    throw new Error('Aucun tarif de livraison Printful disponible pour la France');
  }

  return rates.find((rate) => rate.id.toUpperCase() === 'STANDARD')
    || rates.sort((a, b) => a.amount - b.amount)[0];
}

function shippingLabel(hasDeck, printfulShipping) {
  if (hasDeck && printfulShipping) return 'Livraison deck + textile — France';
  if (printfulShipping) return 'Livraison textile — France';
  return 'Livraison deck — France';
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
    const printfulItems = [];

    for (const item of input) {
      const qty = quantity(item?.qty);

      if (item?.type === 'printful' || item?.syncVariantId) {
        const textile = await resolvePrintfulItem(item);
        printfulItems.push(textile);
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

    const printfulShipping = await resolvePrintfulShipping(printfulItems);
    const shippingAmount = (hasDeck ? DECK_SHIPPING_CENTS : 0)
      + (printfulShipping?.amount || 0);

    if (shippingAmount <= 0) {
      throw new Error('Tarif de livraison indisponible');
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: lines,
      payment_method_types: ['card'],
      adaptive_pricing: { enabled: false },
      billing_address_collection: 'required',
      shipping_address_collection: { allowed_countries: ['FR'] },
      shipping_options: [{
        shipping_rate_data: {
          type: 'fixed_amount',
          display_name: shippingLabel(hasDeck, printfulShipping),
          fixed_amount: {
            amount: shippingAmount,
            currency: 'eur'
          }
        }
      }],
      phone_number_collection: { enabled: true },
      customer_creation: 'always',
      allow_promotion_codes: true,
      success_url: `${base(req)}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base(req)}/cancel`,
      metadata: {
        brand: 'KRØBS',
        drop: 'BLOCK 01',
        fulfillment: printfulItems.length ? 'printful_draft' : 'deck',
        shipping_rule: printfulItems.length
          ? (hasDeck ? 'deck_990_plus_printful_fr' : 'printful_rate_fr')
          : 'deck_fr_990',
        deck_shipping_cents: String(hasDeck ? DECK_SHIPPING_CENTS : 0),
        ...(printfulShipping ? {
          printful_shipping: printfulShipping.id,
          printful_shipping_cents: String(printfulShipping.amount)
        } : {}),
        cart: compactCart(metadataCart)
      }
    });

    return res.status(200).json({ url: session.url });
  } catch (error) {
    console.error('KROBS_CHECKOUT_ERROR', error.message);
    return res.status(400).json({ error: error.message });
  }
}
