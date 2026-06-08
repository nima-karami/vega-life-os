import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import * as THREE from "three";
import { useStore } from "@/core/store";
import { spectrum as SPECTRUM } from "@/core/theme/tokens";
import { todayISO } from "@/core/lib/date";

const R = 3;

function sphericalToXYZ(latDeg: number, lonDeg: number, r = R): [number, number, number] {
  const lat = (latDeg * Math.PI) / 180;
  const lon = (lonDeg * Math.PI) / 180;
  return [r * Math.cos(lat) * Math.cos(lon), r * Math.sin(lat), r * Math.cos(lat) * Math.sin(lon)];
}

function Globe() {
  const values = useStore((s) => s.values);
  const tasks = useStore((s) => s.tasks);
  const group = useRef<THREE.Group>(null);

  const markers = useMemo(
    () => values.map((v, i) => {
      const lat = -45 + (i / Math.max(values.length - 1, 1)) * 90;
      const lon = (i / values.length) * 360;
      return { v, pos: sphericalToXYZ(lat, lon, R + 0.02) };
    }),
    [values],
  );

  const todayCount = tasks.filter((t) => t.date === todayISO()).length;

  useFrame((_, dt) => { if (group.current) group.current.rotation.y += dt * 0.12; });

  return (
    <>
      <ambientLight intensity={0.5} />
      <pointLight position={[6, 6, 8]} intensity={1.4} />
      <group ref={group}>
        {/* opaque core for occlusion */}
        <mesh>
          <sphereGeometry args={[R - 0.02, 48, 48]} />
          <meshStandardMaterial color="#0c0c10" roughness={1} />
        </mesh>
        {/* wireframe shell */}
        <mesh>
          <sphereGeometry args={[R, 24, 18]} />
          <meshBasicMaterial color="#5b6472" wireframe transparent opacity={0.35} />
        </mesh>
        {/* equator + meridian rings */}
        {[0, 60, 120].map((deg) => (
          <mesh key={deg} rotation={[Math.PI / 2, 0, (deg * Math.PI) / 180]}>
            <torusGeometry args={[R, 0.006, 8, 96]} />
            <meshBasicMaterial color="#7d8694" transparent opacity={0.4} />
          </mesh>
        ))}
        {/* value markers */}
        {markers.map(({ v, pos }) => {
          const c = SPECTRUM[v.spectrum] ?? "#888";
          return (
            <group key={v.id} position={pos}>
              <mesh>
                <sphereGeometry args={[0.06 + v.energy * 0.08, 16, 16]} />
                <meshStandardMaterial color={c} emissive={c} emissiveIntensity={1.4} />
              </mesh>
              <Html center distanceFactor={9} position={[0, 0.25, 0]} pointerEvents="none">
                <div className="whitespace-nowrap" style={{ pointerEvents: "none" }}>
                  <span className="display text-[11px]" style={{ color: c }}>{v.name}</span>
                  <span className="mono ml-1 text-[8px] text-[#8a877a]">{Math.round(v.energy * 100)}%</span>
                </div>
              </Html>
            </group>
          );
        })}
      </group>

      {/* task satellites */}
      {Array.from({ length: Math.min(todayCount, 8) }, (_, i) => (
        <Satellite key={i} idx={i} total={Math.min(todayCount, 8)} />
      ))}

      <OrbitControls enablePan={false} autoRotate autoRotateSpeed={0.3} minDistance={5} maxDistance={14} />
    </>
  );
}

function Satellite({ idx, total }: { idx: number; total: number }) {
  const ref = useRef<THREE.Mesh>(null);
  const r = R + 1.2 + (idx % 3) * 0.35;
  const tilt = (idx / total) * Math.PI;
  useFrame((s) => {
    const t = s.clock.elapsedTime * 0.5 + idx;
    if (ref.current) ref.current.position.set(Math.cos(t) * r, Math.sin(t) * r * Math.sin(tilt), Math.sin(t) * r * Math.cos(tilt));
  });
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[0.04, 8, 8]} />
      <meshBasicMaterial color="#efeada" />
    </mesh>
  );
}

export function GlobeVariant() {
  return (
    <div className="absolute inset-0">
      <Canvas camera={{ position: [0, 1.5, 8], fov: 50 }} dpr={[1, 2]}>
        <color attach="background" args={["#08080c"]} />
        <Globe />
      </Canvas>
      <div className="pointer-events-none absolute left-5 top-4">
        <p className="mono text-[10px] tracking-[0.16em] text-[#8a877a]">// GLOBE · DRAG TO SPIN</p>
        <h1 className="display mt-1 text-2xl text-[#efeada]">One world, your values</h1>
      </div>
    </div>
  );
}
