/**
 * Starry night with living constellations.
 *
 * Stars wander gently around home anchors; any two stars closer than the link
 * radius draw a constellation line whose opacity follows proximity. Clicking
 * (or tapping) fires a shockwave: stars inside the blast get an outward
 * impulse, their links visibly snap, and spring forces pull everything home
 * again so the constellations reconnect on their own a few seconds later.
 *
 * Physics is CPU-side either way (≤120 bodies — trivial). Rendering goes
 * WebGPU (instanced quads for stars + line list, one small vertex upload per
 * frame) with a Canvas2D fallback that works in every Android WebView and
 * iOS WKWebView. Honour prefers-reduced-motion with a static render, cap
 * mobile at 30fps, and pause when the tab is hidden.
 */
import { tryInitWebGPU, recreateCanvas } from './gpu';
import { log, logError } from './logger';

interface Star {
  x: number; y: number;    // current position (px, canvas space)
  hx: number; hy: number;  // home anchor
  vx: number; vy: number;
  phase: number;           // twinkle phase
  speed: number;           // twinkle speed
  wander: number;          // wander phase offset
  size: number;
  hue: number;             // 0 white, 1 teal, 2 magenta
}

interface Shooting {
  x: number; y: number; vx: number; vy: number; life: number;
}

const LINK_RADIUS = 140;        // px @ dpr 1, scaled by dpr at runtime
const SPRING = 0.012;           // pull toward home
const DAMPING = 0.92;
const BLAST_RADIUS = 190;
const BLAST_FORCE = 14;
const BREAK_FLASH_MS = 350;     // snapped links flash briefly

const COLORS: [number, number, number][] = [
  [255, 255, 255],
  [45, 226, 230],
  [246, 1, 157],
];

