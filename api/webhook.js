import Stripe from 'stripe';
import { db, ensure } from './db.js';
import { createPrintfulDraftOrder, printfulRequest } from './printful.js';

export const config = { api: { bodyParser: false } };

async function raw(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

function parseCart(value) {
  try {
    const cart = JSON.parse(value || '[]');
    return Array.isArray(cart) ? cart : [];
  } catch {
    return [];
  }
}

function itemQty(item) {
  return Math.max(1, Math.min(10, Number(item?.q ?? item?.qty) || 1));
}

function isDeck(item) {
  return item?.t === 'd'
    || (item?.id === 'block-01-deck' && String(item?.size) === '8.25');
}

function isPrintful(item) {
  return item?.t === 'p' && /^\d+$/.test(String(item?.v || ''));
}

function sessionShipping(session) {
  return session?.collected_information?.shipping_details
    || session?.shipping_details
    || null;
}

function printfulExternalId(sessionId) {
  return `krobs_${String(sessionId).slice(-24)}`;
}

function printfulRecipient(session) {
  const shipping = sessionShipping(session);
  const customer = session?.customer_details || {};
  const address = shipping?.address || customer?.address || {};
  const name = shipping?.name || customer?.name || '';

  if (!name || !address?.line1 || !address?.city || !address?.postal_code || !address?.country) {
    throw new Error('Adresse de livraison Stripe incomplète pour Printful');
  }

  return {
    name,
    address1: address.line1,
    address2: address.line2 || undefined,
    city: address.city,
    state_code: address.state || undefined,
    country_code: String(address.country).toUpperCase(),
    zip: address.postal_code,
    phone: customer?.phone || undefined,
    email: customer?.email || undefined
  };
}

function printfulShippingMethod(session) {
  const method = String(session?.metadata?.printful_shipping || '').trim();
  if (!method) return undefined;
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(method)) {
    throw new Error('Mode de livraison Printful invalide');
  }
  return method;
}

async function findOrCreatePrintfulDraft(session, cart) {
  const externalId = printfulExternalId(session.id);

  try {
    const existing = await printfulRequest(`/orders/@${encodeURIComponent(externalId)}`);
    if (existing?.result?.id) return existing.result;
  } catch (error) {
    if (error.status !== 404) throw error;
  }

  const items = cart
    .filter(isPrintful)
    .map((item) => ({
      sync_variant_id: Number(item.v),
      quantity: itemQty(item)
    }));

  if (!items.length) return null;

  const shipping = printfulShippingMethod(session);
  const created = await createPrintfulDraftOrder({
    external_id: externalId,
    recipient: printfulRecipient(session),
    items,
    ...(shipping ? { shipping } : {})
  });

  return created?.result || null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  let sql;
  let session;

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const event = stripe.webhooks.constructEvent(
      await raw(req),
      req.headers['stripe-signature'],
      process.env.STRIPE_WEBHOOK_SECRET
    );

    if (event.type !== 'checkout.session.completed') {
      return res.status(200).json({ received: true });
    }

    session = event.data.object;
    if (session.payment_status !== 'paid') {
      return res.status(200).json({ received: true });
    }

    sql = db();
    await ensure(sql);

    const cart = parseCart(session.metadata?.cart);
    const shipping = sessionShipping(session);
    const address = shipping?.address || session.customer_details?.address || null;

    const inserted = await sql`
      INSERT INTO krobs_orders(
        stripe_session_id,
        stripe_payment_intent,
        payment_status,
        amount_total,
        currency,
        customer_email,
        customer_name,
        customer_phone,
        shipping_name,
        shipping_address,
        cart,
        stripe_created_at
      ) VALUES (
        ${session.id},
        ${typeof session.payment_intent === 'string' ? session.payment_intent : null},
        ${session.payment_status},
        ${session.amount_total || 0},
        ${session.currency || 'eur'},
        ${session.customer_details?.email || null},
        ${session.customer_details?.name || null},
        ${session.customer_details?.phone || null},
        ${shipping?.name || session.customer_details?.name || null},
        ${JSON.stringify(address)},
        ${JSON.stringify(cart)},
        ${new Date((session.created || Math.floor(Date.now() / 1000)) * 1000).toISOString()}
      )
      ON CONFLICT(stripe_session_id) DO NOTHING
      RETURNING id
    `;

    if (inserted.length) {
      for (const item of cart.filter(isDeck)) {
        const qty = itemQty(item);
        const updated = await sql`
          UPDATE krobs_inventory
          SET stock=stock-${qty}, updated_at=NOW()
          WHERE product_id='block-01-deck'
            AND size='8.25'
            AND stock>=${qty}
          RETURNING stock
        `;

        if (!updated.length) throw new Error('Stock decrement failed');
      }
    }

    const printfulItems = cart.filter(isPrintful);
    let printfulOrderId = null;
    let printfulStatus = null;

    if (printfulItems.length) {
      const rows = await sql`
        SELECT printful_order_id, printful_status
        FROM krobs_orders
        WHERE stripe_session_id=${session.id}
        LIMIT 1
      `;

      if (rows[0]?.printful_order_id) {
        printfulOrderId = rows[0].printful_order_id;
        printfulStatus = rows[0].printful_status || 'draft';
      } else {
        try {
          const draft = await findOrCreatePrintfulDraft(session, cart);
          if (!draft?.id) throw new Error('Printful draft id missing');

          printfulOrderId = String(draft.id);
          printfulStatus = String(draft.status || 'draft');

          await sql`
            UPDATE krobs_orders
            SET printful_order_id=${printfulOrderId},
                printful_status=${printfulStatus},
                printful_error=NULL
            WHERE stripe_session_id=${session.id}
          `;
        } catch (error) {
          await sql`
            UPDATE krobs_orders
            SET printful_status='error', printful_error=${String(error.message).slice(0, 1000)}
            WHERE stripe_session_id=${session.id}
          `;
          throw error;
        }
      }
    }

    console.log(JSON.stringify({
      type: 'KROBS_ORDER_SAVED',
      session: session.id,
      payment_status: session.payment_status,
      amount_total: session.amount_total,
      currency: session.currency,
      shipping_total: session.total_details?.amount_shipping || 0,
      printful_shipping: session.metadata?.printful_shipping || null,
      stock_updated: inserted.length > 0 && cart.some(isDeck),
      printful_order_id: printfulOrderId,
      printful_status: printfulStatus
    }));

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('KROBS_WEBHOOK_ERROR', error.message);
    return res.status(400).send('Webhook Error');
  }
}
