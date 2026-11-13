"use client";

import { Check, ChevronDown, Rocket } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState, type FormEvent } from "react";
import { Avatar, Btn, Chip, EASE } from "@/components/kit";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { assignableDepartmentIds, assignableUsers } from "@/lib/permissions";
import { idx, queueFor } from "@/lib/selectors";
import { actions, useDb, useMe } from "@/lib/store";
import { TEMPLATES } from "@/lib/templates";
import { addDays, beirutToUtc, dateKey, fromInputs, MIN, timeInputValue } from "@/lib/time";
import { PRIORITIES, PRIORITY_COLOR, PRIORITY_LABEL, type Priority } from "@/lib/types";
import { closeComposer, useUi, type ComposerPreset } from "@/lib/ui";
import { cn } from "@/lib/utils";

/** The one task-assignment dialog, opened from anywhere with `openComposer()`. */
export function TaskComposer() {
  const preset = useUi((s) => s.composer);
  return (
    <Dialog open={preset !== null} onOpenChange={(o) => !o && closeComposer()}>
      <DialogContent className="glass-solid block max-h-[92dvh] overflow-x-hidden overflow-y-auto rounded-3xl p-0 sm:max-w-2xl">
        {preset && <ComposerForm preset={preset} />}
      </DialogContent>
    </Dialog>
  );
}

const label = "mb-1.5 block text-[11px] font-semibold tracking-[0.14em] text-paper/50 uppercase";

function dueFrom(t: number) {
  return { date: dateKey(t), time: timeInputValue(t) };
}

