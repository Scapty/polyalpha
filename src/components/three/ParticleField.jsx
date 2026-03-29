import { useRef, useMemo, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
const COUNT = isMobile ? 600 : 1800;

// Subtle particle shader — renders tiny circular dots
const vertexShader = `
  attribute float aSize;
  attribute float aAlpha;
  varying float vAlpha;
  void main() {
    vAlpha = aAlpha;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (200.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const fragmentShader = `
  varying float vAlpha;
  uniform vec3 uColor;
  void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;
    float alpha = smoothstep(0.5, 0.1, d) * vAlpha;
    gl_FragColor = vec4(uColor, alpha);
  }
`;

function Particles({ pageMode }) {
  const pointsRef = useRef();
  const mouseRef = useRef({ x: 0, y: 0 });
  const pageModeRef = useRef(pageMode);

  useEffect(() => { pageModeRef.current = pageMode; }, [pageMode]);

  useEffect(() => {
    if (isMobile) return;
    const onMove = (e) => {
      mouseRef.current.x = (e.clientX / window.innerWidth - 0.5) * 2;
      mouseRef.current.y = -(e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  const { positions, basePositions, sizes, alphas } = useMemo(() => {
    const positions = new Float32Array(COUNT * 3);
    const basePositions = new Float32Array(COUNT * 3);
    const sizes = new Float32Array(COUNT);
    const alphas = new Float32Array(COUNT);

    for (let i = 0; i < COUNT; i++) {
      const i3 = i * 3;
      const x = (Math.random() - 0.5) * 40;
      const y = (Math.random() - 0.5) * 25;
      const z = -Math.random() * 30 - 2;

      positions[i3] = x;
      positions[i3 + 1] = y;
      positions[i3 + 2] = z;
      basePositions[i3] = x;
      basePositions[i3 + 1] = y;
      basePositions[i3 + 2] = z;

      sizes[i] = 0.8 + Math.random() * 1.5;
      // Depth-based alpha: closer = brighter, further = dimmer
      const depthNorm = (-z - 2) / 30; // 0 = close, 1 = far
      alphas[i] = 0.15 + (1 - depthNorm) * 0.45;
    }

    return { positions, basePositions, sizes, alphas };
  }, []);

  const shaderMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uColor: { value: new THREE.Color("#2DD4A8") },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });
  }, []);

  useFrame((state) => {
    if (!pointsRef.current) return;
    const geo = pointsRef.current.geometry;
    const posAttr = geo.attributes.position;
    const time = state.clock.elapsedTime;

    const mx = mouseRef.current.x;
    const my = mouseRef.current.y;

    for (let i = 0; i < COUNT; i++) {
      const i3 = i * 3;
      const bx = basePositions[i3];
      const by = basePositions[i3 + 1];
      const bz = basePositions[i3 + 2];

      // Gentle drift
      const speed = 0.015 + (i % 11) * 0.002;
      const phase = i * 0.37;
      const dx = Math.sin(time * speed + phase) * 0.4;
      const dy = Math.cos(time * speed * 0.6 + phase) * 0.25;

      // Mouse parallax (subtle, depth-based)
      const depthFactor = (-bz) / 32;
      const px = mx * depthFactor * 0.6;
      const py = my * depthFactor * 0.4;

      posAttr.setXYZ(i, bx + dx + px, by + dy + py, bz);
    }

    posAttr.needsUpdate = true;
    pointsRef.current.rotation.y = time * 0.008;
  });

  return (
    <points ref={pointsRef} material={shaderMaterial}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={COUNT} array={positions} itemSize={3} />
        <bufferAttribute attach="attributes-aSize" count={COUNT} array={sizes} itemSize={1} />
        <bufferAttribute attach="attributes-aAlpha" count={COUNT} array={alphas} itemSize={1} />
      </bufferGeometry>
    </points>
  );
}

export default function ParticleField({ pageMode = "default" }) {
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
        camera={{ position: [0, 0, 15], fov: 55, near: 0.1, far: 80 }}
        gl={{
          antialias: false,
          alpha: true,
          powerPreference: "high-performance",
        }}
        dpr={isMobile ? 1 : Math.min(window.devicePixelRatio, 1.5)}
        style={{ background: "transparent" }}
      >
        <Particles pageMode={pageMode} />
      </Canvas>
    </div>
  );
}
