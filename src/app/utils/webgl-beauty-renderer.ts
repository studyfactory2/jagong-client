type BeautyPoint = {
  x: number;
  y: number;
};

export type BeautyFaceMask = {
  center: BeautyPoint;
  radiusX: number;
  radiusY: number;
  roll: number;
  leftEye: BeautyPoint;
  rightEye: BeautyPoint;
  eyeRadiusX: number;
  eyeRadiusY: number;
  mouth: BeautyPoint;
  mouthRadiusX: number;
  mouthRadiusY: number;
};

export type BeautyTreatment = {
  strength: number;
  brightness: number;
  warmth: number;
};

type BeautyCanvas = OffscreenCanvas | HTMLCanvasElement;

const VERTEX_SHADER = `
  attribute vec2 a_position;
  varying vec2 v_uv;

  void main() {
    v_uv = a_position * 0.5 + 0.5;
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

const FRAGMENT_SHADER = `
  precision mediump float;

  uniform sampler2D u_image;
  uniform vec2 u_texel;
  uniform vec2 u_faceCenter;
  uniform vec2 u_faceRadius;
  uniform float u_faceRoll;
  uniform vec2 u_leftEye;
  uniform vec2 u_rightEye;
  uniform vec2 u_eyeRadius;
  uniform vec2 u_mouth;
  uniform vec2 u_mouthRadius;
  uniform float u_strength;
  uniform float u_brightness;
  uniform float u_warmth;
  varying vec2 v_uv;

  float ellipseMask(vec2 point, vec2 center, vec2 radius) {
    vec2 distanceFromCenter = (point - center) / max(radius, vec2(0.0001));
    float distanceToEdge = length(distanceFromCenter);
    return 1.0 - smoothstep(0.78, 1.0, distanceToEdge);
  }

  void main() {
    vec4 original = texture2D(u_image, v_uv);
    vec3 nearby =
      texture2D(u_image, v_uv + vec2(u_texel.x, 0.0) * 1.7).rgb +
      texture2D(u_image, v_uv - vec2(u_texel.x, 0.0) * 1.7).rgb +
      texture2D(u_image, v_uv + vec2(0.0, u_texel.y) * 1.7).rgb +
      texture2D(u_image, v_uv - vec2(0.0, u_texel.y) * 1.7).rgb;
    vec3 softened = (original.rgb * 4.0 + nearby) / 8.0;

    float cosine = cos(-u_faceRoll);
    float sine = sin(-u_faceRoll);
    mat2 rotation = mat2(cosine, -sine, sine, cosine);
    vec2 faceOffset = vec2(
      (v_uv.x - u_faceCenter.x) / u_texel.x,
      -(v_uv.y - u_faceCenter.y) / u_texel.y
    );
    vec2 rotatedFaceOffset = rotation * faceOffset;
    float faceDistance = length(
      rotatedFaceOffset / max(u_faceRadius, vec2(0.0001))
    );
    float face = 1.0 - smoothstep(0.78, 1.0, faceDistance);
    float eyeProtection = max(
      ellipseMask(v_uv, u_leftEye, u_eyeRadius),
      ellipseMask(v_uv, u_rightEye, u_eyeRadius)
    );
    float mouthProtection = ellipseMask(v_uv, u_mouth, u_mouthRadius);
    float treatment = face * (1.0 - max(eyeProtection, mouthProtection));
    treatment *= u_strength;

    vec3 tone = vec3(u_warmth, u_warmth * 0.58, u_warmth * 0.34);
    vec3 brightened = min(vec3(1.0), softened * (1.0 + u_brightness) + tone);
    vec3 result = mix(original.rgb, brightened, treatment);
    gl_FragColor = vec4(result, original.a);
  }
