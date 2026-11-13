"use client";

import { Rocket } from "lucide-react";
import { Btn, PageHeader } from "@/components/kit";
import { TaskBoard } from "@/components/task-board";
import { canCreateTasks } from "@/lib/permissions";
import { useMe } from "@/lib/store";
import { openComposer } from "@/lib/ui";

const COPY = {
  owner: ["All Tasks", "Every task, by priority", "Company-wide view. You can assign a task to anyone in the company."],
  ceo: ["All Tasks", "Every task, by priority", "Company-wide view. You can assign a task to anyone beneath you."],
  gm: ["Task Deployment", "Assign. Prioritise. Track.", "Deploy tasks to any department, reassign and reprioritise in one place."],
  manager: ["Assign Tasks", "Your team's queue", "Assign tasks to your team, set priorities and follow them to completion."],
  employee: ["Tasks", "Tasks", ""],
} as const;

export default function TasksPage() {
  const me = useMe();
  const [eyebrow, title, sub] = COPY[me.role];
  return (
    <>
      <PageHeader eyebrow={eyebrow} title={title} sub={sub}>
        {canCreateTasks(me) && (
          <Btn variant="primary" size="lg" onClick={() => openComposer()}>
            <Rocket className="size-5" /> {me.role === "manager" ? "Assign task" : "Deploy task"}
          </Btn>
        )}
      </PageHeader>
      <TaskBoard />
    </>
  );
}
