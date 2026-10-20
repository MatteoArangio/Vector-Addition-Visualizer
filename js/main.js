(() => {
  const el = id => document.getElementById(id);
  const inputs = { v1x: el('v1x'), v1y: el('v1y'), v2x: el('v2x'), v2y: el('v2y') };
  const out = { x: el('v3x'), y: el('v3y') };
  const btn = {
    add: el('add'), replay: el('replay'), reset: el('reset'),
    theme: el('theme'), expand: el('expand')
  };
  const root = document.documentElement;
  const statusLine = el('status');
  const group3 = document.querySelector('.vgroup[data-v="3"]');

  const S = Scene.state;
  const model = { v1: null, v2: null, v3: null };
  const ORDER = ['v1x', 'v1y', 'v2x', 'v2y'];
  const LIMIT = 1e4;
  const DIM = 0.35;
  const NUMBER = /^-?(\d+(\.\d*)?|\.\d+)$/;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ms = n => (reduced ? Math.min(n, 120) : n);

  let token = Anim.token();
  let timer = null;
  let animating = false;

  const fmt = v => String(parseFloat(v.toFixed(4)));
  const zero = () => ({ x: 0, y: 0 });

  // Abandons whatever animation is running and hands back a fresh token.
  function cancel() {
    token.cancelled = true;
    token = Anim.token();
    return token;
  }

  function parse(raw) {
    const text = raw.trim().replace(',', '.');
    if (!NUMBER.test(text)) return null;
    const n = parseFloat(text);
    return Math.max(-LIMIT, Math.min(LIMIT, n));
  }

  function read(which) {
    const x = parse(inputs[which + 'x'].value);
    const y = parse(inputs[which + 'y'].value);
    return x === null || y === null ? null : { x, y };
  }

  function showSum(v, t) {
    const at = n => (t >= 1 ? fmt(n) : Math.abs(n) >= 100 ? n.toFixed(0) : n.toFixed(1));
    out.x.textContent = at(v.x * t);
    out.y.textContent = at(v.y * t);
  }

  function clearSum() {
    out.x.textContent = '';
    out.y.textContent = '';
  }

  function syncUI() {
    const hasV1 = !!model.v1;
    const hasV2 = !!model.v2;
    const hasV3 = !!model.v3;

    inputs.v2x.disabled = inputs.v2y.disabled = !hasV1;
    btn.add.hidden = !(hasV1 && hasV2) || hasV3;
    btn.replay.hidden = !hasV3 || animating;
    btn.reset.hidden = !(hasV1 || hasV2);
    group3.classList.toggle('filled', hasV3);

    statusLine.textContent =
      animating ? 'Carrying v\u2082 to the tip of v\u2081\u2026' :
      !hasV1 ? 'Enter the components of v\u2081 to begin.' :
      !hasV2 ? 'Now enter the components of v\u2082.' :
      !hasV3 ? 'Add the vectors to build the sum head to tail.' :
      'v\u2083 = (' + fmt(model.v3.x) + ', ' + fmt(model.v3.y) + ')';
  }

  // The usable extent depends on the canvas aspect, so a window resize can
  // change it. Snap rather than animate, unless a sequence is mid-flight.
  function refit() {
    if (animating) return;
    S.half = Scene.fitHalf([model.v1, model.v2, model.v3]);
  }

  // Expanded mode gives the plane the whole window; real full screen is asked
  // for too, and the layout still expands in-window if that request is denied.
  function setExpanded(on) {
    if (on) root.dataset.expanded = '';
    else delete root.dataset.expanded;
    btn.expand.setAttribute('aria-pressed', on ? 'true' : 'false');
    btn.expand.setAttribute('aria-label', on ? 'Leave full screen' : 'Expand to full screen');
    btn.expand.setAttribute('title', on ? 'Leave full screen' : 'Full screen');
  }

  function toggleExpanded() {
    const on = !('expanded' in root.dataset);
    if (on && root.requestFullscreen) {
      const req = root.requestFullscreen();
      if (req && req.catch) req.catch(() => {});
    } else if (!on && document.fullscreenElement && document.exitFullscreen) {
      const exit = document.exitFullscreen();
      if (exit && exit.catch) exit.catch(() => {});
    }
    setExpanded(on);
  }

  function applyTheme(mode) {
    root.dataset.theme = mode;
    try { localStorage.setItem('vav-theme', mode); } catch (e) { /* private mode */ }
    Scene.setColors();
    Scene.requestDraw();
  }

  function initTheme() {
    let saved = null;
    try { saved = localStorage.getItem('vav-theme'); } catch (e) { /* private mode */ }
    if (saved !== 'light' && saved !== 'dark') {
      saved = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }
    applyTheme(saved);
  }

  // A vector became (or changed to) a valid pair: grow it in, or morph it.
  async function enter(which, vec) {
    const tk = cancel();
    const first = !model[which];
    const from = { x: S[which].vec.x, y: S[which].vec.y };
    const grow0 = S[which].grow;
    const hadSum = !!model.v3;
    const sumGrow = S.v3.grow;
    const ghost = S.v2.ghost;
    const off = { x: S.v2.offset.x, y: S.v2.offset.y };
    const dim = { v1: S.v1.alpha, v2: S.v2.alpha };

    model[which] = vec;
    if (hadSum) {
      model.v3 = null;
      clearSum();
    }
    animating = false;
    syncUI();

    if (first) {
      S[which].vec = vec;
      S[which].grow = 0;
    }

    const h0 = S.half;
    const h1 = Scene.fitHalf([model.v1, model.v2]);

    await Anim.tween(ms(first ? 600 : 300), t => {
      S.half = Anim.lerp(h0, h1, t);
      S.v1.alpha = Anim.lerp(dim.v1, 1, t);
      S.v2.alpha = Anim.lerp(dim.v2, 1, t);
      if (first) {
        S[which].grow = t;
      } else {
        S[which].vec = Anim.lerpVec(from, vec, t);
        S[which].grow = Anim.lerp(grow0, 1, t);
      }
      if (hadSum) {
        S.v3.grow = sumGrow * (1 - t);
        S.v2.ghost = ghost * (1 - t);
        S.v2.offset = Anim.lerpVec(off, zero(), t);
      }
      Scene.requestDraw();
    }, tk);
  }

  // A vector stopped being valid: it and everything downstream fades out.
  async function invalidate(which) {
    const tk = cancel();
    const dropped = which === 'v1' ? ['v1', 'v2'] : ['v2'];

    if (which === 'v1') {
      inputs.v2x.value = '';
      inputs.v2y.value = '';
    }
    for (const k of dropped) model[k] = null;
    model.v3 = null;
    clearSum();
    animating = false;
    syncUI();

    const grow = { v1: S.v1.grow, v2: S.v2.grow, v3: S.v3.grow };
    const ghost = S.v2.ghost;
    const off = { x: S.v2.offset.x, y: S.v2.offset.y };
    const dim = { v1: S.v1.alpha, v2: S.v2.alpha };
    const h0 = S.half;
    const h1 = Scene.fitHalf([model.v1, model.v2]);

    await Anim.tween(ms(320), t => {
      S.half = Anim.lerp(h0, h1, t);
      S.v1.alpha = Anim.lerp(dim.v1, 1, t);
      S.v2.alpha = Anim.lerp(dim.v2, 1, t);
      for (const k of dropped) S[k].grow = grow[k] * (1 - t);
      S.v3.grow = grow.v3 * (1 - t);
      S.v2.ghost = ghost * (1 - t);
      S.v2.offset = Anim.lerpVec(off, zero(), t);
      Scene.requestDraw();
    }, tk);
  }

  function apply(which) {
    const vec = read(which);
    if (vec) {
      const cur = model[which];
      if (cur && cur.x === vec.x && cur.y === vec.y) return;
      enter(which, vec);
    } else if (model[which]) {
      invalidate(which);
    }
  }

  function onInput(which) {
    clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      apply(which);
    }, 180);
  }

  function flush(which) {
    if (!timer) return;
    clearTimeout(timer);
    timer = null;
    apply(which);
  }

  // Head to tail: v2 slides over to the tip of v1, then the sum grows.
  async function runAddition(tk) {
    const v1 = model.v1;
    const v2 = model.v2;
    const sum = { x: v1.x + v2.x, y: v1.y + v2.y };

    model.v3 = sum;
    S.v3.vec = sum;
    S.v3.grow = 0;
    S.v2.offset = zero();
    S.v2.ghost = 0;
    animating = true;
    clearSum();
    syncUI();

    const h0 = S.half;
    const h1 = Scene.fitHalf([v1, v2, sum]);
    if (Math.abs(h1 - h0) > 0.01) {
      await Anim.tween(ms(450), t => {
        S.half = Anim.lerp(h0, h1, t);
        Scene.requestDraw();
      }, tk);
      if (tk.cancelled) return;
    }

    await Anim.tween(ms(850), t => {
      S.v2.offset = { x: v1.x * t, y: v1.y * t };
      S.v2.ghost = 0.35 * Math.min(1, t * 4);
      Scene.requestDraw();
    }, tk);
    if (tk.cancelled) return;

    if (!await Anim.delay(ms(160), tk)) return;

    await Anim.tween(ms(750), t => {
      S.v3.grow = t;
      showSum(sum, t);
      Scene.requestDraw();
    }, tk);
    if (tk.cancelled) return;

    showSum(sum, 1);
    animating = false;
    syncUI();

    // Let the result settle, then pull the addends back so v3 carries the eye.
    if (!await Anim.delay(ms(500), tk)) return;
    const from = { v1: S.v1.alpha, v2: S.v2.alpha };
    await Anim.tween(ms(600), t => {
      S.v1.alpha = Anim.lerp(from.v1, DIM, t);
      S.v2.alpha = Anim.lerp(from.v2, DIM, t);
      Scene.requestDraw();
    }, tk);
  }

  async function replay() {
    const tk = cancel();
    const ghost = S.v2.ghost;
    const sumGrow = S.v3.grow;
    const off = { x: S.v2.offset.x, y: S.v2.offset.y };
    const dim = { v1: S.v1.alpha, v2: S.v2.alpha };

    animating = true;
    clearSum();
    syncUI();

    await Anim.tween(ms(260), t => {
      S.v1.alpha = Anim.lerp(dim.v1, 1, t);
      S.v2.alpha = Anim.lerp(dim.v2, 1, t);
      S.v2.offset = Anim.lerpVec(off, zero(), t);
      S.v2.ghost = ghost * (1 - t);
      S.v3.grow = sumGrow * (1 - t);
      Scene.requestDraw();
    }, tk);
    if (tk.cancelled) return;

    await runAddition(tk);
  }

  async function reset() {
    const tk = cancel();
    model.v1 = model.v2 = model.v3 = null;
    for (const id of ORDER) inputs[id].value = '';
    clearSum();
    animating = false;
    syncUI();

    const grow = { v1: S.v1.grow, v2: S.v2.grow, v3: S.v3.grow };
    const ghost = S.v2.ghost;
    const off = { x: S.v2.offset.x, y: S.v2.offset.y };
    const dim = { v1: S.v1.alpha, v2: S.v2.alpha };
    const h0 = S.half;

    await Anim.tween(ms(420), t => {
      S.v1.alpha = Anim.lerp(dim.v1, 1, t);
      S.v2.alpha = Anim.lerp(dim.v2, 1, t);
      S.v1.grow = grow.v1 * (1 - t);
      S.v2.grow = grow.v2 * (1 - t);
      S.v3.grow = grow.v3 * (1 - t);
      S.v2.ghost = ghost * (1 - t);
      S.v2.offset = Anim.lerpVec(off, zero(), t);
      S.half = Anim.lerp(h0, 10, t);
      Scene.requestDraw();
    }, tk);
    if (tk.cancelled) return;
    inputs.v1x.focus();
  }

  for (const id of ORDER) {
    const which = id.slice(0, 2);
    const field = inputs[id];

    field.addEventListener('input', () => {
      const clean = field.value.replace(/[^0-9.,-]/g, '');
      if (clean !== field.value) field.value = clean;
      onInput(which);
    });

    field.addEventListener('blur', () => flush(which));

    field.addEventListener('keydown', e => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      flush(which);
      const next = inputs[ORDER[ORDER.indexOf(id) + 1]];
      if (next && !next.disabled) next.focus();
      else if (!btn.add.hidden) btn.add.click();
    });
  }

  btn.add.addEventListener('click', () => {
    if (model.v1 && model.v2) runAddition(cancel());
  });

  btn.replay.addEventListener('click', () => {
    if (model.v1 && model.v2) replay();
  });

  btn.reset.addEventListener('click', reset);

  btn.theme.addEventListener('click', () => {
    applyTheme(root.dataset.theme === 'light' ? 'dark' : 'light');
  });

  btn.expand.addEventListener('click', toggleExpanded);

  // Esc leaves full screen without going through the button.
  document.addEventListener('fullscreenchange', () => {
    setExpanded(!!document.fullscreenElement);
  });

  Scene.init(refit);
  initTheme();
  syncUI();
})();
