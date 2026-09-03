// Smooth speed interpolation on tape hover
(function () {
  var tape  = document.querySelector('.tape');
  var track = document.querySelector('.tape-track');
  if (!tape || !track) return;

  var FAST = 20;  // seconds — default speed
  var SLOW = 55;  // seconds — hover speed (sangat lambat)
  var LERP = 0.04; // interpolation factor (makin kecil = makin smooth transisinya)

  var current = FAST;
  var target  = FAST;

  tape.addEventListener('mouseenter', function () { target = SLOW; });
  tape.addEventListener('mouseleave', function () { target = FAST; });

  function tick() {
    // Lerp current towards target
    current += (target - current) * LERP;
    // Apply — clamp to avoid float drift
    if (Math.abs(current - target) < 0.05) current = target;
    track.style.animationDuration = current.toFixed(2) + 's';
    requestAnimationFrame(tick);
  }

  tick();
})();
