// Tiny tween helper. `smooth` is Manim's default rate function.
const Anim = {
  smooth(t) {
    return t * t * (3 - 2 * t);
  },

  lerp(a, b, t) {
    return a + (b - a) * t;
  },

  lerpVec(a, b, t) {
    return { x: Anim.lerp(a.x, b.x, t), y: Anim.lerp(a.y, b.y, t) };
  },

  // Tokens let a new interaction abandon an animation that is still running.
  token() {
    return { cancelled: false };
  },

  tween(ms, onUpdate, token) {
    return new Promise(resolve => {
      const start = performance.now();
      const step = now => {
        if (token && token.cancelled) return resolve(false);
        const p = ms <= 0 ? 1 : Math.min(1, (now - start) / ms);
        onUpdate(Anim.smooth(p));
        if (p < 1) requestAnimationFrame(step);
        else resolve(true);
      };
      requestAnimationFrame(step);
    });
  },

  delay(ms, token) {
    return new Promise(resolve => {
      setTimeout(() => resolve(!(token && token.cancelled)), ms);
    });
  }
};