export function startConstellation(canvas: HTMLCanvasElement): () => void {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarse = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
  // dpr 1 on mobile: a dpr-2 canvas on a 1080×2400 phone is a ~40 MB
  // framebuffer; at dpr 1 the stars/lines still look fine over a dark bg.
  const dpr = coarse ? 1 : Math.min(window.devicePixelRatio || 1, 2);
  const count = coarse ? 40 : 110;
  const frameBudget = coarse ? 33 : 16; // 30fps mobile, 60fps desktop
  const linkR = LINK_RADIUS * dpr;
  const linkR2 = linkR * linkR;

  log('Constellation', 'init — reduced: %s, coarse: %s, dpr: %s, stars: %d', reduced, coarse, dpr, count);

  let stars: Star[] = [];
  let shooting: Shooting | null = null;
  let nextShootAt = performance.now() + 6000 + Math.random() * 8000;
  let blastAt = 0;                     // timestamp of last shockwave (for flash)
  let blastX = 0, blastY = 0;
  let raf = 0;
  let running = true;
  let disposed = false;
  let last = 0;

  function seed(): void {
    stars = Array.from({ length: count }, () => {
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height;
      const roll = Math.random();
      return {
        x, y, hx: x, hy: y, vx: 0, vy: 0,
        phase: Math.random() * Math.PI * 2,
        speed: 0.4 + Math.random() * 0.9,
        wander: Math.random() * Math.PI * 2,
        size: (roll > 0.8 ? 2 : 1.4) * dpr,
        hue: roll > 0.85 ? 1 : roll > 0.72 ? 2 : 0,
      };
    });
  }

  function resize(): void {
    const w = Math.floor(window.innerWidth * dpr);
    const h = Math.floor(window.innerHeight * dpr);
    // Mobile browsers fire resize when the address bar slides in/out while
    // scrolling — width is unchanged and height shifts by <~120px. Reseeding
    // there makes every star visibly jump mid-scroll; skip it.
    if (canvas.width === w && Math.abs(canvas.height - h) < 120 * dpr && canvas.height > 0) {
      return;
    }
    canvas.width = w;
    canvas.height = h;
    seed();
  }

  function shockwave(cx: number, cy: number): void {
    const bx = cx * dpr;
    const by = cy * dpr;
    blastAt = performance.now();
    blastX = bx; blastY = by;
    const r = BLAST_RADIUS * dpr;
    for (const s of stars) {
      const dx = s.x - bx;
      const dy = s.y - by;
      const d = Math.hypot(dx, dy) || 1;
      if (d < r) {
        const f = (1 - d / r) * BLAST_FORCE * dpr;
        s.vx += (dx / d) * f;
        s.vy += (dy / d) * f;
      }
    }
  }

  function step(t: number): void {
    const time = t / 1000;
    for (const s of stars) {
      // slow orbital wander around home + spring + damping
      const wx = Math.cos(time * 0.12 + s.wander) * 0.06 * dpr;
      const wy = Math.sin(time * 0.09 + s.wander * 1.7) * 0.06 * dpr;
      s.vx += (s.hx - s.x) * SPRING + wx * 0.02;
      s.vy += (s.hy - s.y) * SPRING + wy * 0.02;
      s.vx *= DAMPING;
      s.vy *= DAMPING;
      s.x += s.vx + wx;
      s.y += s.vy + wy;
    }
    // occasional shooting star
    if (!shooting && t > nextShootAt) {
      const fromLeft = Math.random() > 0.5;
      shooting = {
        x: fromLeft ? -20 : canvas.width + 20,
        y: Math.random() * canvas.height * 0.5,
        vx: (fromLeft ? 1 : -1) * (14 + Math.random() * 8) * dpr,
        vy: (2.5 + Math.random() * 2) * dpr,
        life: 1,
      };
      nextShootAt = t + 4500 + Math.random() * 7000;
    }
    if (shooting) {
      shooting.x += shooting.vx;
      shooting.y += shooting.vy;
      shooting.life -= 0.012;
      if (shooting.life <= 0 || shooting.x < -60 || shooting.x > canvas.width + 60) shooting = null;
    }
  }

  // ------------------------------------------------------------------------
  // Render backends. Both consume the same star/link state each frame.
  // ------------------------------------------------------------------------
  type RenderFn = (t: number) => void;
  let render: RenderFn = () => {}; // replaced by initWebGPU or initCanvas2D
  let stopRender: (() => void) | null = null;

  /** Canvas2D backend — the universal fallback. */
  function initCanvas2D(): boolean {
    log('Constellation', 'attempting Canvas2D fallback...');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      logError('Constellation', 'Canvas2D getContext failed');
      return false;
    }
    log('Constellation', 'Canvas2D path active');
    // Pre-bucketed link styles: one stroke() per alpha bucket per frame
    // instead of one beginPath/stroke + rgba-string allocation per link.
    // Segment coords are binned into reusable arrays in a single O(n²) pass.
    const LINK_BUCKETS = 8;
    const linkStyles = Array.from({ length: LINK_BUCKETS }, (_, i) =>
      `rgba(45, 226, 230, ${(((i + 0.5) / LINK_BUCKETS) * 0.32).toFixed(3)})`);
    const maxPairs = (count * (count - 1)) / 2;
    const bucketSegs = Array.from({ length: LINK_BUCKETS }, () => new Float32Array(maxPairs * 4));
    const bucketLen = new Int32Array(LINK_BUCKETS);
    // Twinkle alpha buckets per hue for star fills (hue-major index).
    const TW_BUCKETS = 10;
    const starStyles = COLORS.map(([r, g, b]) =>
      Array.from({ length: TW_BUCKETS }, (_, i) =>
        `rgba(${r}, ${g}, ${b}, ${((i + 0.5) / TW_BUCKETS).toFixed(3)})`));
    render = (t) => {
      const time = t / 1000;
      const flash = Math.max(0, 1 - (t - blastAt) / BREAK_FLASH_MS);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // links — single pair pass bins segments, then one stroke per bucket
      bucketLen.fill(0);
      for (let i = 0; i < stars.length; i++) {
        const a = stars[i];
        for (let j = i + 1; j < stars.length; j++) {
          const b = stars[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 > linkR2) continue;
          const k = Math.min(LINK_BUCKETS - 1, Math.floor((1 - d2 / linkR2) * LINK_BUCKETS));
          const seg = bucketSegs[k];
          const o = bucketLen[k] * 4;
          seg[o] = a.x; seg[o + 1] = a.y; seg[o + 2] = b.x; seg[o + 3] = b.y;
          bucketLen[k]++;
        }
      }
      ctx.lineWidth = 1 * dpr;
      for (let k = 0; k < LINK_BUCKETS; k++) {
        const m = bucketLen[k];
        if (!m) continue;
        const seg = bucketSegs[k];
        ctx.strokeStyle = linkStyles[k];
        ctx.beginPath();
        for (let i = 0; i < m; i++) {
          const o = i * 4;
          ctx.moveTo(seg[o], seg[o + 1]);
          ctx.lineTo(seg[o + 2], seg[o + 3]);
        }
        ctx.stroke();
      }

      // blast flash ring
      if (flash > 0) {
        const age = (t - blastAt) / BREAK_FLASH_MS;
        ctx.strokeStyle = `rgba(246, 1, 157, ${(flash * 0.5).toFixed(3)})`;
        ctx.lineWidth = 2 * dpr;
        ctx.beginPath();
        ctx.arc(blastX, blastY, BLAST_RADIUS * dpr * age, 0, Math.PI * 2);
        ctx.stroke();
        ctx.lineWidth = 1 * dpr;
      }

      // stars — bucketed fillStyle, no per-star string allocation
      for (const s of stars) {
        const tw = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(s.phase + time * s.speed));
        const bucket = Math.min(TW_BUCKETS - 1, Math.floor(tw * TW_BUCKETS));
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size * (0.8 + tw * 0.4), 0, Math.PI * 2);
        ctx.fillStyle = starStyles[s.hue][bucket];
        ctx.fill();
      }

      // shooting star
      if (shooting) {
        const grad = ctx.createLinearGradient(
          shooting.x, shooting.y,
          shooting.x - shooting.vx * 6, shooting.y - shooting.vy * 6,
        );
        grad.addColorStop(0, `rgba(255, 255, 255, ${(shooting.life * 0.9).toFixed(3)})`);
        grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.6 * dpr;
        ctx.beginPath();
        ctx.moveTo(shooting.x, shooting.y);
        ctx.lineTo(shooting.x - shooting.vx * 6, shooting.y - shooting.vy * 6);
        ctx.stroke();
        ctx.lineWidth = 1 * dpr;
      }
    };
    return true;
  }

  /** WebGPU backend — lines + point-quads from one dynamic vertex buffer. */
  async function initWebGPU(): Promise<boolean> {
    log('Constellation', 'attempting WebGPU init...');
    const gpuCtx = await tryInitWebGPU(canvas);
    if (!gpuCtx || disposed) {
      log('Constellation', 'WebGPU init failed or disposed');
      return false;
    }
    log('Constellation', 'WebGPU path active (format: %s)', gpuCtx.format);
    const { device, context, format } = gpuCtx;

    const shader = device.createShaderModule({
      code: /* wgsl */ `
struct U { resolution: vec2f, _pad: vec2f };
@group(0) @binding(0) var<uniform> u: U;

struct VOut {
  @builtin(position) pos: vec4f,
  @location(0) color: vec4f,
  @location(1) local: vec2f,
  @location(2) shape: f32,
};

// vertex layout: x, y, r, g, b, a, localx, localy, shape
@vertex
fn vs_main(
  @location(0) pos: vec2f,
  @location(1) color: vec4f,
  @location(2) local: vec2f,
  @location(3) shape: f32,
) -> VOut {
  var o: VOut;
  let clip = vec2f(pos.x / u.resolution.x * 2.0 - 1.0, 1.0 - pos.y / u.resolution.y * 2.0);
  o.pos = vec4f(clip, 0.0, 1.0);
  o.color = color;
  o.local = local;
  o.shape = shape;
  return o;
}

@fragment
fn fs_main(in: VOut) -> @location(0) vec4f {
  var a = in.color.a;
  if (in.shape > 0.5) {
    // soft round point sprite
    let d = length(in.local);
    a = a * smoothstep(1.0, 0.55, d);
  }
  return vec4f(in.color.rgb * a, a);
}
`,
    });

    const FLOATS = 9;
    const maxLinks = (count * (count - 1)) / 2;
    const maxVerts = maxLinks * 2 + count * 6 + 8; // links + star quads + shooting star line
    const vbo = device.createBuffer({
      size: maxVerts * FLOATS * 4,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    const ubo = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });

    const vertexLayout: GPUVertexBufferLayout = {
      arrayStride: FLOATS * 4,
      attributes: [
        { shaderLocation: 0, offset: 0, format: 'float32x2' },
        { shaderLocation: 1, offset: 8, format: 'float32x4' },
        { shaderLocation: 2, offset: 24, format: 'float32x2' },
        { shaderLocation: 3, offset: 32, format: 'float32' },
      ],
    };
    const blend: GPUBlendState = {
      color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' },
      alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' },
    };
    const mkPipeline = (topology: GPUPrimitiveTopology): GPURenderPipeline =>
      device.createRenderPipeline({
        layout: 'auto',
        vertex: { module: shader, entryPoint: 'vs_main', buffers: [vertexLayout] },
        fragment: { module: shader, entryPoint: 'fs_main', targets: [{ format, blend }] },
        primitive: { topology },
      });
    const linePipe = mkPipeline('line-list');
    const triPipe = mkPipeline('triangle-list');
    const lineBind = device.createBindGroup({
      layout: linePipe.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: ubo } }],
    });
    const triBind = device.createBindGroup({
      layout: triPipe.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: ubo } }],
    });

    const verts = new Float32Array(maxVerts * FLOATS);
    const uniformArr = new Float32Array(4); // reused every frame
    let n = 0;
    const push = (
      x: number, y: number, r: number, g: number, b: number, a: number,
      lx: number, ly: number, shape: number,
    ): void => {
      const o = n * FLOATS;
      verts[o] = x; verts[o + 1] = y;
      verts[o + 2] = r; verts[o + 3] = g; verts[o + 4] = b; verts[o + 5] = a;
      verts[o + 6] = lx; verts[o + 7] = ly; verts[o + 8] = shape;
      n++;
    };

    render = (t) => {
      const time = t / 1000;
      const flash = Math.max(0, 1 - (t - blastAt) / BREAK_FLASH_MS);
      n = 0;

      // -- link lines --
      for (let i = 0; i < stars.length; i++) {
        const a = stars[i];
        for (let j = i + 1; j < stars.length; j++) {
          const b = stars[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 > linkR2) continue;
          const alpha = (1 - d2 / linkR2) * 0.32;
          push(a.x, a.y, 45 / 255, 226 / 255, 230 / 255, alpha, 0, 0, 0);
          push(b.x, b.y, 45 / 255, 226 / 255, 230 / 255, alpha, 0, 0, 0);
        }
      }
      // -- shooting star trail --
      if (shooting) {
        const al = shooting.life * 0.9;
        push(shooting.x, shooting.y, 1, 1, 1, al, 0, 0, 0);
        push(shooting.x - shooting.vx * 6, shooting.y - shooting.vy * 6, 1, 1, 1, 0, 0, 0, 0);
      }
      const lineVerts = n;

      // -- star quads (2 triangles each) --
      for (const s of stars) {
        const tw = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(s.phase + time * s.speed));
        const [cr, cg, cb] = COLORS[s.hue];
        const r = cr / 255, g = cg / 255, b = cb / 255;
        const hs = s.size * (0.8 + tw * 0.4) * 1.6; // half-size incl. soft edge
        const x0 = s.x - hs, x1 = s.x + hs, y0 = s.y - hs, y1 = s.y + hs;
        push(x0, y0, r, g, b, tw, -1, -1, 1);
        push(x1, y0, r, g, b, tw, 1, -1, 1);
        push(x1, y1, r, g, b, tw, 1, 1, 1);
        push(x0, y0, r, g, b, tw, -1, -1, 1);
        push(x1, y1, r, g, b, tw, 1, 1, 1);
        push(x0, y1, r, g, b, tw, -1, 1, 1);
      }
      // -- blast flash: reuse quad path as a magenta glow burst --
      if (flash > 0) {
        const age = (t - blastAt) / BREAK_FLASH_MS;
        const hs = BLAST_RADIUS * dpr * age;
        const al = flash * 0.28;
        const x0 = blastX - hs, x1 = blastX + hs, y0 = blastY - hs, y1 = blastY + hs;
        push(x0, y0, 246 / 255, 1 / 255, 157 / 255, al, -1, -1, 1);
        push(x1, y0, 246 / 255, 1 / 255, 157 / 255, al, 1, -1, 1);
        push(x1, y1, 246 / 255, 1 / 255, 157 / 255, al, 1, 1, 1);
        push(x0, y0, 246 / 255, 1 / 255, 157 / 255, al, -1, -1, 1);
        push(x1, y1, 246 / 255, 1 / 255, 157 / 255, al, 1, 1, 1);
        push(x0, y1, 246 / 255, 1 / 255, 157 / 255, al, -1, 1, 1);
      }
      const triVerts = n - lineVerts;

      device.queue.writeBuffer(vbo, 0, verts, 0, n * FLOATS);
      uniformArr[0] = canvas.width;
      uniformArr[1] = canvas.height;
      device.queue.writeBuffer(ubo, 0, uniformArr);

      const enc = device.createCommandEncoder();
      const pass = enc.beginRenderPass({
        colorAttachments: [
          {
            view: context.getCurrentTexture().createView(),
            clearValue: { r: 0, g: 0, b: 0, a: 0 },
            loadOp: 'clear',
            storeOp: 'store',
          },
        ],
      });
      pass.setVertexBuffer(0, vbo);
      if (lineVerts > 0) {
        pass.setPipeline(linePipe);
        pass.setBindGroup(0, lineBind);
        pass.draw(lineVerts);
      }
      if (triVerts > 0) {
        pass.setPipeline(triPipe);
        pass.setBindGroup(0, triBind);
        pass.draw(triVerts, 1, lineVerts);
      }
      pass.end();
      device.queue.submit([enc.finish()]);
    };
    stopRender = () => {
      try { device.destroy(); } catch { /* already lost */ }
    };
    return true;
  }

  // ------------------------------------------------------------------------
  function frame(t: number): void {
    if (!running || disposed) return;
    raf = requestAnimationFrame(frame);
    if (t - last < frameBudget) return;
    last = t;
    step(t);
    render?.(t);
  }

  function onPointer(e: PointerEvent): void {
    // ignore clicks on interactive elements — only ambient background taps
    const target = e.target as HTMLElement;
    if (target.closest('button, a, input, select, .modal-content, .script-card, nav')) return;
    shockwave(e.clientX, e.clientY);
  }

  function onVisibility(): void {
    if (document.hidden) {
      running = false;
      cancelAnimationFrame(raf);
    } else if (!running && !reduced && !disposed) {
      running = true;
      last = 0;
      raf = requestAnimationFrame(frame);
    }
  }

  resize();
  window.addEventListener('resize', resize);

  void (async () => {
    // Mobile: never touch WebGPU — adapter/device init allocates GPU memory
    // and often fails into the fallback anyway. Canvas2D directly.
    const ok = coarse ? false : await initWebGPU();
    if (disposed) return;
    if (!ok) {
      if (!coarse) {
        // A failed WebGPU attempt may have claimed the canvas context; swap in
        // a fresh element so getContext('2d') is allowed again.
        canvas = recreateCanvas(canvas);
        resize();
      }
      if (!initCanvas2D()) return;
    }
    if (reduced) {
      step(performance.now());
      render(performance.now());
      return;
    }
    document.addEventListener('pointerdown', onPointer, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);
    raf = requestAnimationFrame(frame);
  })();

  return () => {
    disposed = true;
    running = false;
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', resize);
    document.removeEventListener('pointerdown', onPointer);
    document.removeEventListener('visibilitychange', onVisibility);
    stopRender?.();
  };
}
