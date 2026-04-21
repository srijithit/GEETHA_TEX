// ==========================================
// Geetha Tex — Main JavaScript
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
  initNavbar();
  initCartCount();
  initAnimations();
});

// --- Navbar ---
function initNavbar() {
  const navbar = document.getElementById('navbar');
  const hamburger = document.getElementById('hamburger');
  const navLinks = document.getElementById('navLinks');

  // Scroll effect
  if (navbar) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 50) {
        navbar.classList.add('scrolled');
      } else {
        navbar.classList.remove('scrolled');
      }
    });
  }

  // Hamburger toggle
  if (hamburger && navLinks) {
    hamburger.addEventListener('click', () => {
      hamburger.classList.toggle('active');
      navLinks.classList.toggle('active');
    });

    // Close on link click
    navLinks.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        hamburger.classList.remove('active');
        navLinks.classList.remove('active');
      });
    });
  }
}

// --- Cart ---
function getCart() {
  return JSON.parse(localStorage.getItem('geethaCart') || '[]');
}

function saveCart(cart) {
  localStorage.setItem('geethaCart', JSON.stringify(cart));
  updateCartCount();
}

function updateCartCount() {
  const cart = getCart();
  const total = cart.reduce((sum, item) => sum + item.qty, 0);
  const badges = document.querySelectorAll('#cartCount');
  badges.forEach(badge => {
    badge.textContent = total;
    if (total > 0) {
      badge.classList.add('has-items');
    } else {
      badge.classList.remove('has-items');
    }
  });
}

function initCartCount() {
  updateCartCount();
}

function addToCart(productId) {
  const cart = getCart();
  const existing = cart.find(item => item.id === productId);
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({ id: productId, qty: 1 });
  }
  saveCart(cart);
  showToast('Added to cart! 🛍️');
}

// --- Toast Notification ---
function showToast(message) {
  // Remove existing toast
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<i class="fas fa-check-circle"></i> ${message}`;
  document.body.appendChild(toast);

  // Trigger animation
  requestAnimationFrame(() => {
    toast.classList.add('show');
  });

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

// --- Scroll Animations ---
function initAnimations() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('animate-in');
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

  document.querySelectorAll('.product-card, .category-card, .feature-card, .testimonial-card, .stat, .highlight-card, .value-card, .contact-card').forEach(el => {
    observer.observe(el);
  });
}
