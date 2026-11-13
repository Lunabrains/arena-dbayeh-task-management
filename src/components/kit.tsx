"use client";

// Arena OS design kit: the small set of building blocks every screen shares.

import { animate, motion, useReducedMotion } from "motion/react";
import { useEffect, useId, useRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { PRIORITY_COLOR, PRIORITY_LABEL, STATUS_LABEL, type Priority, type TaskStatus, type User } from "@/lib/types";
import { cn } from "@/lib/utils";

export const EASE = [0.16, 1, 0.3, 1] as const;

/** Arena's logo mark, as published on arenadbayeh.com. */
export function ArenaMark({ className }: { className?: string }) {
  const id = useId();
  return (
    <svg viewBox="0 0 120 48" fill="none" aria-hidden="true" className={className}>
      <defs>
        <linearGradient id={`${id}f`} x1="0" y1="48" x2="0" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#22c73f" />
          <stop offset="0.45" stopColor="#16a333" />
          <stop offset="0.75" stopColor="currentColor" />
        </linearGradient>
        <clipPath id={`${id}c`}>
          <rect width="120" height="48" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id}c)`}>
        <path d="M-1 56 L33 4 L67 56" stroke={`url(#${id}f)`} strokeWidth="9" strokeLinejoin="miter" strokeMiterlimit="8" />
        <path d="M51 4 H96 A20 20 0 0 1 96 44 H77.4 Z" stroke="currentColor" strokeWidth="8" strokeLinejoin="miter" />
      </g>
    </svg>
  );
}

export function Logo({ compact, className }: { compact?: boolean; className?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5 text-paper", className)}>
      <ArenaMark className="h-7 w-auto shrink-0" />
      {!compact && (
        <span className="display flex flex-col text-[0.95rem] leading-[0.9]">
          <span>Arena</span>
          <span className="text-brand">OS</span>
        </span>
      )}
    </span>
  );
}

export function Avatar({ user, size = 36, live }: { user?: User | null; size?: number; live?: boolean }) {
  if (!user) {
    return (
      <span
        className="inline-grid shrink-0 place-items-center rounded-full border border-dashed border-white/25 text-paper/50"
        style={{ width: size, height: size, fontSize: size * 0.4 }}
        aria-label="Unassigned"
      >
        ?
      </span>
    );
  }
  const hue = Number(user.avatar) || 140;
  const initials = user.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");
  return (
    <span
      className="relative inline-grid shrink-0 place-items-center rounded-full font-display font-bold text-white"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.42,
        background: `linear-gradient(140deg, hsl(${hue} 52% 40%), hsl(${(hue + 42) % 360} 60% 20%))`,
        boxShadow: "inset 0 0 0 1px rgb(255 255 255 / 16%)",
      }}
      aria-hidden="true"
    >
      {initials}
      {live && <span className="live-dot absolute -right-0.5 -bottom-0.5 size-3 rounded-full border-2 border-ink bg-brand text-brand" />}
    </span>
  );
}

export function PriorityBadge({ priority, className }: { priority: Priority; className?: string }) {
  const c = PRIORITY_COLOR[priority];
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-wider uppercase", className)}
      style={{ color: c, background: `${c}1c`, boxShadow: `inset 0 0 0 1px ${c}45` }}
    >
      <span className="size-1.5 rounded-full" style={{ background: c }} />
      {PRIORITY_LABEL[priority]}
    </span>
  );
}

const STATUS_COLOR: Record<TaskStatus, string> = {
  pending: "#aab4ae",
  in_progress: "#22c73f",
  paused: "#ffc24b",
  completed: "#7be38d",
};

export function StatusBadge({ status, overdue }: { status: TaskStatus; overdue?: boolean }) {
  const c = STATUS_COLOR[status];
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-wider uppercase"
        style={{ color: c, background: `${c}17` }}
      >
        {status === "in_progress" && <span className="live-dot size-1.5 rounded-full bg-current" />}
        {STATUS_LABEL[status]}
      </span>
      {overdue && (
        <span className="rounded-full bg-crit/15 px-2 py-0.5 text-[11px] font-semibold tracking-wider text-crit uppercase ring-1 ring-crit/40 ring-inset">
          Overdue
        </span>
      )}
    </span>
  );
}

/** Counts up to its value whenever the value changes. */
export function AnimatedNumber({
  value,
  format = (n) => Math.round(n).toLocaleString("en-US"),
  className,
}: {
  value: number;
  format?: (n: number) => string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const from = useRef(0);
  const fmt = useRef(format);
  const reduce = useReducedMotion();
  useEffect(() => {
    fmt.current = format;
  });
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (reduce) {
      node.textContent = fmt.current(value);
      from.current = value;
      return;
    }
    const controls = animate(from.current, value, {
      duration: 0.9,
      ease: EASE,
      onUpdate: (v) => {
        node.textContent = fmt.current(v);
      },
    });
    from.current = value;
    return () => controls.stop();
  }, [value, reduce]);
  return (
    <span ref={ref} className={cn("tnum", className)}>
      {format(value)}
    </span>
  );
}

