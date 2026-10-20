// Draws the plane. Scene.state is the displayed state: main.js tweens those
// fields, this module only renders whatever they currently hold.
const Scene = (() => {
  const canvas = document.getElementById('plane');
  const ctx = canvas.getContext('2d');
  const ORIGIN = { x: 0, y: 0 };

  const state = {
    v1: { vec: { x: 0, y: 0 }, grow: 0 },
    v2: { vec: { x: 0, y: 0 }, grow: 0, offset: { x: 0, y: 0 }, ghost: 0 },
    v3: { vec: { x: 0, y: 0 }, grow: 0 },
    half: 10
  };

  let colors = {};
  let w = 1;
  let h = 1;
  let pending = false;

  function setColors() {
    const css = getComputedStyle(document.documentElement);
    const read = name => css.getPropertyValue(name).trim();
    colors = {
      bg: read('--bg'),
      grid: read('--grid'),
      gridMinor: read('--grid-minor'),
      axis: read('--axis'),
      muted: read('--muted'),
      v1: read('--v1'),
      v2: read('--v2'),
      v3: read('--v3'),
      glow: read('--glow') === '1'
    };
  }

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    w = Math.max(1, Math.round(rect.width));
    h = Math.max(1, Math.round(rect.height));
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }

  const scale = () => Math.min(w, h) / (2 * state.half);
  const sx = x => w / 2 + x * scale();
  const sy = y => h / 2 - y * scale();

  // Largest of 1, 2, 5 x 10^n that keeps roughly ten divisions in view.
  function niceStep(half) {
    const raw = (2 * half) / 10;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const n = raw / mag;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * mag;
  }

  const fmt = v => String(parseFloat(v.toFixed(4)));

  function counts(step) {
    const k = step * scale();
    return { nx: Math.ceil(w / 2 / k), ny: Math.ceil(h / 2 / k) };
  }

  function drawLines(step, color) {
    const { nx, ny } = counts(step);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = -nx; i <= nx; i++) {
      const x = Math.round(sx(i * step)) + 0.5;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
    }
    for (let j = -ny; j <= ny; j++) {
      const y = Math.round(sy(j * step)) + 0.5;
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
    }
    ctx.stroke();
  }

  function drawGrid(step) {
    // Subdivide into whole units: a step of 2 halves, 1 and 5 split into fifths.
    const lead = Math.round(step / Math.pow(10, Math.floor(Math.log10(step))));
    const minor = step / (lead === 2 ? 2 : 5);
    if (minor * scale() >= 14) drawLines(minor, colors.gridMinor);
    drawLines(step, colors.grid);
  }

  function drawAxes(step) {
    ctx.strokeStyle = colors.axis;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(0, Math.round(sy(0)) + 0.5);
    ctx.lineTo(w, Math.round(sy(0)) + 0.5);
    ctx.moveTo(Math.round(sx(0)) + 0.5, 0);
    ctx.lineTo(Math.round(sx(0)) + 0.5, h);
    ctx.stroke();

    const { nx, ny } = counts(step);
    ctx.fillStyle = colors.muted;
    ctx.font = '12px system-ui, sans-serif';

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let i = -nx; i <= nx; i++) {
      if (i !== 0) ctx.fillText(fmt(i * step), sx(i * step), sy(0) + 6);
    }

    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let j = -ny; j <= ny; j++) {
      if (j !== 0) ctx.fillText(fmt(j * step), sx(0) - 8, sy(j * step));
    }
  }

  function drawArrow(from, to, color, opt) {
    const o = Object.assign({ grow: 1, dashed: false, alpha: 1, width: 4 }, opt);
    if (o.grow <= 0.001 || o.alpha <= 0.01) return;

    const tip = Anim.lerpVec(from, to, o.grow);
    const x0 = sx(from.x);
    const y0 = sy(from.y);
    const dx = sx(tip.x) - x0;
    const dy = sy(tip.y) - y0;
    const len = Math.hypot(dx, dy);

    ctx.save();
    ctx.globalAlpha = o.alpha;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = o.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (colors.glow && !o.dashed) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 10;
    }

    if (len < 1.5) {
      // A zero vector has no direction, so there is no arrowhead to point.
      ctx.beginPath();
      ctx.arc(x0, y0, o.width, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }

    const head = Math.min(len * 0.32, 16 + o.width);
    const ux = dx / len;
    const uy = dy / len;
    const baseX = x0 + dx - ux * head;
    const baseY = y0 + dy - uy * head;
    const wing = head * 0.42;

    ctx.beginPath();
    if (o.dashed) ctx.setLineDash([7, 7]);
    ctx.moveTo(x0, y0);
    ctx.lineTo(x0 + dx - ux * head * 0.6, y0 + dy - uy * head * 0.6);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.beginPath();
    ctx.moveTo(x0 + dx, y0 + dy);
    ctx.lineTo(baseX - uy * wing, baseY + ux * wing);
    ctx.lineTo(baseX + uy * wing, baseY - ux * wing);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // A "v" plus a subscript, set by hand so no subscript glyph is needed.
  function drawLabel(sub, from, to, color, alpha) {
    if (alpha <= 0.05) return;

    const x0 = sx(from.x);
    const y0 = sy(from.y);
    const dx = sx(to.x) - x0;
    const dy = sy(to.y) - y0;
    const len = Math.hypot(dx, dy);
    if (len < 26) return;

    const off = 18;
    const mx = x0 + dx / 2 + (dy / len) * off;
    const my = y0 + dy / 2 - (dx / len) * off;
    const base = 'italic 21px Georgia, "Times New Roman", serif';
    const small = 'italic 13px Georgia, "Times New Roman", serif';

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.font = base;
    const vw = ctx.measureText('v').width;
    ctx.font = small;
    const sw = ctx.measureText(sub).width;

    const left = mx - (vw + sw + 1) / 2;
    ctx.font = base;
    ctx.fillText('v', left, my + 7);
    ctx.font = small;
    ctx.fillText(sub, left + vw + 1, my + 11);
    ctx.restore();
  }

  function draw() {
    pending = false;
    const step = niceStep(state.half);

    ctx.fillStyle = colors.bg || '#000';
    ctx.fillRect(0, 0, w, h);
    drawGrid(step);
    drawAxes(step);

    // v2 left behind at the origin while its copy slides to the tip of v1
    if (state.v2.ghost > 0.01) {
      drawArrow(ORIGIN, state.v2.vec, colors.v2, {
        grow: state.v2.grow, dashed: true, alpha: state.v2.ghost, width: 3
      });
    }

    drawArrow(ORIGIN, state.v1.vec, colors.v1, { grow: state.v1.grow });
    drawLabel('1', ORIGIN, Anim.lerpVec(ORIGIN, state.v1.vec, state.v1.grow),
      colors.v1, state.v1.grow);

    const tail = state.v2.offset;
    const head = { x: tail.x + state.v2.vec.x, y: tail.y + state.v2.vec.y };
    drawArrow(tail, head, colors.v2, { grow: state.v2.grow });
    drawLabel('2', tail, Anim.lerpVec(tail, head, state.v2.grow),
      colors.v2, state.v2.grow);

    drawArrow(ORIGIN, state.v3.vec, colors.v3, { grow: state.v3.grow, width: 5 });
    drawLabel('3', ORIGIN, Anim.lerpVec(ORIGIN, state.v3.vec, state.v3.grow),
      colors.v3, state.v3.grow);
  }

  function requestDraw() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(draw);
  }

  // Half-extent that keeps every given vector comfortably in view.
  function fitHalf(vectors) {
    let m = 0;
    for (const v of vectors) {
      if (v) m = Math.max(m, Math.abs(v.x), Math.abs(v.y));
    }
    return Math.max(10, m * 1.15);
  }

  function init() {
    setColors();
    new ResizeObserver(resize).observe(canvas);
    window.addEventListener('resize', resize);
    resize();
  }

  return { state, init, setColors, requestDraw, fitHalf };
})();
