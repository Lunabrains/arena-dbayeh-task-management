"use client";

import { Check, Info, RotateCcw, ShieldCheck, Sparkles, Users } from "lucide-react";
import { useState } from "react";
import { Btn, PageHeader, Panel, Segmented } from "@/components/kit";
import { ROLE_PERMISSIONS } from "@/lib/permissions";
import { resetDemo, setEffects, useApp, useDb } from "@/lib/store";
import { fmtDay, fmtTime } from "@/lib/time";
import { ROLE_LABEL, type Role } from "@/lib/types";
import { openDemo } from "@/lib/ui";

const ROLES: Role[] = ["owner", "ceo", "gm", "manager", "employee"];

export default function SettingsPage() {
  const db = useDb();
  const effects = useApp((s) => s.effects);
  const [confirm, setConfirm] = useState(false);

  return (
    <>
      <PageHeader eyebrow="Settings" title="Demo settings" sub="Controls for this demonstration environment." />
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Panel title="Demo environment" icon={<Info className="size-5" />}>
          <p className="text-sm leading-relaxed text-paper/70">
            Arena OS is running as a demonstration. Every person, task and report is fictional sample data created on{" "}
            <span className="font-semibold text-paper">
              {fmtDay(db.seeded_at)} at {fmtTime(db.seeded_at)}
            </span>
            . Everything you change is saved in this browser only, and fresh sample data is generated at the start of
            each day.
          </p>
          <ul className="mt-3 space-y-1.5 text-sm text-paper/65">
            <li>{db.users.length} demo people across {db.departments.length} departments</li>
            <li>{db.tasks.filter((t) => !t.deleted_at).length} tasks, including 14 days of history</li>
            <li>Business dates use the Asia/Beirut time zone</li>
          </ul>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Btn onClick={openDemo}>
              <Users className="size-4" /> Switch profile
            </Btn>
            {confirm ? (
              <>
                <Btn
                  variant="danger"
                  onClick={() => {
                    resetDemo();
                    setConfirm(false);
                  }}
                >
                  Yes, reset everything
                </Btn>
                <Btn variant="subtle" onClick={() => setConfirm(false)}>
                  Cancel
                </Btn>
              </>
            ) : (
              <Btn variant="danger" onClick={() => setConfirm(true)}>
                <RotateCcw className="size-4" /> Reset demo
              </Btn>
            )}
          </div>
          {confirm && (
            <p className="mt-2 text-xs text-paper/55">
              This restores the original sample data. Tasks, timers and reports changed in this demo will be lost.
            </p>
          )}
        </Panel>

        <Panel title="Visual effects" icon={<Sparkles className="size-5" />}>
          <p className="text-sm leading-relaxed text-paper/70">
            The 3D operations map loads only on larger screens and switches to a flat map automatically when the device
            asks for reduced motion or cannot run 3D graphics.
          </p>
          <Segmented
            id="effects"
            className="mt-4"
            value={effects}
            onChange={setEffects}
            options={[
              { value: "auto", label: "3D when available" },
              { value: "off", label: "Flat map only" },
            ]}
          />
        </Panel>

        <Panel title="Access by role" icon={<ShieldCheck className="size-5" />} className="lg:col-span-2">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {ROLES.map((r) => (
              <div key={r} className="rounded-2xl border border-white/8 bg-white/[0.025] p-4">
                <p className="font-display text-lg font-bold tracking-wide uppercase">{ROLE_LABEL[r]}</p>
                <ul className="mt-2.5 space-y-2">
                  {ROLE_PERMISSIONS[r].map((p) => (
                    <li key={p} className="flex items-start gap-2 text-xs leading-snug text-paper/70">
                      <Check className="mt-0.5 size-3.5 shrink-0 text-brand" /> {p}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-paper/45">
            These rules are enforced in one permissions layer for both screens and actions. The profile switcher is a
            demo convenience and is not a sign-in system; a live deployment enforces the same rules on the server.
          </p>
        </Panel>
      </div>
      <p className="mt-8 text-center text-xs text-paper/35">Arena OS · built for Arena Dbayeh by Brains AI Solutions</p>
    </>
  );
}