export function Ring({
  value,
  size = 64,
  stroke = 6,
  color = "#22c73f",
  track = "rgb(255 255 255 / 9%)",
  children,
  className,
}: {
  value: number; // 0..1
  size?: number;
  stroke?: number;
  color?: string;
  track?: string;
  children?: ReactNode;
  className?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.min(1, Math.max(0, value || 0));
  return (
    <div className={cn("relative grid shrink-0 place-items-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - v) }}
          transition={{ duration: 0.9, ease: EASE }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}

export function Segmented<T extends string>({
  id,
  value,
  onChange,
  options,
  className,
}: {
  id: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode }[];
  className?: string;
}) {
  return (
    <div role="tablist" className={cn("glass inline-flex max-w-full overflow-x-auto rounded-full p-1", className)}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(o.value)}
            className={cn(
              "relative shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold whitespace-nowrap transition-colors",
              on ? "text-ink" : "text-paper/60 hover:text-paper",
            )}
          >
            {on && (
              <motion.span
                layoutId={`seg-${id}`}
                className="absolute inset-0 rounded-full bg-brand"
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
              />
            )}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger" | "subtle";
  size?: "sm" | "md" | "lg";
};

export function Btn({ variant = "ghost", size = "md", className, type = "button", ...props }: BtnProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-2 rounded-full font-semibold whitespace-nowrap transition active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
        variant === "primary" && "bg-brand text-ink shadow-[0_10px_34px_-10px_rgb(34_199_63/75%)] hover:bg-brand-soft",
        variant === "ghost" && "glass text-paper hover:bg-white/10",
        variant === "danger" && "bg-crit/12 text-crit ring-1 ring-crit/40 ring-inset hover:bg-crit/20",
        variant === "subtle" && "text-paper/65 hover:bg-white/6 hover:text-paper",
        size === "sm" && "h-8 px-3 text-xs",
        size === "md" && "h-10 px-4 text-sm",
        size === "lg" && "h-12 px-6 text-base",
        className,
      )}
      {...props}
    />
  );
}

export function Chip({
  active,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition",
        active
          ? "border-brand/70 bg-brand/15 text-brand-soft"
          : "border-white/10 bg-white/[0.03] text-paper/65 hover:border-white/25 hover:text-paper",
        className,
      )}
      {...props}
    />
  );
}

export function PageHeader({
  eyebrow,
  title,
  sub,
  children,
}: {
  eyebrow: string;
  title: ReactNode;
  sub?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="display mt-1.5 text-4xl text-balance md:text-5xl">{title}</h1>
        {sub && <p className="mt-2.5 max-w-2xl text-sm text-paper/60">{sub}</p>}
      </div>
      {children && <div className="no-print flex flex-wrap items-center gap-2">{children}</div>}
    </header>
  );
}

export function Panel({
  title,
  icon,
  right,
  children,
  className,
}: {
  title?: ReactNode;
  icon?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("glass rounded-3xl p-4 md:p-5", className)}>
      {(title || right) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold tracking-wide uppercase">
            {icon && <span className="text-brand">{icon}</span>}
            {title}
          </h2>
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

const TONE: Record<string, string> = {
  default: "text-paper",
  brand: "text-brand",
  crit: "text-crit",
  warn: "text-warn",
};

/** KPI tile. `live` values (ticking timers) skip the count-up animation. */
export function Stat({
  label,
  value,
  format,
  text,
  sub,
  icon,
  tone = "default",
  className,
  onClick,
}: {
  onClick?: () => void; // makes the tile a button
  label: string;
  value?: number;
  format?: (n: number) => string;
  text?: string; // already formatted live value
  sub?: ReactNode;
  icon?: ReactNode;
  tone?: "default" | "brand" | "crit" | "warn";
  className?: string;
}) {
  return (
    <motion.div
      whileHover={{ y: -3 }}
      transition={{ type: "spring", stiffness: 380, damping: 26 }}
      className={cn("glass relative overflow-hidden rounded-2xl p-4", onClick && "cursor-pointer hover:border-white/25", className)}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold tracking-[0.14em] text-paper/55 uppercase">{label}</p>
        {icon && <span className={cn("opacity-80", TONE[tone])}>{icon}</span>}
      </div>
      <p className={cn("tnum mt-2 font-display text-[2.5rem] leading-none font-bold italic", TONE[tone])}>
        {text ?? <AnimatedNumber value={value ?? 0} format={format} />}
      </p>
      {sub && <p className="mt-1.5 text-xs text-paper/50">{sub}</p>}
    </motion.div>
  );
}

export function Empty({ icon, title, hint }: { icon?: ReactNode; title: string; hint?: string }) {
  return (
    <div className="grid place-items-center rounded-2xl border border-dashed border-white/12 px-6 py-10 text-center">
      {icon && <span className="mb-3 text-brand/80">{icon}</span>}
      <p className="font-display text-lg font-bold tracking-wide uppercase">{title}</p>
      {hint && <p className="mt-1 max-w-sm text-sm text-paper/55">{hint}</p>}
    </div>
  );
}

export function Loader({ label = "Loading Arena OS" }: { label?: string }) {
  return (
    <div className="grid min-h-dvh place-items-center" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-5">
        <motion.div
          animate={{ scale: [1, 1.06, 1], opacity: [0.85, 1, 0.85] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        >
          <ArenaMark className="h-12 w-auto text-paper" />
        </motion.div>
        <div className="shimmer h-1 w-40 rounded-full" />
        <p className="eyebrow">{label}</p>
      </div>
    </div>
  );
}
