/**
 * The hero sculpture: the headline as extruded ink type under a hard key light.
 *
 * A bespoke WebGL renderer rather than a 3D library. The scene needs exactly one
 * job done — draw a static extruded solid with two directional lights — and
 * three.js costs ~180 KB gzipped for the privilege, because its renderer defeats
 * tree-shaking. The geometry is baked at build time (scripts/bake-hero-mesh.mjs),
 * so this file only has to upload buffers and shade them.
 *
 * Everything here is a progressive enhancement over a hero that is already
 * complete in HTML and CSS:
 *
 *   - no WebGL, no JavaScript, or `prefers-reduced-motion: reduce` → this module
 *     returns immediately and the CSS marker sequence runs instead
 *   - the mesh is fetched after the first paint, so it cannot affect LCP
 *   - the real `<h1>` stays in the DOM and is only made transparent, never
 *     removed, so assistive tech and crawlers always get the text
 */
import meshMeta from '../assets/type/hero-mesh.json';
import meshUrl from '../assets/type/hero-mesh.bin?url';

/* ======================================================================
   The baked mesh
   ====================================================================== */

interface Contour {
  start: number;
  count: number;
  /** A counter: the bowl of an 'o', the triangle in an 'A'. */
  hole: boolean;
}

interface LineMeta {
  text: string;
  advance: number;
  points: number;
  indices: number;
  contours: Contour[];
}

interface MeshMeta {
  quant: { scale: number };
  lines: LineMeta[];
}

const meta = meshMeta as MeshMeta;

/** Extrusion depth, in em, centred on z = 0. */
const DEPTH_EM = 0.1;

/** Buffer layout: points (x,y Int16 pairs) first, then Uint16 triangle indices. */
const POINT_STRIDE = 4;
const INDEX_STRIDE = 2;

/** Floats per vertex: position then normal. */
const FLOATS_PER_VERTEX = 6;

interface LineGeometry {
  vertices: Float32Array;
  indices: Uint16Array;
}

/**
 * Expands the packed contours into a drawable solid.
 *
 * Three groups of vertices, because the three kinds of surface need different
 * normals: the front cap faces +z, the back cap faces -z, and every edge of the
 * extrusion faces its own way in the plane. The caps reuse the baked
 * triangulation — the back differs only in winding and in z.
 */
