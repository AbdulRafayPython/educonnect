import { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { MeshTransmissionMaterial, Environment, Lightformer, Float } from '@react-three/drei';
import * as THREE from 'three';

// The spinning iridescent glass object. A torus-knot with a transmission
// material (real refraction + chromatic dispersion). Iridescence comes from
// in-scene Lightformers baked into an environment map — no network HDRI, so it
// renders offline and stays performant.
function GlassKnot() {
  const ref = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.35;
  });

  return (
    <Float speed={1.3} rotationIntensity={0.3} floatIntensity={0.7}>
      <mesh ref={ref} scale={0.85} rotation={[0.4, 0, 0.25]}>
        <torusKnotGeometry args={[1, 0.3, 220, 32]} />
        <MeshTransmissionMaterial
          samples={8}
          resolution={512}
          transmission={1}
          thickness={1.4}
          roughness={0.03}
          ior={1.36}
          chromaticAberration={0.95}
          anisotropicBlur={0.25}
          distortion={0.45}
          distortionScale={0.4}
          temporalDistortion={0.15}
          clearcoat={1}
          attenuationColor="#ffffff"
          color="#ffffff"
          background={new THREE.Color('#05070f')}
        />
      </mesh>
    </Float>
  );
}

export default function GlassHero({ offsetX = 0 }: { offsetX?: number }) {
  return (
    <Canvas
      camera={{ position: [0, 0, 7.5], fov: 28 }}
      dpr={[1, 1.75]}
      gl={{ antialias: true, alpha: true }}
      style={{ background: 'transparent' }}
    >
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 5, 5]} intensity={1.1} />
      <group position={[offsetX, 0, 0]}>
        <GlassKnot />
      </group>

      {/* Iridescent rim lights baked into the env map → the rainbow bands. */}
      <Environment resolution={256}>
        <group rotation={[0, 0, 1]}>
          <Lightformer form="circle" intensity={5} color="#4cc9f0" position={[-3.5, 2.5, 2]} scale={4} />
          <Lightformer form="circle" intensity={5} color="#b5179e" position={[3.5, -2.5, 2]} scale={4} />
          <Lightformer form="circle" intensity={4} color="#7c5cff" position={[0, 3.5, -2]} scale={5} />
          <Lightformer form="ring" intensity={3} color="#ffffff" position={[0, 0, 4]} scale={3} />
          <Lightformer form="rect" intensity={2.5} color="#3a0ca3" position={[-3, -3, -2]} scale={7} />
          <Lightformer form="rect" intensity={2.5} color="#06b6d4" position={[3, 3, -3]} scale={7} />
        </group>
      </Environment>
    </Canvas>
  );
}
