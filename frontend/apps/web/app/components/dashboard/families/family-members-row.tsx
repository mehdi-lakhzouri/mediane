"use client";

import { motion } from "framer-motion";
import {
  CalendarDays,
  Crown,
  RefreshCcw,
  ShieldCheck,
  UserRound,
  UsersRound,
} from "lucide-react";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import type {
  AdminFamily,
  AdminFamilyMember,
} from "../../../../lib/api/admin-families";
import {
  useFormatters,
  useMessages,
} from "../../../../lib/i18n/locale-provider";
import { listItemMotion } from "../motion";
import { fullName } from "../users/format";
import { familiesMessages } from "./families.messages";

export interface FamilyDetailState {
  data: AdminFamily | null;
  loading: boolean;
  /** Kept as the failure itself so its message follows a language switch. */
  error: { cause: unknown } | null;
}

function initials(member: AdminFamilyMember): string {
  return `${member.firstName.at(0) ?? ""}${member.lastName.at(0) ?? ""}`.toUpperCase();
}

export function FamilyMembersRow({
  family,
  state,
  errorMessage,
  onRetry,
  onManage,
}: {
  family: AdminFamily;
  state: FamilyDetailState | undefined;
  /** Shown when loading the members failed. */
  errorMessage: string;
  onRetry: () => void;
  onManage: () => void;
}) {
  const t = useMessages(familiesMessages).row;
  const format = useFormatters();
  const details = state?.data;

  return (
    <div className="border-t border-[#e2e9f5] px-4 py-5 sm:px-8">
      <div className="rounded-[12px] border border-[#d9e3f3] bg-white shadow-[0_1px_2px_rgba(16,24,40,.02)]">
        <div className="flex flex-col gap-3 border-b border-[#e6ecf6] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            <div className="flex items-center gap-2">
              <UsersRound className="size-[18px] text-primary" />
              <h3 className="text-[14px] font-semibold text-foreground">
                {t.membersOf(family.name)}
              </h3>
              {details ? (
                <Badge variant="secondary">
                  {t.count(details.memberCount)}
                </Badge>
              ) : null}
            </div>
            <p className="mt-1 text-[12px] text-muted-foreground">
              {t.privacy}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {details?.pendingRequestCount ? (
              <Badge variant="warning">
                {t.waiting(details.pendingRequestCount)}
              </Badge>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-[8px]"
              onClick={onManage}
            >
              {t.manage}
            </Button>
          </div>
        </div>

        {state?.loading || !state ? (
          <div className="space-y-3 px-5 py-5" aria-label={t.loading}>
            {[0, 1].map((row) => (
              <div key={row} className="flex items-center gap-3">
                <Skeleton className="size-9 rounded-full" />
                <Skeleton className="h-4 w-44" />
                <Skeleton className="ml-auto h-6 w-20" />
                <Skeleton className="hidden h-4 w-28 sm:block" />
              </div>
            ))}
          </div>
        ) : state.error ? (
          <div className="flex min-h-28 flex-col items-center justify-center px-5 py-5 text-center">
            <p className="text-[13px] font-medium text-foreground">
              {errorMessage}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3 rounded-[8px]"
              onClick={onRetry}
            >
              <RefreshCcw /> {t.retry}
            </Button>
          </div>
        ) : details?.members?.length ? (
          <div>
            <div className="hidden grid-cols-[minmax(220px,1fr)_150px_180px] gap-4 bg-[#fbfcff] px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground sm:grid">
              {t.columns.map((column) => (
                <span key={column}>{column}</span>
              ))}
            </div>
            <ul className="divide-y divide-[#e6ecf6]">
              {details.members.map((member, index) => (
                <motion.li
                  key={member.userId}
                  custom={index}
                  variants={listItemMotion}
                  initial="hidden"
                  animate="show"
                  className="grid gap-3 px-5 py-3.5 sm:grid-cols-[minmax(220px,1fr)_150px_180px] sm:items-center sm:gap-4"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#eef3ff] text-[11px] font-bold text-[#2441d5]">
                      {initials(member)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-semibold text-foreground">
                        {fullName(member)}
                      </p>
                      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                        {t.driverAccount}
                      </p>
                    </div>
                  </div>
                  <div>
                    {member.role === "OWNER" ? (
                      <Badge
                        variant="warning"
                        className="border-[#efca72] bg-[#fff8e8] text-[#956006]"
                      >
                        <Crown /> {t.owner}
                      </Badge>
                    ) : (
                      <Badge variant="secondary">
                        <UserRound /> {t.member}
                      </Badge>
                    )}
                  </div>
                  <p className="flex items-center gap-2 text-[12px] text-muted-foreground tabular-nums">
                    <CalendarDays className="size-3.5" />
                    {format.date(member.joinedAt)}
                  </p>
                </motion.li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="grid min-h-28 place-items-center px-5 py-5 text-center">
            <div>
              <ShieldCheck className="mx-auto size-5 text-muted-foreground" />
              <p className="mt-2 text-[13px] text-muted-foreground">
                {t.empty}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