`;

const createCanvas = (width: number, height: number): BeautyCanvas => {
  if (typeof OffscreenCanvas !== "undefined") {
    return new OffscreenCanvas(width, height);
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
};

const compileShader = (
  gl: WebGLRenderingContext,
  type: number,
  source: string,
) => {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Unable to create beauty shader.");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) || "Beauty shader failed.";
    gl.deleteShader(shader);
    throw new Error(message);
  }
  return shader;
};

export class WebGlBeautyRenderer {
  private readonly canvas: BeautyCanvas;
  private readonly gl: WebGLRenderingContext;
  private readonly program: WebGLProgram;
  private readonly texture: WebGLTexture;
  private readonly buffer: WebGLBuffer;

  constructor(width: number, height: number) {
    this.canvas = createCanvas(width, height);
    const gl = this.canvas.getContext("webgl", {
      alpha: false,
      antialias: false,
      depth: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
    }) as WebGLRenderingContext | null;
    if (!gl) throw new Error("WebGL beauty rendering is unavailable.");

    const vertexShader = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fragmentShader = compileShader(
      gl,
      gl.FRAGMENT_SHADER,
      FRAGMENT_SHADER,
    );
    const program = gl.createProgram();
    if (!program) throw new Error("Unable to create beauty program.");
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const message = gl.getProgramInfoLog(program) || "Beauty program failed.";
      gl.deleteProgram(program);
      throw new Error(message);
    }

    const texture = gl.createTexture();
    const buffer = gl.createBuffer();
    if (!texture || !buffer) {
      throw new Error("Unable to allocate beauty rendering resources.");
    }

    this.gl = gl;
    this.program = program;
    this.texture = texture;
    this.buffer = buffer;
    this.configure();
  }

  render(
    source: TexImageSource,
    mask: BeautyFaceMask,
    treatment: BeautyTreatment,
  ): CanvasImageSource | null {
    const gl = this.gl;
    try {
      gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      gl.useProgram(this.program);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        source,
      );

      this.uniform2f("u_texel", 1 / this.canvas.width, 1 / this.canvas.height);
      this.uniformPoint("u_faceCenter", mask.center);
      this.uniform2f("u_faceRadius", mask.radiusX, mask.radiusY);
      this.uniform1f("u_faceRoll", mask.roll);
      this.uniformPoint("u_leftEye", mask.leftEye);
      this.uniformPoint("u_rightEye", mask.rightEye);
      this.uniform2f(
        "u_eyeRadius",
        mask.eyeRadiusX / this.canvas.width,
        mask.eyeRadiusY / this.canvas.height,
      );
      this.uniformPoint("u_mouth", mask.mouth);
      this.uniform2f(
        "u_mouthRadius",
        mask.mouthRadiusX / this.canvas.width,
        mask.mouthRadiusY / this.canvas.height,
      );
      this.uniform1f("u_strength", treatment.strength);
      this.uniform1f("u_brightness", treatment.brightness);
      this.uniform1f("u_warmth", treatment.warmth);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      return this.canvas as CanvasImageSource;
    } catch {
      return null;
    }
  }

  destroy() {
    this.gl.deleteTexture(this.texture);
    this.gl.deleteBuffer(this.buffer);
    this.gl.deleteProgram(this.program);
  }

  matchesSize(width: number, height: number) {
    return this.canvas.width === width && this.canvas.height === height;
  }

  private configure() {
    const gl = this.gl;
    gl.useProgram(this.program);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const position = gl.getAttribLocation(this.program, "a_position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    this.uniform1i("u_image", 0);
  }

  private uniformPoint(name: string, point: BeautyPoint) {
    this.uniform2f(
      name,
      point.x / this.canvas.width,
      1 - point.y / this.canvas.height,
    );
  }

  private uniform1f(name: string, value: number) {
    const location = this.gl.getUniformLocation(this.program, name);
    if (location) this.gl.uniform1f(location, value);
  }

  private uniform1i(name: string, value: number) {
    const location = this.gl.getUniformLocation(this.program, name);
    if (location) this.gl.uniform1i(location, value);
  }

  private uniform2f(name: string, x: number, y: number) {
    const location = this.gl.getUniformLocation(this.program, name);
    if (location) this.gl.uniform2f(location, x, y);
  }
}
