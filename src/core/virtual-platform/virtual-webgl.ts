/**
 * Virtual WebGL Context
 * Provides virtualized WebGL rendering context with recording/replay capabilities
 */

import { getLogger } from '../../utils/instrumentation/logger.js';
import { getMetrics } from '../../utils/instrumentation/metrics.js';
import type {
  VirtualWebGLContext,
  CanvasCommand,
  ShaderInfo,
  ProgramInfo,
  BufferInfo,
  TextureInfo,
} from './virtual-graphics.types.js';

const logger = getLogger('virtual-webgl');
const metrics = getMetrics();

/**
 * Implementation of virtual WebGL rendering context
 */
export class VirtualWebGLContextImpl implements VirtualWebGLContext {
  private commands: CanvasCommand[] = [];
  private currentTime: number = 0;

  // WebGL object tracking
  private shaders = new Map<number, ShaderInfo>();
  private programs = new Map<number, ProgramInfo>();
  private buffers = new Map<number, BufferInfo>();
  private textures = new Map<number, TextureInfo>();
  private framebuffers = new Map<number, WebGLFramebuffer>();

  private nextShaderId = 1;
  private nextProgramId = 1;
  private nextBufferId = 1;
  private nextTextureId = 1;
  private nextFramebufferId = 1;

  private currentProgram: number | null = null;
  private lastError: number = 0; // GL_NO_ERROR

  canvas: HTMLCanvasElement;
  drawingBufferWidth: number;
  drawingBufferHeight: number;

  constructor(canvas: HTMLCanvasElement, private recordCommands: boolean = true) {
    this.canvas = canvas;
    this.drawingBufferWidth = canvas.width;
    this.drawingBufferHeight = canvas.height;

    logger.debug('Virtual WebGL context created', {
      width: canvas.width,
      height: canvas.height,
      recording: recordCommands,
    });

    metrics.counter('webgl.created').inc();
  }

  /**
   * Record a command
   */
  private record(method: string, args: any[]): void {
    if (this.recordCommands) {
      this.commands.push({
        timestamp: this.currentTime,
        method,
        args: this.serializeArgs(args),
      });
      metrics.counter('webgl.commands').inc();
    }
  }

  /**
   * Serialize arguments for recording
   */
  private serializeArgs(args: any[]): any[] {
    return args.map(arg => {
      if (arg === null || arg === undefined) return arg;
      if (typeof arg === 'number' || typeof arg === 'string' || typeof arg === 'boolean') return arg;
      if (arg instanceof Float32Array || arg instanceof Uint8Array || arg instanceof Uint16Array) {
        return `[${arg.constructor.name}]`;
      }
      return '[object]';
    });
  }

  // Context state
  getParameter(pname: number): any {
    switch (pname) {
      case 0x0D33: // MAX_TEXTURE_SIZE
        return 4096;
      case 0x1F00: // VENDOR
        return 'WebVisor';
      case 0x1F01: // RENDERER
        return 'Virtual WebGL';
      case 0x1F02: // VERSION
        return 'WebGL 1.0 (Virtual)';
      default:
        return null;
    }
  }

  getError(): number {
    const error = this.lastError;
    this.lastError = 0; // GL_NO_ERROR
    return error;
  }

  isContextLost(): boolean {
    return false;
  }

  // Shader operations
  createShader(type: number): WebGLShader | null {
    const id = this.nextShaderId++;
    const shader = { id } as WebGLShader;

    this.shaders.set(id, {
      id,
      type,
      source: '',
      compiled: false,
    });

    this.record('createShader', [type]);
    metrics.counter('webgl.createShader').inc();

    return shader;
  }

  shaderSource(shader: WebGLShader, source: string): void {
    const id = (shader as any).id;
    const info = this.shaders.get(id);
    if (info) {
      info.source = source;
    }

    this.record('shaderSource', [id, source]);
  }

  compileShader(shader: WebGLShader): void {
    const id = (shader as any).id;
    const info = this.shaders.get(id);
    if (info) {
      info.compiled = true;
    }

    this.record('compileShader', [id]);
    metrics.counter('webgl.compileShader').inc();
  }

  getShaderParameter(shader: WebGLShader, pname: number): any {
    const id = (shader as any).id;
    const info = this.shaders.get(id);

    if (pname === 0x8B81) { // COMPILE_STATUS
      return info?.compiled ?? false;
    }

    return null;
  }

  getShaderInfoLog(shader: WebGLShader): string | null {
    return ''; // No errors in virtual context
  }

  deleteShader(shader: WebGLShader): void {
    const id = (shader as any).id;
    this.shaders.delete(id);
    this.record('deleteShader', [id]);
  }

  // Program operations
  createProgram(): WebGLProgram | null {
    const id = this.nextProgramId++;
    const program = { id } as WebGLProgram;

    this.programs.set(id, {
      id,
      vertexShader: 0,
      fragmentShader: 0,
      linked: false,
      attributes: new Map(),
      uniforms: new Map(),
    });

    this.record('createProgram', []);
    metrics.counter('webgl.createProgram').inc();

    return program;
  }