function buildLine(view: DataView, lineIndex: number): LineGeometry {
  /*
   * The buffer is all the points first, then all the indices, so a line's own
   * index block does not start at zero — it starts after every line's points.
   * Reading the indices from `indexBase` alone silently reads the point data as
   * triangle indices, which fills the letterforms with garbage.
   */
  const pointsSection = meta.lines.reduce((total, line) => total + line.points, 0) * POINT_STRIDE;

  let pointBase = 0;
  let indexBase = pointsSection;
  for (let i = 0; i < lineIndex; i += 1) {
    pointBase += meta.lines[i].points * POINT_STRIDE;
    indexBase += meta.lines[i].indices * INDEX_STRIDE;
  }

  const line = meta.lines[lineIndex];
  const { points: pointCount, scale } = { points: line.points, scale: meta.quant.scale };

  const readX = (i: number) => view.getInt16(pointBase + i * POINT_STRIDE, true) / scale;
  const readY = (i: number) =>
    view.getInt16(pointBase + i * POINT_STRIDE + 2, true) / scale;

  const front = -DEPTH_EM / 2;
  const back = DEPTH_EM / 2;

  // Count first so everything can be written into exact-size typed arrays.
  let edges = 0;
  for (const contour of line.contours) edges += contour.count;

  const vertices = new Float32Array((pointCount * 2 + edges * 4) * FLOATS_PER_VERTEX);
  const indices = new Uint16Array(line.indices + edges * 6);

  let next = 0;
  const push = (x: number, y: number, z: number, nx: number, ny: number, nz: number) => {
    const at = next * FLOATS_PER_VERTEX;
    vertices[at] = x;
    vertices[at + 1] = y;
    vertices[at + 2] = z;
    vertices[at + 3] = nx;
    vertices[at + 4] = ny;
    vertices[at + 5] = nz;
    next += 1;
    return next - 1;
  };

  /* --- caps ----------------------------------------------------------- */

  const backCap = pointCount; // index of the first back-cap vertex
  for (let i = 0; i < pointCount; i += 1) push(readX(i), readY(i), front, 0, 0, 1);
  for (let i = 0; i < pointCount; i += 1) push(readX(i), readY(i), back, 0, 0, -1);

  let w = 0;
  for (let i = 0; i < line.indices; i += 3) {
    const a = view.getUint16(indexBase + i * INDEX_STRIDE, true);
    const b = view.getUint16(indexBase + (i + 1) * INDEX_STRIDE, true);
    const c = view.getUint16(indexBase + (i + 2) * INDEX_STRIDE, true);

    indices[w] = a;
    indices[w + 1] = b;
    indices[w + 2] = c;

    // The back cap is the same triangulation, wound the other way.
    indices[w + 3] = backCap + c;
    indices[w + 4] = backCap + b;
    indices[w + 5] = backCap + a;
    w += 6;
  }

  /* --- side walls ----------------------------------------------------- */

  for (const contour of line.contours) {
    // Signed area says which way of walking the ring points outward. Outer rings
    // face away from their interior; counters face into the hole, which is why
    // the hole flag flips the result rather than the winding order.
    let area = 0;
    for (let i = 0; i < contour.count; i += 1) {
      const j = (i + 1) % contour.count;
      area +=
        readX(contour.start + i) * readY(contour.start + j) -
        readX(contour.start + j) * readY(contour.start + i);
    }

    for (let i = 0; i < contour.count; i += 1) {
      const a = contour.start + i;
      const b = contour.start + ((i + 1) % contour.count);

      const ax = readX(a);
      const ay = readY(a);
      const bx = readX(b);
      const by = readY(b);
      const dx = bx - ax;
      const dy = by - ay;

      let nx = area > 0 ? dy : -dy;
      let ny = area > 0 ? -dx : dx;
      if (contour.hole) {
        nx = -nx;
        ny = -ny;
      }
      const length = Math.hypot(nx, ny) || 1;
      nx /= length;
      ny /= length;

      const a0 = push(ax, ay, front, nx, ny, 0);
      const a1 = push(bx, by, front, nx, ny, 0);
      const a2 = push(bx, by, back, nx, ny, 0);
      const a3 = push(ax, ay, back, nx, ny, 0);

      indices[w] = a0;
      indices[w + 1] = a1;
      indices[w + 2] = a2;
      indices[w + 3] = a0;
      indices[w + 4] = a2;
      indices[w + 5] = a3;
      w += 6;
    }
  }

  return { vertices, indices };
}

/* ======================================================================
   Shading
   ====================================================================== */

/**
 * No matrix library: the scene only ever rotates about two axes and the camera
 * only ever sits on the z axis looking down -Z. Composing that by hand keeps a
 * few hundred lines of linear algebra out of the bundle.
 */
const VERTEX_SHADER = `
attribute vec3 aPosition;
attribute vec3 aNormal;

uniform vec2 uRotation;   // yaw, pitch
uniform vec3 uOffset;     // model translation, in pixels
uniform float uScale;     // em -> pixels
uniform float uCameraZ;
uniform vec2 uFocal;      // (focal / aspect, focal)
uniform vec2 uDepth;      // (A, B) of the perspective depth mapping

varying vec3 vNormal;

void main() {
  vec3 position = aPosition * uScale + uOffset;

  float cy = cos(uRotation.x);
  float sy = sin(uRotation.x);
  position = vec3(
    cy * position.x + sy * position.z,
    position.y,
    -sy * position.x + cy * position.z
  );

  float cx = cos(uRotation.y);
  float sx = sin(uRotation.y);
  position = vec3(
    position.x,
    cx * position.y - sx * position.z,
    sx * position.y + cx * position.z
  );

  vec3 normal = aNormal;
  normal = vec3(cy * normal.x + sy * normal.z, normal.y, -sy * normal.x + cy * normal.z);
  normal = vec3(normal.x, cx * normal.y - sx * normal.z, sx * normal.y + cx * normal.z);
  vNormal = normal;

  // Camera on the z axis. Note that the z component is not the raw eye depth:
  // with w = -z, writing z into gl_Position.z would make z/w a constant -1 for
  // every vertex, flattening the depth buffer so surfaces resolve by draw order
  // instead of by distance. uDepth carries the near/far mapping that fixes it.
  vec3 eye = vec3(position.x, position.y, position.z - uCameraZ);
  float depth = -eye.z;
  gl_Position = vec4(
    eye.x * uFocal.x,
    eye.y * uFocal.y,
    (uDepth.x - uDepth.y / depth) * depth,
    depth
  );
}
`;

