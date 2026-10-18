"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  CalendarDays,
  ChevronDown,
  Clock3,
  Database,
  FileText,
  KeyRound,
  LoaderCircle,
  Mail,
  MoreVertical,
  Pencil,
  RotateCcw,
  Send,
  ShieldBan,
  ShieldCheck,
  Trash2,
  UserRound,
} from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import { Badge } from "@repo/ui/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@repo/ui/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@repo/ui/components/ui/tooltip";
import {
  getInvitationStatus,
  getUser,
  updateUser,
  type AdminUser,
  type InvitationStatus,
} from "../../../../lib/api/admin-users";
import { ApiError } from "../../../../lib/api/client";
import { useErrorText } from "../../../../lib/i18n/api-errors";
import {
  useFormatters,
  useMessages,
} from "../../../../lib/i18n/locale-provider";
import { defineMessages } from "../../../../lib/i18n/messages";
import { labelMessages } from "../labels";
import { useToast } from "../toast-provider";
import { fullName, initials } from "./format";
import { AccountStateBadge, RoleBadge } from "./user-badges";

const messages = defineMessages({
  en: {
    title: "User details",
    subtitle: "View and manage user information, role, and access permissions.",
    sendMessage: "Send message",
    edit: "Edit user",
    more: "More actions",
    resend: "Resend invitation",
    revoke: "Revoke invitation",
    suspend: "Suspend account",
    reactivate: "Reactivate account",
    restore: "Restore account",
    deletePermanently: "Delete permanently",
    softDelete: "Soft delete account",
    editIdentity: "Edit identity",
    firstName: "First name",
    firstNameHint:
      "The given name displayed throughout the administration console.",
    firstNamePlaceholder: "Enter first name",
    lastName: "Last name",
    lastNameHint: "The family name used to identify this account.",
    lastNamePlaceholder: "Enter last name",
    cancel: "Cancel",
    save: "Save changes",
    saveFailed: "Could not save. Please try again.",
    updateFailed: "User update failed.",
    account: "Account information",
    fullName: "Full name",
    fullNameHint: "The account holder’s full display name.",
    email: "Email address",
    emailHint: "The verified address used for invitations and sign-in.",
    role: "Role",
    roleHint: "Determines the permissions granted to this account.",
    state: "Account state",
    stateHint:
      "The effective access and onboarding state calculated by the backend.",
    mfa: "Two-step verification",
    mfaHint: "An authenticator app is required at every sign-in.",
    on: "On",
    off: "Off",
    since: "User since",
    sinceHint: "The date and time when the account was created.",
    lastLogin: "Last sign-in",
    lastLoginHint:
      "The most recent successful authentication recorded for this account.",
    additional: "Additional details",
    invitedBy: "Invited by",
    invitedByHint: "The administrator who originally invited this user.",
    invitationStatus: "Invitation status",
    invitationStatusHint:
      "The current lifecycle state of the latest invitation.",
    createdAt: "Created at",
    createdAtHint: "When the latest invitation was created.",
    notAvailable: "Not available",
    about: (label: string) => `About ${label}`,
  },
  fr: {
    title: "Détails de l’utilisateur",
    subtitle:
      "Consultez et gérez les informations, le rôle et les droits d’accès de l’utilisateur.",
    sendMessage: "Envoyer un message",
    edit: "Modifier l’utilisateur",
    more: "Plus d’actions",
    resend: "Renvoyer l’invitation",
    revoke: "Révoquer l’invitation",
    suspend: "Suspendre le compte",
    reactivate: "Réactiver le compte",
    restore: "Restaurer le compte",
    deletePermanently: "Supprimer définitivement",
    softDelete: "Supprimer le compte",
    editIdentity: "Modifier l’identité",
    firstName: "Prénom",
    firstNameHint:
      "Le prénom affiché dans l’ensemble de la console d’administration.",
    firstNamePlaceholder: "Saisissez le prénom",
    lastName: "Nom",
    lastNameHint: "Le nom de famille utilisé pour identifier ce compte.",
    lastNamePlaceholder: "Saisissez le nom",
    cancel: "Annuler",
    save: "Enregistrer les modifications",
    saveFailed: "Enregistrement impossible. Veuillez réessayer.",
    updateFailed: "Échec de la mise à jour de l’utilisateur.",
    account: "Informations du compte",
    fullName: "Nom complet",
    fullNameHint: "Le nom complet affiché pour le titulaire du compte.",
    email: "Adresse e-mail",
    emailHint:
      "L’adresse vérifiée utilisée pour les invitations et la connexion.",
    role: "Rôle",
    roleHint: "Détermine les autorisations accordées à ce compte.",
    state: "État du compte",
    stateHint:
      "L’état effectif d’accès et d’intégration calculé par le serveur.",
    mfa: "Vérification en deux étapes",
    mfaHint:
      "Une application d’authentification est requise à chaque connexion.",
    on: "Activée",
    off: "Désactivée",
    since: "Utilisateur depuis",
    sinceHint: "La date et l’heure de création du compte.",
    lastLogin: "Dernière connexion",
    lastLoginHint:
      "La dernière authentification réussie enregistrée pour ce compte.",
    additional: "Informations complémentaires",
    invitedBy: "Invité par",
    invitedByHint: "L’administrateur qui a invité cet utilisateur.",
    invitationStatus: "Statut de l’invitation",
    invitationStatusHint: "L’état actuel de la dernière invitation.",
    createdAt: "Créée le",
    createdAtHint: "La date de création de la dernière invitation.",
    notAvailable: "Non disponible",
    about: (label: string) => `À propos : ${label}`,
  },
});