  attachShader(program: WebGLProgram, shader: WebGLShader): void {
    const programId = (program as any).id;
    const shaderId = (shader as any).id;
    const programInfo = this.programs.get(programId);
    const shaderInfo = this.shaders.get(shaderId);

    if (programInfo && shaderInfo) {
      if (shaderInfo.type === 0x8B31) { // VERTEX_SHADER
        programInfo.vertexShader = shaderId;
      } else if (shaderInfo.type === 0x8B30) { // FRAGMENT_SHADER
        programInfo.fragmentShader = shaderId;
      }
    }

    this.record('attachShader', [programId, shaderId]);
  }

  linkProgram(program: WebGLProgram): void {
    const id = (program as any).id;
    const info = this.programs.get(id);
    if (info) {
      info.linked = true;
    }

    this.record('linkProgram', [id]);
    metrics.counter('webgl.linkProgram').inc();
  }

  getProgramParameter(program: WebGLProgram, pname: number): any {
    const id = (program as any).id;
    const info = this.programs.get(id);

    if (pname === 0x8B82) { // LINK_STATUS
      return info?.linked ?? false;
    }

    return null;
  }

  getProgramInfoLog(program: WebGLProgram): string | null {
    return '';
  }

  useProgram(program: WebGLProgram | null): void {
    this.currentProgram = program ? (program as any).id : null;
    this.record('useProgram', [this.currentProgram]);
  }

  deleteProgram(program: WebGLProgram): void {
    const id = (program as any).id;
    this.programs.delete(id);
    this.record('deleteProgram', [id]);
  }

  // Attribute operations
  getAttribLocation(program: WebGLProgram, name: string): number {
    const id = (program as any).id;
    const info = this.programs.get(id);

    if (info) {
      if (!info.attributes.has(name)) {
        info.attributes.set(name, info.attributes.size);
      }
      return info.attributes.get(name)!;
    }

    return -1;
  }

  enableVertexAttribArray(index: number): void {
    this.record('enableVertexAttribArray', [index]);
  }

  disableVertexAttribArray(index: number): void {
    this.record('disableVertexAttribArray', [index]);
  }

  vertexAttribPointer(index: number, size: number, type: number, normalized: boolean, stride: number, offset: number): void {
    this.record('vertexAttribPointer', [index, size, type, normalized, stride, offset]);
  }

  // Uniform operations
  getUniformLocation(program: WebGLProgram, name: string): WebGLUniformLocation | null {
    const id = (program as any).id;
    const info = this.programs.get(id);

    if (info) {
      if (!info.uniforms.has(name)) {
        const location = { name, program: id } as WebGLUniformLocation;
        info.uniforms.set(name, location);
      }
      return info.uniforms.get(name)!;
    }

    return null;
  }

  uniform1f(location: WebGLUniformLocation | null, x: number): void {
    this.record('uniform1f', [location ? (location as any).name : null, x]);
  }

  uniform2f(location: WebGLUniformLocation | null, x: number, y: number): void {
    this.record('uniform2f', [location ? (location as any).name : null, x, y]);
  }

  uniform3f(location: WebGLUniformLocation | null, x: number, y: number, z: number): void {
    this.record('uniform3f', [location ? (location as any).name : null, x, y, z]);
  }

  uniform4f(location: WebGLUniformLocation | null, x: number, y: number, z: number, w: number): void {
    this.record('uniform4f', [location ? (location as any).name : null, x, y, z, w]);
  }

  uniform1i(location: WebGLUniformLocation | null, x: number): void {
    this.record('uniform1i', [location ? (location as any).name : null, x]);
  }

  uniformMatrix4fv(location: WebGLUniformLocation | null, transpose: boolean, value: Float32Array): void {
    this.record('uniformMatrix4fv', [location ? (location as any).name : null, transpose, '[Float32Array]']);
  }

  // Buffer operations
  createBuffer(): WebGLBuffer | null {
    const id = this.nextBufferId++;
    const buffer = { id } as WebGLBuffer;

    this.buffers.set(id, {
      id,
      target: 0,
      data: null,
      size: 0,
    });

    this.record('createBuffer', []);
    metrics.counter('webgl.createBuffer').inc();

    return buffer;
  }

  bindBuffer(target: number, buffer: WebGLBuffer | null): void {
    const id = buffer ? (buffer as any).id : null;
    if (id !== null) {
      const info = this.buffers.get(id);
      if (info) {
        info.target = target;
      }
    }

    this.record('bindBuffer', [target, id]);
  }

  bufferData(target: number, sizeOrData: number | ArrayBuffer | ArrayBufferView, usage: number): void {
    const size = typeof sizeOrData === 'number' ? sizeOrData : (sizeOrData as any).byteLength;
    this.record('bufferData', [target, `[${size} bytes]`, usage]);
    metrics.counter('webgl.bufferData').inc();
  }

