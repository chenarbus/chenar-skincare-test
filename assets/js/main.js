/* ============================================================
   AURELLE — shared site behaviour
   Cart (demo, localStorage), mobile nav, Lenis + GSAP reveals,
   newsletter demo form, header state.
   ============================================================ */

(function () {
  "use strict";

  var REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- product catalogue (demo prices, fictional brand) ---------- */
  var PRODUCTS = {
    serum: {
      id: "serum",
      name: "Lumière Renewal Serum",
      size: "30 ml",
      price: 148,
      category: "serum",
      img: "images/media-generation-aurelle-hero-serum-0-4fcf1c53-7531-4a49-99a8-deaffc6c5359.jpg",
      alt: "Amber glass bottle of Lumière Renewal Serum on a stone surface"
    },
    cream: {
      id: "cream",
      name: "Crème Velours",
      size: "50 ml",
      price: 128,
      category: "cream",
      img: "images/media-generation-aurelle-cream-jar-0-c90256d9-1f0b-487e-a089-5493aa65174f.jpg",
      alt: "Glass jar of Crème Velours with a cream lid"
    },
    oil: {
      id: "oil",
      name: "Huile Nettoyante Cleansing Oil",
      size: "150 ml",
      price: 86,
      category: "cleanser",
      img: "images/media-generation-aurelle-cleansing-oil-0-750a71ce-3fb7-4a8a-93a7-de9e7b2a9779.jpg",
      alt: "Bottle of Huile Nettoyante cleansing oil beside green leaves"
    },
    eye: {
      id: "eye",
      name: "Éclat Eye Concentrate",
      size: "15 ml",
      price: 98,
      category: "serum",
      img: "images/media-generation-aurelle-cream-texture-0-ec41ca31-18d6-4d5b-9123-76716369dccd.jpg",
      alt: "Whipped cream texture of Éclat Eye Concentrate in soft light"
    }
  };

  var STORE_KEY = "aurelle-bag-v1";

  function money(n) { return "$" + n.toFixed(0); }

  /* ---------- cart state ---------- */
  var bag = {};
  try {
    bag = JSON.parse(localStorage.getItem(STORE_KEY) || "{}") || {};
  } catch (e) { bag = {}; }

  function saveBag() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(bag)); } catch (e) {}
  }

  function bagCount() {
    var n = 0;
    Object.keys(bag).forEach(function (id) { n += bag[id]; });
    return n;
  }

  function bagSubtotal() {
    var total = 0;
    Object.keys(bag).forEach(function (id) {
      if (PRODUCTS[id]) total += PRODUCTS[id].price * bag[id];
    });
    return total;
  }

  /* ---------- cart drawer (injected so every page shares it) ---------- */
  var overlay = document.createElement("div");
  overlay.className = "overlay";
  overlay.id = "cartOverlay";

  var drawer = document.createElement("aside");
  drawer.className = "cart-drawer";
  drawer.id = "cartDrawer";
  drawer.setAttribute("role", "dialog");
  drawer.setAttribute("aria-label", "Shopping bag");
  drawer.innerHTML =
    '<div class="cart-head"><h2>Your bag</h2>' +
    '<button class="cart-close" id="cartClose" aria-label="Close bag">&times;</button></div>' +
    '<div class="cart-items" id="cartItems"></div>' +
    '<div class="cart-foot">' +
    '<div class="cart-subtotal"><span>Subtotal</span><span id="cartSubtotal">$0</span></div>' +
    '<p class="cart-shipping">Shipping is calculated at checkout in a real store. This is a demo.</p>' +
    '<button class="btn btn-terra" id="checkoutBtn">Checkout</button>' +
    '<p class="cart-demo-note" id="cartDemoNote">This is a design demo, so there is no checkout. Your bag is saved on this device only.</p>' +
    "</div>";

  var toast = document.createElement("div");
  toast.className = "toast";
  toast.id = "toast";
  toast.setAttribute("role", "status");

  document.body.appendChild(overlay);
  document.body.appendChild(drawer);
  document.body.appendChild(toast);

  var bagCountEl = document.getElementById("bagCount");
  var cartItemsEl = document.getElementById("cartItems");
  var cartSubtotalEl = document.getElementById("cartSubtotal");
  var toastTimer = null;

  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove("show"); }, 2600);
  }

  function renderBag() {
    if (bagCountEl) bagCountEl.textContent = String(bagCount());
    var ids = Object.keys(bag).filter(function (id) { return PRODUCTS[id] && bag[id] > 0; });
    if (ids.length === 0) {
      cartItemsEl.innerHTML =
        '<div class="cart-empty"><p>Your bag is empty.</p>' +
        "<p>Add a product and it will wait here for you.</p></div>";
    } else {
      cartItemsEl.innerHTML = ids.map(function (id) {
        var p = PRODUCTS[id];
        return (
          '<div class="cart-item">' +
          '<img src="' + p.img + '" alt="' + p.alt + '">' +
          '<div><p class="cart-item-name">' + p.name + '</p>' +
          '<p class="cart-item-meta">' + p.size + " &middot; " + money(p.price) + "</p>" +
          '<div class="qty-row">' +
          '<button data-dec="' + id + '" aria-label="Decrease quantity">−</button>' +
          "<span>" + bag[id] + "</span>" +
          '<button data-inc="' + id + '" aria-label="Increase quantity">+</button>' +
          "</div></div>" +
          '<div><p class="cart-item-price">' + money(p.price * bag[id]) + "</p>" +
          '<button class="cart-remove" data-remove="' + id + '">Remove</button></div>' +
          "</div>"
        );
      }).join("");
    }
    cartSubtotalEl.textContent = money(bagSubtotal());
  }

  function openBag() {
    renderBag();
    drawer.classList.add("open");
    overlay.classList.add("show");
    document.body.style.overflow = "hidden";
    document.getElementById("cartClose").focus();
  }

  function closeBag() {
    drawer.classList.remove("open");
    overlay.classList.remove("show");
    document.body.style.overflow = "";
  }

  function addToBag(id) {
    if (!PRODUCTS[id]) return;
    bag[id] = (bag[id] || 0) + 1;
    saveBag();
    renderBag();
    showToast(PRODUCTS[id].name + " added to your bag");
  }

  document.addEventListener("click", function (e) {
    var addBtn = e.target.closest("[data-add-to-bag]");
    if (addBtn) { addToBag(addBtn.getAttribute("data-add-to-bag")); return; }
    var inc = e.target.closest("[data-inc]");
    if (inc) { bag[inc.getAttribute("data-inc")]++; saveBag(); renderBag(); return; }
    var dec = e.target.closest("[data-dec]");
    if (dec) {
      var id = dec.getAttribute("data-dec");
      bag[id]--;
      if (bag[id] <= 0) delete bag[id];
      saveBag(); renderBag(); return;
    }
    var rem = e.target.closest("[data-remove]");
    if (rem) { delete bag[rem.getAttribute("data-remove")]; saveBag(); renderBag(); return; }
  });

  document.getElementById("bagBtn").addEventListener("click", openBag);
  document.getElementById("cartClose").addEventListener("click", closeBag);
  overlay.addEventListener("click", closeBag);
  document.getElementById("checkoutBtn").addEventListener("click", function () {
    document.getElementById("cartDemoNote").classList.add("show");
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") { closeBag(); closeMenu(); }
  });

  renderBag();

  /* ---------- header state + mobile nav ---------- */
  var header = document.getElementById("siteHeader");
  var menuBtn = document.getElementById("menuBtn");
  var siteNav = document.getElementById("siteNav");

  function onScroll() {
    header.classList.toggle("scrolled", window.scrollY > 24);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  function closeMenu() {
    siteNav.classList.remove("open");
    menuBtn.setAttribute("aria-expanded", "false");
  }

  menuBtn.addEventListener("click", function () {
    var open = siteNav.classList.toggle("open");
    menuBtn.setAttribute("aria-expanded", String(open));
  });
  siteNav.querySelectorAll("a").forEach(function (a) {
    a.addEventListener("click", closeMenu);
  });

  /* ---------- newsletter demo form ---------- */
  document.querySelectorAll(".newsletter-form").forEach(function (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var input = form.querySelector('input[type="email"]');
      if (!input.value || input.value.indexOf("@") === -1) {
        input.focus();
        showToast("Please enter a valid email address");
        return;
      }
      form.style.display = "none";
      var thanks = form.parentElement.querySelector(".newsletter-thanks");
      if (thanks) thanks.classList.add("show");
      showToast("Welcome to the AURELLE letter");
    });
  });

  /* ---------- smooth scroll + reveals (GSAP + Lenis) ---------- */
  var hasGsap = typeof window.gsap !== "undefined";
  var hasLenis = typeof window.Lenis !== "undefined";

  if (!REDUCED && hasLenis) {
    var lenis = new Lenis({ duration: 1.1, smoothWheel: true });
    function raf(time) { lenis.raf(time); requestAnimationFrame(raf); }
    requestAnimationFrame(raf);
    if (hasGsap && window.ScrollTrigger) {
      lenis.on("scroll", window.ScrollTrigger.update);
    }
    document.querySelectorAll('a[href^="#"]').forEach(function (a) {
      a.addEventListener("click", function (e) {
        var target = document.querySelector(a.getAttribute("href"));
        if (target) { e.preventDefault(); lenis.scrollTo(target, { offset: -80 }); }
      });
    });
  }

  if (hasGsap && window.ScrollTrigger && !REDUCED) {
    gsap.registerPlugin(ScrollTrigger);

    document.querySelectorAll("[data-reveal]").forEach(function (el) {
      var kind = el.getAttribute("data-reveal") || "up";
      var vars = { opacity: 0, duration: 0.7, ease: "power3.out" };
      if (kind === "up") vars.y = 28;
      if (kind === "left") vars.x = -32;
      if (kind === "right") vars.x = 32;
      if (kind === "scale") vars.scale = 0.96;
      gsap.from(el, Object.assign(vars, {
        scrollTrigger: { trigger: el, start: "top 88%", once: true }
      }));
    });

    document.querySelectorAll("[data-parallax]").forEach(function (el) {
      gsap.fromTo(el, { yPercent: -6 }, {
        yPercent: 6, ease: "none",
        scrollTrigger: { trigger: el.closest("section") || el, start: "top bottom", end: "bottom top", scrub: true }
      });
    });
  }
})();
