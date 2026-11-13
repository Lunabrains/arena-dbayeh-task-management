"use client";

import { ArrowRight, Check, ChevronLeft } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import { ArenaBackdrop } from "@/components/arena-scene";
import { ArenaMark, Avatar, Btn, EASE, Logo } from "@/components/kit";
import { ROLE_PERMISSIONS } from "@/lib/permissions";
import { DEMO_PROFILES } from "@/lib/seed";
import { switchProfile, useApp } from "@/lib/store";
import { cn } from "@/lib/utils";

const JOURNEY = ["Assign", "Prioritise", "Start", "Track", "Complete", "Report"];

export default function LoginPage() {
  const ready = useApp((s) => s.ready);
  const db = useApp((s) => s.db);
  const userId = useApp((s) => s.userId);
  const [choosing, setChoosing] = useState(false);
  const users = useMemo(() => new Map((db?.users ?? []).map((u) => [u.id, u])), [db]);
  const current = userId ? users.get(userId) : undefined;

  return (
    <main className="relative min-h-dvh overflow-hidden">
      <ArenaBackdrop className="absolute inset-0" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_38%,transparent,rgb(7_9_8/72%)_62%,#070908)]" />
      {/* Dim the scene behind the role cards so the text stays readable. */}
      <div
        className={cn(
          "pointer-events-none absolute inset-0 bg-ink/80 backdrop-blur-[3px] transition-opacity duration-700",
          choosing ? "opacity-100" : "opacity-0",
        )}
      />

      <div className="relative z-10 mx-auto flex min-h-dvh max-w-6xl flex-col px-5 py-5">
        <header className="flex items-center justify-between gap-3">
          <Logo />
          <span className="flex h-8 items-center gap-2 rounded-full border border-warn/40 bg-warn/10 px-3 text-[11px] font-bold tracking-[0.14em] text-warn uppercase">
            <span className="size-1.5 rounded-full bg-warn" /> Demonstration environment
          </span>
        </header>

        <section className={cn("flex flex-1 flex-col items-center text-center", choosing ? "pt-8" : "justify-center py-10")}>
          <motion.div
            layout
            initial={{ opacity: 0, scale: 0.6, filter: "blur(12px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            transition={{ duration: 1, ease: EASE }}
          >
            <ArenaMark className={cn("mx-auto w-auto text-paper drop-shadow-[0_0_40px_rgb(34_199_63/55%)]", choosing ? "h-10" : "h-20 md:h-24")} />
          </motion.div>
          <motion.h1
            layout
            className={cn("display mt-5", choosing ? "text-5xl" : "text-7xl md:text-[9rem]")}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.25, ease: EASE }}
          >
            Arena <span className="text-brand">OS</span>
          </motion.h1>
          <motion.p
            layout
            className={cn("mt-3 font-display font-bold tracking-[0.22em] text-paper/80 uppercase", choosing ? "text-sm" : "text-base md:text-2xl")}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.55 }}
          >
            One Arena. One Team. Total Visibility.
          </motion.p>

          <AnimatePresence mode="popLayout" initial={false}>
            {!choosing ? (
              <motion.div
                key="hero"
                className="flex flex-col items-center"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.5, delay: 0.1, ease: EASE }}
              >
                <ul className="mt-7 flex max-w-xl flex-wrap justify-center gap-2" aria-label="How Arena OS works">
                  {JOURNEY.map((step, n) => (
                    <motion.li
                      key={step}
                      className="glass flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold text-paper/80"
                      animate={{ y: [0, -5, 0] }}
                      transition={{ duration: 4, repeat: Infinity, delay: n * 0.35, ease: "easeInOut" }}
                    >
                      <span className="tnum text-brand">{n + 1}</span> {step}
                    </motion.li>
                  ))}
                </ul>
                <p className="mt-6 max-w-md text-sm leading-relaxed text-paper/60">
                  Task deployment and team performance for Arena Dbayeh. This demo runs on fictional people and tasks,
                  and no password is needed.
                </p>
                <Btn variant="primary" size="lg" className="mt-8 h-14 px-10 text-lg" onClick={() => setChoosing(true)} disabled={!ready}>
                  Explore Demo <ArrowRight className="size-5" />
                </Btn>
                {current && (
                  <Btn variant="subtle" className="mt-3" onClick={() => switchProfile(current.id)}>
                    Continue as {current.name}
                  </Btn>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="roles"
                className="mt-7 w-full"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5, ease: EASE }}
              >
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <div className="text-left">
                    <p className="eyebrow">Choose a profile</p>
                    <p className="mt-1 text-sm text-paper/60">
                      Each profile sees the same live data with different access. All names are fictional.
                    </p>
                  </div>
                  <Btn size="sm" variant="subtle" onClick={() => setChoosing(false)}>
                    <ChevronLeft className="size-4" /> Back
                  </Btn>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {DEMO_PROFILES.map((p, n) => {
                    const u = users.get(p.userId);
                    if (!u) return null;
                    return (
                      <motion.button
                        key={p.userId}
                        type="button"
                        onClick={() => switchProfile(u.id)}
                        initial={{ opacity: 0, y: 22 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.45, delay: 0.05 * n, ease: EASE }}
                        whileHover={{ y: -4 }}
                        whileTap={{ scale: 0.98 }}
                        className="glass group rounded-3xl p-4 text-left transition-colors hover:border-brand/60"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar user={u} size={46} />
                          <div className="min-w-0 flex-1">
                            <p className="display text-xl">{p.label}</p>
                            <p className="truncate text-xs text-paper/55">{u.name}</p>
                          </div>
                          <ArrowRight className="size-4 shrink-0 text-paper/30 transition group-hover:translate-x-1 group-hover:text-brand" />
                        </div>
                        <ul className="mt-3 space-y-1.5">
                          {ROLE_PERMISSIONS[u.role].map((perm) => (
                            <li key={perm} className="flex items-start gap-2 text-xs leading-snug text-paper/65">
                              <Check className="mt-0.5 size-3.5 shrink-0 text-brand" /> {perm}
                            </li>
                          ))}
                        </ul>
                      </motion.button>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        <footer className="pt-6 text-center text-xs text-paper/40">
          Built for Arena Dbayeh by Brains AI Solutions · Demonstration environment with fictional data
        </footer>
      </div>
    </main>
  );
}
