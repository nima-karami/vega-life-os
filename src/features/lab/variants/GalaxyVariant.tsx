import { Html, OrbitControls, Stars } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useStore } from "@/core/store";
import { spectrum as SPECTRUM } from "@/core/theme/tokens";
import { goalsForValue } from "@/features/goals";

interface Orbiter {
  label: string;
  radius: number;
  speed: number;
  size: number;
  phase: number;
  kind: "goal" | "habit";
}

function ValueSystem({
  position,
  color,
  energy,
  name,
  orbiters,
  onPick,
  active,
}: {
  position: [number, number, number];
  color: string;
  energy: number;
  name: string;
  orbiters: Orbiter[];
  onPick: () => void;
  active: boolean;
}) {
  const group = useRef<THREE.Group>(null);
  const sunR = 0.45 + energy * 0.7;
  const c = useMemo(() => new THREE.Color(color), [color]);

  useFrame((_, dt) => {
    if (group.current) group.current.rotation.y += dt * 0.18;
  });

  // onClick here is an R3F 3D-pointer handler (not a DOM event); spread so it's
  // applied verbatim to the mesh without DOM-a11y assumptions.
  const pick = { onClick: onPick };
  return (
    <group position={position}>
      {/* sun */}
      <mesh {...pick} scale={active ? 1.15 : 1}>
        <sphereGeometry args={[sunR, 32, 32]} />
        <meshStandardMaterial
          color={c}
          emissive={c}
          emissiveIntensity={0.6 + energy * 1.2}
          roughness={0.4}
        />
      </mesh>
      <pointLight color={c} intensity={energy * 6 + 2} distance={9} />
      {/* glow halo */}
      <mesh>
        <sphereGeometry args={[sunR * 1.5, 24, 24]} />
        <meshBasicMaterial color={c} transparent opacity={0.08} />
      </mesh>
      {/* label */}
      <Html center distanceFactor={11} position={[0, -sunR - 0.7, 0]} pointerEvents="none">
        <div className="whitespace-nowrap text-center" style={{ pointerEvents: "none" }}>
          <div className="display text-[13px] text-[#efeada]">{name}</div>
          <div className="mono text-[9px] tracking-[0.1em] text-[#8a877a]">
            {Math.round(energy * 100)}% energy
          </div>
        </div>
      </Html>
      {/* orbiters */}
      <group ref={group}>
        {orbiters.map((o) => (
          <Orbiter key={`${o.kind}-${o.label}-${o.radius}`} o={o} color={c} sunR={sunR} />
        ))}
      </group>
    </group>
  );
}

function Orbiter({ o, color, sunR }: { o: Orbiter; color: THREE.Color; sunR: number }) {
  const ref = useRef<THREE.Mesh>(null);
  const r = sunR + 0.9 + o.radius;
  const tilt = useMemo(() => (o.phase % 2 ? 0.35 : -0.2), [o.phase]);
  useFrame((state) => {
    const t = state.clock.elapsedTime * o.speed + o.phase;
    if (ref.current) {
      ref.current.position.set(
        Math.cos(t) * r,
        Math.sin(t) * r * Math.sin(tilt),
        Math.sin(t) * r * Math.cos(tilt),
      );
    }
  });
  return (
    <>
      {/* orbit ring */}
      <mesh rotation={[Math.PI / 2 - tilt, 0, 0]}>
        <ringGeometry args={[r - 0.012, r + 0.012, 64]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={o.kind === "goal" ? 0.25 : 0.12}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh ref={ref}>
        <sphereGeometry args={[o.size, 16, 16]} />
        <meshStandardMaterial
          color={o.kind === "goal" ? color : "#cfcabb"}
          emissive={o.kind === "goal" ? color : "#000"}
          emissiveIntensity={0.5}
          roughness={0.6}
        />
      </mesh>
    </>
  );
}

function Scene() {
  const values = useStore((s) => s.values);
  const goals = useStore((s) => s.goals);
  const habits = useStore((s) => s.habits);
  const [active, setActive] = useState<string | null>(null);

  const systems = useMemo(() => {
    const R = 6;
    return values.map((v, i) => {
      const a = (i / values.length) * Math.PI * 2;
      const pos: [number, number, number] = [
        Math.cos(a) * R,
        (i % 2 ? 1 : -1) * 0.6,
        Math.sin(a) * R,
      ];
      const orbiters: Orbiter[] = [];
      goalsForValue(goals, v.id).forEach((g, gi) => {
        orbiters.push({
          label: g.name,
          kind: "goal",
          radius: gi * 0.5,
          speed: 0.4 - gi * 0.05,
          size: 0.13 + g.progress * 0.12,
          phase: gi * 1.7,
        });
      });
      habits
        .filter((h) => h.valueId === v.id)
        .forEach((h, hi) => {
          orbiters.push({
            label: h.name,
            kind: "habit",
            radius: 1.4 + hi * 0.35,
            speed: 0.6 + hi * 0.08,
            size: 0.08,
            phase: hi * 2.1 + 1,
          });
        });
      return { v, pos, orbiters };
    });
  }, [values, goals, habits]);

  return (
    <>
      <ambientLight intensity={0.25} />
      <Stars radius={80} depth={40} count={3500} factor={3} saturation={0} fade speed={0.5} />
      {systems.map(({ v, pos, orbiters }) => (
        <ValueSystem
          key={v.id}
          position={pos}
          color={SPECTRUM[v.spectrum] ?? "#888"}
          energy={v.energy}
          name={v.name}
          orbiters={orbiters}
          active={active === v.id}
          onPick={() => setActive(active === v.id ? null : v.id)}
        />
      ))}
      <OrbitControls
        enablePan={false}
        autoRotate
        autoRotateSpeed={0.35}
        minDistance={8}
        maxDistance={30}
      />
    </>
  );
}

export function GalaxyVariant() {
  return (
    <div className="absolute inset-0">
      <Canvas camera={{ position: [0, 6, 16], fov: 55 }} dpr={[1, 2]}>
        <color attach="background" args={["#07070a"]} />
        <fog attach="fog" args={["#07070a", 18, 40]} />
        <Scene />
      </Canvas>
      <div className="pointer-events-none absolute left-5 top-4">
        <p className="mono text-[10px] tracking-[0.16em] text-[#8a877a]">
          // GALAXY · DRAG TO ORBIT
        </p>
        <h1 className="display mt-1 text-2xl text-[#efeada]">Your life as a galaxy</h1>
      </div>
    </div>
  );
}
