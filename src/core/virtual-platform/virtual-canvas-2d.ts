/**
 * Virtual Canvas 2D Context
 * Provides virtualized 2D rendering context with recording/replay capabilities
 */

import { getLogger } from '../../utils/instrumentation/logger.js';
import { getMetrics } from '../../utils/instrumentation/metrics.js';
import type { VirtualCanvas2DContext, CanvasCommand } from './virtual-graphics.types.js';

const logger = getLogger('virtual-canvas-2d');
const metrics = getMetrics();

/**
 * Implementation of virtual Canvas 2D rendering context
 */
export class VirtualCanvas2DContextImpl implements VirtualCanvas2DContext {
  private commands: CanvasCommand[] = [];
  private currentTime: number = 0;
  private stateStack: CanvasState[] = [];
  private currentState: CanvasState;

  // Canvas reference
  canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement, private recordCommands: boolean = true) {
    this.canvas = canvas;
    this.currentState = this.createDefaultState();

    logger.debug('Virtual Canvas 2D context created', {
      width: canvas.width,
      height: canvas.height,
      recording: recordCommands,
    });

    metrics.counter('canvas.2d.created').inc();
  }

  /**
   * Create default canvas state
   */
  private createDefaultState(): CanvasState {
    return {
      fillStyle: '#000000',
      strokeStyle: '#000000',
      lineWidth: 1,
      lineCap: 'butt',
      lineJoin: 'miter',
      miterLimit: 10,
      lineDash: [],
      lineDashOffset: 0,
      font: '10px sans-serif',
      textAlign: 'start',
      textBaseline: 'alphabetic',
      direction: 'ltr',
      shadowBlur: 0,
      shadowColor: 'rgba(0, 0, 0, 0)',
      shadowOffsetX: 0,
      shadowOffsetY: 0,
      globalAlpha: 1.0,
      globalCompositeOperation: 'source-over',
      filter: 'none',
      imageSmoothingEnabled: true,
      imageSmoothingQuality: 'low',
      transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
    };
  }

  /**
   * Record a command
   */
  private record(method: string, args: any[]): void {
    if (this.recordCommands) {
      this.commands.push({
        timestamp: this.currentTime,
        method,
        args: JSON.parse(JSON.stringify(args)), // Deep clone
      });
      metrics.counter('canvas.2d.commands').inc();
    }
  }

  /**
   * Record a property change
   */
  private recordProperty(property: string, value: any): void {
    if (this.recordCommands) {
      this.commands.push({
        timestamp: this.currentTime,
        method: 'setProperty',
        args: [],
        property,
        value: JSON.parse(JSON.stringify(value)),
      });
    }
  }

  // Drawing rectangles
  fillRect(x: number, y: number, width: number, height: number): void {
    this.record('fillRect', [x, y, width, height]);
    metrics.counter('canvas.2d.fillRect').inc();
  }

  strokeRect(x: number, y: number, width: number, height: number): void {
    this.record('strokeRect', [x, y, width, height]);
    metrics.counter('canvas.2d.strokeRect').inc();
  }

  clearRect(x: number, y: number, width: number, height: number): void {
    this.record('clearRect', [x, y, width, height]);
    metrics.counter('canvas.2d.clearRect').inc();
  }

  // Drawing text
  fillText(text: string, x: number, y: number, maxWidth?: number): void {
    this.record('fillText', maxWidth !== undefined ? [text, x, y, maxWidth] : [text, x, y]);
    metrics.counter('canvas.2d.fillText').inc();
  }

  strokeText(text: string, x: number, y: number, maxWidth?: number): void {
    this.record('strokeText', maxWidth !== undefined ? [text, x, y, maxWidth] : [text, x, y]);
    metrics.counter('canvas.2d.strokeText').inc();
  }

  measureText(text: string): TextMetrics {
    // Return mock TextMetrics
    return {
      width: text.length * 8, // Rough approximation
      actualBoundingBoxLeft: 0,
      actualBoundingBoxRight: text.length * 8,
      actualBoundingBoxAscent: 10,
      actualBoundingBoxDescent: 2,
      fontBoundingBoxAscent: 10,
      fontBoundingBoxDescent: 2,
      alphabeticBaseline: 0,
      emHeightAscent: 10,
      emHeightDescent: 2,
      hangingBaseline: 8,
      ideographicBaseline: -2,
    } as TextMetrics;
  }

  // Line styles
  get lineWidth(): number {
    return this.currentState.lineWidth;
  }
  set lineWidth(value: number) {
    this.currentState.lineWidth = value;
    this.recordProperty('lineWidth', value);
  }

  get lineCap(): CanvasLineCap {
    return this.currentState.lineCap;
  }
  set lineCap(value: CanvasLineCap) {
    this.currentState.lineCap = value;
    this.recordProperty('lineCap', value);
  }

  get lineJoin(): CanvasLineJoin {
    return this.currentState.lineJoin;
  }
  set lineJoin(value: CanvasLineJoin) {
    this.currentState.lineJoin = value;
    this.recordProperty('lineJoin', value);
  }

  get miterLimit(): number {
    return this.currentState.miterLimit;
  }
  set miterLimit(value: number) {
    this.currentState.miterLimit = value;
    this.recordProperty('miterLimit', value);
  }

  setLineDash(segments: number[]): void {
    this.currentState.lineDash = [...segments];
    this.record('setLineDash', [segments]);
  }

  getLineDash(): number[] {
    return [...this.currentState.lineDash];
  }

  get lineDashOffset(): number {
    return this.currentState.lineDashOffset;
  }
  set lineDashOffset(value: number) {
    this.currentState.lineDashOffset = value;
    this.recordProperty('lineDashOffset', value);
  }

  // Text styles
  get font(): string {
    return this.currentState.font;
  }
  set font(value: string) {
    this.currentState.font = value;
    this.recordProperty('font', value);
  }

  get textAlign(): CanvasTextAlign {
    return this.currentState.textAlign;
  }
  set textAlign(value: CanvasTextAlign) {
    this.currentState.textAlign = value;
    this.recordProperty('textAlign', value);
  }

  get textBaseline(): CanvasTextBaseline {
    return this.currentState.textBaseline;
  }
  set textBaseline(value: CanvasTextBaseline) {
    this.currentState.textBaseline = value;
    this.recordProperty('textBaseline', value);
  }

  get direction(): CanvasDirection {
    return this.currentState.direction;
  }
  set direction(value: CanvasDirection) {
    this.currentState.direction = value;
    this.recordProperty('direction', value);
  }

  // Fill and stroke styles
  get fillStyle(): string | CanvasGradient | CanvasPattern {
    return this.currentState.fillStyle;
  }
  set fillStyle(value: string | CanvasGradient | CanvasPattern) {
    this.currentState.fillStyle = value;
    this.recordProperty('fillStyle', typeof value === 'string' ? value : '[object]');
  }

  get strokeStyle(): string | CanvasGradient | CanvasPattern {
    return this.currentState.strokeStyle;
  }
  set strokeStyle(value: string | CanvasGradient | CanvasPattern) {
    this.currentState.strokeStyle = value;
    this.recordProperty('strokeStyle', typeof value === 'string' ? value : '[object]');
  }

  // Gradients and patterns
  createLinearGradient(x0: number, y0: number, x1: number, y1: number): CanvasGradient {
    this.record('createLinearGradient', [x0, y0, x1, y1]);
    return {} as CanvasGradient; // Mock gradient
  }

  createRadialGradient(x0: number, y0: number, r0: number, x1: number, y1: number, r1: number): CanvasGradient {
    this.record('createRadialGradient', [x0, y0, r0, x1, y1, r1]);
    return {} as CanvasGradient;
  }

  createConicGradient(startAngle: number, x: number, y: number): CanvasGradient {
    this.record('createConicGradient', [startAngle, x, y]);
    return {} as CanvasGradient;
  }

  createPattern(image: CanvasImageSource, repetition: string | null): CanvasPattern | null {
    this.record('createPattern', ['[image]', repetition]);
    return {} as CanvasPattern;
  }

  // Shadows
  get shadowBlur(): number {
    return this.currentState.shadowBlur;
  }
  set shadowBlur(value: number) {
    this.currentState.shadowBlur = value;
    this.recordProperty('shadowBlur', value);
  }

  get shadowColor(): string {
    return this.currentState.shadowColor;
  }
  set shadowColor(value: string) {
    this.currentState.shadowColor = value;
    this.recordProperty('shadowColor', value);
  }

  get shadowOffsetX(): number {
    return this.currentState.shadowOffsetX;
  }
  set shadowOffsetX(value: number) {
    this.currentState.shadowOffsetX = value;
    this.recordProperty('shadowOffsetX', value);
  }

  get shadowOffsetY(): number {
    return this.currentState.shadowOffsetY;
  }
  set shadowOffsetY(value: number) {
    this.currentState.shadowOffsetY = value;
    this.recordProperty('shadowOffsetY', value);
  }

  // Paths
  beginPath(): void {
    this.record('beginPath', []);
  }

  closePath(): void {
    this.record('closePath', []);
  }

  moveTo(x: number, y: number): void {
    this.record('moveTo', [x, y]);
  }

  lineTo(x: number, y: number): void {
    this.record('lineTo', [x, y]);
  }

  bezierCurveTo(cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number): void {
    this.record('bezierCurveTo', [cp1x, cp1y, cp2x, cp2y, x, y]);
  }

  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void {
    this.record('quadraticCurveTo', [cpx, cpy, x, y]);
  }

  arc(x: number, y: number, radius: number, startAngle: number, endAngle: number, counterclockwise: boolean = false): void {
    this.record('arc', [x, y, radius, startAngle, endAngle, counterclockwise]);
  }

  arcTo(x1: number, y1: number, x2: number, y2: number, radius: number): void {
    this.record('arcTo', [x1, y1, x2, y2, radius]);
  }

  ellipse(x: number, y: number, radiusX: number, radiusY: number, rotation: number, startAngle: number, endAngle: number, counterclockwise: boolean = false): void {
    this.record('ellipse', [x, y, radiusX, radiusY, rotation, startAngle, endAngle, counterclockwise]);
  }

  rect(x: number, y: number, width: number, height: number): void {
    this.record('rect', [x, y, width, height]);
  }

  // Drawing paths
  fill(fillRule?: CanvasFillRule): void {
    this.record('fill', fillRule ? [fillRule] : []);
    metrics.counter('canvas.2d.fill').inc();
  }

  stroke(): void {
    this.record('stroke', []);
    metrics.counter('canvas.2d.stroke').inc();
  }

  clip(fillRule?: CanvasFillRule): void {
    this.record('clip', fillRule ? [fillRule] : []);
  }

  isPointInPath(x: number, y: number, fillRule?: CanvasFillRule): boolean {
    return false; // Mock implementation
  }

  isPointInStroke(x: number, y: number): boolean {
    return false;
  }

  // Transformations
  rotate(angle: number): void {
    this.record('rotate', [angle]);
  }

  scale(x: number, y: number): void {
    this.record('scale', [x, y]);
  }

  translate(x: number, y: number): void {
    this.record('translate', [x, y]);
  }

  transform(a: number, b: number, c: number, d: number, e: number, f: number): void {
    this.record('transform', [a, b, c, d, e, f]);
  }

  setTransform(a: number, b: number, c: number, d: number, e: number, f: number): void {
    this.currentState.transform = { a, b, c, d, e, f };
    this.record('setTransform', [a, b, c, d, e, f]);
  }

  resetTransform(): void {
    this.currentState.transform = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
    this.record('resetTransform', []);
  }

  getTransform(): DOMMatrix {
    const t = this.currentState.transform;
    return {
      a: t.a, b: t.b, c: t.c, d: t.d, e: t.e, f: t.f,
    } as DOMMatrix;
  }

  // Compositing
  get globalAlpha(): number {
    return this.currentState.globalAlpha;
  }
  set globalAlpha(value: number) {
    this.currentState.globalAlpha = value;
    this.recordProperty('globalAlpha', value);
  }

  get globalCompositeOperation(): GlobalCompositeOperation {
    return this.currentState.globalCompositeOperation;
  }
  set globalCompositeOperation(value: GlobalCompositeOperation) {
    this.currentState.globalCompositeOperation = value;
    this.recordProperty('globalCompositeOperation', value);
  }

  // Image drawing
  drawImage(image: CanvasImageSource, ...args: number[]): void {
    this.record('drawImage', ['[image]', ...args]);
    metrics.counter('canvas.2d.drawImage').inc();
  }

  // Pixel manipulation
  createImageData(sw: number | ImageData, sh?: number): ImageData {
    if (typeof sw === 'number') {
      return this.createMockImageData(sw, sh!);
    }
    return this.createMockImageData(sw.width, sw.height);
  }

  getImageData(sx: number, sy: number, sw: number, sh: number): ImageData {
    this.record('getImageData', [sx, sy, sw, sh]);
    return this.createMockImageData(sw, sh);
  }

  /**
   * Create ImageData (with fallback for environments without ImageData)
   */
  private createMockImageData(width: number, height: number): ImageData {
    // Try to use native ImageData if available
    if (typeof ImageData !== 'undefined') {
      return new ImageData(width, height);
    }

    // Fallback for environments without ImageData (e.g., jsdom)
    const data = new Uint8ClampedArray(width * height * 4);
    return {
      width,
      height,
      data,
      colorSpace: 'srgb',
    } as ImageData;
  }

  putImageData(imagedata: ImageData, dx: number, dy: number, ...args: number[]): void {
    this.record('putImageData', ['[imagedata]', dx, dy, ...args]);
  }

  // State
  save(): void {
    this.stateStack.push({ ...this.currentState });
    this.record('save', []);
  }

  restore(): void {
    if (this.stateStack.length > 0) {
      this.currentState = this.stateStack.pop()!;
      this.record('restore', []);
    }
  }

  // Filter
  get filter(): string {
    return this.currentState.filter;
  }
  set filter(value: string) {
    this.currentState.filter = value;
    this.recordProperty('filter', value);
  }

  // Image smoothing
  get imageSmoothingEnabled(): boolean {
    return this.currentState.imageSmoothingEnabled;
  }
  set imageSmoothingEnabled(value: boolean) {
    this.currentState.imageSmoothingEnabled = value;
    this.recordProperty('imageSmoothingEnabled', value);
  }

  get imageSmoothingQuality(): ImageSmoothingQuality {
    return this.currentState.imageSmoothingQuality;
  }
  set imageSmoothingQuality(value: ImageSmoothingQuality) {
    this.currentState.imageSmoothingQuality = value;
    this.recordProperty('imageSmoothingQuality', value);
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

      if (cmd.method === 'setProperty' && cmd.property) {
        (this as any)[cmd.property] = cmd.value;
      } else {
        const method = (this as any)[cmd.method];
        if (typeof method === 'function') {
          method.apply(this, cmd.args);
        }
      }
    }

    metrics.counter('canvas.2d.replay').inc();
  }
}

/**
 * Internal canvas state
 */
interface CanvasState {
  fillStyle: string | CanvasGradient | CanvasPattern;
  strokeStyle: string | CanvasGradient | CanvasPattern;
  lineWidth: number;
  lineCap: CanvasLineCap;
  lineJoin: CanvasLineJoin;
  miterLimit: number;
  lineDash: number[];
  lineDashOffset: number;
  font: string;
  textAlign: CanvasTextAlign;
  textBaseline: CanvasTextBaseline;
  direction: CanvasDirection;
  shadowBlur: number;
  shadowColor: string;
  shadowOffsetX: number;
  shadowOffsetY: number;
  globalAlpha: number;
  globalCompositeOperation: GlobalCompositeOperation;
  filter: string;
  imageSmoothingEnabled: boolean;
  imageSmoothingQuality: ImageSmoothingQuality;
  transform: { a: number; b: number; c: number; d: number; e: number; f: number };
}

/**
 * Create a virtual Canvas 2D context
 */
export function createVirtualCanvas2D(
  canvas: HTMLCanvasElement,
  recordCommands: boolean = true
): VirtualCanvas2DContext {
  return new VirtualCanvas2DContextImpl(canvas, recordCommands);
}
