"use client";

// The WebGL scene. Loaded lazily by arena-scene.tsx, never on the server.
// Department labels are ordinary HTML buttons laid over the canvas and moved
// each frame to follow their node, so they stay keyboard accessible.

import { Line } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import * as THREE from "three";
import { HEALTH_COLOR, healthOf, type DepartmentNode } from "@/lib/selectors";

const RX = 4.4;
const RZ = 2.8;
const CORE: [number, number, number] = [0, 0.95, 0];
const BRAND = "#22c73f";

type Anchors = Map<string, { object: THREE.Object3D; lift: number }>;
type Labels = RefObject<Record<string, HTMLElement | null>>;

function ring(rx: number, rz: number, y = 0, segments = 96): [number, number, number][] {
  return Array.from({ length: segments + 1 }, (_, n) => {
    const a = (n / segments) * Math.PI * 2;
    return [Math.cos(a) * rx, y, Math.sin(a) * rz];
  });
}

function nodePosition(n: number, total: number): [number, number, number] {
  const a = (n / total) * Math.PI * 2 - Math.PI / 2;
  return [Math.cos(a) * RX, 0.6, Math.sin(a) * RZ];
}

/** Stylised pitch and stadium tiers on the floor. */
function Floor() {
  const tiers = useMemo(() => [1, 0.78, 0.56].map((s) => ring(RX * 1.28 * s, RZ * 1.32 * s)), []);
  const centre = useMemo(() => ring(0.9, 0.9), []);
  const pitch = useMemo<[number, number, number][]>(
    () => [
      [-2.6, 0, -1.5],
      [2.6, 0, -1.5],
      [2.6, 0, 1.5],
      [-2.6, 0, 1.5],
      [-2.6, 0, -1.5],
    ],
    [],
  );
  const half = useMemo<[number, number, number][]>(
    () => [
      [0, 0, -1.5],
      [0, 0, 1.5],
    ],
    [],
  );
  return (
    <group>
      <gridHelper args={[22, 44, "#163a20", "#0e2014"]} position={[0, -0.02, 0]} />
      {tiers.map((pts, n) => (
        <Line key={n} points={pts} color={BRAND} lineWidth={1} transparent opacity={0.16 + n * 0.1} />
      ))}
      <Line points={pitch} color={BRAND} lineWidth={1.2} transparent opacity={0.5} />
      <Line points={half} color={BRAND} lineWidth={1} transparent opacity={0.4} />
      <Line points={centre} color={BRAND} lineWidth={1} transparent opacity={0.45} />
    </group>
  );
}

function Core({ anchors }: { anchors: Anchors }) {
  const group = useRef<THREE.Group>(null);
  const shell = useRef<THREE.Mesh>(null);
  const inner = useRef<THREE.Mesh>(null);
  useEffect(() => {
    if (group.current) anchors.set("core", { object: group.current, lift: -1.05 });
    return () => {
      anchors.delete("core");
    };
  }, [anchors]);
  useFrame((state, dt) => {
    if (shell.current) {
      shell.current.rotation.y += dt * 0.35;
      shell.current.rotation.x += dt * 0.12;
    }
    if (inner.current) inner.current.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 1.6) * 0.06);
  });
  return (
    <group ref={group} position={CORE}>
      <mesh ref={shell}>
        <icosahedronGeometry args={[0.78, 1]} />
        <meshBasicMaterial color={BRAND} wireframe transparent opacity={0.55} />
      </mesh>
      <mesh ref={inner}>
        <sphereGeometry args={[0.36, 32, 32]} />
        <meshStandardMaterial color="#0c3a17" emissive={BRAND} emissiveIntensity={2.2} roughness={0.3} />
      </mesh>
      <pointLight color={BRAND} intensity={14} distance={9} />
    </group>
  );
}