type SheetMessages = (typeof messages)["en"];

export type UserDrawerAction =
  | "suspend"
  | "reactivate"
  | "resend"
  | "revoke"
  | "delete"
  | "restore"
  | "hard-delete";

interface UserSheetProps {
  user: AdminUser | null;
  open: boolean;
  isSelf: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (user: AdminUser) => void;
  onAction: (action: UserDrawerAction, user: AdminUser) => void;
}

export function UserSheet({
  user,
  open,
  isSelf,
  onOpenChange,
  onSaved,
  onAction,
}: UserSheetProps) {
  const t = useMessages(messages);
  const labels = useMessages(labelMessages);
  const format = useFormatters();
  const errorText = useErrorText();
  const toast = useToast();
  const [details, setDetails] = useState<AdminUser | null>(null);
  const [invitation, setInvitation] = useState<InvitationStatus | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setDetails(user);
    setFirstName(user.firstName);
    setLastName(user.lastName);
    setEditing(false);
    setError(null);
    setInvitation(null);
  }, [user]);

  useEffect(() => {
    if (!open || !user) return;
    let active = true;
    setLoadingDetails(true);

    getUser(user.id)
      .then((fresh) => {
        if (!active) return;
        setDetails(fresh);
        setFirstName(fresh.firstName);
        setLastName(fresh.lastName);
      })
      .catch(() => {
        if (active) setDetails(user);
      })
      .finally(() => {
        if (active) setLoadingDetails(false);
      });

    getInvitationStatus(user.id)
      .then((status) => {
        if (active) setInvitation(status);
      })
      .catch(() => {
        if (active) setInvitation(null);
      });

    return () => {
      active = false;
    };
  }, [open, user]);

  if (!user) return null;
  const current = details ?? user;
  const deleted = current.deletedAt !== null;
  const dirty =
    firstName.trim() !== current.firstName ||
    lastName.trim() !== current.lastName;

  async function handleSave() {
    if (!dirty || saving) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await updateUser(current.id, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      });
      setDetails(updated);
      onSaved(updated);
      setEditing(false);
    } catch (err) {
      const message =
        err instanceof ApiError ? errorText.message(err) : t.saveFailed;
      setError(message);
      toast.error(t.updateFailed, message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <TooltipProvider delayDuration={180}>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          overlayClassName="bg-[#101828]/28 backdrop-blur-[8px] backdrop-saturate-75"
          closeClassName="top-6 right-6 z-20 text-[#39507f] opacity-100 hover:bg-[#eef3ff] [&_svg]:size-5"
          className="cg-user-drawer w-full bg-white shadow-[-18px_0_60px_rgba(16,24,40,.18)] sm:max-w-[614px]"
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <SheetHeader className="sticky top-0 z-10 gap-1 border-0 bg-white/95 px-7 pt-7 pb-5 pr-16 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <SheetTitle className="text-[26px] leading-8 tracking-[-0.035em]">
                {t.title}
              </SheetTitle>
              {loadingDetails && (
                <LoaderCircle className="size-4 animate-spin text-muted-foreground" />
              )}
            </div>
            <p className="text-[14px] leading-5 text-[#536489]">{t.subtitle}</p>
          </SheetHeader>

          <SheetBody className="px-7 pt-0 pb-5">
            <section className="overflow-hidden rounded-[12px] border border-[#d7e1f2] bg-[#f8faff] shadow-[0_1px_2px_rgba(16,24,40,.02)]">
              <div className="flex items-center gap-7 px-5 py-5">
                <span className="grid size-[100px] shrink-0 place-items-center rounded-full bg-[#e7edff] text-[28px] font-bold text-[#2441d5]">
                  {initials(current)}
                </span>
                <div className="min-w-0 text-left">
                  <h2 className="text-[27px] font-bold tracking-[-0.035em] text-foreground">
                    {fullName(current)}
                  </h2>
                  <p className="mt-1 truncate text-[14px] text-[#536489]">
                    {current.email}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <RoleBadge role={current.role} />
                    <AccountStateBadge state={current.accountState} />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 px-5 pb-4">
                <Button asChild className="col-span-2 h-11 rounded-[9px]">
                  <a href={`mailto:${current.email}`}>
                    <Mail />
                    {t.sendMessage}
                  </a>
                </Button>
                <Button
                  variant="outline"
                  className="h-11 rounded-[9px] border-[#d8e1ee] bg-white"
                  onClick={() => setEditing((value) => !value)}
                >
                  <Pencil />
                  {t.edit}
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      className="h-11 rounded-[9px] border-[#d8e1ee] bg-white"
                    >
                      <MoreVertical />
                      {t.more}
                      <ChevronDown className="ml-1" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-[250px]">
                    {!deleted && current.status === "INVITED" && (
                      <DropdownMenuItem
                        onSelect={() => onAction("resend", current)}
                      >
                        <Send /> {t.resend}
                      </DropdownMenuItem>
                    )}
                    {invitation?.status === "PENDING" && (
                      <DropdownMenuItem
                        onSelect={() => onAction("revoke", current)}
                      >
                        <Mail /> {t.revoke}
                      </DropdownMenuItem>
                    )}
                    {!deleted && current.status !== "SUSPENDED" && !isSelf && (
                      <DropdownMenuItem
                        onSelect={() => onAction("suspend", current)}
                      >
                        <ShieldBan /> {t.suspend}
                      </DropdownMenuItem>
                    )}
                    {!deleted && current.status === "SUSPENDED" && (
                      <DropdownMenuItem
                        onSelect={() => onAction("reactivate", current)}
                      >
                        <ShieldCheck /> {t.reactivate}
                      </DropdownMenuItem>
                    )}
                    {deleted && (
                      <DropdownMenuItem
                        onSelect={() => onAction("restore", current)}
                      >
                        <RotateCcw /> {t.restore}
                      </DropdownMenuItem>
                    )}
                    {!isSelf && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onSelect={() =>
                            onAction(
                              deleted ? "hard-delete" : "delete",
                              current,
                            )
                          }
                        >
                          <Trash2 />
                          {deleted ? t.deletePermanently : t.softDelete}
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </section>

            {editing && (
              <section className="cg-form-reveal mt-5 rounded-2xl border border-[#dfe6f2] bg-white p-5">
                <h3 className="text-[14px] font-semibold text-foreground">
                  {t.editIdentity}
                </h3>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div className="cg-form-reveal cg-form-delay-1 grid gap-2">
                    <InfoFieldLabel
                      htmlFor="drawer-firstName"
                      label={t.firstName}
                      description={t.firstNameHint}
                      about={t.about}
                    />
                    <div className="relative">
                      <UserRound
                        aria-hidden="true"
                        className="pointer-events-none absolute top-1/2 left-3.5 z-10 size-[17px] -translate-y-1/2 text-[#7787a4]"
                        strokeWidth={1.8}
                      />
                      <Input
                        id="drawer-firstName"
                        value={firstName}
                        maxLength={100}
                        placeholder={t.firstNamePlaceholder}
                        disabled={saving}
                        className="pl-10"
                        onChange={(event) => setFirstName(event.target.value)}
                      />
                    </div>
                  </div>
                  <div className="cg-form-reveal cg-form-delay-2 grid gap-2">
                    <InfoFieldLabel
                      htmlFor="drawer-lastName"
                      label={t.lastName}
                      description={t.lastNameHint}
                      about={t.about}
                    />
                    <div className="relative">
                      <UserRound
                        aria-hidden="true"
                        className="pointer-events-none absolute top-1/2 left-3.5 z-10 size-[17px] -translate-y-1/2 text-[#7787a4]"
                        strokeWidth={1.8}
                      />
                      <Input
                        id="drawer-lastName"
                        value={lastName}
                        maxLength={100}
                        placeholder={t.lastNamePlaceholder}
                        disabled={saving}
                        className="pl-10"
                        onChange={(event) => setLastName(event.target.value)}
                      />
                    </div>
                  </div>
                </div>
                {error && (
                  <p
                    className="mt-3 text-[12px] text-danger-strong"
                    role="alert"
                  >
                    {error}
                  </p>
                )}
                <div className="mt-4 flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditing(false)}
                  >
                    {t.cancel}
                  </Button>
                  <Button
                    size="sm"
                    disabled={!dirty || saving}
                    onClick={handleSave}
                  >
                    {saving && <LoaderCircle className="animate-spin" />}
                    {t.save}
                  </Button>
                </div>
              </section>
            )}

            <DetailSection icon={UserRound} title={t.account}>
              <DetailRow
                icon={UserRound}
                label={t.fullName}
                description={t.fullNameHint}
                value={fullName(current)}
              />
              <DetailRow
                icon={Mail}
                label={t.email}
                description={t.emailHint}
                value={current.email}
              />
              <DetailRow
                icon={ShieldCheck}
                label={t.role}
                description={t.roleHint}
                value={<RoleBadge role={current.role} />}
              />
              <DetailRow
                icon={Database}
                label={t.state}
                description={t.stateHint}
                value={<AccountStateBadge state={current.accountState} />}
              />
              <DetailRow
                icon={KeyRound}
                label={t.mfa}
                description={t.mfaHint}
                value={
                  <Badge
                    variant={current.mfaEnabled ? "success" : "outline"}
                    className="h-7 px-2.5"
                  >
                    {current.mfaEnabled ? t.on : t.off}
                  </Badge>
                }
              />
              <DetailRow
                icon={CalendarDays}
                label={t.since}
                description={t.sinceHint}
                value={format.dateTime(current.createdAt)}
              />
              <DetailRow
                icon={Clock3}
                label={t.lastLogin}
                description={t.lastLoginHint}
                value={format.dateTime(current.lastLoginAt)}
              />
            </DetailSection>

            <DetailSection icon={FileText} title={t.additional}>
              <DetailRow
                icon={Mail}
                label={t.invitedBy}
                description={t.invitedByHint}
                value={invitation?.invitedBy ?? t.notAvailable}
              />
              <DetailRow
                icon={Clock3}
                label={t.invitationStatus}
                description={t.invitationStatusHint}
                value={
                  invitation ? (
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-success-surface px-2 py-1 text-[11px] font-semibold text-success-strong">
                      <span className="size-1.5 rounded-full bg-success" />
                      {labels.invitationStatus[invitation.status]}
                    </span>
                  ) : (
                    t.notAvailable
                  )
                }
              />
              <DetailRow
                icon={CalendarDays}
                label={t.createdAt}
                description={t.createdAtHint}
                value={
                  invitation
                    ? format.dateTime(invitation.createdAt)
                    : t.notAvailable
                }
              />
            </DetailSection>
          </SheetBody>
        </SheetContent>
      </Sheet>
    </TooltipProvider>
  );
}

function InfoMarker({
  label,
  description,
  about,
}: {
  label: string;
  description: string;
  about: SheetMessages["about"];
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={about(label)}
          className="grid size-4 shrink-0 place-items-center rounded-full border border-[#aab7ca] bg-white text-[10px] font-bold leading-none text-[#526180] transition hover:border-primary hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
        >
          i
        </button>
      </TooltipTrigger>
      <TooltipContent
        side="left"
        className="max-w-[260px] text-[12px] leading-5"
      >
        {description}
      </TooltipContent>
    </Tooltip>
  );
}

function InfoFieldLabel({
  htmlFor,
  label,
  description,
  about,
}: {
  htmlFor: string;
  label: string;
  description: string;
  about: SheetMessages["about"];
}) {
  return (
    <div className="flex items-center gap-1.5">
      <InfoMarker label={label} description={description} about={about} />
      <Label htmlFor={htmlFor}>{label}</Label>
    </div>
  );
}

function DetailSection({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof UserRound;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-4 overflow-hidden rounded-[12px] border border-[#d7e1f2] bg-white px-5 pt-4 pb-0">
      <h3 className="flex items-center gap-2.5 text-[17px] font-bold tracking-[-0.02em] text-foreground">
        <Icon className="size-5 text-[#2947e8]" strokeWidth={1.9} />
        {title}
      </h3>
      <dl className="mt-3 divide-y divide-[#dce4f0] border-t border-[#dce4f0]">
        {children}
      </dl>
    </section>
  );
}

function DetailRow({
  icon: Icon,
  label,
  description,
  value,
}: {
  icon: typeof UserRound;
  label: string;
  description: string;
  value: ReactNode;
}) {
  return (
    <div
      className="grid min-h-10 grid-cols-[minmax(130px,.9fr)_minmax(0,1.1fr)] items-center gap-4 sm:grid-cols-[230px_minmax(0,1fr)]"
      title={description}
    >
      <dt className="flex items-center gap-3 text-[14px] text-[#607096]">
        <Icon
          className="size-[19px] shrink-0 text-[#2947e8]"
          strokeWidth={1.9}
        />
        {label}
      </dt>
      <dd className="min-w-0 break-words text-[14px] font-medium text-[#172554]">
        {value}
      </dd>
    </div>
  );
}
