/**
 * Virtual Graphics Types
 * Types for Canvas 2D and WebGL virtualization
 */

/**
 * Canvas drawing command for recording/replay
 */
export interface CanvasCommand {
  timestamp: number;
  method: string;
  args: any[];
  property?: string;
  value?: any;
}

/**
 * Virtual Canvas 2D rendering context
 */
export interface VirtualCanvas2DContext {
  // Drawing rectangles
  fillRect(x: number, y: number, width: number, height: number): void;
  strokeRect(x: number, y: number, width: number, height: number): void;
  clearRect(x: number, y: number, width: number, height: number): void;

  // Drawing text
  fillText(text: string, x: number, y: number, maxWidth?: number): void;
  strokeText(text: string, x: number, y: number, maxWidth?: number): void;
  measureText(text: string): TextMetrics;

  // Line styles
  lineWidth: number;
  lineCap: CanvasLineCap;
  lineJoin: CanvasLineJoin;
  miterLimit: number;
  setLineDash(segments: number[]): void;
  getLineDash(): number[];
  lineDashOffset: number;

  // Text styles
  font: string;
  textAlign: CanvasTextAlign;
  textBaseline: CanvasTextBaseline;
  direction: CanvasDirection;

  // Fill and stroke styles
  fillStyle: string | CanvasGradient | CanvasPattern;
  strokeStyle: string | CanvasGradient | CanvasPattern;

  // Gradients and patterns
  createLinearGradient(x0: number, y0: number, x1: number, y1: number): CanvasGradient;
  createRadialGradient(x0: number, y0: number, r0: number, x1: number, y1: number, r1: number): CanvasGradient;
  createConicGradient(startAngle: number, x: number, y: number): CanvasGradient;
  createPattern(image: CanvasImageSource, repetition: string | null): CanvasPattern | null;

  // Shadows
  shadowBlur: number;
  shadowColor: string;
  shadowOffsetX: number;
  shadowOffsetY: number;

  // Paths
  beginPath(): void;
  closePath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  bezierCurveTo(cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number): void;
  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void;
  arc(x: number, y: number, radius: number, startAngle: number, endAngle: number, counterclockwise?: boolean): void;
  arcTo(x1: number, y1: number, x2: number, y2: number, radius: number): void;
  ellipse(x: number, y: number, radiusX: number, radiusY: number, rotation: number, startAngle: number, endAngle: number, counterclockwise?: boolean): void;
  rect(x: number, y: number, width: number, height: number): void;

  // Drawing paths
  fill(fillRule?: CanvasFillRule): void;
  stroke(): void;
  clip(fillRule?: CanvasFillRule): void;
  isPointInPath(x: number, y: number, fillRule?: CanvasFillRule): boolean;
  isPointInStroke(x: number, y: number): boolean;

  // Transformations
  rotate(angle: number): void;
  scale(x: number, y: number): void;
  translate(x: number, y: number): void;
  transform(a: number, b: number, c: number, d: number, e: number, f: number): void;
  setTransform(a: number, b: number, c: number, d: number, e: number, f: number): void;
  resetTransform(): void;
  getTransform(): DOMMatrix;

  // Compositing
  globalAlpha: number;
  globalCompositeOperation: GlobalCompositeOperation;

  // Image drawing
  drawImage(image: CanvasImageSource, dx: number, dy: number): void;
  drawImage(image: CanvasImageSource, dx: number, dy: number, dw: number, dh: number): void;
  drawImage(image: CanvasImageSource, sx: number, sy: number, sw: number, sh: number, dx: number, dy: number, dw: number, dh: number): void;

  // Pixel manipulation
  createImageData(sw: number, sh: number): ImageData;
  createImageData(imagedata: ImageData): ImageData;
  getImageData(sx: number, sy: number, sw: number, sh: number): ImageData;
  putImageData(imagedata: ImageData, dx: number, dy: number): void;
  putImageData(imagedata: ImageData, dx: number, dy: number, dirtyX: number, dirtyY: number, dirtyWidth: number, dirtyHeight: number): void;

  // State
  save(): void;
  restore(): void;

  // Canvas state
  canvas: HTMLCanvasElement;

  // Filter
  filter: string;

  // Image smoothing
  imageSmoothingEnabled: boolean;
  imageSmoothingQuality: ImageSmoothingQuality;

  // Recording
  getCommands(): CanvasCommand[];
  clearCommands(): void;
  replay(commands: CanvasCommand[]): void;
}

/**
 * WebGL shader information
 */
export interface ShaderInfo {
  id: number;
  type: number;
  source: string;
  compiled: boolean;
}

/**
 * WebGL program information
 */
export interface ProgramInfo {
  id: number;
  vertexShader: number;
  fragmentShader: number;
  linked: boolean;
  attributes: Map<string, number>;
  uniforms: Map<string, WebGLUniformLocation>;
}

/**
 * WebGL buffer information
 */
export interface BufferInfo {
  id: number;
  target: number;
  data: ArrayBuffer | null;
  size: number;
}

/**
 * WebGL texture information
 */
export interface TextureInfo {
  id: number;
  target: number;
  width: number;
  height: number;
  format: number;
  type: number;
}

/**
 * Virtual WebGL rendering context
 */
export interface VirtualWebGLContext {
  // Context attributes
  canvas: HTMLCanvasElement;
  drawingBufferWidth: number;
  drawingBufferHeight: number;

