/**
 * Example: Graphics Virtualization (Canvas & WebGL)
 * Demonstrates virtualized Canvas 2D and WebGL with recording/replay
 */

import { createGraphicsTrapHandler } from '../../src/core/trap-layer/graphics-trap.js';

console.log('=== WebVisor Graphics Virtualization Example ===\n');

// Initialize graphics trap handler
const graphicsHandler = createGraphicsTrapHandler({
  recordCommands: true,
  interceptCanvas: true,
  interceptWebGL: true,
});

graphicsHandler.init();

console.log('✓ Graphics trap handler initialized\n');

// ============================================================================
// Example 1: Canvas 2D Recording and Replay
// ============================================================================

console.log('1. Canvas 2D Recording & Replay\n');

const canvas2d = document.createElement('canvas');
canvas2d.width = 640;
canvas2d.height = 480;

const ctx = canvas2d.getContext('2d') as any;

console.log('  Drawing a house...');

// Draw house base
ctx.fillStyle = '#8B4513';
ctx.fillRect(50, 100, 100, 80);

// Draw roof
ctx.fillStyle = '#FF0000';
ctx.beginPath();
ctx.moveTo(50, 100);
ctx.lineTo(100, 50);
ctx.lineTo(150, 100);
ctx.closePath();
ctx.fill();

// Draw door
ctx.fillStyle = '#0000FF';
ctx.fillRect(70, 120, 30, 40);

// Draw window
ctx.fillStyle = '#87CEEB';
ctx.fillRect(110, 120, 25, 25);

console.log('  ✓ House drawn\n');

// Check commands
const houseCommands = ctx.getCommands();
console.log(`  Recorded ${houseCommands.length} commands:`);
console.log(`    - Property changes: ${houseCommands.filter((c: any) => c.method === 'setProperty').length}`);
console.log(`    - Fill operations: ${houseCommands.filter((c: any) => c.method === 'fill' || c.method === 'fillRect').length}`);
console.log(`    - Path operations: ${houseCommands.filter((c: any) => c.method.includes('Path') || c.method === 'moveTo' || c.method === 'lineTo').length}`);

console.log('\n  Clearing canvas and replaying...');

ctx.clearCommands();
ctx.replay(houseCommands);

const replayedCommands = ctx.getCommands();
console.log(`  ✓ Replayed ${replayedCommands.length} commands\n`);

// ============================================================================
// Example 2: Canvas 2D Transformations
// ============================================================================

console.log('2. Canvas 2D Transformations\n');

const transformCanvas = document.createElement('canvas');
transformCanvas.width = 400;
transformCanvas.height = 400;

const transformCtx = transformCanvas.getContext('2d') as any;

console.log('  Drawing rotating squares...');

for (let i = 0; i < 8; i++) {
  transformCtx.save();

  // Translate to center
  transformCtx.translate(200, 200);

  // Rotate
  transformCtx.rotate((Math.PI / 4) * i);

  // Draw square
  transformCtx.fillStyle = `hsl(${i * 45}, 70%, 50%)`;
  transformCtx.fillRect(-25, -25, 50, 50);

  transformCtx.restore();
}

const transformCommands = transformCtx.getCommands();
console.log(`  ✓ Created ${transformCommands.length} commands for 8 rotated squares\n`);

// ============================================================================
// Example 3: Canvas 2D Text and Styling
// ============================================================================

console.log('3. Canvas 2D Text & Styling\n');

const textCanvas = document.createElement('canvas');
textCanvas.width = 600;
textCanvas.height = 200;

const textCtx = textCanvas.getContext('2d') as any;

console.log('  Drawing styled text...');

// Title
textCtx.font = 'bold 32px Arial';
textCtx.fillStyle = '#2C3E50';
textCtx.fillText('WebVisor Graphics', 50, 50);

// Subtitle with shadow
textCtx.font = '18px Arial';
textCtx.fillStyle = '#7F8C8D';
textCtx.shadowColor = 'rgba(0, 0, 0, 0.5)';
textCtx.shadowBlur = 4;
textCtx.shadowOffsetX = 2;
textCtx.shadowOffsetY = 2;
textCtx.fillText('Virtualized Canvas & WebGL', 50, 80);

