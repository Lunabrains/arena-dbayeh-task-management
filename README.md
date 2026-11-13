# Arena OS — Task Deployment & Team Performance (Demo)

A task deployment and employee performance command center for **Arena Dbayeh**, built by **Brains AI Solutions**.

This is a **demonstration environment**. It is front end only: there is no server, database or sign-in. Every person, task and report is fictional sample data stored in the browser.

The journey it demonstrates: **Assign → Prioritise → Start → Track → Complete → Report**.

## Run locally

```bash
npm install
npm run dev -- -p 3005
```

Open http://localhost:3005. No environment variables or API keys are needed.

```bash
npm run build   # production build
npm run start   # serve the production build
```

## Demo access

There are no passwords. On the first screen press **Explore Demo** and pick a profile:

| Profile | Person (fictional) | What they see |
| --- | --- | --- |
| Owner | Alex Haddad | Command Center, all tasks, departments, team, reports, settings |
| CEO | Maya Khoury | Same company-wide view as the Owner |
| General Manager | Karim Mansour | Command Center, Task Deployment, departments, employees, reports |
| Operations / Sales / Events / Sports / Restaurant Manager | Rami Nassar, Sarah Daher, Lea Nassar, Tony Mansour, Fadi Salem | Their own department only: team, tasks, reports |
| Employee | Jad Salem (Operations) | My Day, My Tasks, My Progress, Profile |
| Waiter | Samir Khoury (Quatro Restaurant) | The same simple employee screens, for restaurant staff |

Inside the app, the **Demo** pill or your avatar (top right) opens the profile switcher with all 31 people, plus **Reset demo**. On any employee card, **See their screen** jumps straight into that person's view.

Two browser tabs can hold two different profiles at once (for example an employee and the Owner). Changes made in one appear in the other immediately.

### Walk-through

1. **General Manager → Task Deployment → Deploy task.** Choose Operations, pick a template, choose Jad Salem, set Critical, Deploy. (To see an alert quickly, set the time allowed to 1 minute; as the Owner you can assign the same way to a waiter.)
2. **Employee (Jad Salem) → My Day.** The new task is at the top of the queue. Press Start, watch the timer, Pause, Resume, Done.
3. **Operations Manager → My Department.** The task is under "Completed today" with its tracked time, and the department numbers have moved.
4. **Owner → Command Center.** Company numbers are updated; click the Operations node on the 3D map (or the department list) for its people and tasks; open Reports.
5. **A department manager → Reports → Submissions → Submit report.** Then **General Manager → Reports → Submissions**: review it and submit the consolidated executive report. **Owner / CEO → Reports → Submissions** shows it.

## What is implemented

- **Roles and permissions**: Owner, CEO, General Manager, Department Manager, Employee. One permissions layer (`src/lib/permissions.ts`) guards every route, every list and every action; managers cannot open other departments, employees see only their own tasks.
- **Chain of command**: Owner > CEO > General Manager > Department Manager > Employee. Each position can assign tasks to, and manage the tasks of, everyone beneath it. The Owner can assign straight to a waiter; a department manager's chain is their own department.
- **Task deployment**: quick create dialog with department templates, assignee picker grouped by leadership, manager and team (waiters grouped by restaurant) showing current workload, four priorities, a time allowed for the task, quick deadlines, optional category and internal notes.
- **Time allowed and alerts**: every task carries a time allowed, set when it is assigned. When a running task passes it, the task is marked "Over time", the assignee sees a warning on their timer, and everyone above them gets a pop-up, an entry in the alert bell (top right), in "Needs attention" and in the activity feed.
- **Restaurants and waiters**: a Restaurants section (Owner, CEO, General Manager and the Restaurant Manager) lists each restaurant with its waiters, what each is doing now, and its open, overdue and over-time tasks. Quatro is named on Arena's website; the Terrace Café is a sample second outlet.
- **Filters**: the task board filters by status (all open, overdue, over time allowed, in progress, paused, not started, unassigned, completed today), by assignee, department, restaurant and priority, plus search. Team Activity filters by status, department and name. The Overdue tile and each alert open the board already filtered.
- **Priority lanes**: Critical / High / Medium / Low, sorted by manual order, then earliest deadline, then assignment order. Managers can move tasks up and down inside a priority, change priority, reassign, reopen, remove and escalate to the General Manager.
- **Live task timer**: Start, Pause, Resume, Done. Time is calculated from stored timestamps, so it stays correct after a refresh, a page change, a background tab or a sleeping device. Paused time is never counted. One running task per person; starting a second offers to pause the first. Completed tasks can only be reopened by an authorised manager.
- **Employee portal (mobile first)**: greeting, three numbers, priority queue with a large Start button, focused timer screen, completion animation with optional note and the next task, automatic end-of-day summary.
- **Department manager portal**: department numbers, live employee cards, quick Assign Task, attention list, activity feed, daily report.
- **Executive Command Center**: eight live KPI tiles, interactive 3D department map (with a flat fallback), live activity feed, rule-based "needs attention" panel, department drill-down panel.
- **Reporting**: employee, department and executive reports calculated from task data; daily / weekly / monthly filters; the submission chain manager → General Manager → Owner / CEO; CSV export and print / save as PDF.
- **Demo data**: 31 fictional people in 8 departments and 2 restaurants, about 115 tasks for today in every state, 14 days of history, activity logs and submitted reports. Generated from a fixed seed. **Reset demo** restores it.

