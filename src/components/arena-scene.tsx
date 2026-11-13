"use client";

// Arena operations map. 3D on capable desktops; the same nodes as a flat map
// on phones, when reduced motion is requested, when 3D is switched off in
// settings, or when WebGL is not available.

import dynamic from "next/dynamic";
import { Component, useEffect, useState, type ReactNode } from "react";
import { HEALTH_COLOR, healthOf, type DepartmentNode } from "@/lib/selectors";
import { useApp } from "@/lib/store";
import { cn } from "@/lib/utils";

function SceneLoading() {
  return (
    <div className="grid h-full place-items-center" role="status">
      <div className="flex flex-col items-center gap-3">
        <span className="size-10 animate-spin rounded-full border-2 border-brand/25 border-t-brand" />
        <p className="eyebrow">Loading operations map</p>
      </div>
    </div>
  );
}

const ArenaCanvas = dynamic(() => import("./arena-scene-canvas"), { ssr: false, loading: SceneLoading });
// Same scene for the login backdrop, without a loading message.
const AmbientCanvas = dynamic(() => import("./arena-scene-canvas"), { ssr: false });

function supportsWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

/** "3d" | "flat", or null until the device has been checked in the browser. */
function useSceneMode(): "3d" | "flat" | null {
  const effects = useApp((s) => s.effects);
  const [mode, setMode] = useState<"3d" | "flat" | null>(null);
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const narrow = window.matchMedia("(max-width: 767px)");
    const check = () => setMode(effects === "off" || reduce.matches || narrow.matches || !supportsWebGL() ? "flat" : "3d");
    check();
    reduce.addEventListener("change", check);
    narrow.addEventListener("change", check);
    return () => {
      reduce.removeEventListener("change", check);
      narrow.removeEventListener("change", check);
    };
  }, [effects]);
  return mode;
}

/** If the 3D scene fails at runtime, fall back to the flat map instead of a blank panel. */
class SceneBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function FlatMap({
  nodes,
  selectedId,
  onSelect,
}: {
  nodes: DepartmentNode[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const at = (n: number) => {
    const a = (n / nodes.length) * Math.PI * 2 - Math.PI / 2;
    return { x: 50 + Math.cos(a) * 38, y: 50 + Math.sin(a) * 36 };
  };
  return (
    <div className="relative h-full w-full">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden="true">
        {[46, 34, 22].map((r, n) => (
          <ellipse key={r} cx="50" cy="50" rx={r} ry={r * 0.94} fill="none" stroke="#22c73f" strokeOpacity={0.14 + n * 0.08} strokeWidth="0.3" vectorEffect="non-scaling-stroke" />
        ))}
        {nodes.map((node, n) => {
          const p = at(n);
          return (
            <line key={node.id} x1="50" y1="50" x2={p.x} y2={p.y} stroke={HEALTH_COLOR[healthOf(node)]} strokeOpacity={node.id === selectedId ? 0.8 : 0.3} strokeWidth="1" vectorEffect="non-scaling-stroke" />
          );
        })}
      </svg>
      <div className="absolute top-1/2 left-1/2 grid size-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-brand/50 bg-brand/15 shadow-[0_0_40px_rgb(34_199_63/45%)]">
        <span className="display text-[10px] tracking-[0.2em] text-brand-soft">Arena</span>
      </div>
      {nodes.map((node, n) => {
        const p = at(n);
        const c = HEALTH_COLOR[healthOf(node)];
        const on = node.id === selectedId;
        return (
          <button
            key={node.id}
            type="button"
            onClick={() => onSelect(node.id)}
            aria-pressed={on}
            aria-label={`${node.name}: ${Math.round(node.completion)}% complete, ${node.assigned} tasks today, ${node.active} working, ${node.overdue} overdue`}
            className={cn(
              "absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5 rounded-2xl border px-2.5 py-1.5 backdrop-blur-md transition",
              on ? "border-white/70 bg-white/15" : "border-white/12 bg-black/55 hover:border-white/40",
            )}
            style={{ left: `${p.x}%`, top: `${p.y}%` }}
          >
            <span className="flex items-center gap-1.5 text-[11px] font-bold tracking-wider uppercase">
              <span className="size-2 rounded-full" style={{ background: c, boxShadow: `0 0 10px ${c}` }} />
              {node.short}
            </span>
            <span className="tnum text-[11px] text-paper/70">
              {Math.round(node.completion)}% · {node.completed}/{node.assigned}
              {node.overdue > 0 && <span className="ml-1 font-semibold text-crit">· {node.overdue} late</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Interactive department map for the Executive Command Center. */
export function ArenaMap({
  nodes,
  selectedId,
  onSelect,
  className,
}: {
  nodes: DepartmentNode[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  className?: string;
}) {
  const mode = useSceneMode();
  const flat = <FlatMap nodes={nodes} selectedId={selectedId} onSelect={onSelect} />;
  return (
    <div className={cn("relative overflow-hidden rounded-2xl bg-[radial-gradient(ellipse_at_center,rgb(34_199_63/10%),transparent_70%)]", className)}>
      {mode === null && <SceneLoading />}
      {mode === "flat" && flat}
      {mode === "3d" && (
        <SceneBoundary fallback={flat}>
          <ArenaCanvas nodes={nodes} selectedId={selectedId} onSelect={onSelect} />
        </SceneBoundary>
      )}
    </div>
  );
}

// Decorative nodes for the login backdrop (no data, not interactive).
const AMBIENT_NODES: DepartmentNode[] = ["a", "b", "c", "d", "e", "f", "g", "h"].map((id, n) => ({
  id,
  name: id,
  short: id,
  employees: 3,
  assigned: 6 + ((n * 5) % 9),
  completed: 0,
  completion: 100,
  active: n % 2 ? 2 : 1,
  overdue: 0,
  pending: 0,
  tracked_seconds: 0,
}));

function StaticBackdrop() {
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" className="h-full w-full" aria-hidden="true">
      {[48, 38, 28, 18].map((r, n) => (
        <ellipse key={r} cx="50" cy="62" rx={r} ry={r * 0.42} fill="none" stroke="#22c73f" strokeOpacity={0.1 + n * 0.07} strokeWidth="0.25" />
      ))}
      <circle cx="50" cy="56" r="3" fill="#22c73f" fillOpacity="0.5" />
    </svg>
  );
}

/** Ambient arena scene behind the login screen. */
export function ArenaBackdrop({ className }: { className?: string }) {
  const mode = useSceneMode();
  return (
    <div className={cn("pointer-events-none", className)} aria-hidden="true">
      {mode === "3d" ? (
        <SceneBoundary fallback={<StaticBackdrop />}>
          <div className="h-full w-full animate-in duration-1000 fade-in-0">
            <AmbientCanvas nodes={AMBIENT_NODES} ambient />
          </div>
        </SceneBoundary>
      ) : (
        <StaticBackdrop />
      )}
    </div>
  );
}
