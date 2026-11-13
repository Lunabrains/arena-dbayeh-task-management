"use client";

import { DepartmentView } from "@/components/department";
import { Empty } from "@/components/kit";
import { useMe } from "@/lib/store";

export default function MyDepartmentPage() {
  const me = useMe();
  if (!me.department_id) return <Empty title="No department" hint="This profile is not attached to a department." />;
  return <DepartmentView deptId={me.department_id} wide />;
}
