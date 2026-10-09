import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const orders = new Map();
const refunds = new Map();
const sqlCalls = [];
let stripeParams;
let event;
let databaseUnavailable = false;
const env = { KROBS_PREORDER_DEADLINE: '2099-01-01T00:00:00Z', STRIPE_SECRET_KEY: 'test-double', STRIPE_WEBHOOK_SECRET: 'test-double' };
const sql = async (strings, ...values) => {
  const query = strings.join('?');
  sqlCalls.push(query);
  if (databaseUnavailable) throw new Error('Database unavailable');
  if (query.includes('INSERT INTO krobs_orders')) {
    if (orders.has(values[0])) return [];
    orders.set(values[0], { intent: values[1], status: values[2], cart: JSON.parse(values[10]), campaign: values[11] });
    return [{ id: orders.size }];
  }
  if (query.includes('INSERT INTO krobs_payment_refunds')) {
    const previous = refunds.get(values[0]);
    refunds.set(values[0], Boolean(previous || values[1]));
    return [];
  }
  if (query.includes('AS paid')) {
    assert.match(query, /payment_status='paid'/);
    assert.match(query, /fully_refunded=TRUE/);
    const paid = [...orders.values()].filter(o => o.campaign === values[0] && o.status === 'paid' && !refunds.get(o.intent))
      .reduce((sum, o) => sum + o.cart.filter(i => i.t === 'd').reduce((n, i) => n + i.q, 0), 0);
    return [{ paid }];
  }
  throw new Error(`Unexpected query: ${query}`);
};
class Stripe {
  checkout = { sessions: { create: async params => { stripeParams = params; return { url: 'https://checkout.stripe.test/session' }; } } };
  webhooks = { constructEvent: (_body, signature) => { if (signature !== 'valid') throw new Error('Bad signature'); return event; } };
}
const context = vm.createContext({ console: { log() {}, error() {} }, process: { env }, Buffer, Date, JSON, Map, Set });
const modules = new Map();
const mock = (id, exports) => new vm.SyntheticModule(Object.keys(exports), function () {
  for (const [key, value] of Object.entries(exports)) this.setExport(key, value);
}, { context, identifier: id });
modules.set('stripe', mock('stripe', { default: Stripe }));
modules.set(path.join(root, 'api/db.js'), mock('db', { db: () => sql, ensure: async () => {} }));
modules.set(path.join(root, 'api/printful.js'), mock('printful', {
  printfulRequest: async route => {
    if (route === '/store/variants/123') return { result: { sync_product_id: 456, synced: true, variant_id: 789,
      currency: 'EUR', retail_price: '29.90', size: 'M', color: 'Black', name: 'KRØBS TEE' } };
    if (route === '/shipping/rates') return { result: [{ id: 'STANDARD', rate: '4.50', currency: 'EUR' }] };
    throw new Error('Unexpected Printful request');
  },
  createPrintfulDraftOrder: async () => { throw new Error('Unexpected Printful draft'); }
}));
async function getModule(id) {
  if (modules.has(id)) return modules.get(id);
  const module = new vm.SourceTextModule(await fs.readFile(id, 'utf8'), { context, identifier: id });
  modules.set(id, module);
  await module.link((specifier, parent) => getModule(specifier === 'stripe' ? specifier : path.resolve(path.dirname(parent.identifier), specifier)));
  return module;
}
const campaign = await getModule(path.join(root, 'lib/preorder.js'));
await campaign.evaluate();
const { campaignState, CAMPAIGN } = campaign.namespace;
const handlers = {};
for (const name of ['create-checkout-session', 'webhook', 'preorders']) {
  const module = await getModule(path.join(root, `api/${name}.js`));
  await module.evaluate();
  handlers[name] = module.namespace.default;
}
async function call(name, body, method = name === 'preorders' ? 'GET' : 'POST', signature = 'valid') {
  const response = { code: 200, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(code) { this.code = code; return this; },
    json(data) { this.data = data; return this; }, send(data) { this.data = data; return this; }, end() { return this; } };
  const req = { method, body, headers: { host: 'shop.example', 'stripe-signature': signature }, async *[Symbol.asyncIterator]() { yield Buffer.from('{}'); } };
  await handlers[name](req, response);
  return response;
}
const cart = qty => ({ cart: [{ id: 'block-01-deck', type: 'deck', size: '8.25', qty, unitAmount: 1 }] });
const session = (id, qty, status = 'paid') => ({ id, payment_intent: `pi_${id}`, payment_status: status, amount_total: qty * 7490 + 990,
  currency: 'eur', metadata: { preorder_campaign: CAMPAIGN, cart: JSON.stringify([{ t: 'd', q: qty }]) }, created: 1791564000 });
