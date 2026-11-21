/* ============================================================
   AURELLE — interactive 3D product viewer (Three.js 0.187.0)
   Shared module for the hero serum bottle and the shop detail
   viewers. All four products are modelled procedurally from
   primitives (lathe profiles, cylinders, canvas label textures)
   — no external model files.
   - window.Aurelle3D.initViewer(container, productKey, options)
   - Drag to rotate (pointer events, inertia, damped tilt),
     slow auto-rotate when idle, double-click / reset button
     returns to the default 3/4 view.
   - DPR capped (2 desktop / 1.5 mobile), rendering pauses
     offscreen, lazy init for shop viewers, full dispose on
     pagehide. If WebGL or the Three.js CDN is unavailable the
     container keeps its fallback photo and nothing breaks.
   ============================================================ */

(function () {
  "use strict";

  var REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var DEFAULT_RY = 0.55; /* default 3/4 view, horizontal */
  var DEFAULT_ELEV = 0.12; /* default camera elevation, radians */
  var TILT_LIMIT = 0.35; /* vertical tilt range around the default */
  var IDLE_RESUME_MS = 3000; /* auto-rotate resumes 3s after last drag */

  var PRODUCTS = {
    serum: { name: "Lumière Renewal Serum", sub: "FACE SERUM", size: "30 ml" },
    cream: { name: "Crème Velours", sub: "FACE CREAM", size: "50 ml" },
    oil: { name: "Huile Nettoyante", sub: "CLEANSING OIL", size: "150 ml" },
    eye: { name: "Éclat Eye Concentrate", sub: "EYE TREATMENT", size: "15 ml" }
  };

  function webglAvailable() {
    try {
      var c = document.createElement("canvas");
      return !!(c.getContext("webgl2") || c.getContext("webgl"));
    } catch (e) { return false; }
  }

  /* ---------- canvas label texture ---------- */

  function drawSpacedText(ctx, text, cx, y, font, spacing, color) {
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    var widths = [];
    var total = 0;
    for (var i = 0; i < text.length; i++) {
      var w = ctx.measureText(text[i]).width;
      widths.push(w);
      total += w;
    }
    total += spacing * Math.max(0, text.length - 1);
    var x = cx - total / 2;
    for (var j = 0; j < text.length; j++) {
      ctx.fillText(text[j], x, y);
      x += widths[j] + spacing;
    }
  }

  function fitFont(ctx, text, basePx, maxWidth, style) {
    var px = basePx;
    ctx.font = style + " " + px + "px Georgia, 'Times New Roman', serif";
    while (px > 28 && ctx.measureText(text).width > maxWidth) {
      px -= 2;
      ctx.font = style + " " + px + "px Georgia, 'Times New Roman', serif";
    }
    return px;
  }

  function makeLabelTexture(THREE, productKey, maxAnisotropy) {
    var p = PRODUCTS[productKey];
    var cv = document.createElement("canvas");
    cv.width = 1024;
    cv.height = 512;
    var ctx = cv.getContext("2d");
    ctx.fillStyle = "#FFFDF9";
    ctx.fillRect(0, 0, 1024, 512);
    /* fine terracotta rules, top and bottom */
    ctx.strokeStyle = "#B96A3B";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(64, 42); ctx.lineTo(960, 42); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(64, 470); ctx.lineTo(960, 470); ctx.stroke();
    /* wordmark */
    drawSpacedText(ctx, "AURELLE", 512, 128, "600 58px Georgia, 'Times New Roman', serif", 18, "#1D1A16");
    /* small terracotta diamond */
    ctx.fillStyle = "#B96A3B";
    ctx.save();
    ctx.translate(512, 192);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-6, -6, 12, 12);
    ctx.restore();
    /* product name (shrunk to fit long names) */
    var namePx = fitFont(ctx, p.name, 54, 860, "italic 500");
    ctx.font = "italic 500 " + namePx + "px Georgia, 'Times New Roman', serif";
    ctx.fillStyle = "#1D1A16";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(p.name, 512, 268);
    /* sub line */
    drawSpacedText(ctx, p.sub, 512, 340, "400 28px Georgia, 'Times New Roman', serif", 7, "rgba(29, 26, 22, 0.82)");
    /* size */
    drawSpacedText(ctx, p.size, 512, 414, "600 34px Georgia, 'Times New Roman', serif", 4, "#8A4A22");
    var tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = maxAnisotropy;
    return tex;
  }

  function makeShadowTexture(THREE) {
    var cv = document.createElement("canvas");
    cv.width = 256;
    cv.height = 256;
    var ctx = cv.getContext("2d");
    var g = ctx.createRadialGradient(128, 128, 8, 128, 128, 126);
    g.addColorStop(0, "rgba(29, 26, 22, 0.32)");
    g.addColorStop(0.55, "rgba(29, 26, 22, 0.14)");
    g.addColorStop(1, "rgba(29, 26, 22, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
    var tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  /* ---------- materials ---------- */

  function materials(THREE, labelTex) {
    return {
      amberGlass: new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        metalness: 0,
        roughness: 0.06,
        transmission: 0.9,
        thickness: 0.35,
        ior: 1.5,
        attenuationColor: new THREE.Color(0xB26A1A),
        attenuationDistance: 0.5,
        clearcoat: 1,
        clearcoatRoughness: 0.08,
        envMapIntensity: 1.2,
        specularIntensity: 1
      }),
      amberLiquid: new THREE.MeshPhysicalMaterial({
        color: 0x9C5A14,
        roughness: 0.28,
        clearcoat: 0.5,
        clearcoatRoughness: 0.3,
        envMapIntensity: 0.7
      }),
      frostedGlass: new THREE.MeshPhysicalMaterial({
        color: 0xF6F0E6,
        metalness: 0,
        roughness: 0.45,
        transmission: 0.35,
        thickness: 0.9,
        ior: 1.45,
        attenuationColor: new THREE.Color(0xffffff),
        attenuationDistance: 2,
        clearcoat: 0.5,
        clearcoatRoughness: 0.35,
        envMapIntensity: 0.9
      }),
      creamFill: new THREE.MeshStandardMaterial({ color: 0xF1E6D2, roughness: 0.95 }),
      lidCream: new THREE.MeshPhysicalMaterial({
        color: 0xEFE4CE, roughness: 0.42, clearcoat: 0.4, clearcoatRoughness: 0.3
      }),
      ink: new THREE.MeshStandardMaterial({ color: 0x1D1A16, roughness: 0.38, metalness: 0.15 }),
      terra: new THREE.MeshStandardMaterial({ color: 0xB96A3B, roughness: 0.4, metalness: 0.1 }),
      label: new THREE.MeshPhysicalMaterial({
        map: labelTex, roughness: 0.55, clearcoat: 0.25, clearcoatRoughness: 0.5
      })
    };
  }

  function lathe(THREE, pts, segments) {
    var v = pts.map(function (p) { return new THREE.Vector2(p[0], p[1]); });
    return new THREE.LatheGeometry(v, segments || 64);
  }

  function mesh(geo, mat, x, y, z) {
    var m = new THREE.Mesh(geo, mat);
    if (x !== undefined) m.position.set(x || 0, y || 0, z || 0);
    return m;
  }

  function labelBand(THREE, mats, radius, height, y) {
    var band = mesh(
      new THREE.CylinderGeometry(radius, radius, height, 96, 1, true),
      mats.label
    );
    band.position.y = y;
    band.rotation.y = Math.PI; /* texture centre faces the camera at rest */
    return band;
  }

  /* ---------- product builders (base at y = 0) ---------- */

  var BUILDERS = {
    serum: function (THREE, M) {
      var g = new THREE.Group();
      g.add(mesh(lathe(THREE, [
        [0.001, 0], [0.28, 0], [0.38, 0.02], [0.42, 0.08], [0.43, 0.16],
        [0.43, 1.10], [0.42, 1.22], [0.38, 1.33], [0.30, 1.42], [0.20, 1.48],
        [0.16, 1.52], [0.155, 1.58], [0.155, 1.70], [0.13, 1.70], [0.13, 1.74]
      ]), M.amberGlass));
      /* amber liquid, filled to just over half so the pipette shows above it */
      g.add(mesh(lathe(THREE, [
        [0.001, 0.01], [0.30, 0.01], [0.39, 0.05], [0.40, 0.12], [0.40, 0.66],
        [0.36, 0.70], [0.001, 0.70]
      ]), M.amberLiquid));
      /* dropper stem, visible through the glass above the liquid line */
      g.add(mesh(new THREE.CylinderGeometry(0.032, 0.032, 1.38, 16), M.ink, 0, 1.03, 0));
      /* thin terracotta ring at the cap base */
      g.add(mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.045, 48), M.terra, 0, 1.70, 0));
      /* dark cap */
      g.add(mesh(new THREE.CylinderGeometry(0.185, 0.185, 0.44, 48), M.ink, 0, 1.92, 0));
      g.add(mesh(new THREE.CylinderGeometry(0.185, 0.16, 0.05, 48), M.ink, 0, 2.15, 0));
      g.add(labelBand(THREE, M, 0.438, 0.55, 0.62));
      return { model: g, height: 2.18 };
    },

    cream: function (THREE, M) {
      var g = new THREE.Group();
      g.add(mesh(lathe(THREE, [
        [0.001, 0], [0.40, 0], [0.52, 0.03], [0.57, 0.10], [0.58, 0.20],
        [0.58, 0.52], [0.56, 0.60], [0.50, 0.64], [0.48, 0.64]
      ]), M.frostedGlass));
      /* warm cream core seen through the frosted glass */
      g.add(mesh(new THREE.CylinderGeometry(0.50, 0.50, 0.46, 48), M.creamFill, 0, 0.30, 0));
      /* thin terracotta ring where lid meets jar */
      g.add(mesh(new THREE.CylinderGeometry(0.605, 0.605, 0.035, 64), M.terra, 0, 0.655, 0));
      /* cream lid */
      g.add(mesh(new THREE.CylinderGeometry(0.60, 0.60, 0.20, 64), M.lidCream, 0, 0.74, 0));
      g.add(mesh(new THREE.CylinderGeometry(0.58, 0.60, 0.03, 64), M.lidCream, 0, 0.85, 0));
      g.add(labelBand(THREE, M, 0.588, 0.36, 0.34));
      return { model: g, height: 0.87 };
    },

    oil: function (THREE, M) {
      var g = new THREE.Group();
      g.add(mesh(lathe(THREE, [
        [0.001, 0], [0.22, 0], [0.30, 0.03], [0.32, 0.10], [0.32, 1.55],
        [0.31, 1.68], [0.26, 1.80], [0.17, 1.88], [0.13, 1.92], [0.125, 1.98], [0.125, 2.06]
      ]), M.amberGlass));
      g.add(mesh(lathe(THREE, [
        [0.001, 0.01], [0.23, 0.01], [0.29, 0.05], [0.30, 0.12], [0.30, 0.96],
        [0.27, 1.00], [0.001, 1.00]
      ]), M.amberLiquid));
      /* pump: collar, stem, nozzle, spout */
      g.add(mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.14, 32), M.ink, 0, 2.10, 0));
      g.add(mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.22, 32), M.ink, 0, 2.26, 0));
      g.add(mesh(new THREE.BoxGeometry(0.36, 0.10, 0.13), M.ink, 0.13, 2.36, 0));
      g.add(mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.12, 16), M.ink, 0.29, 2.28, 0));
      g.add(labelBand(THREE, M, 0.328, 0.75, 0.95));
      return { model: g, height: 2.41 };
    },

    eye: function (THREE, M) {
      var g = new THREE.Group();
      g.add(mesh(lathe(THREE, [
        [0.001, 0], [0.18, 0], [0.235, 0.02], [0.25, 0.07], [0.25, 0.72],
        [0.24, 0.80], [0.20, 0.87], [0.13, 0.92], [0.11, 0.95], [0.11, 1.06]
      ]), M.amberGlass));
      g.add(mesh(lathe(THREE, [
        [0.001, 0.01], [0.19, 0.01], [0.225, 0.05], [0.23, 0.10], [0.23, 0.48],
        [0.20, 0.51], [0.001, 0.51]
      ]), M.amberLiquid));
      g.add(mesh(new THREE.CylinderGeometry(0.135, 0.135, 0.035, 32), M.terra, 0, 1.06, 0));
      g.add(mesh(new THREE.CylinderGeometry(0.125, 0.125, 0.34, 32), M.ink, 0, 1.24, 0));
      g.add(labelBand(THREE, M, 0.258, 0.42, 0.42));
      return { model: g, height: 1.41 };
    }
  };

  /* ---------- viewer ---------- */

  function initViewer(container, productKey, options) {
    options = options || {};
    if (!container || !BUILDERS[productKey]) return null;
    if (container.dataset.viewerInit === "1") return null;
    container.dataset.viewerInit = "1";

    var state = {
      container: container,
      productKey: productKey,
      options: options,
      rotY: DEFAULT_RY,
      elev: DEFAULT_ELEV,
      velY: 0,
      velElev: 0,
      dragging: false,
      resetting: false,
      resetFrom: null,
      resetStart: 0,
      lastInteract: 0,
      visible: false,
      ready: false,
      disposed: false,
      rafId: null,
      hint: null,
      resetBtn: null,
      renderer: null,
      scene: null,
      camera: null,
      spin: null,
      dist: 5
    };

    function markOff() {
      container.setAttribute("data-webgl", "off");
    }

    function dispose() {
      if (state.disposed) return;
      state.disposed = true;
      if (state.rafId !== null) cancelAnimationFrame(state.rafId);
      state.rafId = null;
      if (state.io) state.io.disconnect();
      if (state.lazyIo) state.lazyIo.disconnect();
      if (state.ro) state.ro.disconnect();
      if (state._onResize) window.removeEventListener("resize", state._onResize);
      if (state.scene) {
        state.scene.traverse(function (obj) {
          if (obj.geometry) obj.geometry.dispose();
          if (obj.material) {
            var mats = Array.isArray(obj.material) ? obj.material : [obj.material];
            mats.forEach(function (m) {
              if (m.map) m.map.dispose();
              m.dispose();
            });
          }
        });
      }
      if (state.renderer) {
        state.renderer.dispose();
        if (state.renderer.domElement && state.renderer.domElement.parentNode) {
          state.renderer.domElement.parentNode.removeChild(state.renderer.domElement);
        }
      }
      if (state.hint && state.hint.parentNode) state.hint.parentNode.removeChild(state.hint);
      if (state.resetBtn && state.resetBtn.parentNode) state.resetBtn.parentNode.removeChild(state.resetBtn);
      window.removeEventListener("pagehide", dispose);
    }

    function resetView() {
      if (!state.ready) return;
      state.resetting = true;
      state.resetFrom = { ry: state.rotY, elev: state.elev };
      state.resetStart = performance.now();
      state.velY = 0;
      state.velElev = 0;
      ensureLoop();
    }

    function render() {
      if (!state.renderer || !state.scene || !state.camera) return;
      state.renderer.render(state.scene, state.camera);
    }

    function applyCamera() {
      var d = state.dist;
      state.camera.position.set(0, Math.sin(state.elev) * d, Math.cos(state.elev) * d);
      state.camera.lookAt(0, 0, 0);
    }

    function frame() {
      if (state.disposed || !state.visible) { state.rafId = null; return; }
      state.rafId = requestAnimationFrame(frame);
      var now = performance.now();

      /* reset animation (ease-out cubic over 600ms) */
      if (state.resetting) {
        var p = Math.min(1, (now - state.resetStart) / 600);
        var e = 1 - Math.pow(1 - p, 3);
        var dRy = DEFAULT_RY - state.resetFrom.ry;
        dRy = ((dRy + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
        state.rotY = state.resetFrom.ry + dRy * e;
        state.elev = state.resetFrom.elev + (DEFAULT_ELEV - state.resetFrom.elev) * e;
        if (p >= 1) state.resetting = false;
      } else if (state.dragging) {
        /* rotation applied directly by pointer handlers */
      } else {
        /* inertia after a flick */
        if (Math.abs(state.velY) > 0.0004 || Math.abs(state.velElev) > 0.0004) {
          state.rotY += state.velY;
          state.elev = clampElev(state.elev + state.velElev);
          state.velY *= 0.94;
          state.velElev *= 0.94;
        } else {
          state.velY = 0;
          state.velElev = 0;
        }
        /* slow auto-rotate once idle for 3s */
        if (state.options.autoRotate !== false && !REDUCED &&
            now - state.lastInteract > IDLE_RESUME_MS) {
          state.rotY += 0.0038;
        }
      }

      state.spin.rotation.y = state.rotY;
      applyCamera();
      render();

      /* reduced-motion: stop the loop when nothing is moving */
      if (REDUCED && !state.dragging && !state.resetting &&
          Math.abs(state.velY) < 0.0004 && Math.abs(state.velElev) < 0.0004) {
        cancelAnimationFrame(state.rafId);
        state.rafId = null;
      }
    }

    function ensureLoop() {
      if (state.disposed || !state.visible || state.rafId !== null) return;
      if (REDUCED && !state.dragging && !state.resetting &&
          Math.abs(state.velY) < 0.0004 && Math.abs(state.velElev) < 0.0004) {
        render();
        return;
      }
      state.rafId = requestAnimationFrame(frame);
    }

    function clampElev(v) {
      var lo = DEFAULT_ELEV - TILT_LIMIT;
      var hi = DEFAULT_ELEV + TILT_LIMIT;
      return Math.max(lo, Math.min(hi, v));
    }

    function bindPointer(canvas) {
      var lastX = 0, lastY = 0, moved = 0;
      canvas.addEventListener("pointerdown", function (e) {
        state.dragging = true;
        state.resetting = false;
        state.velY = 0;
        state.velElev = 0;
        state.lastInteract = performance.now();
        lastX = e.clientX;
        lastY = e.clientY;
        moved = 0;
        try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* older browsers */ }
        canvas.classList.add("viewer-dragging");
        ensureLoop();
        e.preventDefault();
      });
      canvas.addEventListener("pointermove", function (e) {
        if (!state.dragging) return;
        var dx = e.clientX - lastX;
        var dy = e.clientY - lastY;
        lastX = e.clientX;
        lastY = e.clientY;
        moved += Math.abs(dx) + Math.abs(dy);
        state.rotY += dx * 0.008;
        state.elev = clampElev(state.elev - dy * 0.004);
        state.velY = state.velY * 0.7 + dx * 0.008 * 0.3;
        state.velElev = state.velElev * 0.7 + (-dy * 0.004) * 0.3;
        state.lastInteract = performance.now();
        if (moved > 5 && state.hint) state.hint.classList.add("gone");
        if (REDUCED) render();
      });
      function endDrag(e) {
        if (!state.dragging) return;
        state.dragging = false;
        state.lastInteract = performance.now();
        canvas.classList.remove("viewer-dragging");
        ensureLoop();
      }
      canvas.addEventListener("pointerup", endDrag);
      canvas.addEventListener("pointercancel", endDrag);
      canvas.addEventListener("dblclick", function () { resetView(); });
    }

    function buildUI() {
      if (state.options.hint !== false) {
        var hint = document.createElement("span");
        hint.className = "viewer-hint";
        hint.textContent = "Drag to rotate";
        container.appendChild(hint);
        state.hint = hint;
      }
      if (state.options.resetButton !== false) {
        var btn = document.createElement("button");
        btn.className = "viewer-reset";
        btn.type = "button";
        btn.setAttribute("aria-label", "Reset view");
        btn.textContent = "↺";
        btn.addEventListener("click", function () { resetView(); });
        container.appendChild(btn);
        state.resetBtn = btn;
      }
    }

    function doInit(THREE, RoomEnvironment) {
      if (state.disposed) return;
      try {
        var transparent = state.options.transparent === true;
        var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: transparent });
        var isMobile = window.innerWidth < 768;
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2));
        renderer.setClearColor(0xF5F0E8, transparent ? 0 : 1);
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.05;
        renderer.domElement.className = "product-viewer-canvas";
        renderer.domElement.setAttribute("role", "img");
        renderer.domElement.setAttribute("aria-label",
          "Interactive 3D view of " + PRODUCTS[productKey].name + " — drag to rotate");
        container.appendChild(renderer.domElement);
        state.renderer = renderer;

        var scene = new THREE.Scene();
        state.scene = scene;

        var camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
        state.camera = camera;

        try {
          var pmrem = new THREE.PMREMGenerator(renderer);
          scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
          pmrem.dispose();
        } catch (envErr) { /* lights alone still carry the look */ }

        var maxAniso = renderer.capabilities.getMaxAnisotropy();
        var labelTex = makeLabelTexture(THREE, productKey, maxAniso);
        var mats = materials(THREE, labelTex);
        var built = BUILDERS[productKey](THREE, mats);
        var spin = new THREE.Group();
        spin.add(built.model);
        scene.add(spin);
        state.spin = spin;

        /* centre the product on the origin and fit the camera to it */
        var box = new THREE.Box3().setFromObject(built.model);
        var size = new THREE.Vector3();
        var center = new THREE.Vector3();
        box.getSize(size);
        box.getCenter(center);
        built.model.position.y -= center.y;
        var baseY = -size.y / 2;

        var shadow = new THREE.Mesh(
          new THREE.PlaneGeometry(size.x * 2.1 + 0.9, size.x * 2.1 + 0.9),
          new THREE.MeshBasicMaterial({
            map: makeShadowTexture(THREE), transparent: true, depthWrite: false
          })
        );
        shadow.rotation.x = -Math.PI / 2;
        shadow.position.y = baseY + 0.001;
        scene.add(shadow);

        var key = new THREE.DirectionalLight(0xFFF3E0, 2.2);
        key.position.set(4, 6, 5);
        scene.add(key);
        var rim = new THREE.DirectionalLight(0xFFD9A0, 1.3);
        rim.position.set(-5, -2, -4);
        scene.add(rim);
        scene.add(new THREE.HemisphereLight(0xFFF6E8, 0x7C8A6E, 0.65));

        state.rotY = DEFAULT_RY;
        state.elev = DEFAULT_ELEV;
        state.lastInteract = performance.now();

        function resize() {
          var w = container.clientWidth || 300;
          var h = container.clientHeight || 300;
          renderer.setSize(w, h, false);
          camera.aspect = w / h;
          var fitH = (size.y / 2) / Math.tan(THREE.MathUtils.degToRad(16));
          var fitW = (size.x / 2) / (Math.tan(THREE.MathUtils.degToRad(16)) * camera.aspect);
          state.dist = Math.max(fitH, fitW) * (state.options.fitMargin || 1.4);
          applyCamera();
          camera.updateProjectionMatrix();
          render();
        }
        state.resize = resize;
        resize();
        if (typeof ResizeObserver !== "undefined") {
          state.ro = new ResizeObserver(function () { resize(); });
          state.ro.observe(container);
        } else {
          state._onResize = resize;
          window.addEventListener("resize", state._onResize);
        }

        buildUI();
        bindPointer(renderer.domElement);
        container.setAttribute("data-webgl", "on");

        state.io = new IntersectionObserver(function (entries) {
          state.visible = entries[0].isIntersecting;
          if (state.visible) ensureLoop();
          else if (state.rafId !== null) {
            cancelAnimationFrame(state.rafId);
            state.rafId = null;
          }
        }, { threshold: 0.05 });
        state.io.observe(container);

        state.ready = true;
        /* first frame, then the ready hook (hero entrance) */
        render();
        if (typeof state.options.onReady === "function") state.options.onReady();
        if (REDUCED) {
          render();
        } else {
          ensureLoop();
        }
      } catch (err) {
        dispose();
        markOff();
      }
    }

    function start() {
      if (state.disposed) return;
      if (!webglAvailable()) { markOff(); return; }
      Promise.all([
        import("three"),
        import("three/addons/environments/RoomEnvironment.js")
      ]).then(function (mods) {
        doInit(mods[0], mods[1].RoomEnvironment);
      }).catch(function () {
        markOff();
      });
    }

    if (options.lazy && typeof IntersectionObserver !== "undefined") {
      state.lazyIo = new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting) {
          state.lazyIo.disconnect();
          state.lazyIo = null;
          start();
        }
      }, { rootMargin: "400px 0px" });
      state.lazyIo.observe(container);
      window.addEventListener("pagehide", dispose);
    } else {
      start();
      window.addEventListener("pagehide", dispose);
    }

    return {
      container: container,
      productKey: productKey,
      reset: resetView,
      dispose: dispose
    };
  }

  window.Aurelle3D = {
    initViewer: initViewer,
    products: Object.keys(PRODUCTS)
  };
})();
