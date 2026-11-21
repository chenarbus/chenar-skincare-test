/* ============================================================
   AURELLE hero 3D — one faceted serum drop (Three.js 0.187.0)
   - IcosahedronGeometry + MeshPhysicalMaterial (clearcoat amber)
   - Key + rim lighting, RoomEnvironment for reflections
   - DPR capped (2 desktop / 1.5 mobile), pauses offscreen,
     disposes on pagehide, still frame for reduced motion.
   - Three.js is loaded with dynamic import: if the CDN is
     unreachable or WebGL is unavailable, the stage hides and
     the hero serum image carries the hero on its own.
   ============================================================ */

(function () {
  "use strict";

  var stage = document.getElementById("dropStage");
  if (!stage) return;

  function hideStage() {
    stage.setAttribute("data-webgl", "off");
  }

  /* WebGL support check */
  try {
    var testCanvas = document.createElement("canvas");
    var gl = testCanvas.getContext("webgl2") || testCanvas.getContext("webgl");
    if (!gl) { hideStage(); return; }
  } catch (e) { hideStage(); return; }

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  Promise.all([
    import("three"),
    import("three/addons/environments/RoomEnvironment.js")
  ]).then(function (mods) {
    var THREE = mods[0];
    var RoomEnvironment = mods[1].RoomEnvironment;
    init(THREE, RoomEnvironment);
  }).catch(function () {
    hideStage();
  });

  function init(THREE, RoomEnvironment) {
    var renderer, scene, camera, drop, clock, rafId = null, visible = true;
    var mouseX = 0, mouseY = 0;

    function dispose() {
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = null;
      if (scene) {
        scene.traverse(function (obj) {
          if (obj.geometry) obj.geometry.dispose();
          if (obj.material) {
            if (Array.isArray(obj.material)) obj.material.forEach(function (m) { m.dispose(); });
            else obj.material.dispose();
          }
        });
      }
      if (renderer) {
        renderer.dispose();
        if (renderer.domElement && renderer.domElement.parentNode) {
          renderer.domElement.parentNode.removeChild(renderer.domElement);
        }
      }
    }

    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      var isMobile = window.innerWidth < 768;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2));
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      stage.appendChild(renderer.domElement);

      scene = new THREE.Scene();

      camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
      camera.position.set(0, 0, 6);

      /* Environment for glassy reflections (best effort) */
      try {
        var pmrem = new THREE.PMREMGenerator(renderer);
        scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
        pmrem.dispose();
      } catch (envErr) { /* lights alone still carry the look */ }

      /* Faceted serum drop */
      var geometry = new THREE.IcosahedronGeometry(1.15, 0);
      var material = new THREE.MeshPhysicalMaterial({
        color: 0xC98A4B,
        roughness: 0.15,
        metalness: 0,
        clearcoat: 1,
        clearcoatRoughness: 0.12,
        transmission: 0.4,
        thickness: 1.6,
        ior: 1.42,
        attenuationColor: new THREE.Color(0xB96A3B),
        attenuationDistance: 2.5,
        flatShading: true,
        envMapIntensity: 1.1
      });
      drop = new THREE.Mesh(geometry, material);
      drop.scale.set(1, 1.35, 1); /* a drop, not a ball */
      drop.rotation.set(0.15, 0, 0);
      scene.add(drop);

      /* Lighting: warm key + cool rim + soft fill */
      var key = new THREE.DirectionalLight(0xFFF3E0, 2.4);
      key.position.set(4, 6, 5);
      scene.add(key);

      var rim = new THREE.DirectionalLight(0xFFD9A0, 1.4);
      rim.position.set(-5, -2, -4);
      scene.add(rim);

      scene.add(new THREE.HemisphereLight(0xFFF6E8, 0x7C8A6E, 0.7));

      clock = new THREE.Clock();

      function resize() {
        var w = stage.clientWidth || 200;
        var h = stage.clientHeight || 200;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      }
      resize();
      window.addEventListener("resize", resize);

      /* Pause when the hero is offscreen */
      var observer = new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        if (visible && !reduced && rafId === null) loop();
        if (!visible && rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
      }, { threshold: 0.05 });
      observer.observe(stage);

      /* Gentle pointer parallax (hover-capable pointers only) */
      if (!reduced && window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
        var hero = stage.closest(".hero") || document.body;
        hero.addEventListener("pointermove", function (e) {
          var r = hero.getBoundingClientRect();
          mouseX = ((e.clientX - r.left) / r.width - 0.5) * 2;
          mouseY = ((e.clientY - r.top) / r.height - 0.5) * 2;
        });
        hero.addEventListener("pointerleave", function () { mouseX = 0; mouseY = 0; });
      }

      function renderFrame() {
        var elapsed = clock.getElapsedTime();
        drop.rotation.y += 0.0035;
        drop.rotation.x += (0.15 + mouseY * 0.22 - drop.rotation.x) * 0.04;
        drop.rotation.z += (mouseX * 0.12 - drop.rotation.z) * 0.04;
        drop.position.y = Math.sin(elapsed * 0.8) * 0.12;
        renderer.render(scene, camera);
      }

      function loop() {
        if (!visible) { rafId = null; return; }
        rafId = requestAnimationFrame(loop);
        renderFrame();
      }

      if (reduced) {
        /* One still frame: the drop, lit and composed, no motion */
        renderFrame();
      } else {
        /* 3D entrance: part of the one orchestrated hero moment */
        if (window.gsap) {
          gsap.from(stage, { scale: 0.82, opacity: 0, duration: 0.8, ease: "power3.out", delay: 0.35 });
        }
        loop();
      }

      window.addEventListener("pagehide", function () {
        observer.disconnect();
        dispose();
      });
    } catch (err) {
      dispose();
      hideStage();
    }
  }
})();
