/**
 * Graphics Trap Handler
 * Intercepts Canvas and WebGL API calls
 */

import { getLogger } from '../../utils/instrumentation/logger.js';
import { getMetrics } from '../../utils/instrumentation/metrics.js';
import { createVirtualCanvas2D } from '../virtual-platform/virtual-canvas-2d.js';
import { createVirtualWebGL } from '../virtual-platform/virtual-webgl.js';
import type { VirtualCanvas2DContext, VirtualWebGLContext, GraphicsState, CanvasState } from '../virtual-platform/virtual-graphics.types.js';

const logger = getLogger('graphics-trap');
const metrics = getMetrics();

/**
 * Graphics trap handler configuration
 */
export interface GraphicsTrapConfig {
  recordCommands?: boolean;
  interceptCanvas?: boolean;
  interceptWebGL?: boolean;
}

/**
 * Graphics trap handler
 * Intercepts canvas.getContext() calls and returns virtual contexts
 */
export class GraphicsTrapHandler {
  private config: GraphicsTrapConfig;
  private canvases = new Map<number, VirtualCanvas>();
  private nextCanvasId = 1;
  private originalGetContext?: typeof HTMLCanvasElement.prototype.getContext;

  constructor(config: GraphicsTrapConfig = {}) {
    this.config = {
      recordCommands: true,
      interceptCanvas: true,
      interceptWebGL: true,
      ...config,
    };

    logger.info('Graphics trap handler initialized', {
      config: this.config,
    });
  }

  /**
   * Initialize the trap handler
   */
  init(): void {
    // Save original getContext
    this.originalGetContext = HTMLCanvasElement.prototype.getContext;

    // Override getContext
    const self = this;

    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      contextId: string,
      options?: any
    ): RenderingContext | null {
      return self.trapGetContext(this, contextId, options);
    } as any;

