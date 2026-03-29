import { useEffect, useRef } from "react";
import * as THREE from "three";
import {
  EffectComposer,
  RenderPass,
  EffectPass,
  BloomEffect,
  VignetteEffect,
} from "postprocessing";

// ─── GLSL: 3D Simplex Noise (Ashima) ────────────────────────────────────────
const noiseGLSL = /* glsl */ `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}

float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0);
  const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy));
  vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);
  vec3 l=1.0-g;
  vec3 i1=min(g.xyz,l.zxy);
  vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;
  vec3 x2=x0-i2+C.yyy;
  vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(
    i.z+vec4(0.0,i1.z,i2.z,1.0))
    +i.y+vec4(0.0,i1.y,i2.y,1.0))
    +i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857;
  vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z);
  vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy;
  vec4 y=y_*ns.x+ns.yyyy;
  vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);
  vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0;
  vec4 s1=floor(b1)*2.0+1.0;
  vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
  vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);
  vec3 p1=vec3(a0.zw,h.y);
  vec3 p2=vec3(a1.xy,h.z);
  vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);
  m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
`;

// ─── Terrain Vertex Shader ───────────────────────────────────────────────────
const terrainVertex = /* glsl */ `
${noiseGLSL}

uniform float uTime;
uniform vec2 uMouseXZ;
uniform float uMouseActive;

varying float vHeight;
varying vec2 vGridPos;
varying float vFogDepth;

void main() {
  // position.x/z are the grid coordinates (PlaneGeometry rotated to XZ)
  vec2 gp = position.xz;
  vGridPos = gp;

  // Center valley: flatten the middle where DEXIO text lives
  float centerDist = length(gp * vec2(0.65, 1.0)); // wider on X
  float valley = smoothstep(2.0, 6.0, centerDist);

  // Multi-octave noise displacement (the "market data")
  float t = uTime * 0.2;
  float n1 = snoise(vec3(gp * 0.28 + vec2(t * 0.3, t * 0.2), t * 0.15)) * 2.0;
  float n2 = snoise(vec3(gp * 0.55 + vec2(t * 0.2, t * 0.4), t * 0.25)) * 0.9;
  float n3 = snoise(vec3(gp * 1.1 + vec2(t * 0.5, t * 0.1), t * 0.35)) * 0.35;
  float height = (n1 + n2 + n3) * valley;

  // Edge fade: reduce height at terrain borders
  float edgeFade = smoothstep(16.0, 10.0, max(abs(gp.x), abs(gp.y)));
  height *= edgeFade;

  // Mouse ripple
  float mouseDist = length(gp - uMouseXZ);
  float ripple = sin(mouseDist * 5.0 - uTime * 3.5) * exp(-mouseDist * 0.35) * uMouseActive * 0.25;
  height += ripple * valley;

  // Ensure valley floor is near 0
  height = max(height, -0.1);

  vHeight = height;

  vec3 displaced = vec3(position.x, height, position.z);
  vec4 mvPosition = modelViewMatrix * vec4(displaced, 1.0);
  vFogDepth = -mvPosition.z;

  gl_Position = projectionMatrix * mvPosition;
}
`;

// ─── Terrain Fragment Shader ─────────────────────────────────────────────────
const terrainFragment = /* glsl */ `
uniform float uTime;
uniform vec3 uAccent;
uniform vec3 uGridColor;
uniform vec3 uFogColor;
uniform float uFogNear;
uniform float uFogFar;

varying float vHeight;
varying vec2 vGridPos;
varying float vFogDepth;

void main() {
  // Height-normalized (0 = valley floor, 1 = tallest peaks)
  float hn = smoothstep(-0.1, 2.5, vHeight);

  // Base color: very dark
  vec3 baseCol = vec3(0.022, 0.022, 0.028);

  // Surface color: blend dark base toward accent on peaks
  vec3 surfaceCol = mix(baseCol, uAccent * 0.35, hn * hn);

  // Grid lines (anti-aliased via fwidth)
  float gridScale = 0.8;
  vec2 gridUv = vGridPos * gridScale;
  vec2 gridAbs = abs(fract(gridUv - 0.5) - 0.5);
  vec2 gridW = fwidth(gridUv) * 1.2;
  float gridX = smoothstep(gridW.x, gridW.x * 0.3, gridAbs.x);
  float gridZ = smoothstep(gridW.y, gridW.y * 0.3, gridAbs.y);
  float grid = max(gridX, gridZ);

  // Grid color: dim by default, brighter/accent-tinted on peaks
  vec3 gridCol = mix(uGridColor * 0.5, uAccent * 0.4, hn * 0.6);
  surfaceCol = mix(surfaceCol, gridCol, grid * 0.75);

  // Peak glow: bright accent on high points
  surfaceCol += uAccent * hn * hn * hn * 0.3;

  // Subtle ridge highlight (derivative-based)
  float dx = dFdx(vHeight);
  float dz = dFdy(vHeight);
  float slope = length(vec2(dx, dz));
  surfaceCol += uAccent * slope * 0.15;

  // Fog
  float fog = smoothstep(uFogNear, uFogFar, vFogDepth);
  surfaceCol = mix(surfaceCol, uFogColor, fog);

  gl_FragColor = vec4(surfaceCol, 1.0);
}
`;

