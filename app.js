const DECK_PRODUCT = {
  type: 'deck',
  id: 'block-01-deck',
  name: 'BLOCK 01 DECK',
  unitAmount: 7490,
  size: '8.25'
};

const CART_KEY = 'krobs-cart';

const cartDrawer = document.querySelector('#cart');
const backdrop = document.querySelector('.backdrop');
const cartToggle = document.querySelector('.cart-toggle');
const cartClose = document.querySelector('.cart-close');
const addButton = document.querySelector('.add-to-cart');
const checkoutButton = document.querySelector('#checkout');
const cartItems = document.querySelector('#cart-items');
const cartCount = document.querySelector('#cart-count');
const cartTotal = document.querySelector('#cart-total');
const stockStatus = document.querySelector('#stock-status');

let stock = null;
let preorderOpen = false;

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function normalizeCartItem(item) {
  if (!item || typeof item !== 'object') return null;

  const qty = Math.max(1, Math.min(10, Math.floor(Number(item.qty) || 1)));

  if (item.type === 'printful' || item.syncVariantId) {
    const productId = String(item.productId || '').trim();
    const syncVariantId = String(item.syncVariantId || '').trim();
    if (!/^\d+$/.test(productId) || !/^\d+$/.test(syncVariantId)) return null;

    return {
      type: 'printful',
      id: String(item.id || `printful-${productId}`),
      productId,
      syncVariantId,
      name: String(item.name || 'KRØBS TEXTILE'),
      size: String(item.size || ''),
      color: String(item.color || ''),
      unitAmount: Math.max(0, Math.round(Number(item.unitAmount) || 0)),
      qty
    };
  }

  if (item.id === DECK_PRODUCT.id) {
    return {
      ...DECK_PRODUCT,
      qty
    };
  }

  return null;
}

function getCart() {
  try {
    const stored = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
    if (!Array.isArray(stored)) return [];
    return stored.map(normalizeCartItem).filter(Boolean);
  } catch {
    return [];
  }
}

function saveCart(cart) {
  const clean = Array.isArray(cart)
    ? cart.map(normalizeCartItem).filter(Boolean)
    : [];
  localStorage.setItem(CART_KEY, JSON.stringify(clean));
  renderCart();
}

function formatPrice(cents) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR'
  }).format((Number(cents) || 0) / 100);
}

function openCart() {
  cartDrawer?.classList.add('open');
  backdrop?.classList.add('open');
  document.body.classList.add('cart-open');
}

function closeCart() {
  cartDrawer?.classList.remove('open');
  backdrop?.classList.remove('open');
  document.body.classList.remove('cart-open');
}

function sameItem(a, b) {
  if (a.type === 'printful' || b.type === 'printful') {
    return a.type === 'printful'
      && b.type === 'printful'
      && String(a.productId) === String(b.productId)
      && String(a.syncVariantId) === String(b.syncVariantId);
  }

  return a.id === b.id && a.size === b.size;
}

function renderCart() {
  const cart = getCart();
  const quantity = cart.reduce((total, item) => total + Number(item.qty || 0), 0);
  const total = cart.reduce(
    (sum, item) => sum + Number(item.unitAmount || 0) * Number(item.qty || 0),
    0
  );

  if (cartCount) cartCount.textContent = quantity;
  if (cartTotal) cartTotal.textContent = formatPrice(total);
  if (!cartItems) return;

  if (!cart.length) {
    cartItems.innerHTML = '<p class="empty-cart">TON PANIER EST VIDE.</p>';
    if (checkoutButton) checkoutButton.disabled = true;
    return;
  }

  if (checkoutButton) checkoutButton.disabled = false;

  cartItems.innerHTML = cart.map((item) => {
    const details = item.type === 'printful'
      ? [item.size, item.color].filter(Boolean).join(' / ')
      : `${item.size}\" / PRÉCOMMANDE`;

    return `
      <div class="cart-item">
        <div>
          <strong>${escapeHtml(item.name)}</strong>
          <span>${escapeHtml(details)} / QTY ${item.qty}</span>
        </div>
        <div>
          <strong>${formatPrice(item.unitAmount * item.qty)}</strong>
          <button
            type="button"
            class="remove-item"
            data-id="${escapeHtml(item.id)}"
            data-size="${escapeHtml(item.size)}"
            data-sync-variant-id="${escapeHtml(item.syncVariantId || '')}"
          >SUPPRIMER</button>
        </div>
      </div>
    `;
  }).join('');

  document.querySelectorAll('.remove-item').forEach((button) => {
    button.addEventListener('click', () => {
      removeItem(button.dataset.id, button.dataset.size, button.dataset.syncVariantId);
    });
  });
}

