import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, MeshDistortMaterial, Sparkles, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';

/* The pool "core": a glassy distorted sphere. It represents the shielded
   liquidity pool. It drifts and breathes; on a swap it pulses. While a proof
   is being generated it spins faster and distorts more (work happening). */
function PoolCore({ pulse, busy }) {
  const grp = useRef();
  const mat = useRef();
  const scale = useRef(1);
  const lastPulse = useRef(pulse);

  useFrame((_, dt) => {
    if (pulse !== lastPulse.current) {
      scale.current = 1.22; // kick
      lastPulse.current = pulse;
    }
    scale.current += (1 - scale.current) * Math.min(1, dt * 4); // ease back
    const s = scale.current;
    if (grp.current) {
      grp.current.scale.setScalar(s);
      grp.current.rotation.y += dt * (busy ? 0.9 : 0.22);
      grp.current.rotation.x += dt * (busy ? 0.25 : 0.06);
    }
    if (mat.current) {
      const target = busy ? 0.55 : 0.32;
      mat.current.distort += (target - mat.current.distort) * Math.min(1, dt * 3);
    }
  });

  return (
    <group ref={grp}>
      <mesh castShadow>
        <icosahedronGeometry args={[1.25, 12]} />
        <MeshDistortMaterial
          ref={mat}
          color={'#12897a'}
          roughness={0.08}
          metalness={0.22}
          distort={0.32}
          speed={busy ? 3.2 : 1.4}
          transparent
          opacity={0.96}
        />
      </mesh>
      {/* inner glow sphere */}
      <mesh scale={0.62}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshBasicMaterial color={'#8fe7d3'} transparent opacity={0.25} />
      </mesh>
    </group>
  );
}

/* Orbiting ring of "hidden orders" — traders whose amounts are shielded. */
function OrderRing() {
  const ref = useRef();
  const nodes = useMemo(
    () => new Array(9).fill(0).map((_, i) => (i / 9) * Math.PI * 2),
    [],
  );
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.16;
  });
  return (
    <group ref={ref} rotation={[0.5, 0, 0.15]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[2.35, 0.012, 12, 120]} />
        <meshBasicMaterial color={'#cbd3d1'} transparent opacity={0.6} />
      </mesh>
      {nodes.map((a, i) => (
        <mesh key={i} position={[Math.cos(a) * 2.35, 0, Math.sin(a) * 2.35]}>
          <sphereGeometry args={[0.055, 16, 16]} />
          <meshStandardMaterial
            color={i % 3 === 0 ? '#574fc7' : '#2a54a8'}
            roughness={0.4}
            metalness={0.1}
            emissive={'#1a2a55'}
            emissiveIntensity={0.15}
          />
        </mesh>
      ))}
    </group>
  );
}

export default function Scene({ pulse, busy }) {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [0, 0.4, 6.3], fov: 42 }}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
      style={{ background: 'transparent' }}
    >
      <ambientLight intensity={0.7} />
      <directionalLight position={[4, 6, 5]} intensity={1.15} castShadow />
      <pointLight position={[-4, -2, 2]} intensity={40} color={'#0e7c66'} />
      <pointLight position={[3, -3, -2]} intensity={26} color={'#574fc7'} />

      <Float speed={1.3} rotationIntensity={0.35} floatIntensity={0.7}>
        <PoolCore pulse={pulse} busy={busy} />
      </Float>
      <OrderRing />

      {/* privacy "noise" — obscures the individual amounts */}
      <Sparkles count={70} scale={[7, 4.5, 7]} size={2.2} speed={0.35} opacity={0.5} color={'#0e7c66'} />

      <ContactShadows position={[0, -2.1, 0]} opacity={0.28} scale={9} blur={2.6} far={4} color={'#163a30'} />
    </Canvas>
  );
}