/**
 * Lambert in linear space, then encoded back to sRGB, so a surface lit to 1.0
 * renders as exactly --tinta rather than an approximation of it.
 */
const FRAGMENT_SHADER = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

varying vec3 vNormal;

uniform vec3 uInk;      // linear
uniform vec3 uLight;    // x = ambient, y = key, z = fill
uniform vec3 uKeyDir;
uniform vec3 uFillDir;

vec3 toSrgb(vec3 linear) {
  return pow(max(linear, 0.0), vec3(1.0 / 2.2));
}

void main() {
  vec3 normal = normalize(vNormal);

  float key = max(dot(normal, uKeyDir), 0.0);
  float fill = max(dot(normal, uFillDir), 0.0);
  float lit = uLight.x + uLight.y * key + uLight.z * fill;

  gl_FragColor = vec4(toSrgb(uInk * lit), 1.0);
}
`;

/** Hard key from the left, as the brand's photography direction has it. */
const KEY_DIRECTION = [-0.62, 0.36, 0.7];
/** A low bounce from the right, to keep the shadow side from going flat. */
const FILL_DIRECTION = [0.72, -0.22, 0.66];
/** ambient, key, fill — tuned so a face pointed at the camera lands on 1.0. */
const LIGHT = [0.42, 0.86, 0.14];

const INK_HEX = 0x14213d;

/** sRGB hex to linear, because the lighting maths belongs in linear space. */
function toLinear(hex: number): [number, number, number] {
  const channel = (value: number) => Math.pow(value / 255, 2.2);
  return [channel((hex >> 16) & 0xff), channel((hex >> 8) & 0xff), channel(hex & 0xff)];
}

/* ======================================================================
   Scene
   ====================================================================== */

const FOV = 35;
/** Matches the DOM headline's line-height. */
const LEADING = 0.92;
/** Archivo's ascender, used to centre the inked block on the text box. */
const INK_TOP = 0.724;
const INK_BOTTOM = -0.012;

const MAX_POINTER_YAW = 0.055;
const MAX_POINTER_PITCH = 0.028;
const POINTER_SHIFT_PX = 9;
const DAMPING = 0.075;

const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function createContext(canvas: HTMLCanvasElement): WebGLRenderingContext | null {
  const options: WebGLContextAttributes = {
    alpha: true,
    antialias: true,
    depth: true,
    // Premultiplied output would dirty the ink where it meets the page.
    premultipliedAlpha: false,
    powerPreference: 'high-performance',
  };
  return (canvas.getContext('webgl', options) ??
    canvas.getContext('experimental-webgl', options)) as WebGLRenderingContext | null;
}

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('could not create shader');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader) ?? 'shader compilation failed');
  }
  return shader;
}

function createProgram(gl: WebGLRenderingContext) {
  const program = gl.createProgram();
  if (!program) throw new Error('could not create program');

  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER));
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) ?? 'program link failed');
  }
  return program;
}

const UNIFORM_NAMES = [
  'uRotation',
  'uOffset',
  'uScale',
  'uCameraZ',
  'uFocal',
  'uDepth',
  'uInk',
  'uLight',
  'uKeyDir',
  'uFillDir',
] as const;

async function init(canvas: HTMLCanvasElement, hero: HTMLElement) {
  const headline = hero.querySelector<HTMLElement>('.hero__headline');
  if (!headline) return;

  const gl = createContext(canvas);
  if (!gl) return;

  const response = await fetch(meshUrl);
  if (!response.ok) throw new Error(`mesh fetch failed: HTTP ${response.status}`);
  const view = new DataView(await response.arrayBuffer());

  const program = createProgram(gl);
  gl.useProgram(program);

  const positionAttribute = gl.getAttribLocation(program, 'aPosition');
  const normalAttribute = gl.getAttribLocation(program, 'aNormal');
  const uniforms = Object.fromEntries(
    UNIFORM_NAMES.map((name) => [name, gl.getUniformLocation(program, name)]),
  ) as Record<(typeof UNIFORM_NAMES)[number], WebGLUniformLocation | null>;

  /* --- upload -------------------------------------------------------- */

  const stride = FLOATS_PER_VERTEX * Float32Array.BYTES_PER_ELEMENT;

  const draws = meta.lines.map((_, index) => {
    const { vertices, indices } = buildLine(view, index);

    const vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    const indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

    return {
      vertexBuffer,
      indexBuffer,
      count: indices.length,
      /*
       * Each line is baked with its own baseline at y = 0, so the stacking has
       * to happen here. The gap is the DOM's line-height, in em, which is what
       * makes the sculpture sit on the same rhythm as the text it replaces.
       */
      baselineEm: -index * LEADING,
    };
  });

  const bindVertexLayout = (buffer: WebGLBuffer | null) => {
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(positionAttribute);
    gl.vertexAttribPointer(positionAttribute, 3, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(normalAttribute);
    gl.vertexAttribPointer(
      normalAttribute,
      3,
      gl.FLOAT,
      false,
      stride,
      3 * Float32Array.BYTES_PER_ELEMENT,
    );
  };

  const [inkR, inkG, inkB] = toLinear(INK_HEX);
  gl.uniform3f(uniforms.uInk, inkR, inkG, inkB);
  gl.uniform3fv(uniforms.uLight, LIGHT);
  gl.uniform3fv(uniforms.uKeyDir, KEY_DIRECTION);
  gl.uniform3fv(uniforms.uFillDir, FILL_DIRECTION);

  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  // Winding order is not worth relying on for a closed solid drawn from one side;
  // the depth buffer decides what is in front.
  gl.disable(gl.CULL_FACE);
  gl.clearColor(0, 0, 0, 0);

  /* --- framing ------------------------------------------------------- */

  const focal = 1 / Math.tan((FOV * Math.PI) / 360);
  const viewport = { width: 0, height: 0 };

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false;

    const mobile = window.matchMedia('(max-width: 767px)').matches;
    const dpr = Math.min(window.devicePixelRatio, mobile ? 1.75 : 2);

    viewport.width = rect.width;
    viewport.height = rect.height;
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
    return true;
  };

  const offset: [number, number, number] = [0, 0, 0];
  let scale = 1;

  const layout = () => {
    const fontSize = parseFloat(getComputedStyle(headline).fontSize);
    if (!Number.isFinite(fontSize) || fontSize <= 0) return;

    // Contours are in em, so scaling by the font size reproduces the DOM exactly.
    scale = fontSize;

    const headlineBox = headline.getBoundingClientRect();
    const canvasBox = canvas.getBoundingClientRect();
    const left = headlineBox.left - canvasBox.left;
    const top = headlineBox.top - canvasBox.top;

    // A camera distance that makes one world unit equal one pixel at z = 0.
    const cameraZ = viewport.height / 2 / Math.tan((FOV * Math.PI) / 360);
    gl.uniform1f(uniforms.uCameraZ, cameraZ);
    gl.uniform2f(uniforms.uFocal, focal / (viewport.width / viewport.height), focal);

    /*
     * Perspective depth, expressed as zNdc = A - B / distance. The near and far
     * planes are derived from the camera distance rather than fixed, so the same
     * numbers work whether the viewport is 320px or 2560px tall. The scene is
     * only a few tens of pixels deep, so a 4:1 near:far ratio costs nothing in
     * precision and keeps the extrusion resolving cleanly against the caps.
     */
    const near = cameraZ * 0.5;
    const far = cameraZ * 2;
    gl.uniform2f(uniforms.uDepth, (far + near) / (far - near), (2 * far * near) / (far - near));

    /*
     * The inked block. Line 0's baseline sits at y = 0 and the last line's at
     * -(n-1) * leading, so the ink runs from INK_BOTTOM below that baseline to
     * INK_TOP above the first one. Centring on the ink rather than on the em box
     * is what makes the sculpture land where the text did.
     */
    const inkTop = INK_TOP;
    const inkBottom = -LEADING * (meta.lines.length - 1) + INK_BOTTOM;
    const inkCentre = ((inkTop + inkBottom) / 2) * scale;

    // Left-aligned, as everything on this page is, and centred vertically on the
    // box the text would have occupied.
    offset[0] = left - viewport.width / 2;
    offset[1] = viewport.height / 2 - top - headlineBox.height / 2 - inkCentre;
    offset[2] = 0;

    gl.uniform1f(uniforms.uScale, scale);
  };

  /* --- interaction --------------------------------------------------- */

  const pointer = { x: 0, y: 0 };
  const current = { x: 0, y: 0 };

  const onPointerMove = (event: PointerEvent) => {
    const rect = hero.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = ((event.clientY - rect.top) / rect.height) * 2 - 1;
  };
  const onPointerLeave = () => {
    pointer.x = 0;
    pointer.y = 0;
  };

  hero.addEventListener('pointermove', onPointerMove, { passive: true });
  hero.addEventListener('pointerleave', onPointerLeave, { passive: true });

  let drift = 0;
  const onScroll = () => {
    const rect = hero.getBoundingClientRect();
    drift = Math.min(Math.max(-rect.top / Math.max(rect.height, 1), 0), 1);
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  /* --- loop ---------------------------------------------------------- */

  let running = false;
  let frame = 0;
  let revealed = false;

  const render = () => {
    current.x += (pointer.x - current.x) * DAMPING;
    current.y += (pointer.y - current.y) * DAMPING;

    gl.uniform2f(uniforms.uRotation, current.x * MAX_POINTER_YAW, -current.y * MAX_POINTER_PITCH);

    const sharedY = offset[1] - drift * 14;
    const sharedZ = offset[2] + drift * 90;
    const sharedX = offset[0] + current.x * POINTER_SHIFT_PX * 0.08;

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    for (const draw of draws) {
      gl.uniform3f(
        uniforms.uOffset,
        sharedX,
        // Moving the model is equivalent to moving a camera that has no pitch.
        sharedY + draw.baselineEm * scale,
        sharedZ,
      );
      bindVertexLayout(draw.vertexBuffer);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, draw.indexBuffer);
      gl.drawElements(gl.TRIANGLES, draw.count, gl.UNSIGNED_SHORT, 0);
    }
  };

  const loop = () => {
    frame = requestAnimationFrame(loop);
    render();
  };
  const stop = () => {
    running = false;
    cancelAnimationFrame(frame);
  };
  const play = () => {
    if (running) return;
    running = true;
    loop();
  };

  // Nothing is drawn while the hero is off screen: the sculpture costs battery
  // only while someone is looking at it.
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) play();
        else stop();
      }
    },
    { rootMargin: '10% 0px' },
  );

  const onSync = () => {
    if (!resize()) return;
    layout();
    if (!running) render();
    if (!revealed) {
      revealed = true;
      // Only now hand the visual over to the canvas: until a frame has landed the
      // DOM headline is what the visitor sees, and if anything above failed it
      // stays that way.
      hero.classList.add('is-gl');
    }
  };

  /*
   * A ResizeObserver rather than a window resize listener. The canvas fills the
   * hero, and the hero's box changes for reasons that never fire a window
   * resize — fonts swapping in, the headline reflowing, a language switch — so
   * listening to the window alone leaves the drawing buffer stale while the
   * element is displayed at the new size, which silently stretches the type.
   * The observer also fires once on `observe`, which covers first paint.
   */
  const watcher = new ResizeObserver(onSync);
  watcher.observe(hero);
  onSync();

  observer.observe(hero);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stop();
    } else {
      observer.unobserve(hero);
      observer.observe(hero);
    }
  });

  /*
   * Live diagnostics, behind getters so they cost nothing unless something reads
   * them. Reading the canvas back is unreliable without `preserveDrawingBuffer`
   * — the buffer is cleared once it has been composited — so these are the
   * dependable way to check what the scene is actually doing.
   */
  (window as unknown as Record<string, unknown>).__heroGl = {
    lines: draws.length,
    triangles: draws.reduce((total, draw) => total + draw.count / 3, 0),
    points: meta.lines.reduce((total, line) => total + line.points, 0),
    get scale() {
      return scale;
    },
    get rotation() {
      return [current.x * MAX_POINTER_YAW, -current.y * MAX_POINTER_PITCH];
    },
    get pointer() {
      return { ...pointer };
    },
    get viewport() {
      return { ...viewport };
    },
    get offset() {
      return [...offset];
    },
    get drawingBuffer() {
      return { width: canvas.width, height: canvas.height };
    },
  };
}

/**
 * Entry point. Resolves quietly whenever the sculpture is not appropriate.
 */
export async function initHero3D() {
  const hero = document.querySelector<HTMLElement>('[data-hero]');
  const canvas = hero?.querySelector<HTMLCanvasElement>('[data-hero-gl]');
  if (!hero || !canvas) return;

  if (prefersReducedMotion()) return;

  try {
    await init(canvas, hero);
  } catch (error) {
    // Never let the enhancement break the page: the DOM hero is already there.
    console.error('[hero-3d] disabled:', error);
    hero.classList.remove('is-gl');
  }
}
