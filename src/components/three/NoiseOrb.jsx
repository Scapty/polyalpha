import { useRef, useMemo, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

/* ── GLSL: Classic 3D simplex noise (Ashima) ── */
const noiseGLSL = `
  vec3 mod289(vec3 x){ return x - floor(x * (1.0/289.0)) * 289.0; }
  vec4 mod289(vec4 x){ return x - floor(x * (1.0/289.0)) * 289.0; }
  vec4 permute(vec4 x){ return mod289(((x*34.0)+1.0)*x); }
  vec4 taylorInvSqrt(vec4 r){ return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v){
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g  = step(x0.yzx, x0.xyz);
    vec3 l  = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod289(i);
    vec4 p = permute(permute(permute(
      i.z + vec4(0.0, i1.z, i2.z, 1.0))
    + i.y + vec4(0.0, i1.y, i2.y, 1.0))
    + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j  = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x  = x_ * ns.x + ns.yyyy;
    vec4 y  = y_ * ns.x + ns.yyyy;
    vec4 h  = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
  }
`;

/* ── Vertex: displace sphere with layered noise ── */
const vertexShader = `
  ${noiseGLSL}
  uniform float uTime;
  uniform float uNoiseScale;
  uniform float uDisplacement;
  varying float vDisplacement;
  varying vec3 vNormal;
  varying vec3 vWorldPos;

  void main() {
    vNormal = normalize(normalMatrix * normal);

    // Layered noise for organic displacement
    float n1 = snoise(normal * uNoiseScale + uTime * 0.15) * 0.6;
    float n2 = snoise(normal * uNoiseScale * 2.0 + uTime * 0.25) * 0.3;
    float n3 = snoise(normal * uNoiseScale * 4.0 + uTime * 0.35) * 0.1;
    float noise = n1 + n2 + n3;

    // Pulse: subtle breathing
    float pulse = sin(uTime * 0.8) * 0.04 + 1.0;

    float disp = noise * uDisplacement * pulse;
    vDisplacement = disp;

    vec3 newPos = position + normal * disp;
    vWorldPos = (modelMatrix * vec4(newPos, 1.0)).xyz;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(newPos, 1.0);
  }
`;

/* ── Fragment: teal fresnel glow with displacement coloring ── */
const fragmentShader = `
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform vec3 uGlowColor;
  uniform float uTime;
  varying float vDisplacement;
  varying vec3 vNormal;
  varying vec3 vWorldPos;

  void main() {
    // View direction for fresnel
    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    float fresnel = pow(1.0 - max(dot(vNormal, viewDir), 0.0), 2.5);

    // Map displacement to color gradient
    float t = smoothstep(-0.3, 0.3, vDisplacement);
    vec3 baseColor = mix(uColorA, uColorB, t);

    // Rim glow
    vec3 glow = uGlowColor * fresnel * 0.8;

    // Subtle scan line effect
    float scan = sin(vWorldPos.y * 20.0 + uTime * 2.0) * 0.03 + 1.0;

    vec3 finalColor = baseColor * scan + glow;
    float alpha = 0.75 + fresnel * 0.25;

    gl_FragColor = vec4(finalColor, alpha);
  }
`;

/* ── Outer glow ring (additive) ── */
const glowVertexShader = `
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const glowFragmentShader = `
  uniform vec3 uGlowColor;
  uniform float uTime;
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  void main() {
    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    float fresnel = pow(1.0 - max(dot(vNormal, viewDir), 0.0), 3.0);
    float pulse = sin(uTime * 0.6) * 0.15 + 0.85;
    float alpha = fresnel * 0.4 * pulse;
    gl_FragColor = vec4(uGlowColor, alpha);
  }
`;

function Orb() {
  const meshRef = useRef();
  const glowRef = useRef();
  const mouseRef = useRef({ x: 0, y: 0 });
  const smoothMouse = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (isMobile) return;
    const onMove = (e) => {
      mouseRef.current.x = (e.clientX / window.innerWidth - 0.5) * 2;
      mouseRef.current.y = -(e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  const orbMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: {
          uTime: { value: 0 },
          uNoiseScale: { value: 1.5 },
          uDisplacement: { value: 0.35 },
          uColorA: { value: new THREE.Color("#0a2a22") },
          uColorB: { value: new THREE.Color("#2DD4A8") },
          uGlowColor: { value: new THREE.Color("#2DD4A8") },
        },
        transparent: true,
        depthWrite: false,
        side: THREE.FrontSide,
      }),
    []
  );

  const glowMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: glowVertexShader,
        fragmentShader: glowFragmentShader,
        uniforms: {
          uGlowColor: { value: new THREE.Color("#2DD4A8") },
          uTime: { value: 0 },
        },
        transparent: true,
        depthWrite: false,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
      }),
    []
  );

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    orbMaterial.uniforms.uTime.value = t;
    glowMaterial.uniforms.uTime.value = t;

    // Smooth mouse follow
    const lerp = 0.03;
    smoothMouse.current.x += (mouseRef.current.x - smoothMouse.current.x) * lerp;
    smoothMouse.current.y += (mouseRef.current.y - smoothMouse.current.y) * lerp;

    if (meshRef.current) {
      meshRef.current.rotation.y = t * 0.08;
      meshRef.current.rotation.x = Math.sin(t * 0.05) * 0.15;

      // Subtle mouse-driven tilt
      meshRef.current.rotation.z = smoothMouse.current.x * 0.1;
      meshRef.current.position.x = 2.5 + smoothMouse.current.x * 0.3;
      meshRef.current.position.y = 0.2 + smoothMouse.current.y * 0.2;
    }

    if (glowRef.current) {
      glowRef.current.rotation.copy(meshRef.current.rotation);
      glowRef.current.position.copy(meshRef.current.position);
    }
  });

  const radius = isMobile ? 1.3 : 1.8;

  return (
    <>
      <mesh ref={meshRef} material={orbMaterial} position={[2.5, 0.2, 0]}>
        <icosahedronGeometry args={[radius, 64]} />
      </mesh>
      <mesh ref={glowRef} material={glowMaterial} position={[2.5, 0.2, 0]}>
        <icosahedronGeometry args={[radius * 1.15, 32]} />
      </mesh>
    </>
  );
}

export default function NoiseOrb() {
  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        zIndex: 0,
        pointerEvents: "none",
      }}
    >
      <Canvas
        camera={{ position: [0, 0, 8], fov: 50, near: 0.1, far: 50 }}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
        }}
        dpr={isMobile ? 1 : Math.min(window.devicePixelRatio, 1.5)}
        style={{ background: "transparent" }}
      >
        <Orb />
      </Canvas>
    </div>
  );
}