function Pulse({ from, color, offset }: { from: [number, number, number]; color: string; offset: number }) {
  const ref = useRef<THREE.Mesh>(null);
  const a = useMemo(() => new THREE.Vector3(...from), [from]);
  const b = useMemo(() => new THREE.Vector3(...CORE), []);
  useFrame((state) => {
    if (!ref.current) return;
    const t = (state.clock.elapsedTime * 0.28 + offset) % 1;
    ref.current.position.lerpVectors(a, b, t);
    ref.current.scale.setScalar(0.6 + Math.sin(t * Math.PI) * 0.8);
  });
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[0.055, 12, 12]} />
      <meshBasicMaterial color={color} />
    </mesh>
  );
}

function Node({
  node,
  index,
  total,
  selected,
  interactive,
  anchors,
  onSelect,
}: {
  node: DepartmentNode;
  index: number;
  total: number;
  selected: boolean;
  interactive: boolean;
  anchors: Anchors;
  onSelect?: (id: string) => void;
}) {
  const group = useRef<THREE.Group>(null);
  const halo = useRef<THREE.Mesh>(null);
  const alert = useRef<THREE.Mesh>(null);
  const [hover, setHover] = useState(false);
  const base = useMemo(() => nodePosition(index, total), [index, total]);
  const link = useMemo<[number, number, number][]>(() => [base, CORE], [base]);
  const scale = useMemo(() => new THREE.Vector3(1, 1, 1), []);
  const color = HEALTH_COLOR[healthOf(node)];
  const r = 0.2 + (Math.min(node.assigned, 16) / 16) * 0.2;
  const arc = Math.max(0.02, node.completion / 100) * Math.PI * 2;
  const pulses = Math.min(node.active, 3);

  useEffect(() => {
    if (group.current) anchors.set(node.id, { object: group.current, lift: r + 0.55 });
    return () => {
      anchors.delete(node.id);
    };
  }, [anchors, node.id, r]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (group.current) {
      group.current.position.y = base[1] + Math.sin(t * 0.9 + index * 1.3) * 0.09;
      group.current.scale.lerp(scale.setScalar(selected ? 1.28 : hover ? 1.14 : 1), 0.14);
    }
    if (halo.current) {
      halo.current.rotation.z = t * 0.6;
      halo.current.visible = selected || hover;
    }
    if (alert.current) alert.current.position.set(Math.cos(t * 1.8) * (r + 0.34), 0.05, Math.sin(t * 1.8) * (r + 0.34));
  });

  return (
    <>
      <Line points={link} color={color} lineWidth={1} transparent opacity={selected ? 0.7 : 0.26} />
      {Array.from({ length: pulses }, (_, k) => (
        <Pulse key={k} from={base} color={color} offset={k / pulses + index * 0.11} />
      ))}
      <group ref={group} position={base}>
        <mesh
          onClick={interactive ? () => onSelect?.(node.id) : undefined}
          onPointerOver={
            interactive
              ? () => {
                  setHover(true);
                  document.body.style.cursor = "pointer";
                }
              : undefined
          }
          onPointerOut={
            interactive
              ? () => {
                  setHover(false);
                  document.body.style.cursor = "";
                }
              : undefined
          }
        >
          <sphereGeometry args={[r, 32, 32]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={selected ? 1.5 : 0.75} roughness={0.35} metalness={0.15} />
        </mesh>
        {/* completion arc over a faint full ring */}
        <mesh rotation={[-Math.PI / 2, 0, Math.PI / 2]}>
          <torusGeometry args={[r + 0.17, 0.014, 8, 64]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.12} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, Math.PI / 2]}>
          <torusGeometry args={[r + 0.17, 0.032, 8, 64, arc]} />
          <meshBasicMaterial color={color} />
        </mesh>
        <mesh ref={halo} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
          <ringGeometry args={[r + 0.3, r + 0.36, 48, 1, 0, Math.PI * 1.5]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.7} side={THREE.DoubleSide} />
        </mesh>
        {node.overdue > 0 && (
          <mesh ref={alert}>
            <sphereGeometry args={[0.06, 12, 12]} />
            <meshBasicMaterial color="#ff4d5e" />
          </mesh>
        )}
      </group>
    </>
  );
}

