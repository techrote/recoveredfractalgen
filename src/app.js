(() => {
  "use strict";

  const canvas = document.getElementById("view");
  const fatal = document.getElementById("fatal");
  const gl = canvas.getContext("webgl2", {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    preserveDrawingBuffer: true,
    powerPreference: "high-performance"
  });

  function die(message) {
    fatal.textContent = message;
    fatal.classList.remove("hidden");
    throw new Error(message);
  }

  if (!gl) {
    die("WebGL2 is required for the recovered fractal renderer.\n\nTry a current Chrome, Edge, or Firefox build with hardware acceleration enabled.");
  }

  const VERTEX_SHADER = `#version 300 es
precision highp float;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
`;

  const FRAGMENT_SHADER = `#version 300 es
precision highp float;
precision highp int;

out vec4 fragColor;

uniform vec2 uResolution;
uniform float uTime;
uniform vec3 uCameraPos;
uniform vec3 uCameraTarget;
uniform float uFov;

uniform int uMode;
uniform int uIterations;
uniform int uSteps;
uniform float uPower;
uniform float uBailout;
uniform float uScale;
uniform float uFold;
uniform float uSurface;
uniform vec4 uJulia;

uniform float uGrowth;
uniform float uSlice;
uniform float uWSpin;
uniform float uTwist;
uniform float uFlowSpeed;
uniform float uFlowWarp;
uniform float uFilament;
uniform float uGrain;

uniform sampler2D uTexture;
uniform float uTextureScale;
uniform float uTextureFlow;
uniform float uTextureMix;
uniform float uRoughness;
uniform float uMetallic;
uniform float uGlow;
uniform float uPaletteShift;

uniform float uExposure;
uniform float uFog;
uniform float uLightSpin;
uniform float uShadow;
uniform float uNormalEps;
uniform float uMaxDistance;

const int MAX_ITER = 32;
const int MAX_STEPS = 220;
const float PI = 3.141592653589793;

vec2 r2(vec2 p, float a) {
  float c = cos(a), s = sin(a);
  return vec2(c * p.x - s * p.y, s * p.x + c * p.y);
}

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float hash31(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}

vec3 palette(float t) {
  vec3 a = vec3(0.48, 0.44, 0.50);
  vec3 b = vec3(0.48, 0.46, 0.43);
  vec3 c = vec3(1.00, 0.82, 0.67);
  vec3 d = vec3(0.02, 0.18, 0.37) + uPaletteShift;
  return a + b * cos(6.2831853 * (c * t + d));
}

vec3 animatedDomain(vec3 p) {
  float flowT = uTime * uFlowSpeed;
  p.z += flowT;

  float pathX = sin(p.z * 0.21) + 0.45 * sin(p.z * 0.57 + 1.2);
  float pathY = cos(p.z * 0.17 + 0.7) + 0.35 * sin(p.z * 0.43 - 0.4);
  p.xy -= vec2(pathX, pathY) * uFlowWarp;

  float growPhase = p.z * 0.38 - uTime * (0.72 + 0.42 * uGrowth);
  float breath = 1.0 + 0.045 * uGrowth * sin(growPhase)
                     + 0.022 * uGrowth * sin(growPhase * 2.7 + 0.8);
  p.xy /= max(0.45, breath);

  p.xz = r2(p.xz, uTwist * (0.075 * p.z + 0.13 * uTime));
  p.yz = r2(p.yz, 0.035 * uTwist * sin(p.z * 0.31 - uTime * 0.27));
  p += 0.018 * uGrowth * vec3(
    sin(p.z * 1.7 - uTime * 0.47),
    sin(p.z * 1.13 + uTime * 0.39),
    sin(p.x * 1.9 + p.y * 1.4)
  );
  return p;
}

float deFlowField(vec3 p) {
  vec3 z = p * uScale;
  float d = 1e5;
  float invScale = 1.0;
  float thickness = mix(0.010, 0.080, clamp(uFilament, 0.0, 1.0));

  for (int i = 0; i < MAX_ITER; ++i) {
    if (i >= uIterations) break;
    float fi = float(i);

    z.xy = r2(z.xy, 0.55 + uTwist * 0.09 + 0.08 * sin(fi * 1.7 + uTime * 0.18));
    z.yz = r2(z.yz, -0.37 + 0.05 * cos(fi * 1.13 - uTime * 0.13));
    z = abs(z);
    if (z.x < z.y) z.xy = z.yx;
    if (z.x < z.z) z.xz = z.zx;

    vec3 q = z - vec3(0.68, 0.44, 0.58);
    float pulse = 1.0 + 0.22 * uGrowth * sin(uTime * 0.65 + fi * 1.37 + q.z * 2.0);
    float strand = length(q.xy) - thickness * pulse;
    float rail = max(abs(q.y) - thickness * 0.42, abs(q.z) - 0.29);
    float ring = abs(length(q.xz) - 0.31) - thickness * 0.55;
    d = min(d, min(strand, min(rail, ring)) * invScale);

    z = z * 1.78 - vec3(1.08, 0.82, 0.94);
    invScale /= 1.78;
  }

  float spine = length(p.xy - vec2(sin(p.z * 0.41), cos(p.z * 0.37)) * 0.18)
              - thickness * 0.72;
  d = min(d, spine);
  float micro = (hash31(floor(p * 52.0)) - 0.5) * clamp(uGrain, 0.0, 1.5) * 0.0035;
  return d + micro - uSurface;
}

float deJulia4(vec3 p) {
  vec4 q = vec4(p * uScale, uSlice + 0.18 * uGrowth * sin(uTime * 0.29));
  float a = uWSpin * uTime * 0.37 + uTwist * length(p);
  q.xw = r2(q.xw, a);
  q.yw = r2(q.yw, a * 0.73 + 0.41);
  q.zw = r2(q.zw, -a * 0.51 + 0.17);

  float dr = 1.0;
  float radius = 0.0;
  for (int i = 0; i < MAX_ITER; ++i) {
    if (i >= uIterations) break;
    radius = length(q);
    if (radius > uBailout) break;
    dr = max(1e-5, 2.0 * radius * dr + 1.0);
    vec3 v = q.xyz;
    float w = q.w;
    q = vec4(2.0 * w * v, w * w - dot(v, v)) + uJulia;
  }

  radius = max(length(q), 1.00001);
  return (0.5 * log(radius) * radius / max(dr, 1e-5)) / max(uScale, 0.05) - uSurface;
}

float deMandelbulb(vec3 p) {
  vec3 c = p * uScale;
  vec3 z = c;
  float dr = 1.0;
  float radius = 0.0;
  float power = clamp(uPower, 2.0, 12.0);

  for (int i = 0; i < MAX_ITER; ++i) {
    if (i >= uIterations) break;
    radius = length(z);
    if (radius > uBailout) break;
    float rr = max(radius, 1e-6);
    float theta = acos(clamp(z.z / rr, -1.0, 1.0));
    float phi = atan(z.y, z.x);
    dr = pow(rr, power - 1.0) * power * dr + 1.0;
    float zr = pow(rr, power);
    theta *= power;
    phi *= power;
    z = zr * vec3(sin(theta) * cos(phi), sin(phi) * sin(theta), cos(theta));
    z += c * (0.88 + 0.12 * sin(uTime * 0.33 * uGrowth + float(i) * 0.21));
  }

  radius = max(length(z), 1.00001);
  return (0.5 * log(radius) * radius / max(abs(dr), 1e-5)) / max(uScale, 0.05) - uSurface;
}

void boxFold(inout vec3 z, float limit) {
  z = clamp(z, -limit, limit) * 2.0 - z;
}

void sphereFold(inout vec3 z, inout float dz) {
  float r2v = dot(z, z);
  const float minR2 = 0.25;
  const float fixedR2 = 1.0;
  if (r2v < minR2) {
    float t = fixedR2 / minR2;
    z *= t;
    dz *= t;
  } else if (r2v < fixedR2) {
    float t = fixedR2 / max(r2v, 1e-6);
    z *= t;
    dz *= t;
  }
}

float deMandelbox(vec3 p) {
  vec3 offset = p * uScale;
  vec3 z = offset;
  float dz = 1.0;
  float scale = -(1.45 + clamp(uFold, 0.0, 4.0) * 0.42);

  for (int i = 0; i < MAX_ITER; ++i) {
    if (i >= uIterations) break;
    boxFold(z, 1.0 + 0.08 * sin(uTime * 0.24 * uGrowth));
    sphereFold(z, dz);
    z = z * scale + offset;
    dz = dz * abs(scale) + 1.0;
    z.xy = r2(z.xy, 0.018 * uTwist * float(i + 1));
  }

  return length(z) / max(abs(dz), 1e-5) / max(uScale, 0.05) - uSurface;
}

float deFoldedLoop(vec3 p) {
  vec3 z = p * uScale;
  float totalScale = 1.0;
  float scale = 1.35 + clamp(uFold, 0.0, 4.0) * 0.19;

  for (int i = 0; i < 14; ++i) {
    if (i >= uIterations) break;
    float fi = float(i);
    z.xz = r2(z.xz, 0.43 + uTwist * 0.08 + 0.03 * sin(uTime * 0.4 + fi));
    z.xy = r2(z.xy, -0.19 + 0.025 * cos(uTime * 0.27 + fi));
    z = abs(z) - vec3(0.56, 0.43, 0.56) * (1.0 + 0.05 * uGrowth * sin(uTime * 0.6 + fi));
    if (z.x < z.y) z.xy = z.yx;
    if (z.x < z.z) z.xz = z.zx;
    z *= scale;
    totalScale *= scale;
  }

  float ring = abs(length(z.xz) - (0.58 + 0.08 * sin(uTime * 0.41 * uGrowth))) - 0.16;
  float slab = abs(z.y) - 0.21;
  return max(ring, slab) / max(totalScale, 1.0) / max(uScale, 0.05) - uSurface;
}

float mapScene(vec3 p) {
  p = animatedDomain(p);
  if (uMode == 0) return deFlowField(p);
  if (uMode == 1) return deJulia4(p);
  if (uMode == 2) return deMandelbulb(p);
  if (uMode == 3) return deMandelbox(p);
  return deFoldedLoop(p);
}

vec3 normalAt(vec3 p) {
  float e = max(0.00015, uNormalEps);
  vec2 h = vec2(1.0, -1.0) * e;
  return normalize(
    h.xyy * mapScene(p + h.xyy) +
    h.yyx * mapScene(p + h.yyx) +
    h.yxy * mapScene(p + h.yxy) +
    h.xxx * mapScene(p + h.xxx)
  );
}

float ambientOcclusion(vec3 p, vec3 n) {
  float occ = 0.0;
  float weight = 0.65;
  for (int i = 1; i <= 4; ++i) {
    float h = 0.025 * float(i);
    float d = mapScene(p + n * h);
    occ += (h - d) * weight;
    weight *= 0.62;
  }
  return clamp(1.0 - occ * 2.4, 0.15, 1.0);
}

float softShadow(vec3 ro, vec3 rd) {
  if (uShadow <= 0.001) return 1.0;
  float res = 1.0;
  float t = 0.03;
  for (int i = 0; i < 24; ++i) {
    float h = mapScene(ro + rd * t);
    res = min(res, 12.0 * h / max(t, 0.01));
    t += clamp(h, 0.018, 0.65);
    if (h < 0.0005 || t > 12.0) break;
  }
  return mix(1.0, clamp(res, 0.08, 1.0), uShadow);
}

vec3 triTexture(vec3 p, vec3 n) {
  vec3 w = pow(abs(n), vec3(3.5));
  w /= max(dot(w, vec3(1.0)), 1e-5);
  float flow = uTime * uTextureFlow;
  float s = max(0.05, uTextureScale);
  vec2 fx = vec2(flow, -flow * 0.37);
  vec2 fy = vec2(-flow * 0.61, flow * 0.29);
  vec2 fz = vec2(flow * 0.23, flow * 0.73);
  vec3 tx = texture(uTexture, p.yz * s + fx).rgb;
  vec3 ty = texture(uTexture, p.xz * s + fy).rgb;
  vec3 tz = texture(uTexture, p.xy * s + fz).rgb;
  return tx * w.x + ty * w.y + tz * w.z;
}

vec3 background(vec3 rd) {
  float horizon = pow(max(0.0, 1.0 - abs(rd.y)), 5.0);
  vec3 col = mix(vec3(0.002, 0.004, 0.011), vec3(0.018, 0.027, 0.052), horizon);
  vec2 cell = floor((rd.xy / max(0.08, abs(rd.z))) * 190.0);
  float star = step(0.9965, hash21(cell));
  star *= pow(hash21(cell + 17.3), 6.0);
  col += star * vec3(0.65, 0.78, 1.0);
  float haze = pow(max(0.0, dot(rd, normalize(vec3(-0.45, 0.18, 0.87)))), 18.0);
  col += haze * vec3(0.09, 0.04, 0.13);
  return col;
}

vec3 shade(vec3 p, vec3 n, vec3 rd, float distanceTravelled) {
  float spin = uTime * uLightSpin;
  vec3 lightDir = normalize(vec3(cos(spin) * 0.7, 0.78, sin(spin) * 0.7));
  vec3 viewDir = -rd;
  vec3 halfDir = normalize(lightDir + viewDir);

  float ndl = max(dot(n, lightDir), 0.0);
  float shadow = softShadow(p + n * uNormalEps * 3.0, lightDir);
  float ao = ambientOcclusion(p, n);
  float specPower = mix(90.0, 8.0, clamp(uRoughness, 0.0, 1.0));
  float spec = pow(max(dot(n, halfDir), 0.0), specPower);
  float rim = pow(1.0 - max(dot(n, viewDir), 0.0), 2.6);

  float bands = 0.5 + 0.5 * sin(length(p) * 8.0 - uTime * 0.7 * uGrowth + n.y * 3.0);
  vec3 base = palette(length(p) * 0.21 + bands * 0.12 + uTime * 0.018);
  vec3 tex = triTexture(p, n);
  base = mix(base, tex, clamp(uTextureMix, 0.0, 1.0));
  float surfaceGrain = hash31(floor((p + n * 0.07) * mix(34.0, 118.0, clamp(uGrain, 0.0, 1.0))));
  base *= mix(1.0, 0.69 + 0.62 * surfaceGrain, clamp(uGrain, 0.0, 1.0));

  vec3 ambient = base * (0.11 + 0.23 * ao);
  vec3 diffuse = base * ndl * shadow * (0.62 + 0.38 * ao);
  vec3 specular = mix(vec3(0.86), base, uMetallic) * spec * shadow * mix(0.45, 1.35, uMetallic);
  vec3 emission = (0.25 + 0.75 * tex) * uGlow * (0.18 + 0.82 * bands) + rim * base * (0.12 + uGlow * 0.35);

  vec3 col = ambient + diffuse + specular + emission;
  float fogAmount = 1.0 - exp(-distanceTravelled * distanceTravelled * max(0.0, uFog) * 0.018);
  return mix(col, background(rd), clamp(fogAmount, 0.0, 0.94));
}

void main() {
  vec2 uv = (gl_FragCoord.xy * 2.0 - uResolution.xy) / max(uResolution.y, 1.0);

  vec3 forward = normalize(uCameraTarget - uCameraPos);
  vec3 worldUp = abs(forward.y) > 0.96 ? vec3(0.0, 0.0, 1.0) : vec3(0.0, 1.0, 0.0);
  vec3 right = normalize(cross(forward, worldUp));
  vec3 up = normalize(cross(right, forward));
  float lens = tan(radians(clamp(uFov, 18.0, 105.0)) * 0.5);
  vec3 rd = normalize(forward + right * uv.x * lens + up * uv.y * lens);
  vec3 ro = uCameraPos;

  float travel = 0.0;
  bool hit = false;
  for (int i = 0; i < MAX_STEPS; ++i) {
    if (i >= uSteps) break;
    vec3 p = ro + rd * travel;
    float d = mapScene(p);
    float eps = max(uNormalEps * 0.72, 0.00035 * (1.0 + travel * 0.08));
    if (d < eps) {
      hit = true;
      break;
    }
    travel += max(d * 0.68, eps * 0.75);
    if (travel > uMaxDistance) break;
  }

  vec3 color;
  if (hit) {
    vec3 p = ro + rd * travel;
    vec3 n = normalAt(p);
    color = shade(p, n, rd, travel);
  } else {
    color = background(rd);
  }

  color = max(color, vec3(0.0));
  color = vec3(1.0) - exp(-color * max(0.05, uExposure));
  color = pow(color, vec3(0.4545));
  float film = hash21(gl_FragCoord.xy + vec2(fract(uTime) * 997.0, floor(uTime * 31.0)));
  float grainAmp = 0.105 * clamp(uGrain, 0.0, 1.5);
  color += (film - 0.5) * grainAmp * (0.35 + 0.65 * sqrt(max(color, vec3(0.0))));
  float vignette = 1.0 - 0.13 * pow(length(uv) * 0.62, 2.0);
  fragColor = vec4(max(color, vec3(0.0)) * vignette, 1.0);
}
`;

  function compile(type, source, label) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(shader) || "unknown shader compilation error";
      gl.deleteShader(shader);
      die(label + " shader failed:\n\n" + log);
    }
    return shader;
  }

  const program = gl.createProgram();
  const vs = compile(gl.VERTEX_SHADER, VERTEX_SHADER, "Vertex");
  const fs = compile(gl.FRAGMENT_SHADER, FRAGMENT_SHADER, "Fragment");
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    die("Shader link failed:\n\n" + (gl.getProgramInfoLog(program) || "unknown link error"));
  }
  gl.useProgram(program);

  const DEFAULT = {
    fractalMode: 0,
    iterations: 13,
    steps: 132,
    power: 7.4,
    bailout: 8.0,
    scale: 1.34,
    fold: 1.55,
    surface: 0.0015,
    juliaX: -0.21,
    juliaY: 0.63,
    juliaZ: -0.18,
    juliaW: -0.27,

    growth: 1.28,
    slice: 0.0,
    wSpin: 0.66,
    twist: 0.91,
    flowSpeed: 1.05,
    flowWarp: 0.56,
    filament: 0.30,
    grain: 0.82,
    timeScale: 1.0,

    cameraMode: "Flow Chase",
    orbitRadius: 3.15,
    orbitSpeed: 0.62,
    orbitHeight: 0.15,
    chaseLag: 6.5,
    fov: 69,

    textureScale: 3.15,
    textureFlow: 0.32,
    textureMix: 0.47,
    roughness: 0.76,
    metallic: 0.06,
    glow: 0.16,
    paletteShift: 0.08,

    exposure: 1.08,
    fog: 0.145,
    lightSpin: 0.08,
    shadow: 0.38,

    normalEps: 0.0017,
    maxDistance: 24,
    renderScale: 0.78,

    texturePreset: "Filament Grain",
    paused: false
  };

  let state = { ...DEFAULT };
  let simTime = 0;
  let lastNow = performance.now();
  let manualYaw = 0.0;
  let manualPitch = 0.0;
  let manualZoom = 1.0;
  let dragging = false;
  let dragX = 0;
  let dragY = 0;
  let smoothCamera = [0.0, 0.0, 1.8];
  let smoothTarget = [0, 0, 0];
  let textureName = "Plasma";
  let customTextureLoaded = false;
  const bindings = new Map();

  const uniforms = {};
  [
    "uResolution", "uTime", "uCameraPos", "uCameraTarget", "uFov",
    "uMode", "uIterations", "uSteps", "uPower", "uBailout", "uScale", "uFold", "uSurface", "uJulia",
    "uGrowth", "uSlice", "uWSpin", "uTwist", "uFlowSpeed", "uFlowWarp", "uFilament", "uGrain",
    "uTexture", "uTextureScale", "uTextureFlow", "uTextureMix", "uRoughness", "uMetallic", "uGlow", "uPaletteShift",
    "uExposure", "uFog", "uLightSpin", "uShadow", "uNormalEps", "uMaxDistance"
  ].forEach(name => uniforms[name] = gl.getUniformLocation(program, name));

  const texture = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.uniform1i(uniforms.uTexture, 0);

  function fract(x) { return x - Math.floor(x); }
  function hash2(x, y) { return fract(Math.sin(x * 127.1 + y * 311.7) * 43758.5453123); }

  function proceduralTexture(kind, size = 256) {
    const data = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; ++y) {
      for (let x = 0; x < size; ++x) {
        const u = x / size;
        const v = y / size;
        const px = u * Math.PI * 2;
        const py = v * Math.PI * 2;
        let r, g, b;
        if (kind === "Filament Grain") {
          const streak = 0.5 + 0.5 * Math.sin(px * 1.7 + Math.sin(py * 4.0) * 2.2);
          const hair = Math.pow(Math.abs(Math.sin(px * 11.0 + py * 2.7)), 7);
          const speck = hash2(x * 0.73 + y * 0.17, y * 0.91 - x * 0.11);
          const grit = Math.pow(speck, 8);
          r = 24 + 154 * streak + 72 * hair + 55 * grit;
          g = 22 + 104 * streak + 90 * hair + 28 * grit;
          b = 34 + 128 * (1 - streak) + 108 * hair + 78 * grit;
        } else if (kind === "Veins") {
          const n = Math.sin(px * 3.0 + Math.sin(py * 5.0)) + Math.sin(py * 4.0 - Math.cos(px * 6.0));
          const q = Math.pow(Math.abs(Math.sin(n * 2.1)), 0.26);
          r = 35 + 170 * q;
          g = 20 + 95 * (1 - q) + 65 * q;
          b = 65 + 185 * (1 - q);
        } else if (kind === "Cells") {
          const gx = u * 18, gy = v * 18;
          const ix = Math.floor(gx), iy = Math.floor(gy);
          let nearest = 10;
          for (let oy = -1; oy <= 1; ++oy) for (let ox = -1; ox <= 1; ++ox) {
            const cx = ix + ox + hash2(ix + ox, iy + oy);
            const cy = iy + oy + hash2(ix + ox + 71, iy + oy + 19);
            nearest = Math.min(nearest, Math.hypot(gx - cx, gy - cy));
          }
          const edge = Math.min(1, nearest * 1.85);
          r = 40 + 190 * edge;
          g = 85 + 130 * (1 - edge);
          b = 120 + 125 * Math.sin(edge * 2.2);
        } else if (kind === "Grid") {
          const line = Math.max(Math.pow(Math.abs(Math.sin(px * 8)), 18), Math.pow(Math.abs(Math.sin(py * 8)), 18));
          const wave = 0.5 + 0.5 * Math.sin(px * 2 + py * 3);
          r = 18 + 165 * line + 55 * wave;
          g = 35 + 195 * line;
          b = 58 + 190 * (1 - line) + 35 * wave;
        } else {
          const a = Math.sin(px * 2.0 + Math.sin(py * 3.0));
          const c = Math.cos(py * 2.5 - Math.cos(px * 4.0));
          const q = 0.5 + 0.25 * a + 0.25 * c;
          r = 40 + 190 * q;
          g = 28 + 145 * (0.5 + 0.5 * Math.sin(q * 7.0 + px));
          b = 72 + 180 * (1 - q);
        }
        const i = (y * size + x) * 4;
        data[i] = Math.max(0, Math.min(255, r));
        data[i + 1] = Math.max(0, Math.min(255, g));
        data[i + 2] = Math.max(0, Math.min(255, b));
        data[i + 3] = 255;
      }
    }
    return { size, data };
  }

  function uploadProcedural(kind) {
    const generated = proceduralTexture(kind);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, generated.size, generated.size, 0, gl.RGBA, gl.UNSIGNED_BYTE, generated.data);
    gl.generateMipmap(gl.TEXTURE_2D);
    textureName = kind;
    customTextureLoaded = false;
    state.texturePreset = kind;
    document.getElementById("texturePreset").value = kind;
    updateStatus();
  }

  function uploadImage(image, name) {
    const maxSide = 2048;
    let source = image;
    if (image.width > maxSide || image.height > maxSide) {
      const scale = Math.min(maxSide / image.width, maxSide / image.height);
      const off = document.createElement("canvas");
      off.width = Math.max(1, Math.round(image.width * scale));
      off.height = Math.max(1, Math.round(image.height * scale));
      off.getContext("2d").drawImage(image, 0, 0, off.width, off.height);
      source = off;
    }
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.generateMipmap(gl.TEXTURE_2D);
    textureName = name || "Custom image";
    customTextureLoaded = true;
    updateStatus();
  }

  function loadTextureFile(file) {
    if (!file || !file.type.startsWith("image/")) return;
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      uploadImage(image, file.name);
      URL.revokeObjectURL(url);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      fatal.textContent = "Could not decode texture: " + file.name;
      fatal.classList.remove("hidden");
      setTimeout(() => fatal.classList.add("hidden"), 2200);
    };
    image.src = url;
  }

  const GROUPS = {
    fractalControls: [
      ["iterations", "Iterations", 2, 24, 1, 0],
      ["power", "Bulb power", 2, 12, 0.05, 2],
      ["bailout", "Bailout", 2, 18, 0.1, 1],
      ["scale", "Domain scale", 0.45, 2.5, 0.01, 2],
      ["fold", "Fold strength", 0, 4, 0.01, 2],
      ["filament", "Filament width", 0.02, 1, 0.01, 2],
      ["surface", "Surface bias", -0.02, 0.04, 0.0005, 4],
      ["juliaX", "Julia X", -1.2, 1.2, 0.005, 3],
      ["juliaY", "Julia Y", -1.2, 1.2, 0.005, 3],
      ["juliaZ", "Julia Z", -1.2, 1.2, 0.005, 3],
      ["juliaW", "Julia W", -1.2, 1.2, 0.005, 3]
    ],
    motionControls: [
      ["growth", "Growth / propagation", 0, 2.5, 0.01, 2],
      ["flowSpeed", "Space flow", 0, 4, 0.01, 2],
      ["flowWarp", "Flow path warp", 0, 1.5, 0.01, 2],
      ["slice", "4D slice W", -1.5, 1.5, 0.005, 3],
      ["wSpin", "4D rotation", -2.5, 2.5, 0.01, 2],
      ["twist", "Domain twist", -2.5, 2.5, 0.01, 2],
      ["timeScale", "Time scale", 0, 3, 0.01, 2]
    ],
    cameraControls: [
      ["orbitRadius", "Follow distance", 0.8, 12, 0.02, 2],
      ["orbitSpeed", "Camera rate", -1.5, 1.5, 0.01, 2],
      ["orbitHeight", "Height", -3, 3, 0.01, 2],
      ["chaseLag", "Chase response", 0.4, 12, 0.1, 1],
      ["fov", "Field of view", 18, 105, 1, 0]
    ],
    materialControls: [
      ["textureScale", "Texture scale", 0.05, 8, 0.01, 2],
      ["textureFlow", "Texture flow", -1.5, 1.5, 0.01, 2],
      ["textureMix", "Texture mix", 0, 1, 0.01, 2],
      ["grain", "Surface grain", 0, 1.5, 0.01, 2],
      ["roughness", "Roughness", 0, 1, 0.01, 2],
      ["metallic", "Metallic", 0, 1, 0.01, 2],
      ["glow", "Emission", 0, 2, 0.01, 2],
      ["paletteShift", "Palette phase", -2, 2, 0.01, 2]
    ],
    lightControls: [
      ["exposure", "Exposure", 0.2, 3, 0.01, 2],
      ["fog", "Distance fog", 0, 0.8, 0.005, 3],
      ["lightSpin", "Light orbit", -1, 1, 0.01, 2],
      ["shadow", "Soft shadow", 0, 1, 0.01, 2]
    ],
    qualityControls: [
      ["steps", "Ray steps", 48, 220, 1, 0],
      ["normalEps", "Normal epsilon", 0.0003, 0.01, 0.0001, 4],
      ["maxDistance", "Max distance", 8, 50, 0.5, 1],
      ["renderScale", "Render scale", 0.35, 1.25, 0.05, 2]
    ]
  };

  function addSlider(container, spec) {
    const [key, labelText, min, max, step, digits] = spec;
    const line = document.createElement("div");
    line.className = "control";
    const label = document.createElement("label");
    label.textContent = labelText;
    label.htmlFor = "ctl-" + key;
    const input = document.createElement("input");
    input.id = "ctl-" + key;
    input.type = "range";
    input.min = min;
    input.max = max;
    input.step = step;
    input.value = state[key];
    const output = document.createElement("output");
    const format = () => digits === 0 ? String(Math.round(Number(state[key]))) : Number(state[key]).toFixed(digits);
    output.textContent = format();
    input.addEventListener("input", () => {
      const value = Number(input.value);
      state[key] = digits === 0 ? Math.round(value) : value;
      output.textContent = format();
      if (key === "renderScale") resize(true);
    });
    line.append(label, input, output);
    container.appendChild(line);
    bindings.set(key, { input, output, digits, format });
  }

  Object.entries(GROUPS).forEach(([id, specs]) => {
    const container = document.getElementById(id);
    specs.forEach(spec => addSlider(container, spec));
  });

  const MODE_NAMES = ["Recursive Flow Filaments", "Quaternion Julia 4D", "Mandelbulb", "Mandelbox", "Folded Loop IFS"];

  const PRESETS = {
    "Flow Chase": {
      fractalMode: 0, iterations: 13, scale: 1.34, filament: 0.30, growth: 1.28, flowSpeed: 1.05, flowWarp: 0.56, twist: 0.91,
      cameraMode: "Flow Chase", orbitRadius: 3.15, orbitSpeed: 0.62, fov: 69, texturePreset: "Filament Grain",
      textureScale: 3.15, textureFlow: 0.32, textureMix: 0.47, grain: 0.82, roughness: 0.76, metallic: 0.06, glow: 0.16, fog: 0.145
    },
    "Fast Thread Tunnel": {
      fractalMode: 0, iterations: 15, scale: 1.52, filament: 0.20, growth: 1.65, flowSpeed: 1.85, flowWarp: 0.78, twist: 1.24,
      cameraMode: "Flythrough", orbitRadius: 2.4, orbitSpeed: 0.9, fov: 78, texturePreset: "Filament Grain",
      textureScale: 4.4, textureFlow: 0.55, textureMix: 0.39, grain: 1.10, roughness: 0.87, metallic: 0.02, glow: 0.10, fog: 0.19
    },
    "Growing Lattice": {
      fractalMode: 0, iterations: 12, scale: 1.18, filament: 0.42, growth: 2.05, flowSpeed: 0.72, flowWarp: 0.42, twist: 0.54,
      cameraMode: "Follow Growth", orbitRadius: 4.0, orbitSpeed: 0.44, fov: 63, texturePreset: "Grid",
      textureScale: 3.7, textureFlow: 0.18, textureMix: 0.30, grain: 0.72, roughness: 0.79, metallic: 0.10, glow: 0.22, fog: 0.12
    },
    "4D Stream": {
      fractalMode: 1, iterations: 13, scale: 1.10, juliaX: -0.08, juliaY: 0.71, juliaZ: 0.12, juliaW: -0.31,
      growth: 1.12, flowSpeed: 0.92, flowWarp: 0.48, slice: 0.24, wSpin: 1.08, twist: 0.88,
      cameraMode: "Flow Chase", orbitRadius: 3.5, orbitSpeed: 0.58, fov: 66, texturePreset: "Veins",
      textureScale: 2.6, textureFlow: -0.13, textureMix: 0.43, grain: 0.66, glow: 0.30, roughness: 0.72, fog: 0.15
    },
    "Mandelbulb Current": {
      fractalMode: 2, iterations: 12, power: 7.6, bailout: 8.0, scale: 1.10, growth: 1.38, flowSpeed: 1.12, flowWarp: 0.36, twist: 0.31,
      cameraMode: "Flythrough", orbitRadius: 3.0, orbitSpeed: 0.71, fov: 72, texturePreset: "Cells",
      textureScale: 2.3, textureFlow: 0.21, textureMix: 0.31, grain: 0.74, roughness: 0.81, metallic: 0.05, glow: 0.12, fog: 0.17
    },
    "Folded River": {
      fractalMode: 4, iterations: 11, scale: 1.30, fold: 1.45, growth: 1.62, flowSpeed: 1.30, flowWarp: 0.64, twist: 1.18,
      cameraMode: "Flow Chase", orbitRadius: 3.4, orbitSpeed: 0.55, fov: 70, texturePreset: "Filament Grain",
      textureScale: 2.0, textureFlow: 0.36, textureMix: 0.55, grain: 0.90, roughness: 0.86, metallic: 0.03, glow: 0.27, fog: 0.13
    }
  };

  const presetSelect = document.getElementById("preset");
  Object.keys(PRESETS).forEach(name => {
    const option = document.createElement("option");
    option.textContent = name;
    presetSelect.appendChild(option);
  });

  function syncUI() {
    bindings.forEach((binding, key) => {
      binding.input.value = state[key];
      binding.output.textContent = binding.format();
    });
    document.getElementById("fractalMode").value = String(state.fractalMode);
    document.getElementById("cameraMode").value = state.cameraMode;
    if (!customTextureLoaded) document.getElementById("texturePreset").value = state.texturePreset;
    document.getElementById("pause").textContent = state.paused ? "Resume" : "Pause";
    document.getElementById("modeBadge").textContent = MODE_NAMES[state.fractalMode] || MODE_NAMES[0];
    document.getElementById("cameraBadge").textContent = state.cameraMode;
  }

  function applyPreset(name) {
    const preset = PRESETS[name];
    if (!preset) return;
    Object.assign(state, preset);
    manualYaw = 0;
    manualPitch = 0;
    manualZoom = 1;
    if (preset.texturePreset) uploadProcedural(preset.texturePreset);
    syncUI();
    resize(true);
    updateStatus();
  }

  function mutate() {
    const jitter = amount => (Math.random() * 2 - 1) * amount;
    state.juliaX = Math.max(-1.2, Math.min(1.2, state.juliaX + jitter(0.16)));
    state.juliaY = Math.max(-1.2, Math.min(1.2, state.juliaY + jitter(0.16)));
    state.juliaZ = Math.max(-1.2, Math.min(1.2, state.juliaZ + jitter(0.16)));
    state.juliaW = Math.max(-1.2, Math.min(1.2, state.juliaW + jitter(0.16)));
    state.slice = Math.max(-1.5, Math.min(1.5, state.slice + jitter(0.25)));
    state.twist = Math.max(-2.5, Math.min(2.5, state.twist + jitter(0.45)));
    state.wSpin = Math.max(-2.5, Math.min(2.5, state.wSpin + jitter(0.35)));
    state.flowSpeed = Math.max(0, Math.min(4, state.flowSpeed + jitter(0.28)));
    state.flowWarp = Math.max(0, Math.min(1.5, state.flowWarp + jitter(0.18)));
    state.filament = Math.max(0.02, Math.min(1, state.filament + jitter(0.10)));
    state.grain = Math.max(0, Math.min(1.5, state.grain + jitter(0.15)));
    state.paletteShift = ((state.paletteShift + jitter(0.7) + 2) % 4) - 2;
    state.textureFlow = Math.max(-1.5, Math.min(1.5, state.textureFlow + jitter(0.18)));
    syncUI();
  }

  document.getElementById("applyPreset").addEventListener("click", () => applyPreset(presetSelect.value));
  document.getElementById("fractalMode").addEventListener("change", event => {
    state.fractalMode = Number(event.target.value);
    syncUI();
    updateStatus();
  });
  document.getElementById("cameraMode").addEventListener("change", event => {
    state.cameraMode = event.target.value;
    syncUI();
    updateStatus();
  });
  document.getElementById("texturePreset").addEventListener("change", event => uploadProcedural(event.target.value));
  document.getElementById("textureFile").addEventListener("change", event => loadTextureFile(event.target.files[0]));
  document.getElementById("randomize").addEventListener("click", mutate);
  document.getElementById("pause").addEventListener("click", () => {
    state.paused = !state.paused;
    syncUI();
  });
  document.getElementById("reset").addEventListener("click", () => {
    state = { ...DEFAULT };
    simTime = 0;
    manualYaw = manualPitch = 0;
    manualZoom = 1;
    uploadProcedural(state.texturePreset);
    syncUI();
    resize(true);
  });
  document.getElementById("recenter").addEventListener("click", () => {
    manualYaw = manualPitch = 0;
    manualZoom = 1;
  });

  document.getElementById("toggleUi").addEventListener("click", () => document.body.classList.toggle("uiHidden"));
  document.getElementById("fullscreen").addEventListener("click", () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
    else document.exitFullscreen?.();
  });

  document.getElementById("shot").addEventListener("click", () => {
    const link = document.createElement("a");
    link.download = "recovered-fractal-" + new Date().toISOString().replace(/[:.]/g, "-") + ".png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  });

  function exportedState() {
    const out = {};
    Object.keys(DEFAULT).forEach(key => out[key] = state[key]);
    out.texturePreset = customTextureLoaded ? "Custom image (not embedded)" : state.texturePreset;
    out.reconstructionVersion = 2;
    return out;
  }

  document.getElementById("exportState").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(exportedState(), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.download = "fractal-state.json";
    link.href = url;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  document.getElementById("copyState").addEventListener("click", async () => {
    const text = JSON.stringify(exportedState(), null, 2);
    try {
      await navigator.clipboard.writeText(text);
      document.getElementById("status").textContent = "settings copied";
    } catch {
      window.prompt("Copy settings JSON:", text);
    }
  });

  document.getElementById("importState").addEventListener("change", event => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const incoming = JSON.parse(String(reader.result));
        Object.keys(DEFAULT).forEach(key => {
          if (Object.prototype.hasOwnProperty.call(incoming, key) && typeof incoming[key] === typeof DEFAULT[key]) {
            state[key] = incoming[key];
          }
        });
        if (["Filament Grain", "Plasma", "Veins", "Cells", "Grid"].includes(state.texturePreset)) uploadProcedural(state.texturePreset);
        syncUI();
        resize(true);
      } catch (error) {
        fatal.textContent = "State import failed:\n\n" + error.message;
        fatal.classList.remove("hidden");
        setTimeout(() => fatal.classList.add("hidden"), 2500);
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  });

  canvas.addEventListener("pointerdown", event => {
    dragging = true;
    dragX = event.clientX;
    dragY = event.clientY;
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener("pointermove", event => {
    if (!dragging) return;
    const dx = event.clientX - dragX;
    const dy = event.clientY - dragY;
    dragX = event.clientX;
    dragY = event.clientY;
    manualYaw += dx * 0.006;
    manualPitch = Math.max(-1.35, Math.min(1.35, manualPitch + dy * 0.006));
  });
  canvas.addEventListener("pointerup", event => {
    dragging = false;
    canvas.releasePointerCapture?.(event.pointerId);
  });
  canvas.addEventListener("pointercancel", () => dragging = false);
  canvas.addEventListener("wheel", event => {
    event.preventDefault();
    manualZoom *= Math.exp(event.deltaY * 0.001);
    manualZoom = Math.max(0.35, Math.min(3.5, manualZoom));
  }, { passive: false });

  ["dragenter", "dragover"].forEach(type => window.addEventListener(type, event => {
    event.preventDefault();
    document.body.classList.add("dropActive");
  }));
  ["dragleave", "drop"].forEach(type => window.addEventListener(type, event => {
    event.preventDefault();
    document.body.classList.remove("dropActive");
  }));
  window.addEventListener("drop", event => {
    const file = Array.from(event.dataTransfer?.files || []).find(f => f.type.startsWith("image/"));
    if (file) loadTextureFile(file);
  });

  window.addEventListener("keydown", event => {
    const tag = event.target?.tagName;
    if (tag === "INPUT" || tag === "SELECT") return;
    if (event.code === "Space") {
      event.preventDefault();
      state.paused = !state.paused;
      syncUI();
    } else if (event.key.toLowerCase() === "r") {
      mutate();
    } else if (event.key.toLowerCase() === "h") {
      document.body.classList.toggle("uiHidden");
    } else if (event.key.toLowerCase() === "f") {
      if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
      else document.exitFullscreen?.();
    } else if (/^[1-6]$/.test(event.key)) {
      const name = Object.keys(PRESETS)[Number(event.key) - 1];
      if (name) {
        presetSelect.value = name;
        applyPreset(name);
      }
    }
  });

  function v3(x, y, z) { return [x, y, z]; }
  function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
  function scale(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; }
  function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }

  function orbitPosition(angle, radius, height) {
    const cp = Math.cos(manualPitch);
    return [
      Math.cos(angle + manualYaw) * radius * cp,
      height + Math.sin(manualPitch) * radius * 0.72,
      Math.sin(angle + manualYaw) * radius * cp
    ];
  }

  function flowPath(t, lead = 0, rate = 0.80) {
    const travel = (t + lead) * state.flowSpeed * rate;
    const z = -travel;
    const advectedZ = z + t * state.flowSpeed;
    const x = (Math.sin(advectedZ * 0.21) + 0.45 * Math.sin(advectedZ * 0.57 + 1.2)) * state.flowWarp;
    const y = (Math.cos(advectedZ * 0.17 + 0.7) + 0.35 * Math.sin(advectedZ * 0.43 - 0.4)) * state.flowWarp;
    return [x, y + state.orbitHeight * 0.18, z];
  }

  function cameraForTime(t, dt) {
    const radius = state.orbitRadius * manualZoom;
    let desiredPos;
    let desiredTarget;

    if (state.cameraMode === "Flow Chase") {
      desiredPos = flowPath(t, -0.55 - radius * 0.05, 0.78);
      desiredTarget = flowPath(t, 1.05, 0.78);
      desiredPos[0] += Math.sin(manualYaw) * radius * 0.18;
      desiredPos[1] += Math.sin(manualPitch) * radius * 0.18;
    } else if (state.cameraMode === "Flythrough") {
      const rate = 0.48 + 0.14 * Math.abs(state.orbitSpeed);
      desiredPos = flowPath(t, 0.0, rate);
      desiredTarget = flowPath(t, 1.45, rate);
      desiredPos[0] += Math.sin(manualYaw) * 0.45;
      desiredPos[1] += Math.sin(manualPitch) * 0.38;
    } else if (state.cameraMode === "Follow Growth") {
      desiredPos = flowPath(t, -1.4, 0.96);
      desiredTarget = flowPath(t, 1.8 + 0.35 * state.growth, 0.96);
      const roll = t * state.orbitSpeed * 0.42 + manualYaw;
      desiredPos[0] += Math.cos(roll) * radius * 0.18;
      desiredPos[1] += Math.sin(roll + manualPitch) * radius * 0.14;
    } else if (state.cameraMode === "Observer") {
      desiredTarget = flowPath(t, 0.0, 0.84);
      desiredPos = add(desiredTarget, orbitPosition(manualYaw, radius, state.orbitHeight));
    } else if (state.cameraMode === "Chase") {
      desiredTarget = flowPath(t, 0.65, 0.70);
      desiredPos = flowPath(t, -0.85, 0.70);
      const sway = t * (0.42 + Math.abs(state.orbitSpeed) * 0.7);
      desiredPos[0] += Math.sin(sway * 1.13 + manualYaw) * radius * 0.22;
      desiredPos[1] += Math.sin(sway * 0.71 + manualPitch) * radius * 0.12;
    } else if (state.cameraMode === "Lissajous") {
      desiredTarget = flowPath(t, 0.4, 0.86);
      const phase = t * (0.20 + Math.abs(state.orbitSpeed) * 0.46);
      desiredPos = add(desiredTarget, [
        Math.sin(phase * 1.37 + manualYaw) * radius,
        Math.sin(phase * 0.83 + manualPitch) * radius * 0.34,
        Math.cos(phase * 1.09 + manualYaw * 0.7) * radius
      ]);
    } else if (state.cameraMode === "4D Lock") {
      desiredTarget = flowPath(t, 0.35, 0.88);
      const angle = t * state.wSpin * 0.37 + t * state.orbitSpeed + manualYaw;
      desiredPos = add(desiredTarget, orbitPosition(angle, radius, state.orbitHeight + Math.sin(t * state.wSpin * 0.19) * 0.45));
    } else {
      desiredTarget = flowPath(t, 0.0, 0.88);
      const angle = t * state.orbitSpeed + manualYaw;
      desiredPos = add(desiredTarget, orbitPosition(angle, radius, state.orbitHeight));
    }

    const response = 1 - Math.exp(-Math.max(0.001, dt) * state.chaseLag);
    smoothCamera = mix(smoothCamera, desiredPos, response);
    smoothTarget = mix(smoothTarget, desiredTarget, response);
    return { pos: smoothCamera, target: smoothTarget };
  }

  function resize(force = false) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2.0);
    const scaleFactor = Math.max(0.35, Math.min(1.25, state.renderScale));
    const width = Math.max(2, Math.floor(innerWidth * dpr * scaleFactor));
    const height = Math.max(2, Math.floor(innerHeight * dpr * scaleFactor));
    if (force || canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
      document.getElementById("resolution").textContent = width + " × " + height;
    }
  }
  window.addEventListener("resize", () => resize(true));

  function uniform1f(name, value) { gl.uniform1f(uniforms[name], value); }
  function uniform1i(name, value) { gl.uniform1i(uniforms[name], value); }

  function sendUniforms(camera) {
    gl.uniform2f(uniforms.uResolution, canvas.width, canvas.height);
    uniform1f("uTime", simTime);
    gl.uniform3f(uniforms.uCameraPos, camera.pos[0], camera.pos[1], camera.pos[2]);
    gl.uniform3f(uniforms.uCameraTarget, camera.target[0], camera.target[1], camera.target[2]);
    uniform1f("uFov", state.fov);

    uniform1i("uMode", state.fractalMode);
    uniform1i("uIterations", state.iterations);
    uniform1i("uSteps", state.steps);
    uniform1f("uPower", state.power);
    uniform1f("uBailout", state.bailout);
    uniform1f("uScale", state.scale);
    uniform1f("uFold", state.fold);
    uniform1f("uSurface", state.surface);
    gl.uniform4f(uniforms.uJulia, state.juliaX, state.juliaY, state.juliaZ, state.juliaW);

    uniform1f("uGrowth", state.growth);
    uniform1f("uSlice", state.slice);
    uniform1f("uWSpin", state.wSpin);
    uniform1f("uTwist", state.twist);
    uniform1f("uFlowSpeed", state.flowSpeed);
    uniform1f("uFlowWarp", state.flowWarp);
    uniform1f("uFilament", state.filament);
    uniform1f("uGrain", state.grain);

    uniform1f("uTextureScale", state.textureScale);
    uniform1f("uTextureFlow", state.textureFlow);
    uniform1f("uTextureMix", state.textureMix);
    uniform1f("uRoughness", state.roughness);
    uniform1f("uMetallic", state.metallic);
    uniform1f("uGlow", state.glow);
    uniform1f("uPaletteShift", state.paletteShift);

    uniform1f("uExposure", state.exposure);
    uniform1f("uFog", state.fog);
    uniform1f("uLightSpin", state.lightSpin);
    uniform1f("uShadow", state.shadow);
    uniform1f("uNormalEps", state.normalEps);
    uniform1f("uMaxDistance", state.maxDistance);
  }

  let fpsFrames = 0;
  let fpsStart = performance.now();
  let fpsValue = 0;

  function updateStatus() {
    document.getElementById("status").textContent =
      "WebGL2 · " + MODE_NAMES[state.fractalMode] + " · " + state.cameraMode + " · tex " + textureName;
    document.getElementById("modeBadge").textContent = MODE_NAMES[state.fractalMode];
    document.getElementById("cameraBadge").textContent = state.cameraMode;
  }

  function frame(now) {
    resize();
    const dt = Math.min(0.05, Math.max(0.0001, (now - lastNow) / 1000));
    lastNow = now;
    if (!state.paused) simTime += dt * state.timeScale;

    const camera = cameraForTime(simTime, dt);
    gl.useProgram(program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    sendUniforms(camera);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    fpsFrames++;
    if (now - fpsStart > 500) {
      fpsValue = fpsFrames * 1000 / (now - fpsStart);
      fpsFrames = 0;
      fpsStart = now;
      document.getElementById("fps").textContent = fpsValue.toFixed(1) + " fps";
    }
    document.getElementById("timeReadout").textContent = "t " + simTime.toFixed(2);

    requestAnimationFrame(frame);
  }

  canvas.addEventListener("webglcontextlost", event => {
    event.preventDefault();
    fatal.textContent = "WebGL context lost. Reload the page to rebuild the renderer.";
    fatal.classList.remove("hidden");
  });

  uploadProcedural("Filament Grain");
  syncUI();
  resize(true);
  updateStatus();
  smoothCamera = flowPath(0, -0.55, 0.78);
  requestAnimationFrame(frame);
})();
