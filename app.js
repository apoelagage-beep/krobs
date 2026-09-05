const PRODUCT = {
  id: "block-01-deck",
  name: "BLOCK 01 DECK",
  price: 7490,
  size: "8.25"
};

const CART_KEY = "krobs-cart";

const cartDrawer = document.querySelector("#cart");
const backdrop = document.querySelector(".backdrop");
const cartToggle = document.querySelector(".cart-toggle");
const cartClose = document.querySelector(".cart-close");
const addButton = document.querySelector(".add-to-cart");
const checkoutButton = document.querySelector("#checkout");
const cartItems = document.querySelector("#cart-items");
const cartCount = document.querySelector("#cart-count");
const cartTotal = document.querySelector("#cart-total");
const stockStatus = document.querySelector("#stock-status");

let stock = null;

function getCart() {
  try {
    const cart = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
    return Array.isArray(cart) ? cart : [];
  } catch {
    return [];
  }
}

function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  renderCart();
}

function formatPrice(cents) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR"
  }).format(cents / 100);
}

function openCart() {
  cartDrawer?.classList.add("open");
  backdrop?.classList.add("open");
  document.body.classList.add("cart-open");
}

function closeCart() {
  cartDrawer?.classList.remove("open");
  backdrop?.classList.remove("open");
  document.body.classList.remove("cart-open");
}

function renderCart() {
  const cart = getCart();

  const quantity = cart.reduce(
    (total, item) => total + Number(item.qty || 0),
    0
  );

  const total = cart.reduce(
    (sum, item) => sum + PRODUCT.price * Number(item.qty || 0),
    0
  );

  if (cartCount) {
    cartCount.textContent = quantity;
  }

  if (cartTotal) {
    cartTotal.textContent = formatPrice(total);
  }

  if (!cartItems) return;

  if (!cart.length) {
    cartItems.innerHTML = `
      <p class="empty-cart">TON PANIER EST VIDE.</p>
    `;

    if (checkoutButton) {
      checkoutButton.disabled = true;
    }

    return;
  }

  if (checkoutButton) {
    checkoutButton.disabled = false;
  }

  cartItems.innerHTML = cart.map((item) => `
    <div class="cart-item">
      <div>
        <strong>${PRODUCT.name}</strong>
        <span>${item.size}" / QTY ${item.qty}</span>
      </div>

      <div>
        <strong>${formatPrice(PRODUCT.price * item.qty)}</strong>
        <button
          type="button"
          class="remove-item"
          data-id="${item.id}"
          data-size="${item.size}"
        >
          SUPPRIMER
        </button>
      </div>
    </div>
  `).join("");

  document.querySelectorAll(".remove-item").forEach((button) => {
    button.addEventListener("click", () => {
      removeItem(button.dataset.id, button.dataset.size);
    });
  });
}

function addToCart() {
  const cart = getCart();

  const existing = cart.find(
    (item) =>
      item.id === PRODUCT.id &&
      item.size === PRODUCT.size
  );

  const currentQuantity = existing ? Number(existing.qty) : 0;

  if (stock !== null && currentQuantity >= stock) {
    alert("Stock maximum atteint.");
    return;
  }

  if (existing) {
    existing.qty = currentQuantity + 1;
  } else {
    cart.push({
      id: PRODUCT.id,
      size: PRODUCT.size,
      qty: 1
    });
  }

  saveCart(cart);
  openCart();
}

function removeItem(id, size) {
  const cart = getCart();

  const item = cart.find(
    (product) =>
      product.id === id &&
      product.size === size
  );

  if (!item) return;

  if (item.qty > 1) {
    item.qty -= 1;
    saveCart(cart);
    return;
  }

  saveCart(
    cart.filter(
      (product) =>
        !(product.id === id && product.size === size)
    )
  );
}

async function loadStock() {
  if (!stockStatus) return;

  try {
    const response = await fetch("/api/inventory", {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error("Inventory unavailable");
    }

    const data = await response.json();

    const row = data.inventory?.find(
      (item) =>
        item.product_id === PRODUCT.id &&
        item.size === PRODUCT.size
    );

    if (!row) {
      throw new Error("Product unavailable");
    }

    stock = Number(row.stock);

    if (stock <= 0) {
      stockStatus.textContent = "ÉPUISÉ";

      if (addButton) {
        addButton.disabled = true;
        addButton.textContent = "ÉPUISÉ";
      }

      return;
    }

    stockStatus.textContent =
      stock <= 10
        ? `PLUS QUE ${stock} EN STOCK`
        : "EN STOCK";
  } catch (error) {
    stockStatus.textContent = "STOCK DISPONIBLE";
  }
}

async function checkout() {
  const cart = getCart();

  if (!cart.length || !checkoutButton) return;

  const originalText = checkoutButton.textContent;

  checkoutButton.disabled = true;
  checkoutButton.textContent = "CHARGEMENT…";

  try {
    const response = await fetch("/api/create-checkout-session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ cart })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Checkout impossible");
    }

    if (!data.url) {
      throw new Error("URL Stripe manquante");
    }

    window.location.href = data.url;
  } catch (error) {
    alert(error.message || "Une erreur est survenue.");

    checkoutButton.disabled = false;
    checkoutButton.textContent = originalText;

    loadStock();
  }
}

cartToggle?.addEventListener("click", openCart);
cartClose?.addEventListener("click", closeCart);
backdrop?.addEventListener("click", closeCart);
addButton?.addEventListener("click", addToCart);
checkoutButton?.addEventListener("click", checkout);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeCart();
  }
});

renderCart();
loadStock();