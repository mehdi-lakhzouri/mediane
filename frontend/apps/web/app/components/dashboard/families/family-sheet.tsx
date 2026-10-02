"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Crown,
  LoaderCircle,
  MoreVertical,
  Search,
  Trash2,
  UserMinus,
  UserPlus,
  UsersRound,
} from "lucide-react";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import { Input } from "@repo/ui/components/ui/input";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@repo/ui/components/ui/sheet";
import {
  addFamilyMember,
  dissolveFamily,
  FAMILY_MAX_MEMBERS,
  getFamily,
  removeFamilyMember,
  setFamilyOwner,
  type AdminFamily,
  type AdminFamilyMember,
} from "../../../../lib/api/admin-families";
import { listUsers, type AdminUser } from "../../../../lib/api/admin-users";
import { ApiError } from "../../../../lib/api/client";
import { ConfirmDialog, type ConfirmRequest } from "../confirm-dialog";
import { useToast } from "../toast-provider";
import { formatDate, fullName } from "../users/format";

function letters(person: { firstName: string; lastName: string }): string {
  return `${person.firstName.at(0) ?? ""}${person.lastName.at(0) ?? ""}`.toUpperCase();
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

interface FamilySheetProps {
  family: AdminFamily | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The family changed (or was dissolved): refresh the list. */
  onChanged: () => void;
}

/**
 * Console view of one family. Shows who is in it and lets an administrator
 * fix membership; members' shared data (phone, incidents, health) is never
 * exposed here.
 */
export function FamilySheet({
  family,
  open,
  onOpenChange,
  onChanged,
}: FamilySheetProps) {
  const toast = useToast();
  const [details, setDetails] = useState<AdminFamily | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
  const [adding, setAdding] = useState(false);

  const familyId = family?.id;
  const load = useCallback(async () => {
    if (!familyId) return;
    setLoading(true);
    try {
      setDetails(await getFamily(familyId));
    } catch (error) {
      toast.error(
        "Could not load the family.",
        errorMessage(error, "Please try again."),
      );
    } finally {
      setLoading(false);
    }
  }, [familyId, toast]);

  useEffect(() => {
    if (open) {
      setDetails(null);
      setAdding(false);
      void load();
    }
  }, [open, load]);

  const current = details ?? family;
  if (!current) return null;
  const members = details?.members ?? [];
  const full =
    (details?.memberCount ?? current.memberCount) >= FAMILY_MAX_MEMBERS;

  async function run(
    action: () => Promise<AdminFamily | null>,
    success: string,
  ): Promise<void> {
    try {
      const updated = await action();
      onChanged();
      if (!updated) {
        toast.success(
          success,
          "The family no longer has members and was dissolved.",
        );
        onOpenChange(false);
        return;
      }
      setDetails(updated);
      toast.success(success);
    } catch (error) {
      toast.error(
        "That didn't work.",
        errorMessage(error, "Please try again."),
      );
    }
  }

  function askMakeOwner(member: AdminFamilyMember) {
    setConfirm({
      title: `Make ${fullName(member)} the owner?`,
      description:
        "The owner approves join requests, shares the family code and manages members. The current owner becomes a regular member.",
      actionLabel: "Make owner",
      run: () =>
        run(
          () => setFamilyOwner(current!.id, member.userId),
          "Ownership transferred.",
        ),
    });
  }

  function askRemove(member: AdminFamilyMember) {
    const isOwner = member.role === "OWNER";
    setConfirm({
      title: `Remove ${fullName(member)}?`,
      description: isOwner
        ? "The longest-standing member becomes owner. If nobody else is in the family, it is dissolved."
        : "They leave the family and stop seeing what its members share.",
      actionLabel: "Remove",
      destructive: true,
      run: () =>
        run(
          () => removeFamilyMember(current!.id, member.userId),
          "Member removed.",
        ),
    });
  }

  function askDissolve() {
    setConfirm({
      title: `Dissolve “${current!.name}”?`,
      description:
        "Every member leaves the family and pending requests are dropped. Members can create or join another family afterwards. Type the family name to confirm.",
      actionLabel: "Dissolve",
      destructive: true,
      confirmText: current!.name,
      run: async () => {
        try {
          await dissolveFamily(current!.id);
          toast.success("Family dissolved.");
          onChanged();
          onOpenChange(false);
        } catch (error) {
          toast.error(
            "That didn't work.",
            errorMessage(error, "Please try again."),
          );
        }
      },
    });
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          overlayClassName="bg-[#101828]/28 backdrop-blur-[8px] backdrop-saturate-75"
          closeClassName="top-6 right-6 z-20 text-[#39507f] opacity-100 hover:bg-[#eef3ff] [&_svg]:size-5"
          className="w-full bg-white shadow-[-18px_0_60px_rgba(16,24,40,.18)] sm:max-w-[614px]"
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <SheetHeader className="sticky top-0 z-10 gap-1 border-0 bg-white/95 px-7 pt-7 pb-5 pr-16 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <SheetTitle className="text-[26px] leading-8 tracking-[-0.035em]">
                Family details
              </SheetTitle>
              {loading && (
                <LoaderCircle className="size-4 animate-spin text-muted-foreground" />
              )}
            </div>
            <p className="text-[14px] leading-5 text-[#536489]">
              Who belongs to this family. What members share with each other
              stays private.
            </p>
          </SheetHeader>

          <SheetBody className="px-7 pt-0 pb-7">
            <section className="rounded-[12px] border border-[#d7e1f2] bg-[#f8faff] px-5 py-5">
              <div className="flex items-center gap-5">
                <span className="grid size-[72px] shrink-0 place-items-center rounded-2xl bg-[#e7edff] text-[#2441d5]">
                  <UsersRound className="size-8" strokeWidth={1.8} />
                </span>
                <div className="min-w-0">
                  <h2 className="truncate text-[24px] font-bold tracking-[-0.03em] text-foreground">
                    {current.name}
                  </h2>
                  <p className="mt-1 text-[13px] text-[#536489]">
                    Created {formatDate(current.createdAt)}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge variant={full ? "warning" : "secondary"}>
                      {details?.memberCount ?? current.memberCount} /{" "}
                      {FAMILY_MAX_MEMBERS} members
                    </Badge>
                    {details?.pendingRequestCount ? (
                      <Badge variant="outline">
                        {details.pendingRequestCount} waiting to join
                      </Badge>
                    ) : null}
                  </div>
                </div>
              </div>
            </section>

            <div className="mt-7 flex items-center justify-between">
              <h3 className="text-[16px] font-semibold text-foreground">
                Members
              </h3>
              <Button
                variant="outline"
                size="sm"
                disabled={full}
                title={full ? "This family is full" : undefined}
                onClick={() => setAdding((value) => !value)}
                className="rounded-[9px]"
              >
                <UserPlus />
                Add a driver
              </Button>
            </div>

            {adding && (
              <AddDriverPanel
                onAdd={async (driver) => {
                  await run(
                    () => addFamilyMember(current.id, driver.id),
                    `${fullName(driver)} added.`,
                  );
                  setAdding(false);
                }}
              />
            )}

            <ul className="mt-3 divide-y divide-[#e6ecf6] rounded-[12px] border border-[#e1e8f4]">
              {members.length === 0 && (
                <li className="px-4 py-6 text-center text-[13px] text-muted-foreground">
                  {loading ? "Loading members…" : "No members."}
                </li>
              )}
              {members.map((member) => (
                <li
                  key={member.userId}
                  className="flex items-center gap-3 px-4 py-3"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#eef3ff] text-[13px] font-bold text-[#2441d5]">
                    {letters(member)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 truncate text-[14px] font-medium text-foreground">
                      {fullName(member)}
                      {member.role === "OWNER" && (
                        <Badge variant="default" className="h-6 gap-1 px-2">
                          <Crown className="size-3" /> Owner
                        </Badge>
                      )}
                    </p>
                    <p className="text-[12px] text-muted-foreground">
                      Joined {formatDate(member.joinedAt)}
                    </p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      aria-label={`Actions for ${fullName(member)}`}
                      className="grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                      <MoreVertical className="size-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-[200px]">
                      {member.role !== "OWNER" && (
                        <DropdownMenuItem onSelect={() => askMakeOwner(member)}>
                          <Crown /> Make owner
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        variant="destructive"
                        onSelect={() => askRemove(member)}
                      >
                        <UserMinus /> Remove from family
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </li>
              ))}
            </ul>

            <div className="mt-8 rounded-[12px] border border-danger/20 bg-danger/[0.03] px-5 py-4">
              <p className="text-[14px] font-semibold text-foreground">
                Dissolve this family
              </p>
              <p className="mt-1 text-[13px] text-muted-foreground">
                For abuse or at the members&apos; request. Everyone leaves the
                family.
              </p>
              <Button
                variant="destructive"
                size="sm"
                className="mt-3 rounded-[9px]"
                onClick={askDissolve}
              >
                <Trash2 /> Dissolve family
              </Button>
            </div>
          </SheetBody>
        </SheetContent>
      </Sheet>

      <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
    </>
  );
}

/** Finds an active driver by name or email; drivers already in a family are refused by the API. */
function AddDriverPanel({
  onAdd,
}: {
  onAdd: (driver: AdminUser) => Promise<void>;
}) {
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<AdminUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    const value = term.trim();
    if (value.length < 2) {
      setResults([]);
      return;
    }
    let active = true;
    const timer = setTimeout(() => {
      setSearching(true);
      listUsers({
        page: 1,
        pageSize: 5,
        search: value,
        role: "DRIVER",
        status: "ACTIVE",
      })
        .then((page) => {
          if (active) setResults(page.items);
        })
        .catch(() => {
          if (active) setResults([]);
        })
        .finally(() => {
          if (active) setSearching(false);
        });
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [term]);

  return (
    <div className="mt-3 rounded-[12px] border border-[#d7e1f2] bg-[#f8faff] p-3">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          autoFocus
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Search an active driver by name or email…"
          aria-label="Search a driver"
          className="h-10 rounded-[9px] bg-white pl-10"
        />
      </div>
      <ul className="mt-2 space-y-1">
        {searching && (
          <li className="px-2 py-2 text-[13px] text-muted-foreground">
            Searching…
          </li>
        )}
        {!searching && term.trim().length >= 2 && results.length === 0 && (
          <li className="px-2 py-2 text-[13px] text-muted-foreground">
            No active driver matches.
          </li>
        )}
        {results.map((driver) => (
          <li
            key={driver.id}
            className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-white"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-foreground">
                {fullName(driver)}
              </p>
              <p className="truncate text-[12px] text-muted-foreground">
                {driver.email}
              </p>
            </div>
            <Button
              size="sm"
              disabled={pending !== null}
              onClick={async () => {
                setPending(driver.id);
                try {
                  await onAdd(driver);
                } finally {
                  setPending(null);
                }
              }}
              className="rounded-[8px]"
            >
              {pending === driver.id ? (
                <LoaderCircle className="animate-spin" />
              ) : (
                <UserPlus />
              )}
              Add
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