function World({
  nodes,
  selectedId,
  onSelect,
  ambient,
  labels,
}: {
  nodes: DepartmentNode[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  ambient?: boolean;
  labels: Labels;
}) {
  const world = useRef<THREE.Group>(null);
  const anchors = useMemo<Anchors>(() => new Map(), []);
  const v = useMemo(() => new THREE.Vector3(), []);

  useFrame((state) => {
    if (!world.current) return;
    const t = state.clock.elapsedTime;
    // Idle sway plus a little pointer parallax; the login backdrop turns slowly.
    if (ambient) world.current.rotation.y = t * 0.05;
    else {
      world.current.rotation.y = THREE.MathUtils.lerp(world.current.rotation.y, state.pointer.x * 0.2 + Math.sin(t * 0.18) * 0.07, 0.05);
      world.current.rotation.x = THREE.MathUtils.lerp(world.current.rotation.x, -state.pointer.y * 0.05, 0.05);
    }
    // Keep each HTML label above its node.
    anchors.forEach(({ object, lift }, id) => {
      const el = labels.current[id];
      if (!el) return;
      object.getWorldPosition(v);
      v.y += lift * object.scale.y;
      v.project(state.camera);
      const x = (v.x * 0.5 + 0.5) * state.size.width;
      const y = (-v.y * 0.5 + 0.5) * state.size.height;
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -50%)`;
      el.style.zIndex = String(Math.round((1 - v.z) * 5000));
      el.style.opacity = "1";
    });
  });

  return (
    <group ref={world}>
      <Floor />
      <Core anchors={anchors} />
      {nodes.map((n, k) => (
        <Node
          key={n.id}
          node={n}
          index={k}
          total={nodes.length}
          selected={n.id === selectedId}
          interactive={!ambient}
          anchors={anchors}
          onSelect={onSelect}
        />
      ))}
    </group>
  );
}

export default function ArenaCanvas({
  nodes,
  selectedId,
  onSelect,
  ambient,
}: {
  nodes: DepartmentNode[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  ambient?: boolean;
}) {
  const labels = useRef<Record<string, HTMLElement | null>>({});
  return (
    <div className="relative isolate h-full w-full">
      <Canvas
        dpr={[1, 1.75]}
        camera={{ position: ambient ? [0, 4.2, 9.6] : [0, 5.6, 8.8], fov: 40 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        style={{ pointerEvents: ambient ? "none" : "auto" }}
      >
        <ambientLight intensity={0.75} />
        <directionalLight position={[4, 8, 5]} intensity={1.1} />
        <fog attach="fog" args={["#070908", 11, 22]} />
        <World nodes={nodes} selectedId={selectedId} onSelect={onSelect} ambient={ambient} labels={labels} />
      </Canvas>

      {!ambient && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <span
            ref={(el) => {
              labels.current.core = el;
            }}
            className="display absolute top-0 left-0 text-xs tracking-[0.3em] whitespace-nowrap text-brand-soft opacity-0"
          >
            Arena
          </span>
          {nodes.map((node) => {
            const on = node.id === selectedId;
            return (
              <button
                key={node.id}
                type="button"
                ref={(el) => {
                  labels.current[node.id] = el;
                }}
                onClick={() => onSelect?.(node.id)}
                aria-pressed={on}
                aria-label={`${node.name}: ${Math.round(node.completion)}% complete, ${node.assigned} tasks today, ${node.active} working, ${node.overdue} overdue`}
                className={`pointer-events-auto absolute top-0 left-0 flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold tracking-wider whitespace-nowrap uppercase opacity-0 backdrop-blur-md transition-colors ${
                  on ? "border-white/70 bg-white/20 text-white" : "border-white/15 bg-black/55 text-white/85 hover:border-white/50"
                }`}
              >
                <span className="size-1.5 rounded-full" style={{ background: HEALTH_COLOR[healthOf(node)] }} />
                {node.short}
                <span className="tnum font-mono font-medium text-white/65">{Math.round(node.completion)}%</span>
                {node.overdue > 0 && <span className="tnum rounded-full bg-[#ff4d5e] px-1.5 text-[10px] text-black">{node.overdue}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
