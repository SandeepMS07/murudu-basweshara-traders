"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  MODULES,
  MODULE_LABELS,
  type ModuleKey,
  type PermissionLevel,
} from "@/features/auth/lib/permissions";
import type { AppUser } from "@/features/users/schemas";
import {
  createUserAction,
  deleteUserAction,
  updateUserAction,
} from "@/app/users/actions";

const LEVELS: PermissionLevel[] = ["none", "view", "edit"];

// Modules an operator can be granted (Users management stays admin-only in practice).
const ASSIGNABLE_MODULES = MODULES.filter((m) => m !== "users");

type FormState = {
  email: string;
  password: string;
  role: "admin" | "operator";
  permissions: Record<string, PermissionLevel>;
};

function emptyPermissions(): Record<string, PermissionLevel> {
  const map: Record<string, PermissionLevel> = {};
  for (const m of ASSIGNABLE_MODULES) map[m] = "none";
  return map;
}

const inputClass =
  "h-10 border-[#2a2d34] bg-[#14161b] text-zinc-100 placeholder:text-zinc-500";
const selectClass =
  "h-9 rounded-md border border-[#2a2d34] bg-[#14161b] px-2 text-sm text-zinc-100 outline-none focus:border-[#ff8f6b]/50";

export function UsersManager({ initialUsers }: { initialUsers: AppUser[] }) {
  const router = useRouter();
  const [users, setUsers] = useState<AppUser[]>(initialUsers);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AppUser | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AppUser | null>(null);
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState<FormState>({
    email: "",
    password: "",
    role: "operator",
    permissions: emptyPermissions(),
  });

  const isEditing = Boolean(editing);

  const summarize = useMemo(
    () => (user: AppUser) => {
      if (user.role === "admin") return "Full access (admin)";
      const granted = ASSIGNABLE_MODULES.filter(
        (m) => (user.permissions[m] ?? "none") !== "none",
      );
      if (granted.length === 0) return "No modules";
      return granted
        .map((m) => `${MODULE_LABELS[m]} (${user.permissions[m]})`)
        .join(", ");
    },
    [],
  );

  const openCreate = () => {
    setEditing(null);
    setForm({
      email: "",
      password: "",
      role: "operator",
      permissions: emptyPermissions(),
    });
    setDialogOpen(true);
  };

  const openEdit = (user: AppUser) => {
    setEditing(user);
    setForm({
      email: user.email,
      password: "",
      role: user.role,
      permissions: { ...emptyPermissions(), ...user.permissions },
    });
    setDialogOpen(true);
  };

  const setLevel = (module: ModuleKey, level: PermissionLevel) => {
    setForm((f) => ({ ...f, permissions: { ...f.permissions, [module]: level } }));
  };

  const handleSubmit = () => {
    startTransition(async () => {
      const payload = {
        email: form.email,
        role: form.role,
        permissions: form.permissions,
        ...(form.password ? { password: form.password } : {}),
      };

      const result =
        isEditing && editing
          ? await updateUserAction(editing.id, payload)
          : await createUserAction(payload);

      if (!result.success) {
        toast.error(result.message);
        return;
      }

      setUsers((current) => {
        if (isEditing && editing) {
          return current.map((u) => (u.id === result.user.id ? result.user : u));
        }
        return [...current, result.user];
      });
      toast.success(isEditing ? "User updated" : "User created");
      setDialogOpen(false);
      router.refresh();
    });
  };

  const handleDelete = () => {
    if (!confirmDelete) return;
    startTransition(async () => {
      const result = await deleteUserAction(confirmDelete.id);
      if (!result.success) {
        toast.error(result.message);
        return;
      }
      setUsers((current) => current.filter((u) => u.id !== confirmDelete.id));
      toast.success("User deleted");
      setConfirmDelete(null);
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          onClick={openCreate}
          className="cursor-pointer border border-[#ff6a3d] bg-[#ff6a3d] text-white hover:bg-[#ff5a28]"
        >
          <Plus className="mr-1 h-4 w-4" /> Add User
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-[#1f2229] bg-[#14161b]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1f2229] text-left text-zinc-400">
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Module access</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-zinc-500">
                  No users yet.
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id} className="border-b border-[#1a1c22] last:border-0">
                  <td className="px-4 py-3 text-zinc-100">{user.email}</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        user.role === "admin"
                          ? "rounded border border-[#7a4a22] bg-[#3a2417] px-2 py-0.5 text-xs text-[#ffb792]"
                          : "rounded border border-[#2a2d34] bg-[#1b1e24] px-2 py-0.5 text-xs text-zinc-300"
                      }
                    >
                      {user.role}
                    </span>
                  </td>
                  <td className="max-w-[420px] px-4 py-3 text-zinc-400">
                    {summarize(user)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Edit"
                        onClick={() => openEdit(user)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Delete"
                        onClick={() => setConfirmDelete(user)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create / edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto border border-[#2a2d34] bg-[#15171c] text-zinc-100 shadow-[0_20px_50px_rgba(0,0,0,0.55)] sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle className="text-zinc-100">
              {isEditing ? "Edit User" : "Add User"}
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              Set the login details and choose which modules this user can access.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm text-zinc-300">Email</label>
              <Input
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className={inputClass}
                placeholder="user@example.com"
                type="email"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm text-zinc-300">
                Password{" "}
                {isEditing ? (
                  <span className="text-zinc-500">(leave blank to keep current)</span>
                ) : null}
              </label>
              <Input
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                className={inputClass}
                placeholder={isEditing ? "••••••" : "At least 6 characters"}
                type="password"
                autoComplete="new-password"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm text-zinc-300">Role</label>
              <select
                value={form.role}
                onChange={(e) =>
                  setForm((f) => ({ ...f, role: e.target.value as FormState["role"] }))
                }
                className={`${selectClass} w-full`}
              >
                <option value="operator">Operator (module access below)</option>
                <option value="admin">Admin (full access to everything)</option>
              </select>
            </div>

            {form.role === "operator" ? (
              <div className="rounded-md border border-[#2a2d34] bg-[#12141a] p-3">
                <p className="mb-2 text-sm font-medium text-zinc-300">Module access</p>
                <div className="space-y-2">
                  {ASSIGNABLE_MODULES.map((module) => (
                    <div
                      key={module}
                      className="flex items-center justify-between gap-3"
                    >
                      <span className="text-sm text-zinc-300">
                        {MODULE_LABELS[module]}
                      </span>
                      <select
                        value={form.permissions[module] ?? "none"}
                        onChange={(e) =>
                          setLevel(module, e.target.value as PermissionLevel)
                        }
                        className={selectClass}
                      >
                        {LEVELS.map((lvl) => (
                          <option key={lvl} value={lvl}>
                            {lvl === "none"
                              ? "No access"
                              : lvl === "view"
                                ? "View only"
                                : "Full (edit)"}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="rounded-md border border-[#7a4a22] bg-[#3a2417]/40 p-3 text-sm text-[#ffb792]">
                Admins have full access to every module and can manage users.
              </p>
            )}
          </div>

          <DialogFooter className="-mx-4 -mb-4 rounded-b-xl border-t border-[#2a2d34] bg-[#15171c] p-4">
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => setDialogOpen(false)}
              className="border-[#2a2d34] bg-[#1b1e24] text-zinc-200 hover:bg-[#23262e] hover:text-zinc-100"
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={isPending}
              onClick={handleSubmit}
              className="border border-[#ff6a3d] bg-[#ff6a3d] text-white hover:bg-[#ff5a28]"
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isEditing ? (
                "Save"
              ) : (
                "Create"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog
        open={Boolean(confirmDelete)}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
      >
        <DialogContent
          showCloseButton={false}
          className="border border-[#2a2d34] bg-[#15171c] text-zinc-100 shadow-[0_20px_50px_rgba(0,0,0,0.55)]"
        >
          <DialogHeader>
            <DialogTitle className="text-zinc-100">Delete User</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Delete {confirmDelete?.email}? This removes their login and access.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="-mx-4 -mb-4 rounded-b-xl border-t border-[#2a2d34] bg-[#15171c] p-4">
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => setConfirmDelete(null)}
              className="border-[#2a2d34] bg-[#1b1e24] text-zinc-200 hover:bg-[#23262e] hover:text-zinc-100"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isPending}
              onClick={handleDelete}
              className="border border-[#ff6a3d] bg-[#ff6a3d] text-white hover:bg-[#ff5a28]"
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
