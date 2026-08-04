/**
 * Gradient smoke that follows the mouse — a port of the volumetric
 * light-scattering FBM shader from the old iammaddog.ru site, recoloured to
 * the site palette and driven by pointer velocity instead of a static light.
 *
 * Desktop-only by design (mouse-driven), WebGPU first with a WebGL1 fallback
 * so it still runs on older desktop browsers. Renders at half resolution into
 * a CSS-upscaled canvas; smoke fades out ~2.5s after the pointer stops and
 * the rAF loop suspends entirely once invisible, so idle cost is zero.
 */
import { tryInitWebGPU, recreateCanvas, FULLSCREEN_VERT_WGSL } from './gpu';
import { log, logError } from './logger';

// ---------------------------------------------------------------- WGSL ----
const SMOKE_WGSL = /* wgsl */ `
struct U {
  resolution: vec2f,
  mouse: vec2f,
  time: f32,
  intensity: f32,
};
@group(0) @binding(0) var<uniform> u: U;

fn hash2(p: vec2f) -> vec2f {
  let q = vec2f(dot(p, vec2f(127.1, 311.7)), dot(p, vec2f(269.5, 183.3)));
  return -1.0 + 2.0 * fract(sin(q) * 43758.5453123);
}

// Gradient value noise (iq) — replaces the old site's 256px noise texture.
fn vnoise(p: vec2f) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let s = f * f * (3.0 - 2.0 * f);
  let a = dot(hash2(i + vec2f(0.0, 0.0)), f - vec2f(0.0, 0.0));
  let b = dot(hash2(i + vec2f(1.0, 0.0)), f - vec2f(1.0, 0.0));
  let c = dot(hash2(i + vec2f(0.0, 1.0)), f - vec2f(0.0, 1.0));
  let d = dot(hash2(i + vec2f(1.0, 1.0)), f - vec2f(1.0, 1.0));
  return mix(mix(a, b, s.x), mix(c, d, s.x), s.y);
}

fn fbm(p: vec2f, t: f32) -> f32 {
  var v = 0.0;
  var a = 0.5;
  var q = p;
  let rot = mat2x2f(0.8775, 0.4794, -0.4794, 0.8775); // rotate ~0.5rad per octave
  for (var i = 0; i < 3; i = i + 1) {
    v = v + a * vnoise(q + vec2f(t * 0.15, -t * 0.1));
    q = rot * q * 2.0 + vec2f(100.0);
    a = a * 0.45;
  }
  return v * 0.5 + 0.5;
}

@fragment
fn fs_main(@builtin(position) frag: vec4f) -> @location(0) vec4f {
  let res = u.resolution;
  // frag.xy and u.mouse are both y-down, so no flip is needed
  var uv = (frag.xy - 0.5 * res) / min(res.x, res.y);
  let m = (u.mouse - 0.5) * vec2f(res.x / min(res.x, res.y), 1.0) * 2.0;
  let mo = vec2f(m.x, m.y);

  let d = length(uv - mo);
  // domain-warped smoke plume around the pointer
  let n1 = fbm(uv * 3.0 + mo, u.time);
  let n2 = fbm(uv * 3.0 + vec2f(n1 * 1.5) - mo * 0.5, u.time * 1.3);
  let plume = smoothstep(0.85, 0.0, d) * (0.35 + 0.65 * n2);

  // palette: teal core -> magenta falloff, like the site accents
  let teal = vec3f(0.176, 0.886, 0.902);
  let magenta = vec3f(0.965, 0.004, 0.616);
  let col = mix(teal, magenta, clamp(d * 1.4 + n1 * 0.35, 0.0, 1.0));

  let a = plume * u.intensity * 0.55;
  return vec4f(col * a, a); // premultiplied
}
`;