function addItem(input) {
  const item = normalizeCartItem(input);
  if (!item) return false;

  const cart = getCart();
  const existing = cart.find((entry) => sameItem(entry, item));
  const currentQuantity = existing ? Number(existing.qty) : 0;

  if (item.type === 'deck' && (!preorderOpen || stock === null || currentQuantity + item.qty > stock)) {
    alert('Précommande indisponible ou quantité restante insuffisante.');
    return false;
  }

  if (existing) {
    existing.qty = Math.min(10, currentQuantity + Number(item.qty || 1));
  } else {
    cart.push(item);
  }

  saveCart(cart);
  openCart();
  return true;
}

function addDeckToCart() {
  addItem({ ...DECK_PRODUCT, qty: 1 });
}

function removeItem(id, size, syncVariantId = '') {
  const cart = getCart();
  const item = cart.find((entry) => {
    if (syncVariantId) {
      return entry.type === 'printful'
        && entry.id === id
        && String(entry.syncVariantId) === String(syncVariantId);
    }
    return entry.id === id && entry.size === size;
  });

  if (!item) return;

  if (item.qty > 1) {
    item.qty -= 1;
    saveCart(cart);
    return;
  }

  saveCart(cart.filter((entry) => entry !== item));
}

async function loadStock() {
  if (!stockStatus) return;
  if (addButton) addButton.disabled = true;
  try {
    const response = await fetch('/api/preorders', { cache: 'no-store' });
    if (!response.ok) throw new Error('Preorders unavailable');
    const data = await response.json();
    if (!Number.isInteger(data.paid) || data.paid < 0 || data.target !== 50 || typeof data.open !== 'boolean') {
      throw new Error('Invalid campaign');
    }
    stock = Math.max(0, data.target - data.paid);
    preorderOpen = data.open;
    const progress = document.querySelector('#preorder-progress');
    if (progress) {
      progress.max = data.target;
      progress.value = Math.min(data.paid, data.target);
      progress.hidden = false;
    }
    stockStatus.textContent = `${data.paid} / ${data.target} PLANCHES PRÉCOMMANDÉES ET PAYÉES`;
    const deadline = document.querySelector('#preorder-deadline');
    if (deadline) deadline.textContent = data.deadline
      ? `Clôture le ${new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/Paris' }).format(new Date(data.deadline))} (heure de Paris).`
      : 'Date d’ouverture à venir.';
    const state = document.querySelector('#preorder-state');
    if (state) state.textContent = data.goalReached
      ? 'Objectif atteint ! Les nouvelles précommandes sont fermées. Le lancement sera confirmé aux clients.'
      : data.status === 'closed'
        ? 'Campagne terminée : objectif non atteint. Les précommandes seront remboursées.'
        : data.open ? 'Chaque planche payée nous rapproche du lancement de la production.' : 'Les précommandes ouvriront prochainement.';
    if (addButton) {
      addButton.disabled = !data.open;
      addButton.textContent = data.open ? 'PRÉCOMMANDER — 74,90 €' : 'PRÉCOMMANDES FERMÉES';
    }
  } catch {
    preorderOpen = false;
    stock = null;
    stockStatus.textContent = 'SUIVI DES PRÉCOMMANDES TEMPORAIREMENT INDISPONIBLE';
    const progress = document.querySelector('#preorder-progress');
    if (progress) progress.hidden = true;
    if (addButton) { addButton.disabled = true; addButton.textContent = 'RÉESSAYER PLUS TARD'; }
  }
}

async function checkout() {
  const cart = getCart();
  if (!cart.length || !checkoutButton) return;

  const originalText = checkoutButton.textContent;
  checkoutButton.disabled = true;
  checkoutButton.textContent = 'CHARGEMENT…';

  try {
    const response = await fetch('/api/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cart })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Checkout impossible');
    if (!data.url) throw new Error('URL Stripe manquante');

    window.location.href = data.url;
  } catch (error) {
    alert(error.message || 'Une erreur est survenue.');
    checkoutButton.disabled = false;
    checkoutButton.textContent = originalText;
    loadStock();
  }
}

window.KROBS_CART = {
  addItem,
  getCart,
  openCart,
  renderCart
};

cartToggle?.addEventListener('click', openCart);
cartClose?.addEventListener('click', closeCart);
backdrop?.addEventListener('click', closeCart);
addButton?.addEventListener('click', addDeckToCart);
checkoutButton?.addEventListener('click', checkout);

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeCart();
});

renderCart();
loadStock();
if (stockStatus) window.setInterval(loadStock, 30000);