// ─── Data Pin Vertex Shader ──────────────────────────────────────────────────
const pinVertex = /* glsl */ `
attribute float aAlpha;
varying float vAlpha;
void main() {
  vAlpha = aAlpha;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
}
`;

const pinFragment = /* glsl */ `
uniform vec3 uColor;
varying float vAlpha;
void main() {
  gl_FragColor = vec4(uColor, vAlpha);
}
`;

// ─── Data Pin Dot Shaders ────────────────────────────────────────────────────
const dotVertex = /* glsl */ `
attribute float aSize;
uniform float uPixelRatio;
uniform float uTime;
varying float vPulse;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float pulse = 0.8 + sin(uTime * 2.0 + position.x * 3.0) * 0.2;
  vPulse = pulse;
  gl_PointSize = aSize * uPixelRatio * (120.0 / -mv.z) * pulse;
  gl_Position = projectionMatrix * mv;
}
`;

const dotFragment = /* glsl */ `
uniform vec3 uColor;
varying float vPulse;
void main() {
  float d = length(gl_PointCoord - 0.5);
  if (d > 0.5) discard;
  float alpha = smoothstep(0.5, 0.05, d);
  // Bright core, soft glow
  float core = smoothstep(0.25, 0.0, d);
  vec3 col = mix(uColor * 0.7, vec3(1.0), core * 0.6);
  gl_FragColor = vec4(col, alpha * vPulse);
}
`;

// ─── Rising Particle Shaders ─────────────────────────────────────────────────
const risingVertex = /* glsl */ `
attribute float aSize;
attribute float aSpeed;
attribute float aOffset;
uniform float uTime;
uniform float uPixelRatio;
varying float vAlpha;

void main() {
  vec3 pos = position;

  // Rise upward, loop
  float cycle = mod(uTime * aSpeed + aOffset, 1.0);
  pos.y += cycle * 4.0;

  vec4 mv = modelViewMatrix * vec4(pos, 1.0);

  // Fade in at bottom, fade out at top
  vAlpha = sin(cycle * 3.14159) * 0.5;

  float dist = -mv.z;
  gl_PointSize = aSize * uPixelRatio * (60.0 / dist);
  gl_Position = projectionMatrix * mv;
}
`;

const risingFragment = /* glsl */ `
uniform vec3 uColor;
varying float vAlpha;
void main() {
  float d = length(gl_PointCoord - 0.5);
  if (d > 0.5) discard;
  float alpha = smoothstep(0.5, 0.15, d) * vAlpha;
  gl_FragColor = vec4(uColor, alpha);
}
`;

// ─── PIN DATA (positions + tip heights for data markers on terrain) ──────────
const PIN_DATA = [
  { x: -6.5, z: -4.5, tipY: 3.8 },
  { x: 5.0, z: -6.0, tipY: 3.2 },
  { x: -4.0, z: 6.0, tipY: 4.0 },
  { x: 7.5, z: 2.0, tipY: 2.8 },
  { x: -7.5, z: -1.5, tipY: 3.4 },
  { x: 6.0, z: 5.0, tipY: 3.6 },
  { x: -3.5, z: -7.5, tipY: 2.9 },
  { x: 8.0, z: -3.0, tipY: 3.1 },
];

