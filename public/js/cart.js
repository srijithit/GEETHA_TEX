// ==========================================
// Geetha Tex — Cart Page JavaScript
// ==========================================

document.addEventListener('DOMContentLoaded', loadCart);

async function loadCart() {
  const container = document.getElementById('cart-content');
  const cart = getCart();

  if (cart.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-shopping-bag" style="font-size: 4rem; color: var(--accent-gold); margin-bottom: 1rem;"></i>
        <h2>Your cart is empty</h2>
        <p>Looks like you haven't added any sarees yet!</p>
        <a href="/products" class="btn btn-primary btn-lg" style="margin-top: 1.5rem;">
          <i class="fas fa-shopping-bag"></i> Start Shopping
        </a>
      </div>
    `;
    return;
  }

  // Fetch product details
  const ids = cart.map(item => item.id);
  try {
    const res = await fetch('/api/products/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids })
    });
    const products = await res.json();

    let subtotal = 0;
    let itemsHtml = '';

    cart.forEach(item => {
      const product = products.find(p => p.id === item.id);
      if (product) {
        const total = product.price * item.qty;
        subtotal += total;
        itemsHtml += `
          <div class="cart-item" id="cart-item-${product.id}">
            <div class="cart-item-image">
              <img src="/uploads/${product.image}" alt="${product.name}"
                   onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 120%22><rect fill=%22%23f3e8d9%22 width=%22100%22 height=%22120%22/><text x=%2250%%22 y=%2250%%22 text-anchor=%22middle%22 fill=%22%238B1A1A%22 font-size=%2230%22>🪷</text></svg>'">
            </div>
            <div class="cart-item-details">
              <h3><a href="/products/${product.id}">${product.name}</a></h3>
              <span class="cart-item-price">₹${product.price.toLocaleString('en-IN')}</span>
            </div>
            <div class="cart-item-qty">
              <button class="qty-btn" onclick="updateCartQty(${product.id}, -1)">−</button>
              <span class="qty-value">${item.qty}</span>
              <button class="qty-btn" onclick="updateCartQty(${product.id}, 1)">+</button>
            </div>
            <div class="cart-item-total">
              <span>₹${total.toLocaleString('en-IN')}</span>
            </div>
            <button class="cart-remove-btn" onclick="removeFromCart(${product.id})" title="Remove">
              <i class="fas fa-times"></i>
            </button>
          </div>
        `;
      }
    });

    const shipping = subtotal >= 5000 ? 0 : 99;
    const grandTotal = subtotal + shipping;

    container.innerHTML = `
      <div class="cart-layout">
        <div class="cart-items">
          <div class="cart-header-row">
            <h2>Cart Items (${cart.reduce((s, i) => s + i.qty, 0)})</h2>
            <button class="btn btn-outline btn-sm" onclick="clearCart()">
              <i class="fas fa-trash"></i> Clear Cart
            </button>
          </div>
          ${itemsHtml}
        </div>
        <div class="cart-summary">
          <h2>Order Summary</h2>
          <div class="summary-row">
            <span>Subtotal</span>
            <span>₹${subtotal.toLocaleString('en-IN')}</span>
          </div>
          <div class="summary-row">
            <span>Shipping</span>
            <span class="${shipping === 0 ? 'text-success' : ''}">${shipping === 0 ? 'Free' : '₹' + shipping}</span>
          </div>
          ${subtotal < 5000 ? '<p class="shipping-hint"><i class="fas fa-info-circle"></i> Add ₹' + (5000 - subtotal).toLocaleString('en-IN') + ' more for free shipping</p>' : ''}
          <div class="summary-divider"></div>
          <div class="summary-row total-row">
            <span>Total</span>
            <span>₹${grandTotal.toLocaleString('en-IN')}</span>
          </div>
          <a href="/checkout" class="btn btn-primary btn-lg btn-block" id="checkout-btn">
            <i class="fas fa-lock"></i> Proceed to Checkout
          </a>
          <a href="/products" class="btn btn-outline btn-block" style="margin-top: 0.75rem;">
            <i class="fas fa-arrow-left"></i> Continue Shopping
          </a>
        </div>
      </div>
    `;
  } catch (error) {
    container.innerHTML = '<div class="empty-state"><h3>Error loading cart</h3><p>Please try again later.</p></div>';
  }
}

function updateCartQty(productId, delta) {
  const cart = getCart();
  const item = cart.find(i => i.id === productId);
  if (item) {
    item.qty += delta;
    if (item.qty <= 0) {
      const index = cart.indexOf(item);
      cart.splice(index, 1);
    }
    saveCart(cart);
    loadCart();
  }
}

function removeFromCart(productId) {
  const cart = getCart().filter(i => i.id !== productId);
  saveCart(cart);
  showToast('Item removed from cart');
  loadCart();
}

function clearCart() {
  if (confirm('Are you sure you want to clear your cart?')) {
    saveCart([]);
    loadCart();
  }
}
