/* ============================================================
   AURELLE hero 3D — the Lumière Renewal Serum bottle, draggable
   (Three.js 0.187.0, via the shared product-3d.js viewer module)
   - The hero 3D object is the actual serum bottle, drag-rotatable
     with slow auto-rotate; double-click resets to the 3/4 view.
   - DPR capped (2 desktop / 1.5 mobile), rendering pauses
     offscreen, still frame for reduced motion.
   - If WebGL is unavailable or the Three.js CDN fails, the stage
     hides and the hero serum photo carries the hero on its own.
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

  if (!window.Aurelle3D || typeof window.Aurelle3D.initViewer !== "function") {
    hideStage();
    return;
  }

  /* The stage is a small floating element: drag needs pointer events. */
  stage.style.pointerEvents = "auto";

  var viewer = window.Aurelle3D.initViewer(stage, "serum", {
    transparent: true,
    autoRotate: true,
    lazy: false,
    hint: true,
    resetButton: false, /* stage is small; double-click resets instead */
    fitMargin: 1.3,
    onReady: function () {
      /* 3D entrance: part of the one orchestrated hero moment */
      if (window.gsap && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        gsap.from(stage, { scale: 0.82, opacity: 0, duration: 0.8, ease: "power3.out", delay: 0.35 });
      }
    }
  });

  if (!viewer) hideStage();
})();