  deleteBuffer(buffer: WebGLBuffer): void {
    const id = (buffer as any).id;
    this.buffers.delete(id);
    this.record('deleteBuffer', [id]);
  }

  // Texture operations
  createTexture(): WebGLTexture | null {
    const id = this.nextTextureId++;
    const texture = { id } as WebGLTexture;

    this.textures.set(id, {
      id,
      target: 0,
      width: 0,
      height: 0,
      format: 0,
      type: 0,
    });

    this.record('createTexture', []);
    metrics.counter('webgl.createTexture').inc();

    return texture;
  }

  bindTexture(target: number, texture: WebGLTexture | null): void {
    const id = texture ? (texture as any).id : null;
    if (id !== null) {
      const info = this.textures.get(id);
      if (info) {
        info.target = target;
      }
    }

    this.record('bindTexture', [target, id]);
  }

  texImage2D(...args: any[]): void {
    this.record('texImage2D', args);
    metrics.counter('webgl.texImage2D').inc();
  }

  texParameteri(target: number, pname: number, param: number): void {
    this.record('texParameteri', [target, pname, param]);
  }

  deleteTexture(texture: WebGLTexture): void {
    const id = (texture as any).id;
    this.textures.delete(id);
    this.record('deleteTexture', [id]);
  }

  // Framebuffer operations
  createFramebuffer(): WebGLFramebuffer | null {
    const id = this.nextFramebufferId++;
    const framebuffer = { id } as WebGLFramebuffer;

    this.framebuffers.set(id, framebuffer);
    this.record('createFramebuffer', []);
    metrics.counter('webgl.createFramebuffer').inc();

    return framebuffer;
  }

  bindFramebuffer(target: number, framebuffer: WebGLFramebuffer | null): void {
    const id = framebuffer ? (framebuffer as any).id : null;
    this.record('bindFramebuffer', [target, id]);
  }

  framebufferTexture2D(target: number, attachment: number, textarget: number, texture: WebGLTexture | null, level: number): void {
    const texId = texture ? (texture as any).id : null;
    this.record('framebufferTexture2D', [target, attachment, textarget, texId, level]);
  }

  deleteFramebuffer(framebuffer: WebGLFramebuffer): void {
    const id = (framebuffer as any).id;
    this.framebuffers.delete(id);
    this.record('deleteFramebuffer', [id]);
  }

  // Rendering
  clear(mask: number): void {
    this.record('clear', [mask]);
    metrics.counter('webgl.clear').inc();
  }

  clearColor(red: number, green: number, blue: number, alpha: number): void {
    this.record('clearColor', [red, green, blue, alpha]);
  }

  clearDepth(depth: number): void {
    this.record('clearDepth', [depth]);
  }

  clearStencil(s: number): void {
    this.record('clearStencil', [s]);
  }

  viewport(x: number, y: number, width: number, height: number): void {
    this.record('viewport', [x, y, width, height]);
  }

  drawArrays(mode: number, first: number, count: number): void {
    this.record('drawArrays', [mode, first, count]);
    metrics.counter('webgl.drawArrays').inc();
    metrics.counter('webgl.drawCalls').inc();
  }

  drawElements(mode: number, count: number, type: number, offset: number): void {
    this.record('drawElements', [mode, count, type, offset]);
    metrics.counter('webgl.drawElements').inc();
    metrics.counter('webgl.drawCalls').inc();
  }

  // Capabilities
  enable(cap: number): void {
    this.record('enable', [cap]);
  }

  disable(cap: number): void {
    this.record('disable', [cap]);
  }

  depthFunc(func: number): void {
    this.record('depthFunc', [func]);
  }

  blendFunc(sfactor: number, dfactor: number): void {
    this.record('blendFunc', [sfactor, dfactor]);
  }

  // Recording
  getCommands(): CanvasCommand[] {
    return [...this.commands];
  }

  clearCommands(): void {
    this.commands = [];
    logger.debug('Commands cleared');
  }

  replay(commands: CanvasCommand[]): void {
    logger.info('Replaying commands', { count: commands.length });

    for (const cmd of commands) {
      this.currentTime = cmd.timestamp;

      const method = (this as any)[cmd.method];
      if (typeof method === 'function') {
        method.apply(this, cmd.args);
      }
    }

    metrics.counter('webgl.replay').inc();
  }

  // Inspection
  getShaders(): ShaderInfo[] {
    return Array.from(this.shaders.values());
  }

  getPrograms(): ProgramInfo[] {
    return Array.from(this.programs.values()).map(p => ({
      ...p,
      attributes: new Map(p.attributes),
      uniforms: new Map(p.uniforms),
    }));
  }

  getBuffers(): BufferInfo[] {
    return Array.from(this.buffers.values());
  }

  getTextures(): TextureInfo[] {
    return Array.from(this.textures.values());
  }
}

/**
 * Create a virtual WebGL context
 */
export function createVirtualWebGL(
  canvas: HTMLCanvasElement,
  recordCommands: boolean = true
): VirtualWebGLContext {
  return new VirtualWebGLContextImpl(canvas, recordCommands);
}