async function deliver(type, object, signature) { event = { type, data: { object } }; return call('webhook', null, 'POST', signature); }

assert.equal(campaignState(0, '').status, 'not_configured');
assert.equal(campaignState(0, '2099-01-01').open, false);
assert.equal(campaignState(49, '2099-01-01T00:00:00Z').open, true);
assert.equal(campaignState(50, '2099-01-01T00:00:00Z').status, 'goal_reached');
assert.equal(campaignState(51, '2099-01-01T00:00:00Z').open, false);
assert.equal(campaignState(10, '2020-01-01T00:00:00Z').status, 'closed');
let response = await call('create-checkout-session', cart(1));
assert.equal(response.code, 200);
assert.equal(stripeParams.line_items[0].price_data.unit_amount, 7490);
assert.equal(stripeParams.shipping_options[0].shipping_rate_data.fixed_amount.amount, 990);
assert.equal(stripeParams.line_items[0].price_data.unit_amount + stripeParams.shipping_options[0].shipping_rate_data.fixed_amount.amount, 8480);
assert.equal(stripeParams.metadata.preorder_campaign, CAMPAIGN);
assert.equal('payment_method_types' in stripeParams, false);
assert.match(stripeParams.line_items[0].price_data.product_data.name, /PRÉCOMMANDE/);
const textile = { type: 'printful', productId: '456', syncVariantId: '123', qty: 1, unitAmount: 1 };
assert.equal((await call('create-checkout-session', { cart: [textile] })).code, 200);
assert.equal(stripeParams.line_items[0].price_data.unit_amount, 2990);
assert.equal(stripeParams.shipping_options[0].shipping_rate_data.fixed_amount.amount, 450);
assert.equal(stripeParams.metadata.preorder_campaign, undefined);
assert.equal((await call('create-checkout-session', { cart: [...cart(1).cart, textile] })).code, 200);
assert.equal(stripeParams.shipping_options[0].shipping_rate_data.fixed_amount.amount, 1440);
assert.equal(stripeParams.metadata.fulfillment, 'printful_draft');
for (const qty of [0, -1, 1.5, 11, 'bad']) assert.equal((await call('create-checkout-session', cart(qty))).code, 400);
assert.equal((await call('create-checkout-session', { cart: [] })).code, 400);
assert.equal((await call('create-checkout-session', cart(1), 'GET')).code, 405);
const originalDeadline = env.KROBS_PREORDER_DEADLINE;
delete env.KROBS_PREORDER_DEADLINE;
assert.equal((await call('create-checkout-session', cart(1))).code, 400);
env.KROBS_PREORDER_DEADLINE = '2020-01-01T00:00:00Z';
assert.equal((await call('create-checkout-session', cart(1))).code, 400);
env.KROBS_PREORDER_DEADLINE = originalDeadline;
assert.equal((await deliver('checkout.session.completed', session('bad', 1), 'invalid')).code, 400);
assert.equal(orders.size, 0);
await deliver('checkout.session.completed', session('pending', 2, 'unpaid'));
assert.equal(orders.size, 0);
await deliver('checkout.session.async_payment_succeeded', session('pending', 2));
await deliver('checkout.session.completed', session('pending', 2));
assert.equal(orders.size, 1);
assert.equal((await call('preorders')).data.paid, 2);
assert.equal(sqlCalls.some(q => q.includes('UPDATE krobs_inventory')), false);
await deliver('charge.refunded', { payment_intent: 'pi_pending', refunded: false, amount_refunded: 100 });
assert.equal((await call('preorders')).data.paid, 2);
await deliver('charge.refunded', { payment_intent: 'pi_pending', refunded: true, amount_refunded: 15970 });
await deliver('charge.refunded', { payment_intent: 'pi_pending', refunded: false, amount_refunded: 100 });
assert.equal((await call('preorders')).data.paid, 0);
await deliver('charge.refunded', { payment_intent: 'pi_early', refunded: true, amount_refunded: 8480 });
await deliver('checkout.session.completed', session('early', 1));
assert.equal((await call('preorders')).data.paid, 0);
orders.set('legacy', { campaign: null, status: 'paid', intent: 'legacy', cart: [{ t: 'd', q: 50 }] });
orders.set('textile', { campaign: CAMPAIGN, status: 'paid', intent: 'textile', cart: [{ t: 'p', q: 50 }] });
assert.equal((await call('preorders')).data.paid, 0);
for (let i = 0; i < 4; i++) await deliver('checkout.session.completed', session(`ten-${i}`, 10));
await deliver('checkout.session.completed', session('nine', 9));
assert.equal((await call('preorders')).data.paid, 49);
assert.equal((await call('create-checkout-session', cart(2))).code, 400);
assert.equal((await call('create-checkout-session', cart(1))).code, 200);
await deliver('checkout.session.completed', session('last', 1));
assert.equal((await call('preorders')).data.goalReached, true);
assert.equal((await call('create-checkout-session', cart(1))).code, 400);
databaseUnavailable = true;
assert.equal((await call('preorders')).code, 503);
assert.equal((await call('create-checkout-session', cart(1))).code, 400);
console.log('Précommandes : contrôles prix, quantités, clôture, signatures, paiements différés, doublons, remboursements et seuil 49/50 réussis (Stripe/SQL simulés).');