### Rules worth knowing

- A task belongs to the business day of its **deadline**, in the **Asia/Beirut** time zone. Timestamps are stored in UTC.
- Completion rate = completed ÷ assigned × 100. Average task duration = total completed task duration ÷ completed tasks.
- "Overdue" is derived (deadline passed, not completed); it is not a status.
- Tracked time is active task time only. It is not attendance or total working hours.
- Removing a task is a soft delete, and submitted reports keep a frozen snapshot, so history is never silently changed.
- Sample data is regenerated at the start of each business day so the venue always looks mid-shift. Within a day everything you do persists in the browser.
- The profile switcher is a demo convenience, not authentication.

## Project map

```
src/lib/types.ts         entities (users, departments, tasks, time sessions, activity logs, reports)
src/lib/permissions.ts   who can see and do what, and each role's navigation
src/lib/engine.ts        every write: validation, state transitions, activity logging
src/lib/selectors.ts     every number on screen, derived from the data
src/lib/seed.ts          deterministic demo data
src/lib/repository.ts    persistence boundary (browser storage today)
src/lib/store.ts         app state, shared clock, actions
src/components/          design kit, shell (with the alert bell), task board and filters, composer, employee and department views, 3D map, reports
src/app/                 routes: / (role selection) and the role portals under (app)/
```

Stack: Next.js 16 (App Router), TypeScript, Tailwind CSS 4, shadcn/ui (Base UI) dialogs and sheets, Motion, React Three Fiber + Drei, Recharts, Zustand, Lucide.

## Deploy to Vercel

1. Push this repository to GitHub.
2. In Vercel choose **Add New → Project**, import the repository and keep the defaults (framework: Next.js, build command `next build`).
3. Deploy. No environment variables are required.

Or from the command line: `npx vercel` for a preview, `npx vercel --prod` for production.

## Connecting Supabase later

The screens never touch storage directly, so the interface does not need rebuilding:

1. **Tables**: create one table per entity in `src/lib/types.ts`. Field names already use database naming (`assigned_to`, `due_at`, `started_at`, …): `users`, `departments`, `tasks`, `task_time_sessions`, `task_activity_logs`, `daily_reports`, `executive_reports`.
2. **Persistence**: implement the `DataRepository` interface in `src/lib/repository.ts` with Supabase (`load`, `save`, `subscribe`) and pass it to the store in place of `localRepository`. For production, replace the whole-database `save` with one call per action — each function in `src/lib/engine.ts` maps to one insert or update.
3. **Realtime**: back `subscribe` with Supabase Realtime channels on `tasks`, `task_time_sessions` and `task_activity_logs`; the store already re-renders every screen when data arrives.
4. **Authentication**: replace the demo profile switcher with Supabase Auth and read the signed-in user's row from `users`.
5. **Permissions**: copy the rules in `src/lib/permissions.ts` into row-level security policies. In production they must be enforced by the database, not only by the interface.
6. **Time**: let the database set timestamps (`now()`) for timer events so a device with a wrong clock cannot skew tracked time.