    logger.info('Graphics traps installed');
    metrics.counter('graphics.trap.installed').inc();
  }

  /**
   * Trap canvas.getContext() calls
   */
  private trapGetContext(
    canvas: HTMLCanvasElement,
    contextId: string,
    options?: any
  ): RenderingContext | null {
    logger.debug('getContext trapped', {
      contextId,
      width: canvas.width,
      height: canvas.height,
    });

    metrics.counter('graphics.getContext').inc();

    // Get or create virtual canvas
    let vCanvas = this.getVirtualCanvas(canvas);
    if (!vCanvas) {
      vCanvas = this.createVirtualCanvas(canvas);
    }

    // Return appropriate context
    if (contextId === '2d' && this.config.interceptCanvas) {
      if (!vCanvas.context2d) {
        vCanvas.context2d = createVirtualCanvas2D(canvas, this.config.recordCommands);
        logger.debug('Virtual Canvas 2D context created', {
          canvasId: vCanvas.id,
        });
        metrics.counter('graphics.canvas2d.created').inc();
      }
      return vCanvas.context2d as any;
    }

    if ((contextId === 'webgl' || contextId === 'webgl2') && this.config.interceptWebGL) {
      if (!vCanvas.contextWebGL) {
        vCanvas.contextWebGL = createVirtualWebGL(canvas, this.config.recordCommands);
        logger.debug('Virtual WebGL context created', {
          canvasId: vCanvas.id,
          contextId,
        });
        metrics.counter('graphics.webgl.created').inc();
      }
      return vCanvas.contextWebGL as any;
    }

    // Fallback to original for unsupported contexts
    if (this.originalGetContext) {
      return this.originalGetContext.call(canvas, contextId as any, options);
    }

    return null;
  }

  /**
   * Get virtual canvas for HTMLCanvasElement
   */
  private getVirtualCanvas(canvas: HTMLCanvasElement): VirtualCanvas | undefined {
    for (const vCanvas of this.canvases.values()) {
      if (vCanvas.element === canvas) {
        return vCanvas;
      }
    }
    return undefined;
  }

  /**
   * Create virtual canvas wrapper
   */
  private createVirtualCanvas(canvas: HTMLCanvasElement): VirtualCanvas {
    const id = this.nextCanvasId++;
    const vCanvas: VirtualCanvas = {
      id,
      element: canvas,
      context2d: null,
      contextWebGL: null,
    };

    this.canvases.set(id, vCanvas);

    logger.debug('Virtual canvas created', {
      id,
      width: canvas.width,
      height: canvas.height,
    });

    metrics.counter('graphics.canvas.created').inc();

    return vCanvas;
  }

  /**
   * Get canvas by ID
   */
  getCanvas(id: number): VirtualCanvas | undefined {
    return this.canvases.get(id);
  }

  /**
   * Get all canvases
   */
  getAllCanvases(): VirtualCanvas[] {
    return Array.from(this.canvases.values());
  }

  /**
   * Get graphics state for inspection
   */
  getState(): GraphicsState {
    const canvasStates = new Map<number, CanvasState>();
    let totalDrawCalls = 0;
    let totalCommands = 0;

    for (const [id, vCanvas] of this.canvases) {
      let contextType: '2d' | 'webgl' | 'webgl2' | null = null;
      let commands: any[] = [];
      let drawCalls = 0;

      if (vCanvas.context2d) {
        contextType = '2d';
        commands = vCanvas.context2d.getCommands();
        drawCalls = commands.filter(c =>
          c.method === 'fill' ||
          c.method === 'stroke' ||
          c.method === 'fillRect' ||
          c.method === 'strokeRect' ||
          c.method === 'fillText' ||
          c.method === 'strokeText' ||
          c.method === 'drawImage'
        ).length;
      } else if (vCanvas.contextWebGL) {
        contextType = 'webgl';
        commands = vCanvas.contextWebGL.getCommands();
        drawCalls = commands.filter(c =>
          c.method === 'drawArrays' ||
          c.method === 'drawElements'
        ).length;
      }

      canvasStates.set(id, {
        id,
        width: vCanvas.element.width,
        height: vCanvas.element.height,
        contextType,
        commands,
        drawCalls,
      });

      totalDrawCalls += drawCalls;
      totalCommands += commands.length;
    }

    return {
      canvases: canvasStates,
      totalDrawCalls,
      totalCommands,
    };
  }

  /**
   * Clear all recorded commands
   */
  clearAllCommands(): void {
    for (const vCanvas of this.canvases.values()) {
      if (vCanvas.context2d) {
        vCanvas.context2d.clearCommands();
      }
      if (vCanvas.contextWebGL) {
        vCanvas.contextWebGL.clearCommands();
      }
    }

    logger.info('All commands cleared');
  }

  /**
   * Get commands for a specific canvas
   */
  getCommands(canvasId: number): any[] {
    const vCanvas = this.canvases.get(canvasId);
    if (!vCanvas) return [];

    if (vCanvas.context2d) {
      return vCanvas.context2d.getCommands();
    }
    if (vCanvas.contextWebGL) {
      return vCanvas.contextWebGL.getCommands();
    }

    return [];
  }

  /**
   * Replay commands on a canvas
   */
  replayCommands(canvasId: number, commands: any[]): void {
    const vCanvas = this.canvases.get(canvasId);
    if (!vCanvas) {
      throw new Error(`Canvas ${canvasId} not found`);
    }

    if (vCanvas.context2d) {
      vCanvas.context2d.replay(commands);
    } else if (vCanvas.contextWebGL) {
      vCanvas.contextWebGL.replay(commands);
    }

    logger.info('Commands replayed', {
      canvasId,
      count: commands.length,
    });
  }

  /**
   * Cleanup and restore original APIs
   */
  cleanup(): void {
    if (this.originalGetContext) {
      HTMLCanvasElement.prototype.getContext = this.originalGetContext;
    }

    this.canvases.clear();

    logger.info('Graphics traps removed');
  }

  /**
   * Check if handler can handle this API
   */
  canHandle(api: string): boolean {
    return api.startsWith('graphics.') || api === 'canvas.getContext';
  }

  /**
   * Intercept API call
   */
  intercept(target: unknown, thisArg: unknown, args: unknown[]): unknown {
    // Handle specific API calls
    if (target === HTMLCanvasElement.prototype.getContext) {
      return this.trapGetContext(thisArg as HTMLCanvasElement, args[0] as string, args[1]);
    }

    return undefined;
  }
}

/**
 * Virtual canvas wrapper
 */
interface VirtualCanvas {
  id: number;
  element: HTMLCanvasElement;
  context2d: VirtualCanvas2DContext | null;
  contextWebGL: VirtualWebGLContext | null;
}

/**
 * Create graphics trap handler
 */
export function createGraphicsTrapHandler(config?: GraphicsTrapConfig): GraphicsTrapHandler {
  return new GraphicsTrapHandler(config);
}