// ─── MAIN COMPONENT ─────────────────────────────────────────────────────────
export default function ThreeScene({ scrollProgress = 0 }) {
  const containerRef = useRef(null);
  const mouseRef = useRef({ x: 0, y: 0, tx: 0, ty: 0, worldX: 0, worldZ: 0, active: 0 });
  const frameRef = useRef(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const isMobile = window.innerWidth < 768;

    // ─── Scene ─────────────────────────────────────────────────────
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x09090b);

    // Camera: elevated angle looking across terrain
    const camera = new THREE.PerspectiveCamera(
      50,
      window.innerWidth / window.innerHeight,
      0.1,
      80
    );
    camera.position.set(0, 7.5, 13);
    camera.lookAt(0, 0, -2);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    container.appendChild(renderer.domElement);

    const accentColor = new THREE.Color(0x4f46e5);

    // ─── Terrain ───────────────────────────────────────────────────
    const gridRes = isMobile ? 80 : 120;
    const terrainGeo = new THREE.PlaneGeometry(32, 32, gridRes, gridRes);
    terrainGeo.rotateX(-Math.PI / 2);

    const terrainUniforms = {
      uTime: { value: 0 },
      uMouseXZ: { value: new THREE.Vector2(0, 0) },
      uMouseActive: { value: 0 },
      uAccent: { value: accentColor },
      uGridColor: { value: new THREE.Color(0x27272a) },
      uFogColor: { value: new THREE.Color(0x09090b) },
      uFogNear: { value: 15 },
      uFogFar: { value: 35 },
    };

    const terrainMat = new THREE.ShaderMaterial({
      vertexShader: terrainVertex,
      fragmentShader: terrainFragment,
      uniforms: terrainUniforms,
      side: THREE.DoubleSide,
    });

    const terrain = new THREE.Mesh(terrainGeo, terrainMat);
    scene.add(terrain);

    // ─── Data Pins (vertical lines + glowing dots) ─────────────────
    // Lines: from below terrain to tip
    const linePositions = [];
    const lineAlphas = [];
    const dotPositions = [];
    const dotSizes = [];

    PIN_DATA.forEach((pin) => {
      // Line from y=-1 (hidden below surface) to tipY
      linePositions.push(pin.x, -1, pin.z);
      linePositions.push(pin.x, pin.tipY, pin.z);
      lineAlphas.push(0.0, 0.35);

      // Dot at tip
      dotPositions.push(pin.x, pin.tipY, pin.z);
      dotSizes.push(2.5 + Math.random() * 1.5);
    });

    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute("position", new THREE.Float32BufferAttribute(linePositions, 3));
    lineGeo.setAttribute("aAlpha", new THREE.Float32BufferAttribute(lineAlphas, 1));

    const lineMat = new THREE.ShaderMaterial({
      vertexShader: pinVertex,
      fragmentShader: pinFragment,
      uniforms: { uColor: { value: accentColor.clone().multiplyScalar(0.5) } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const pinLines = new THREE.LineSegments(lineGeo, lineMat);
    scene.add(pinLines);

    // Dot tips
    const dotGeo = new THREE.BufferGeometry();
    dotGeo.setAttribute("position", new THREE.Float32BufferAttribute(dotPositions, 3));
    dotGeo.setAttribute("aSize", new THREE.Float32BufferAttribute(dotSizes, 1));

    const dotMat = new THREE.ShaderMaterial({
      vertexShader: dotVertex,
      fragmentShader: dotFragment,
      uniforms: {
        uColor: { value: accentColor },
        uTime: { value: 0 },
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const pinDots = new THREE.Points(dotGeo, dotMat);
    scene.add(pinDots);

    // ─── Rising Particles (data dust from peaks) ───────────────────
    const rCount = isMobile ? 30 : 60;
    const rPositions = new Float32Array(rCount * 3);
    const rSizes = new Float32Array(rCount);
    const rSpeeds = new Float32Array(rCount);
    const rOffsets = new Float32Array(rCount);

    for (let i = 0; i < rCount; i++) {
      // Bias positions away from center (where peaks are)
      const angle = Math.random() * Math.PI * 2;
      const radius = 3 + Math.random() * 9;
      rPositions[i * 3] = Math.cos(angle) * radius;
      rPositions[i * 3 + 1] = Math.random() * 1.5; // start near terrain
      rPositions[i * 3 + 2] = Math.sin(angle) * radius;
      rSizes[i] = 0.8 + Math.random() * 1.2;
      rSpeeds[i] = 0.08 + Math.random() * 0.12;
      rOffsets[i] = Math.random();
    }

    const rGeo = new THREE.BufferGeometry();
    rGeo.setAttribute("position", new THREE.Float32BufferAttribute(rPositions, 3));
    rGeo.setAttribute("aSize", new THREE.Float32BufferAttribute(rSizes, 1));
    rGeo.setAttribute("aSpeed", new THREE.Float32BufferAttribute(rSpeeds, 1));
    rGeo.setAttribute("aOffset", new THREE.Float32BufferAttribute(rOffsets, 1));

    const rMat = new THREE.ShaderMaterial({
      vertexShader: risingVertex,
      fragmentShader: risingFragment,
      uniforms: {
        uColor: { value: new THREE.Color(0x4f46e5).multiplyScalar(0.6) },
        uTime: { value: 0 },
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const risingParticles = new THREE.Points(rGeo, rMat);
    scene.add(risingParticles);

    // ─── Post-Processing ───────────────────────────────────────────
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));

    const bloom = new BloomEffect({
      intensity: 0.8,
      luminanceThreshold: 0.25,
      luminanceSmoothing: 0.6,
      mipmapBlur: true,
    });

    const vignette = new VignetteEffect({
      darkness: 0.5,
      offset: 0.35,
    });

    composer.addPass(new EffectPass(camera, bloom, vignette));

    // ─── Mouse tracking → terrain XZ ──────────────────────────────
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const raycaster = new THREE.Raycaster();
    const mouseNDC = new THREE.Vector2();
    const intersectPt = new THREE.Vector3();

    const handleMouseMove = (e) => {
      mouseRef.current.tx = (e.clientX / window.innerWidth) * 2 - 1;
      mouseRef.current.ty = -(e.clientY / window.innerHeight) * 2 + 1;
    };
    window.addEventListener("mousemove", handleMouseMove);

    // ─── Resize ────────────────────────────────────────────────────
    const handleResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      composer.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    // ─── Animation Loop ────────────────────────────────────────────
    const clock = new THREE.Clock();
    const baseCamY = camera.position.y;
    const baseCamZ = camera.position.z;

    function animate() {
      frameRef.current = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();

      // Smooth mouse
      mouseRef.current.x += (mouseRef.current.tx - mouseRef.current.x) * 0.06;
      mouseRef.current.y += (mouseRef.current.ty - mouseRef.current.y) * 0.06;

      // Project mouse to terrain plane
      mouseNDC.set(mouseRef.current.x, mouseRef.current.y);
      raycaster.setFromCamera(mouseNDC, camera);
      if (raycaster.ray.intersectPlane(groundPlane, intersectPt)) {
        mouseRef.current.worldX = intersectPt.x;
        mouseRef.current.worldZ = intersectPt.z;
        mouseRef.current.active += (1 - mouseRef.current.active) * 0.05;
      }

      // Update terrain
      terrainUniforms.uTime.value = elapsed;
      terrainUniforms.uMouseXZ.value.set(mouseRef.current.worldX, mouseRef.current.worldZ);
      terrainUniforms.uMouseActive.value = mouseRef.current.active;

      // Update pin dots
      dotMat.uniforms.uTime.value = elapsed;

      // Update rising particles
      rMat.uniforms.uTime.value = elapsed;

      // Camera: subtle drift with mouse + parallax
      camera.position.x = mouseRef.current.x * 1.2;
      camera.position.y = baseCamY + mouseRef.current.y * 0.4;
      camera.lookAt(mouseRef.current.x * 0.5, 0, -2);

      composer.render();
    }
    animate();

    // ─── Cleanup ───────────────────────────────────────────────────
    return () => {
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("resize", handleResize);
      terrainGeo.dispose();
      terrainMat.dispose();
      lineGeo.dispose();
      lineMat.dispose();
      dotGeo.dispose();
      dotMat.dispose();
      rGeo.dispose();
      rMat.dispose();
      renderer.dispose();
      composer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        zIndex: 0,
        opacity: Math.max(0, 1 - scrollProgress * 2),
        pointerEvents: "none",
      }}
    />
  );
}