// --------------------------------------------------------------- GLSL -----
const SMOKE_FRAG_GL = `
precision mediump float;
uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform float u_time;
uniform float u_intensity;

vec2 hash2(vec2 p) {
  vec2 q = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return -1.0 + 2.0 * fract(sin(q) * 43758.5453123);
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 s = f * f * (3.0 - 2.0 * f);
  float a = dot(hash2(i), f);
  float b = dot(hash2(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0));
  float c = dot(hash2(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0));
  float d = dot(hash2(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0));
  return mix(mix(a, b, s.x), mix(c, d, s.x), s.y);
}
float fbm(vec2 p, float t) {
  float v = 0.0;
  float a = 0.5;
  mat2 rot = mat2(0.8775, 0.4794, -0.4794, 0.8775);
  for (int i = 0; i < 3; i++) {
    v += a * vnoise(p + vec2(t * 0.15, -t * 0.1));
    p = rot * p * 2.0 + vec2(100.0);
    a *= 0.45;
  }
  return v * 0.5 + 0.5;
}
void main() {
  vec2 res = u_resolution;
  vec2 uv = (gl_FragCoord.xy - 0.5 * res) / min(res.x, res.y);
  vec2 m = (u_mouse - 0.5) * vec2(res.x / min(res.x, res.y), 1.0) * 2.0;
  float d = length(uv - m);
  float n1 = fbm(uv * 3.0 + m, u_time);
  float n2 = fbm(uv * 3.0 + vec2(n1 * 1.5) - m * 0.5, u_time * 1.3);
  float plume = smoothstep(0.85, 0.0, d) * (0.35 + 0.65 * n2);
  vec3 teal = vec3(0.176, 0.886, 0.902);
  vec3 magenta = vec3(0.965, 0.004, 0.616);
  vec3 col = mix(teal, magenta, clamp(d * 1.4 + n1 * 0.35, 0.0, 1.0));
  float a = plume * u_intensity * 0.55;
  gl_FragColor = vec4(col * a, a);
}
`;

const SMOKE_VERT_GL = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

// ------------------------------------------------------------- driver -----
const RES_SCALE = 0.5; // half-res render, CSS upscales — biggest perf lever

interface PointerState {
  x: number; y: number;        // smoothed, 0..1
  tx: number; ty: number;      // raw target
  intensity: number;           // 0..1, rises with movement, decays when idle
  lastMove: number;
}

function makePointerState(): PointerState {
  return { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5, intensity: 0, lastMove: 0 };
}

function stepPointer(p: PointerState, now: number): void {
  const dx = p.tx - p.x;
  const dy = p.ty - p.y;
  p.x += dx * 0.08;
  p.y += dy * 0.08;
  const idleFor = now - p.lastMove;
  if (idleFor < 100) {
    p.intensity = Math.min(1, p.intensity + 0.06);
  } else if (idleFor > 2500) {
    p.intensity = Math.max(0, p.intensity - 0.02);
  }
}