// Stroked text
textCtx.shadowColor = 'transparent';
textCtx.font = 'bold 24px Arial';
textCtx.strokeStyle = '#E74C3C';
textCtx.lineWidth = 2;
textCtx.strokeText('Recording Enabled', 50, 120);

console.log('  ✓ Text rendered with shadows and strokes\n');

const textCommands = textCtx.getCommands();
console.log(`  Text drawing commands: ${textCommands.length}`);

// Measure text
const metrics = textCtx.measureText('WebVisor Graphics');
console.log(`  Text width: ${metrics.width}px\n`);

// ============================================================================
// Example 4: WebGL Context Creation and Basic Operations
// ============================================================================

console.log('4. WebGL Context & Basic Operations\n');

const webglCanvas = document.createElement('canvas');
webglCanvas.width = 800;
webglCanvas.height = 600;

const gl = webglCanvas.getContext('webgl') as any;

console.log('  Creating WebGL resources...');

// Create vertex shader
const vertexShader = gl.createShader(gl.VERTEX_SHADER);
gl.shaderSource(vertexShader, `
  attribute vec4 aPosition;
  void main() {
    gl_Position = aPosition;
  }
`);
gl.compileShader(vertexShader);

// Create fragment shader
const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
gl.shaderSource(fragmentShader, `
  precision mediump float;
  uniform vec4 uColor;
  void main() {
    gl_FragColor = uColor;
  }
`);
gl.compileShader(fragmentShader);

// Create program
const program = gl.createProgram();
gl.attachShader(program, vertexShader);
gl.attachShader(program, fragmentShader);
gl.linkProgram(program);
gl.useProgram(program);

console.log('  ✓ Shaders compiled and linked\n');

// Create buffer
const buffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, buffer);

const vertices = new Float32Array([
  -0.5, -0.5,
   0.5, -0.5,
   0.0,  0.5,
]);

gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

console.log('  ✓ Vertex buffer created\n');

// Setup rendering
gl.clearColor(0.0, 0.0, 0.0, 1.0);
gl.viewport(0, 0, 800, 600);

// Draw triangle
const positionLoc = gl.getAttribLocation(program, 'aPosition');
gl.enableVertexAttribArray(positionLoc);
gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

const colorLoc = gl.getUniformLocation(program, 'uColor');
gl.uniform4f(colorLoc, 1.0, 0.0, 0.0, 1.0);

gl.clear(gl.COLOR_BUFFER_BIT);
gl.drawArrays(gl.TRIANGLES, 0, 3);

console.log('  ✓ Triangle rendered\n');

const glCommands = gl.getCommands();
console.log(`  WebGL commands recorded: ${glCommands.length}`);

// Inspect WebGL state
const shaders = gl.getShaders();
const programs = gl.getPrograms();
const buffers = gl.getBuffers();

console.log(`  Shaders created: ${shaders.length}`);
console.log(`  Programs created: ${programs.length}`);
console.log(`  Buffers created: ${buffers.length}\n`);

// ============================================================================
// Example 5: WebGL Textures
// ============================================================================

console.log('5. WebGL Textures\n');

console.log('  Creating texture...');

const texture = gl.createTexture();
gl.bindTexture(gl.TEXTURE_2D, texture);

// Set texture parameters
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

console.log('  ✓ Texture created and configured\n');

const textures = gl.getTextures();
console.log(`  Textures in context: ${textures.length}\n`);

// ============================================================================
// Example 6: Graphics State Inspection
// ============================================================================

console.log('6. Graphics State Inspection\n');

const state = graphicsHandler.getState();

console.log(`  Total canvases: ${state.canvases.size}`);
console.log(`  Total draw calls: ${state.totalDrawCalls}`);
console.log(`  Total commands: ${state.totalCommands}\n`);

