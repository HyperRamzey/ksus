/**
 * Shared WebGPU bootstrap. Every effect calls tryInitWebGPU() first and falls
 * back to WebGL1/Canvas2D when it returns null — WebGPU is still absent or
 * broken in many Android WebViews and iOS WKWebViews (caniwebview.com, 2026-07),
 * so the fallback path is a first-class citizen, not an afterthought.
 */
import { log, logError } from './logger';

export interface GpuCtx {
  device: GPUDevice;
  context: GPUCanvasContext;
  format: GPUTextureFormat;
}

/** Fullscreen-triangle vertex stage shared by the smoke and entry shaders. */
export const FULLSCREEN_VERT_WGSL = /* wgsl */ `
@vertex
fn vs_main(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
  // Single triangle covering the screen: (-1,-1) (3,-1) (-1,3)
  var pos = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0));
  return vec4f(pos[i], 0.0, 1.0);
}
`;

export async function tryInitWebGPU(canvas: HTMLCanvasElement): Promise<GpuCtx | null> {
  try {
    if (!('gpu' in navigator)) {
      log('WebGPU', 'navigator.gpu not available');
      return null;
    }
    const gpu = navigator.gpu as GPU;
    log('WebGPU', 'requesting adapter...');
    const adapter = await gpu.requestAdapter({ powerPreference: 'low-power' });
    if (!adapter) {
      log('WebGPU', 'no adapter found');
      return null;
    }
    log('WebGPU', 'adapter found, requesting device...');
    const device = await adapter.requestDevice();
    const context = canvas.getContext('webgpu') as GPUCanvasContext | null;
    if (!context) {
      log('WebGPU', 'getContext("webgpu") failed');
      device.destroy();
      return null;
    }
    const format = gpu.getPreferredCanvasFormat();
    context.configure({ device, format, alphaMode: 'premultiplied' });
    log('WebGPU', 'context configured (format: %s)', format);
    // Losing the device (driver reset, backgrounding) must not throw uncaught.
    device.lost.then(() => {}).catch(() => {});
    return { device, format, context };
  } catch (e) {
    logError('WebGPU', 'exception during init', e);
    return null;
  }
}

/**
 * A canvas that ever held a 'webgpu' context refuses other context types, so
 * a fallback after failed pipeline validation needs a fresh element. Clones
 * the node (id/class/size come along) and swaps it in place.
 */
export function recreateCanvas(old: HTMLCanvasElement): HTMLCanvasElement {
  const fresh = old.cloneNode(false) as HTMLCanvasElement;
  old.replaceWith(fresh);
  return fresh;
}
