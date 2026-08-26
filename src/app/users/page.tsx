export const dynamic = "force-dynamic";

import { AppShell } from "@/components/layout/AppShell";
import { requireModule } from "@/features/auth/lib/session";
import { listUsers } from "@/features/users/service/user.service";
import { UsersManager } from "@/features/users/components/UsersManager";

export default async function UsersPage() {
  await requireModule("users", "view");
  const users = await listUsers();

  return (
    <AppShell>
      <div className="mb-4">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-100">Users</h1>
        <p className="text-zinc-500">
          Manage logins and control which modules each user can access.
        </p>
      </div>
      <UsersManager initialUsers={users} />
    </AppShell>
  );
}