export function startSmoke(canvas: HTMLCanvasElement): () => void {
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  log('Smoke', 'init — fine pointer: %s, reduced motion: %s', fine, reduced);

  if (!fine) {
    log('Smoke', 'skipped: not a fine-pointer device (touch/mobile)');
    canvas.remove();
    return () => {};
  }
  if (reduced) {
    log('Smoke', 'skipped: prefers-reduced-motion enabled');
    canvas.remove();
    return () => {};
  }

  const p = makePointerState();
  let raf = 0;
  let running = false;   // rAF loop active
  let disposed = false;
  let stopRender: (() => void) | null = null;

  function resize(): void {
    canvas.width = Math.max(1, Math.floor(window.innerWidth * RES_SCALE));
    canvas.height = Math.max(1, Math.floor(window.innerHeight * RES_SCALE));
  }

  function onMove(e: MouseEvent): void {
    p.tx = e.clientX / window.innerWidth;
    p.ty = e.clientY / window.innerHeight;
    p.lastMove = performance.now();
    if (!running && !disposed) {
      running = true;
      raf = requestAnimationFrame(loop);
    }
  }

  let renderFrame: ((time: number) => void) | null = null;

  function loop(t: number): void {
    if (disposed) return;
    stepPointer(p, t);
    // Fully faded → suspend loop until the next mousemove (zero idle cost).
    if (p.intensity <= 0 && t - p.lastMove > 2500) {
      running = false;
      return;
    }
    renderFrame?.(t / 1000);
    raf = requestAnimationFrame(loop);
  }

  // ---- WebGPU path with WebGL1 fallback ----
  void (async () => {
    log('Smoke', 'attempting WebGPU init...');
    const gpuCtx = await tryInitWebGPU(canvas);
    if (disposed) return;
    if (gpuCtx) {
      log('Smoke', 'WebGPU path active (format: %s)', gpuCtx.format);
      const { device, context, format } = gpuCtx;
      const module = device.createShaderModule({ code: SMOKE_WGSL + FULLSCREEN_VERT_WGSL });
      const pipeline = device.createRenderPipeline({
        layout: 'auto',
        vertex: { module, entryPoint: 'vs_main' },
        fragment: {
          module,
          entryPoint: 'fs_main',
          targets: [
            {
              format,
              blend: {
                color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' },
                alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' },
              },
            },
          ],
        },
      });
      const ubo = device.createBuffer({ size: 32, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
      const bindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [{ binding: 0, resource: { buffer: ubo } }],
      });
      const uniforms = new Float32Array(8);

      renderFrame = (time) => {
        uniforms[0] = canvas.width;
        uniforms[1] = canvas.height;
        uniforms[2] = p.x;
        uniforms[3] = p.y;
        uniforms[4] = time;
        uniforms[5] = p.intensity;
        device.queue.writeBuffer(ubo, 0, uniforms);
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
        pass.setPipeline(pipeline);
        pass.setBindGroup(0, bindGroup);
        pass.draw(3);
        pass.end();
        device.queue.submit([enc.finish()]);
      };
      stopRender = () => {
        try { device.destroy(); } catch { /* already lost */ }
      };
      return;
    }

    // ---- WebGL1 fallback ----
    // getContext('webgpu') may have claimed the canvas even though init
    // failed afterwards; a cloned canvas accepts a webgl context again.
    log('Smoke', 'WebGPU unavailable, falling back to WebGL1...');
    canvas = recreateCanvas(canvas);
    resize();
    const gl = canvas.getContext('webgl', { alpha: true, antialias: false, premultipliedAlpha: true });
    if (!gl) {
      logError('Smoke', 'WebGL context creation failed');
      canvas.remove();
      return;
    }
    log('Smoke', 'WebGL1 path active');
    const compile = (type: number, src: string): WebGLShader | null => {
      const sh = gl.createShader(type);
      if (!sh) return null;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        const info = gl.getShaderInfoLog(sh);
        gl.deleteShader(sh);
        logError('Smoke', `${type === gl.VERTEX_SHADER ? 'vertex' : 'fragment'} shader compile failed: ${info}`);
        return null;
      }
      return sh;
    };
    const vs = compile(gl.VERTEX_SHADER, SMOKE_VERT_GL);
    const fs = compile(gl.FRAGMENT_SHADER, SMOKE_FRAG_GL);
    if (!vs || !fs) { canvas.remove(); return; }
    const prog = gl.createProgram();
    if (!prog) { canvas.remove(); return; }
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      const info = gl.getProgramInfoLog(prog);
      logError('Smoke', 'Program link failed: %s', info);
      canvas.remove();
      return;
    }
    log('Smoke', 'Shader program linked successfully');
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'a_pos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    const uRes = gl.getUniformLocation(prog, 'u_resolution');
    const uMouse = gl.getUniformLocation(prog, 'u_mouse');
    const uTime = gl.getUniformLocation(prog, 'u_time');
    const uIntensity = gl.getUniformLocation(prog, 'u_intensity');

    renderFrame = (time) => {
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform2f(uMouse, p.x, 1.0 - p.y);
      gl.uniform1f(uTime, time);
      gl.uniform1f(uIntensity, p.intensity);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    stopRender = () => gl.getExtension('WEBGL_lose_context')?.loseContext();
  })();

  function onVisibility(): void {
    if (document.hidden) {
      running = false;
      cancelAnimationFrame(raf);
    }
    // resumes automatically on next mousemove
  }

  resize();
  window.addEventListener('resize', resize);
  document.addEventListener('mousemove', onMove, { passive: true });
  document.addEventListener('visibilitychange', onVisibility);

  return () => {
    disposed = true;
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', resize);
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('visibilitychange', onVisibility);
    stopRender?.();
  };
}
