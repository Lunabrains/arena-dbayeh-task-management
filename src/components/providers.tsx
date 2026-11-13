"use client";

import { AnimatePresence, motion, MotionConfig } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { Avatar, EASE } from "@/components/kit";
import { Toaster } from "@/components/ui/sonner";
import { homeFor } from "@/lib/permissions";
import { boot, clearSwitch, completeSwitch, useApp } from "@/lib/store";

export function Providers({ children }: { children: ReactNode }) {
  useEffect(() => {
    boot();
  }, []);
  return (
    <MotionConfig reducedMotion="user">
      {children}
      <RoleTransition />
      <Toaster position="top-center" />
    </MotionConfig>
  );
}

/** Full-screen hand-over shown while the demo switches from one profile to another. */
function RoleTransition() {
  const router = useRouter();
  const switchingTo = useApp((s) => s.switchingTo);
  const user = useApp((s) => s.db?.users.find((u) => u.id === s.switchingTo) ?? null);
  const role = user?.role;

  useEffect(() => {
    if (!switchingTo || !role) return;
    const enter = setTimeout(() => {
      completeSwitch(switchingTo);
      router.replace(homeFor(role));
    }, 700);
    const leave = setTimeout(clearSwitch, 1250);
    return () => {
      clearTimeout(enter);
      clearTimeout(leave);
    };
  }, [switchingTo, role, router]);

  return (
    <AnimatePresence>
      {user && (
        <motion.div
          key="role-transition"
          className="fixed inset-0 z-[100] grid place-items-center overflow-hidden bg-ink/92 backdrop-blur-2xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
          role="status"
          aria-live="polite"
        >
          <motion.span
            className="absolute inset-x-0 top-1/2 h-px bg-gradient-to-r from-transparent via-brand to-transparent"
            initial={{ scaleX: 0, opacity: 0 }}
            animate={{ scaleX: 1, opacity: 1 }}
            transition={{ duration: 0.8, ease: EASE }}
          />
          <motion.div
            className="relative flex flex-col items-center gap-4 rounded-3xl bg-ink px-10 py-8 text-center"
            initial={{ y: 24, scale: 0.92, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            transition={{ duration: 0.55, ease: EASE }}
          >
            <Avatar user={user} size={76} />
            <div>
              <p className="eyebrow">Entering as</p>
              <p className="display mt-1 text-4xl">{user.name}</p>
              <p className="mt-1.5 text-sm text-paper/60">{user.title}</p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
