"use client";

import { Crown, Eye, Pencil, MoreHorizontal, UserMinus, ArrowRightLeft } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { motion, AnimatePresence } from "framer-motion";
import { getInitials } from "@/lib/collaboration/presence";
import {
  labelForRole,
  canManageAccess,
  canChangeRole,
  canTransferOwnership,
} from "@/lib/collaboration/permissions";
import { useCollaborationContextOptional } from "./CollaborationProvider";
import type { CollabUser, CollabRole } from "@/lib/collaboration/socket";
import { cn } from "@/lib/utils";

// ─── Role Icon ────────────────────────────────────────────────────────────────

function RoleIcon({ role }: { role: CollabRole }) {
  if (role === "owner") return <Crown className="w-3 h-3 text-amber-400" />;
  if (role === "collaborator") return <Pencil className="w-3 h-3 text-brand-400" />;
  return <Eye className="w-3 h-3 text-surface-400" />;
}

// ─── Single Collaborator Row ──────────────────────────────────────────────────

interface CollaboratorRowProps {
  user: CollabUser;
  isCurrentUser: boolean;
  canManage: boolean;
  myRole: CollabRole;
  isOnline: boolean;
  onChangeRole: (role: CollabRole) => void;
  onRevoke: () => void;
  onTransfer: () => void;
}

function CollaboratorRow({
  user,
  isCurrentUser,
  canManage,
  myRole,
  isOnline,
  onChangeRole,
  onRevoke,
  onTransfer,
}: CollaboratorRowProps) {
  const roles: CollabRole[] = ["owner", "collaborator", "viewer"];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -8 }}
      className="flex items-center gap-2.5 py-2"
    >
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
          style={{ backgroundColor: user.color }}
        >
          {user.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.avatar}
              alt={user.name}
              className="w-full h-full rounded-full object-cover"
            />
          ) : (
            getInitials(user.name)
          )}
        </div>
        {isOnline && (
          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-400 border-2 border-surface-800" />
        )}
      </div>

      {/* Name & email */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-surface-100 truncate">
            {user.name}
            {isCurrentUser && (
              <span className="text-surface-500 font-normal"> (you)</span>
            )}
          </span>
          <RoleIcon role={user.role} />
        </div>
        <p className="text-xs text-surface-500 truncate">{user.email}</p>
      </div>

      {/* Role badge */}
      <span
        className={cn(
          "text-[10px] font-medium px-1.5 py-0.5 rounded",
          user.role === "owner" && "bg-amber-900/40 text-amber-300",
          user.role === "collaborator" && "bg-brand-900/40 text-brand-300",
          user.role === "viewer" && "bg-surface-700 text-surface-400"
        )}
      >
        {labelForRole(user.role)}
      </span>

      {/* Actions menu */}
      {canManage && !isCurrentUser && (
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button className="p-1 rounded text-surface-500 hover:text-surface-200 hover:bg-surface-700 transition-colors">
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </DropdownMenu.Trigger>

          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={4}
              className={cn(
                "z-50 min-w-[160px] rounded-lg border border-surface-700 bg-surface-800 shadow-xl py-1",
                "text-sm text-surface-200"
              )}
            >
              {/* Change role submenu */}
              <DropdownMenu.Sub>
                <DropdownMenu.SubTrigger className="flex items-center gap-2 px-3 py-1.5 hover:bg-surface-700 cursor-pointer outline-none">
                  <Pencil className="w-3.5 h-3.5 text-surface-400" />
                  Change role
                </DropdownMenu.SubTrigger>
                <DropdownMenu.SubContent
                  sideOffset={4}
                  className="z-50 min-w-[140px] rounded-lg border border-surface-700 bg-surface-800 shadow-xl py-1"
                >
                  {roles
                    .filter(
                      (r) => r !== user.role && canChangeRole(myRole, r)
                    )
                    .map((r) => (
                      <DropdownMenu.Item
                        key={r}
                        onClick={() => onChangeRole(r)}
                        className="flex items-center gap-2 px-3 py-1.5 hover:bg-surface-700 cursor-pointer outline-none"
                      >
                        <RoleIcon role={r} />
                        {labelForRole(r)}
                      </DropdownMenu.Item>
                    ))}
                </DropdownMenu.SubContent>
              </DropdownMenu.Sub>

              {/* Transfer ownership */}
              {canTransferOwnership(myRole) && user.role !== "owner" && (
                <DropdownMenu.Item
                  onClick={onTransfer}
                  className="flex items-center gap-2 px-3 py-1.5 hover:bg-surface-700 cursor-pointer outline-none text-amber-300"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                  Transfer ownership
                </DropdownMenu.Item>
              )}

              <DropdownMenu.Separator className="my-1 border-t border-surface-700" />

              {/* Revoke */}
              <DropdownMenu.Item
                onClick={onRevoke}
                className="flex items-center gap-2 px-3 py-1.5 hover:bg-red-900/40 cursor-pointer outline-none text-red-400"
              >
                <UserMinus className="w-3.5 h-3.5" />
                Remove access
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      )}
    </motion.div>
  );
}

// ─── CollaboratorList ─────────────────────────────────────────────────────────

export function CollaboratorList() {
  const ctx = useCollaborationContextOptional();
  if (!ctx) return null;

  const { currentUser, otherUsers, presence, myRole, changeRole, revokeAccess, transferOwnership } =
    ctx;

  const allUsers: CollabUser[] = [currentUser, ...otherUsers];
  const canManage = myRole ? canManageAccess(myRole) : false;

  return (
    <div>
      <h4 className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-2">
        {allUsers.length} participant{allUsers.length !== 1 ? "s" : ""}
      </h4>
      <div className="divide-y divide-surface-700/50">
        <AnimatePresence initial={false}>
          {allUsers.map((user) => (
            <CollaboratorRow
              key={user.id}
              user={user}
              isCurrentUser={user.id === currentUser.id}
              canManage={canManage}
              myRole={myRole ?? "viewer"}
              isOnline={presence.users.has(user.id)}
              onChangeRole={(role) => changeRole(user.id, role)}
              onRevoke={() => revokeAccess(user.id)}
              onTransfer={() => transferOwnership(user.id)}
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