  // State management
  getParameter(pname: number): any;
  getError(): number;
  isContextLost(): boolean;

  // Shader operations
  createShader(type: number): WebGLShader | null;
  shaderSource(shader: WebGLShader, source: string): void;
  compileShader(shader: WebGLShader): void;
  getShaderParameter(shader: WebGLShader, pname: number): any;
  getShaderInfoLog(shader: WebGLShader): string | null;
  deleteShader(shader: WebGLShader): void;

  // Program operations
  createProgram(): WebGLProgram | null;
  attachShader(program: WebGLProgram, shader: WebGLShader): void;
  linkProgram(program: WebGLProgram): void;
  getProgramParameter(program: WebGLProgram, pname: number): any;
  getProgramInfoLog(program: WebGLProgram): string | null;
  useProgram(program: WebGLProgram | null): void;
  deleteProgram(program: WebGLProgram): void;

  // Attribute operations
  getAttribLocation(program: WebGLProgram, name: string): number;
  enableVertexAttribArray(index: number): void;
  disableVertexAttribArray(index: number): void;
  vertexAttribPointer(index: number, size: number, type: number, normalized: boolean, stride: number, offset: number): void;

  // Uniform operations
  getUniformLocation(program: WebGLProgram, name: string): WebGLUniformLocation | null;
  uniform1f(location: WebGLUniformLocation | null, x: number): void;
  uniform2f(location: WebGLUniformLocation | null, x: number, y: number): void;
  uniform3f(location: WebGLUniformLocation | null, x: number, y: number, z: number): void;
  uniform4f(location: WebGLUniformLocation | null, x: number, y: number, z: number, w: number): void;
  uniform1i(location: WebGLUniformLocation | null, x: number): void;
  uniformMatrix4fv(location: WebGLUniformLocation | null, transpose: boolean, value: Float32Array): void;

  // Buffer operations
  createBuffer(): WebGLBuffer | null;
  bindBuffer(target: number, buffer: WebGLBuffer | null): void;
  bufferData(target: number, size: number, usage: number): void;
  bufferData(target: number, data: ArrayBuffer | ArrayBufferView, usage: number): void;
  deleteBuffer(buffer: WebGLBuffer): void;

  // Texture operations
  createTexture(): WebGLTexture | null;
  bindTexture(target: number, texture: WebGLTexture | null): void;
  texImage2D(target: number, level: number, internalformat: number, width: number, height: number, border: number, format: number, type: number, pixels: ArrayBufferView | null): void;
  texImage2D(target: number, level: number, internalformat: number, format: number, type: number, source: TexImageSource): void;
  texParameteri(target: number, pname: number, param: number): void;
  deleteTexture(texture: WebGLTexture): void;

  // Framebuffer operations
  createFramebuffer(): WebGLFramebuffer | null;
  bindFramebuffer(target: number, framebuffer: WebGLFramebuffer | null): void;
  framebufferTexture2D(target: number, attachment: number, textarget: number, texture: WebGLTexture | null, level: number): void;
  deleteFramebuffer(framebuffer: WebGLFramebuffer): void;

  // Rendering
  clear(mask: number): void;
  clearColor(red: number, green: number, blue: number, alpha: number): void;
  clearDepth(depth: number): void;
  clearStencil(s: number): void;
  viewport(x: number, y: number, width: number, height: number): void;
  drawArrays(mode: number, first: number, count: number): void;
  drawElements(mode: number, count: number, type: number, offset: number): void;

  // Capabilities
  enable(cap: number): void;
  disable(cap: number): void;
  depthFunc(func: number): void;
  blendFunc(sfactor: number, dfactor: number): void;

  // Recording
  getCommands(): CanvasCommand[];
  clearCommands(): void;
  replay(commands: CanvasCommand[]): void;

  // Inspection
  getShaders(): ShaderInfo[];
  getPrograms(): ProgramInfo[];
  getBuffers(): BufferInfo[];
  getTextures(): TextureInfo[];
}

/**
 * Virtual canvas element
 */
export interface VirtualCanvasElement {
  width: number;
  height: number;
  getContext(contextId: '2d', options?: CanvasRenderingContext2DSettings): VirtualCanvas2DContext | null;
  getContext(contextId: 'webgl' | 'webgl2', options?: WebGLContextAttributes): VirtualWebGLContext | null;
  toDataURL(type?: string, quality?: any): string;
  toBlob(callback: BlobCallback, type?: string, quality?: any): void;
  captureStream(frameRate?: number): MediaStream;
}

/**
 * Graphics state for inspection
 */
export interface GraphicsState {
  canvases: Map<number, CanvasState>;
  totalDrawCalls: number;
  totalCommands: number;
}

/**
 * Individual canvas state
 */
export interface CanvasState {
  id: number;
  width: number;
  height: number;
  contextType: '2d' | 'webgl' | 'webgl2' | null;
  commands: CanvasCommand[];
  drawCalls: number;
}

/**
 * Graphics recording for replay
 */
export interface GraphicsRecording {
  canvasId: number;
  contextType: '2d' | 'webgl' | 'webgl2';
  commands: CanvasCommand[];
  metadata: {
    width: number;
    height: number;
    startTime: number;
    endTime: number;
    totalCommands: number;
  };
}
