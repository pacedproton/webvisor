/**
 * Graphics Virtualization Tests
 * Tests for Canvas 2D and WebGL virtualization
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createVirtualCanvas2D } from '../../src/core/virtual-platform/virtual-canvas-2d.js';
import { createVirtualWebGL } from '../../src/core/virtual-platform/virtual-webgl.js';
import { createGraphicsTrapHandler } from '../../src/core/trap-layer/graphics-trap.js';

describe('Virtual Canvas 2D', () => {
  let canvas: HTMLCanvasElement;
  let ctx: ReturnType<typeof createVirtualCanvas2D>;

  beforeEach(() => {
    canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    ctx = createVirtualCanvas2D(canvas, true);
  });

  it('should create virtual 2D context', () => {
    expect(ctx).toBeDefined();
    expect(ctx.canvas).toBe(canvas);
  });

  it('should record fillRect commands', () => {
    ctx.fillRect(10, 20, 100, 50);

    const commands = ctx.getCommands();
    expect(commands.length).toBe(1);
    expect(commands[0]!.method).toBe('fillRect');
    expect(commands[0]!.args).toEqual([10, 20, 100, 50]);
  });

  it('should record strokeRect commands', () => {
    ctx.strokeRect(5, 10, 200, 100);

    const commands = ctx.getCommands();
    expect(commands.length).toBe(1);
    expect(commands[0]!.method).toBe('strokeRect');
    expect(commands[0]!.args).toEqual([5, 10, 200, 100]);
  });

  it('should record clearRect commands', () => {
    ctx.clearRect(0, 0, 640, 480);

    const commands = ctx.getCommands();
    expect(commands.length).toBe(1);
    expect(commands[0]!.method).toBe('clearRect');
  });

  it('should record fillText commands', () => {
    ctx.fillText('Hello World', 100, 200);

    const commands = ctx.getCommands();
    expect(commands.length).toBe(1);
    expect(commands[0]!.method).toBe('fillText');
    expect(commands[0]!.args[0]).toBe('Hello World');
  });

  it('should record strokeText commands', () => {
    ctx.strokeText('Test', 50, 75, 200);

    const commands = ctx.getCommands();
    expect(commands.length).toBe(1);
    expect(commands[0]!.method).toBe('strokeText');
    expect(commands[0]!.args).toEqual(['Test', 50, 75, 200]);
  });

  it('should measure text', () => {
    const metrics = ctx.measureText('Hello');
    expect(metrics.width).toBeGreaterThan(0);
  });

  it('should record path commands', () => {
    ctx.beginPath();
    ctx.moveTo(10, 10);
    ctx.lineTo(100, 100);
    ctx.arc(50, 50, 25, 0, Math.PI * 2);
    ctx.closePath();
    ctx.fill();

    const commands = ctx.getCommands();
    expect(commands.length).toBe(6);
    expect(commands.map(c => c.method)).toEqual([
      'beginPath',
      'moveTo',
      'lineTo',
      'arc',
      'closePath',
      'fill',
    ]);
  });

  it('should record transformation commands', () => {
    ctx.translate(50, 100);
    ctx.rotate(Math.PI / 4);
    ctx.scale(2, 2);

    const commands = ctx.getCommands();
    expect(commands.length).toBe(3);
    expect(commands.map(c => c.method)).toEqual(['translate', 'rotate', 'scale']);
  });

  it('should save and restore state', () => {
    ctx.fillStyle = '#ff0000';
    ctx.save();
    ctx.fillStyle = '#00ff00';
    ctx.restore();

    // State should be restored to red
    expect(ctx.fillStyle).toBe('#ff0000');
  });

  it('should track property changes', () => {
    ctx.fillStyle = '#0000ff';
    ctx.strokeStyle = '#ff00ff';
    ctx.lineWidth = 5;
    ctx.font = '20px Arial';

    expect(ctx.fillStyle).toBe('#0000ff');
    expect(ctx.strokeStyle).toBe('#ff00ff');
    expect(ctx.lineWidth).toBe(5);
    expect(ctx.font).toBe('20px Arial');
  });

  it('should create gradients', () => {
    const gradient = ctx.createLinearGradient(0, 0, 100, 100);
    expect(gradient).toBeDefined();

    const commands = ctx.getCommands();
    expect(commands.some(c => c.method === 'createLinearGradient')).toBe(true);
  });

  it('should create radial gradients', () => {
    const gradient = ctx.createRadialGradient(50, 50, 10, 50, 50, 50);
    expect(gradient).toBeDefined();

    const commands = ctx.getCommands();
    expect(commands.some(c => c.method === 'createRadialGradient')).toBe(true);
  });

  it('should set line dash', () => {
    ctx.setLineDash([5, 10]);
    const dash = ctx.getLineDash();
    expect(dash).toEqual([5, 10]);
  });

  it('should clear commands', () => {
    ctx.fillRect(0, 0, 10, 10);
    ctx.strokeRect(0, 0, 10, 10);

    expect(ctx.getCommands().length).toBe(2);

    ctx.clearCommands();

    expect(ctx.getCommands().length).toBe(0);
  });

  it('should replay commands', () => {
    ctx.fillRect(10, 10, 50, 50);
    ctx.strokeRect(20, 20, 30, 30);

    const commands = ctx.getCommands();
    ctx.clearCommands();

    ctx.replay(commands);

    // After replay, we should have the same commands again
    const newCommands = ctx.getCommands();
    expect(newCommands.length).toBe(commands.length);
  });

  it('should handle complex drawing sequence', () => {
    // Draw a house
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(50, 100, 100, 80);

    ctx.fillStyle = '#FF0000';
    ctx.beginPath();
    ctx.moveTo(50, 100);
    ctx.lineTo(100, 50);
    ctx.lineTo(150, 100);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#0000FF';
    ctx.fillRect(70, 120, 30, 40);

    const commands = ctx.getCommands();
    expect(commands.length).toBeGreaterThan(5);
  });

  it('should create ImageData', () => {
    const imageData = ctx.createImageData(100, 100);
    expect(imageData).toBeDefined();
    expect(imageData.width).toBe(100);
    expect(imageData.height).toBe(100);
  });

  it('should get and put ImageData', () => {
    const imageData = ctx.getImageData(0, 0, 50, 50);
    expect(imageData).toBeDefined();

    ctx.putImageData(imageData, 100, 100);

    const commands = ctx.getCommands();
    expect(commands.some(c => c.method === 'getImageData')).toBe(true);
    expect(commands.some(c => c.method === 'putImageData')).toBe(true);
  });
});

describe('Virtual WebGL', () => {
  let canvas: HTMLCanvasElement;
  let gl: ReturnType<typeof createVirtualWebGL>;

  beforeEach(() => {
    canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    gl = createVirtualWebGL(canvas, true);
  });

  it('should create virtual WebGL context', () => {
    expect(gl).toBeDefined();
    expect(gl.canvas).toBe(canvas);
    expect(gl.drawingBufferWidth).toBe(640);
    expect(gl.drawingBufferHeight).toBe(480);
  });

  it('should create and compile shader', () => {
    const shader = gl.createShader(0x8B31); // VERTEX_SHADER
    expect(shader).toBeDefined();

    gl.shaderSource(shader!, 'void main() {}');
    gl.compileShader(shader!);

    const compiled = gl.getShaderParameter(shader!, 0x8B81); // COMPILE_STATUS
    expect(compiled).toBe(true);

    const commands = gl.getCommands();
    expect(commands.some(c => c.method === 'createShader')).toBe(true);
    expect(commands.some(c => c.method === 'compileShader')).toBe(true);
  });

  it('should create and link program', () => {
    const program = gl.createProgram();
    expect(program).toBeDefined();

    const vertexShader = gl.createShader(0x8B31); // VERTEX_SHADER
    const fragmentShader = gl.createShader(0x8B30); // FRAGMENT_SHADER

    gl.attachShader(program!, vertexShader!);
    gl.attachShader(program!, fragmentShader!);
    gl.linkProgram(program!);

    const linked = gl.getProgramParameter(program!, 0x8B82); // LINK_STATUS
    expect(linked).toBe(true);
  });

  it('should use program', () => {
    const program = gl.createProgram();
    gl.useProgram(program);

    const commands = gl.getCommands();
    expect(commands.some(c => c.method === 'useProgram')).toBe(true);
  });

  it('should create and bind buffer', () => {
    const buffer = gl.createBuffer();
    expect(buffer).toBeDefined();

    gl.bindBuffer(0x8892, buffer); // ARRAY_BUFFER
    gl.bufferData(0x8892, 1024, 0x88E4); // STATIC_DRAW

    const commands = gl.getCommands();
    expect(commands.some(c => c.method === 'createBuffer')).toBe(true);
    expect(commands.some(c => c.method === 'bindBuffer')).toBe(true);
    expect(commands.some(c => c.method === 'bufferData')).toBe(true);
  });

  it('should create and bind texture', () => {
    const texture = gl.createTexture();
    expect(texture).toBeDefined();

    gl.bindTexture(0x0DE1, texture); // TEXTURE_2D

    const commands = gl.getCommands();
    expect(commands.some(c => c.method === 'createTexture')).toBe(true);
    expect(commands.some(c => c.method === 'bindTexture')).toBe(true);
  });

  it('should set clear color and clear', () => {
    gl.clearColor(1.0, 0.0, 0.0, 1.0);
    gl.clear(0x4000); // COLOR_BUFFER_BIT

    const commands = gl.getCommands();
    expect(commands.some(c => c.method === 'clearColor')).toBe(true);
    expect(commands.some(c => c.method === 'clear')).toBe(true);
  });

  it('should set viewport', () => {
    gl.viewport(0, 0, 640, 480);

    const commands = gl.getCommands();
    expect(commands.some(c => c.method === 'viewport')).toBe(true);
  });

  it('should draw arrays', () => {
    gl.drawArrays(0x0004, 0, 3); // TRIANGLES

    const commands = gl.getCommands();
    expect(commands.some(c => c.method === 'drawArrays')).toBe(true);
  });

  it('should draw elements', () => {
    gl.drawElements(0x0004, 6, 0x1403, 0); // TRIANGLES, UNSIGNED_SHORT

    const commands = gl.getCommands();
    expect(commands.some(c => c.method === 'drawElements')).toBe(true);
  });

  it('should get and set uniforms', () => {
    const program = gl.createProgram();
    const location = gl.getUniformLocation(program!, 'uColor');

    expect(location).toBeDefined();

    gl.uniform4f(location, 1.0, 0.0, 0.0, 1.0);

    const commands = gl.getCommands();
    expect(commands.some(c => c.method === 'uniform4f')).toBe(true);
  });

  it('should get attribute location', () => {
    const program = gl.createProgram();
    const location = gl.getAttribLocation(program!, 'aPosition');

    expect(location).toBeGreaterThanOrEqual(0);
  });

  it('should enable vertex attrib array', () => {
    gl.enableVertexAttribArray(0);

    const commands = gl.getCommands();
    expect(commands.some(c => c.method === 'enableVertexAttribArray')).toBe(true);
  });

  it('should set vertex attrib pointer', () => {
    gl.vertexAttribPointer(0, 3, 0x1406, false, 0, 0); // FLOAT

    const commands = gl.getCommands();
    expect(commands.some(c => c.method === 'vertexAttribPointer')).toBe(true);
  });

  it('should enable capabilities', () => {
    gl.enable(0x0B71); // DEPTH_TEST

    const commands = gl.getCommands();
    expect(commands.some(c => c.method === 'enable')).toBe(true);
  });

  it('should set blend function', () => {
    gl.blendFunc(0x0302, 0x0303); // SRC_ALPHA, ONE_MINUS_SRC_ALPHA

    const commands = gl.getCommands();
    expect(commands.some(c => c.method === 'blendFunc')).toBe(true);
  });

  it('should create framebuffer', () => {
    const fbo = gl.createFramebuffer();
    expect(fbo).toBeDefined();

    gl.bindFramebuffer(0x8D40, fbo); // FRAMEBUFFER

    const commands = gl.getCommands();
    expect(commands.some(c => c.method === 'createFramebuffer')).toBe(true);
  });

  it('should get parameters', () => {
    const vendor = gl.getParameter(0x1F00); // VENDOR
    expect(vendor).toBe('WebVisor');

    const renderer = gl.getParameter(0x1F01); // RENDERER
    expect(renderer).toBe('Virtual WebGL');
  });

  it('should track errors', () => {
    const error = gl.getError();
    expect(error).toBe(0); // GL_NO_ERROR
  });

  it('should clear commands', () => {
    gl.clear(0x4000);
    gl.drawArrays(0x0004, 0, 3);

    expect(gl.getCommands().length).toBe(2);

    gl.clearCommands();

    expect(gl.getCommands().length).toBe(0);
  });

  it('should replay commands', () => {
    gl.clearColor(1.0, 0.0, 0.0, 1.0);
    gl.clear(0x4000);

    const commands = gl.getCommands();
    gl.clearCommands();

    gl.replay(commands);

    const newCommands = gl.getCommands();
    expect(newCommands.length).toBe(commands.length);
  });

  it('should inspect shaders', () => {
    const shader1 = gl.createShader(0x8B31);
    const shader2 = gl.createShader(0x8B30);

    gl.shaderSource(shader1!, 'vertex shader source');
    gl.shaderSource(shader2!, 'fragment shader source');

    const shaders = gl.getShaders();
    expect(shaders.length).toBe(2);
  });

  it('should inspect programs', () => {
    const program = gl.createProgram();
    const programs = gl.getPrograms();

    expect(programs.length).toBe(1);
    expect(programs[0]!.id).toBe((program as any).id);
  });

  it('should inspect buffers', () => {
    const buffer = gl.createBuffer();
    const buffers = gl.getBuffers();

    expect(buffers.length).toBe(1);
  });

  it('should inspect textures', () => {
    const texture = gl.createTexture();
    const textures = gl.getTextures();

    expect(textures.length).toBe(1);
  });

  it('should handle complete render loop', () => {
    // Setup
    const program = gl.createProgram();
    const buffer = gl.createBuffer();

    gl.useProgram(program);
    gl.bindBuffer(0x8892, buffer);
    gl.bufferData(0x8892, 48, 0x88E4);

    // Render
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(0x4000);
    gl.viewport(0, 0, 640, 480);

    gl.drawArrays(0x0004, 0, 3);

    const commands = gl.getCommands();
    expect(commands.length).toBeGreaterThan(5);
  });
});

describe('Graphics Trap Handler', () => {
  let handler: ReturnType<typeof createGraphicsTrapHandler>;

  beforeEach(() => {
    handler = createGraphicsTrapHandler({
      recordCommands: true,
      interceptCanvas: true,
      interceptWebGL: true,
    });
    handler.init();
  });

  it('should create trap handler', () => {
    expect(handler).toBeDefined();
  });

  it('should intercept canvas 2D context', () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    expect(ctx).toBeDefined();

    // Context should be virtual
    expect((ctx as any).getCommands).toBeDefined();
  });

  it('should intercept WebGL context', () => {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl');

    expect(gl).toBeDefined();

    // Context should be virtual
    expect((gl as any).getCommands).toBeDefined();
  });

  it('should track all canvases', () => {
    const canvas1 = document.createElement('canvas');
    const canvas2 = document.createElement('canvas');

    canvas1.getContext('2d');
    canvas2.getContext('webgl');

    const canvases = handler.getAllCanvases();
    expect(canvases.length).toBe(2);
  });

  it('should get graphics state', () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d') as any;

    ctx.fillRect(0, 0, 100, 100);
    ctx.strokeRect(10, 10, 50, 50);

    const state = handler.getState();

    expect(state.totalDrawCalls).toBe(2);
    expect(state.totalCommands).toBe(2);
  });

  it('should clear all commands', () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d') as any;

    ctx.fillRect(0, 0, 100, 100);

    const stateBefore = handler.getState();
    expect(stateBefore.totalCommands).toBe(1);

    handler.clearAllCommands();

    const stateAfter = handler.getState();
    expect(stateAfter.totalCommands).toBe(0);
  });

  it('should get commands for specific canvas', () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d') as any;

    ctx.fillRect(0, 0, 100, 100);
    ctx.strokeRect(10, 10, 50, 50);

    const canvases = handler.getAllCanvases();
    const commands = handler.getCommands(canvases[0]!.id);

    expect(commands.length).toBe(2);
  });

  it('should replay commands on canvas', () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d') as any;

    ctx.fillRect(0, 0, 100, 100);

    const canvases = handler.getAllCanvases();
    const commands = handler.getCommands(canvases[0]!.id);

    ctx.clearCommands();
    expect(ctx.getCommands().length).toBe(0);

    handler.replayCommands(canvases[0]!.id, commands);

    expect(ctx.getCommands().length).toBe(1);
  });

  it('should handle multiple canvases with different contexts', () => {
    const canvas1 = document.createElement('canvas');
    const canvas2 = document.createElement('canvas');
    const canvas3 = document.createElement('canvas');

    const ctx2d1 = canvas1.getContext('2d') as any;
    const gl = canvas2.getContext('webgl') as any;
    const ctx2d2 = canvas3.getContext('2d') as any;

    ctx2d1.fillRect(0, 0, 10, 10);
    gl.clear(0x4000);
    ctx2d2.strokeRect(0, 0, 20, 20);

    const state = handler.getState();

    expect(state.canvases.size).toBe(3);
    expect(state.totalCommands).toBe(3);
  });

  it('should track draw calls correctly', () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d') as any;

    ctx.fillRect(0, 0, 100, 100);
    ctx.strokeRect(10, 10, 50, 50);
    ctx.fillText('Test', 50, 50);
    ctx.beginPath();
    ctx.arc(50, 50, 25, 0, Math.PI * 2);
    ctx.fill();

    const state = handler.getState();

    // fillRect, strokeRect, fillText, fill = 4 draw calls
    expect(state.totalDrawCalls).toBe(4);
  });

  it('should cleanup properly', () => {
    const canvas = document.createElement('canvas');
    canvas.getContext('2d');

    expect(handler.getAllCanvases().length).toBe(1);

    handler.cleanup();

    expect(handler.getAllCanvases().length).toBe(0);
  });

  it('should handle canHandle correctly', () => {
    expect(handler.canHandle('graphics.canvas')).toBe(true);
    expect(handler.canHandle('canvas.getContext')).toBe(true);
    expect(handler.canHandle('timing.setTimeout')).toBe(false);
  });
});