const elements = new Map(['#stock-status', '#preorder-progress', '#preorder-state', '#preorder-deadline', '.add-to-cart'].map(key => [key,
  { textContent: '', disabled: false, hidden: true, addEventListener() {} }]));
let inventoryResponse = { paid: 32, target: 50, open: true, deadline: originalDeadline, status: 'open', goalReached: false };
let uiUnavailable = false;
const uiContext = vm.createContext({ console, Intl, Date, JSON, Number, String, Array, Math,
  document: { querySelector: key => elements.get(key) || null, querySelectorAll: () => [], addEventListener() {} },
  localStorage: { getItem: () => '[]' },
  window: { setInterval() {} },
  fetch: async url => { assert.equal(url, '/api/preorders'); return { ok: !uiUnavailable, json: async () => inventoryResponse }; }
});
vm.runInContext(await fs.readFile(path.join(root, 'app.js'), 'utf8'), uiContext);
await vm.runInContext('loadStock()', uiContext);
assert.match(elements.get('#stock-status').textContent, /32 \/ 50/);
assert.equal(elements.get('#preorder-progress').value, 32);
assert.equal(elements.get('.add-to-cart').disabled, false);
inventoryResponse = { ...inventoryResponse, paid: 50, open: false, goalReached: true, status: 'goal_reached' };
await vm.runInContext('loadStock()', uiContext);
assert.equal(elements.get('.add-to-cart').disabled, true);
assert.match(elements.get('#preorder-state').textContent, /Objectif atteint/);
uiUnavailable = true;
await vm.runInContext('loadStock()', uiContext);
assert.equal(elements.get('.add-to-cart').disabled, true);
assert.equal(elements.get('#preorder-progress').hidden, true);
assert.match(elements.get('#stock-status').textContent, /INDISPONIBLE/);
console.log('Interface : compteur à 32/50, fermeture à 50 et indisponibilité vérifiés. Paiement textile et panier mixte inchangés.');