function ComposerForm({ preset }: { preset: ComposerPreset }) {
  const db = useDb();
  const me = useMe();
  const i = idx(db);
  const depts = useMemo(() => assignableDepartmentIds(db, me).map((id) => idx(db).deptById.get(id)!), [db, me]);
  const [dept, setDept] = useState(preset.department_id ?? me.department_id ?? depts[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignee, setAssignee] = useState(preset.assigned_to ?? "");
  const [priority, setPriority] = useState<Priority>("medium");
  const [due, setDue] = useState(() => {
    const now = Date.now();
    // Two hours from now, rounded to the half hour, kept inside today.
    const t = Math.ceil((now + 120 * MIN) / (30 * MIN)) * 30 * MIN;
    return dueFrom(Math.min(t, beirutToUtc(dateKey(now), 23, 30)));
  });
  const [est, setEst] = useState<number | null>(null);
  const [category, setCategory] = useState("");
  const [notes, setNotes] = useState("");
  const [more, setMore] = useState(false);
  const [deployed, setDeployed] = useState<string | null>(null);

  const people = useMemo(() => assignableUsers(db, me, dept), [db, me, dept]);
  const templates = TEMPLATES[dept] ?? [];

  const pickDept = (id: string) => {
    setDept(id);
    if (!assignableUsers(db, me, id).some((u) => u.id === assignee)) setAssignee("");
  };

  const quickDue: [string, () => number][] = [
    ["In 1 hour", () => Date.now() + 60 * MIN],
    ["In 3 hours", () => Date.now() + 180 * MIN],
    ["End of day", () => beirutToUtc(dateKey(Date.now()), 23, 0)],
    ["Tomorrow 10:00", () => beirutToUtc(addDays(dateKey(Date.now()), 1), 10, 0)],
  ];

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const ok = actions.createTask({
      title,
      description,
      department_id: dept,
      assigned_to: assignee,
      priority,
      due_at: fromInputs(due.date, due.time),
      estimated_duration: est,
      category,
      internal_notes: notes,
    });
    if (!ok) return;
    setDeployed(i.userById.get(assignee)?.name ?? "the team");
    setTimeout(closeComposer, 1600);
  };

  return (
    <form onSubmit={submit} className="relative">
      <div className="p-5 pb-0">
        <p className="eyebrow">Task deployment</p>
        <DialogTitle className="display mt-1 text-3xl">Deploy a task</DialogTitle>
        <DialogDescription className="mt-1.5 text-paper/55">
          Pick a template or write your own, choose who does it, set the priority and deadline.
        </DialogDescription>
      </div>

      <div className="space-y-5 p-5">
        {depts.length > 1 && (
          <div>
            <span className={label}>Department</span>
            <div className="flex flex-wrap gap-1.5">
              {depts.map((d) => (
                <Chip key={d.id} active={d.id === dept} onClick={() => pickDept(d.id)}>
                  {d.name}
                </Chip>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className={label} htmlFor="task-title">
            Task
          </label>
          <input
            id="task-title"
            className="field text-base font-semibold"
            placeholder="What needs to be done?"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoComplete="off"
          />
          {templates.length > 0 && (
            <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
              {templates.map((t) => (
                <Chip
                  key={t.title}
                  active={t.title === title}
                  onClick={() => {
                    setTitle(t.title);
                    setDescription(t.description);
                    setEst(t.est);
                    setCategory(t.category);
                  }}
                >
                  {t.title}
                </Chip>
              ))}
            </div>
          )}
          <textarea
            className="field mt-2 min-h-[68px] resize-y"
            placeholder="Short description or instructions"
            aria-label="Task description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div>
          <span className={label}>Assign to</span>
          {people.length === 0 ? (
            <p className="text-sm text-paper/55">No one in this department can be assigned by your role.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {people.map((u) => {
                const on = u.id === assignee;
                const load = queueFor(db, u.id).length;
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => setAssignee(u.id)}
                    aria-pressed={on}
                    className={cn(
                      "flex items-center gap-3 rounded-2xl border p-2.5 text-left transition",
                      on ? "border-brand/70 bg-brand/14" : "border-white/8 bg-white/[0.03] hover:border-white/25",
                    )}
                  >
                    <Avatar user={u} size={38} live={i.openByEmployee.has(u.id)} />
                    <span className="min-w-0 flex-1 leading-tight">
                      <span className="block truncate text-sm font-semibold">{u.name}</span>
                      <span className="block truncate text-[11px] text-paper/55">
                        {u.title} · {load} open
                      </span>
                    </span>
                    {on && <Check className="size-4 shrink-0 text-brand" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <span className={label}>Priority</span>
          <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Priority">
            {PRIORITIES.map((p) => {
              const on = p === priority;
              const c = PRIORITY_COLOR[p];
              return (
                <motion.button
                  key={p}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setPriority(p)}
                  whileTap={{ scale: 0.94 }}
                  animate={{ y: on ? -2 : 0 }}
                  className="relative h-11 rounded-xl text-xs font-bold tracking-wider uppercase"
                  style={{
                    color: on ? "#070908" : c,
                    background: on ? c : `${c}14`,
                    boxShadow: on ? `0 12px 30px -12px ${c}` : `inset 0 0 0 1px ${c}40`,
                  }}
                >
                  {PRIORITY_LABEL[p]}
                </motion.button>
              );
            })}
          </div>
        </div>

        <div>
          <span className={label}>Due</span>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {quickDue.map(([name, at]) => (
              <Chip key={name} onClick={() => setDue(dueFrom(at()))}>
                {name}
              </Chip>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              className="field"
              aria-label="Due date"
              value={due.date}
              onChange={(e) => setDue((d) => ({ ...d, date: e.target.value }))}
              required
            />
            <input
              type="time"
              className="field"
              aria-label="Due time (Beirut)"
              value={due.time}
              onChange={(e) => setDue((d) => ({ ...d, time: e.target.value }))}
              required
            />
          </div>
        </div>

        <div>
          <button
            type="button"
            onClick={() => setMore((m) => !m)}
            aria-expanded={more}
            className="flex items-center gap-1.5 text-xs font-semibold text-paper/55 hover:text-paper"
          >
            <ChevronDown className={cn("size-4 transition-transform", more && "rotate-180")} />
            Optional: estimate, category, internal notes
          </button>
          <AnimatePresence initial={false}>
            {more && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="space-y-3 pt-3">
                  <div>
                    <span className={label}>Estimated duration</span>
                    <div className="flex flex-wrap gap-1.5">
                      {[15, 30, 45, 60, 90].map((m) => (
                        <Chip key={m} active={est === m} onClick={() => setEst(est === m ? null : m)}>
                          {m} min
                        </Chip>
                      ))}
                    </div>
                  </div>
                  <input
                    className="field"
                    placeholder="Category (for example Opening, Safety)"
                    aria-label="Task category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  />
                  <textarea
                    className="field min-h-[60px]"
                    placeholder="Internal notes (visible to managers only)"
                    aria-label="Internal notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-white/10 bg-[#0b0f0d] p-4">
        <p className="hidden text-xs text-paper/45 sm:block">
          {est ? `${est} min estimate · ` : ""}
          {PRIORITY_LABEL[priority]} priority
        </p>
        <div className="ml-auto flex gap-2">
          <Btn onClick={closeComposer}>Cancel</Btn>
          <Btn variant="primary" type="submit">
            <Rocket className="size-4" /> Deploy task
          </Btn>
        </div>
      </div>

      <AnimatePresence>
        {deployed && (
          <motion.div
            className="absolute inset-0 z-10 grid place-items-center rounded-3xl bg-[#080b09]/96 backdrop-blur"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            role="status"
          >
            <div className="flex flex-col items-center gap-4 p-6 text-center">
              <motion.div
                className="relative grid size-24 place-items-center rounded-full bg-brand text-ink"
                initial={{ scale: 0.3, rotate: -30 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 260, damping: 16 }}
              >
                <motion.span
                  className="absolute inset-0 rounded-full border-2 border-brand"
                  initial={{ scale: 1, opacity: 0.8 }}
                  animate={{ scale: 2.1, opacity: 0 }}
                  transition={{ duration: 1.1, ease: EASE }}
                />
                <Rocket className="size-10" />
              </motion.div>
              <div>
                <p className="display text-3xl">Task deployed</p>
                <p className="mt-1.5 text-sm text-paper/65">
                  “{title.trim()}” is now in {deployed}&rsquo;s queue.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </form>
  );
}