console.log('  Canvas details:');
for (const [id, canvasState] of state.canvases) {
  console.log(`    Canvas ${id}:`);
  console.log(`      - Size: ${canvasState.width}x${canvasState.height}`);
  console.log(`      - Context: ${canvasState.contextType || 'none'}`);
  console.log(`      - Commands: ${canvasState.commands.length}`);
  console.log(`      - Draw calls: ${canvasState.drawCalls}`);
}

console.log('\n');

// ============================================================================
// Example 7: Command Recording Export/Import
// ============================================================================

console.log('7. Command Export & Import\n');

// Export commands from canvas 2D
const canvases = graphicsHandler.getAllCanvases();
const canvas2dId = canvases[0]!.id;

const exportedCommands = graphicsHandler.getCommands(canvas2dId);
console.log(`  Exported ${exportedCommands.length} commands from Canvas 2D`);

// Serialize to JSON
const serialized = JSON.stringify(exportedCommands);
console.log(`  Serialized size: ${serialized.length} bytes`);

// Deserialize and replay
const deserialized = JSON.parse(serialized);
console.log(`  Deserialized ${deserialized.length} commands`);

console.log('  ✓ Commands can be saved and loaded\n');

// ============================================================================
// Example 8: Performance Analysis
// ============================================================================

console.log('8. Performance Analysis\n');

// Create a complex scene
const perfCanvas = document.createElement('canvas');
perfCanvas.width = 1920;
perfCanvas.height = 1080;

const perfCtx = perfCanvas.getContext('2d') as any;

console.log('  Drawing complex scene...');

const startTime = Date.now();

// Draw 1000 random shapes
for (let i = 0; i < 1000; i++) {
  const x = Math.random() * 1920;
  const y = Math.random() * 1080;
  const size = Math.random() * 50 + 10;

  perfCtx.fillStyle = `hsl(${Math.random() * 360}, 70%, 50%)`;

  if (i % 2 === 0) {
    perfCtx.fillRect(x, y, size, size);
  } else {
    perfCtx.beginPath();
    perfCtx.arc(x, y, size / 2, 0, Math.PI * 2);
    perfCtx.fill();
  }
}

const endTime = Date.now();
const perfCommands = perfCtx.getCommands();

console.log(`  ✓ Drew 1000 shapes in ${endTime - startTime}ms`);
console.log(`  Commands generated: ${perfCommands.length}`);
console.log(`  Average commands per shape: ${(perfCommands.length / 1000).toFixed(2)}\n`);

// ============================================================================
// Example 9: Clear and Replay
// ============================================================================

console.log('9. Clear & Replay Operations\n');

console.log('  Clearing all commands...');
graphicsHandler.clearAllCommands();

const stateAfterClear = graphicsHandler.getState();
console.log(`  ✓ Commands cleared (now: ${stateAfterClear.totalCommands})\n`);

console.log('  Replaying house drawing...');
graphicsHandler.replayCommands(canvas2dId, houseCommands);

const stateAfterReplay = graphicsHandler.getState();
console.log(`  ✓ Commands replayed (now: ${stateAfterReplay.totalCommands})\n`);

// ============================================================================
// Summary
// ============================================================================

console.log('=== Summary ===\n');

console.log('WebVisor Graphics Virtualization Features:');
console.log('  ✓ Canvas 2D context virtualization');
console.log('  ✓ WebGL context virtualization');
console.log('  ✓ Complete command recording');
console.log('  ✓ Command replay for deterministic rendering');
console.log('  ✓ State inspection and analysis');
console.log('  ✓ Export/import of drawing commands');
console.log('  ✓ Transformation tracking');
console.log('  ✓ Text rendering with styling');
console.log('  ✓ WebGL shader and buffer management');
console.log('  ✓ Texture handling');
console.log('  ✓ Performance monitoring');

console.log('\nUse Cases:');
console.log('  • Record and replay canvas animations');
console.log('  • Deterministic testing of graphics code');
console.log('  • Time-travel debugging for visual output');
console.log('  • Performance profiling of drawing operations');
console.log('  • Offline rendering and caching');
console.log('  • Visual regression testing');
console.log('  • Graphics command optimization');

console.log('\n=== Example Complete ===');
