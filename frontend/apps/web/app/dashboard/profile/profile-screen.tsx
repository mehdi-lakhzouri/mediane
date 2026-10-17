"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  BadgeCheck,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  Copy,
  Fingerprint,
  KeyRound,
  Laptop,
  LoaderCircle,
  LockKeyhole,
  Mail,
  MonitorSmartphone,
  RefreshCcw,
  Save,
  ShieldCheck,
  Smartphone,
  UserRound,
  Wifi,
} from "lucide-react";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/ui/table";
import { cn } from "@repo/ui/lib/utils";
import { ConfirmDialog, type ConfirmRequest } from "../../components/dashboard/confirm-dialog";
import { sectionMotion, stagger } from "../../components/dashboard/motion";
import { useToast } from "../../components/dashboard/toast-provider";
import {
  listAccountSessions,
  revokeAccountSession,
  revokeOtherAccountSessions,
  type AccountSession,
  type DevicePlatform,
} from "../../../lib/api/account-sessions";
import {
  fullName,
  getCurrentUser,
  initials,
  type CurrentUser,
} from "../../../lib/api/auth";
import { getUser, updateUser, type AdminUser } from "../../../lib/api/admin-users";
import { getMfaStatus, type MfaStatus } from "../../../lib/api/mfa";
import { useErrorText } from "../../../lib/i18n/api-errors";
import {
  useFormatters,
  useMessages,
} from "../../../lib/i18n/locale-provider";
import { defineMessages } from "../../../lib/i18n/messages";

const messages = defineMessages({
  en: {
    title: "Your profile",
    subtitle: "Manage your administrator identity and review account security.",
    refresh: "Refresh profile",
    overview: {
      verified: "Active account",
      admin: "Administrator",
      photo: "Profile photo",
      photoHint: "Initials are used because administrator avatars are not exposed by the API.",
      memberSince: "Member since",
      lastLogin: "Last signed in",
      completion: "Account readiness",
      complete: "Ready",
      completeHint: "Identity, security and account access are all configured.",
    },
    identity: {
      title: "Personal information",
      description: "The name shown across the console and audit activity.",
      firstName: "First name",
      lastName: "Last name",
      email: "Email address",
      emailHint: "Email changes require a separate privileged account flow.",
      role: "Account role",
      save: "Save changes",
      saving: "Saving changes",
      saved: "Profile updated",
      savedDescription: "Your name has been updated across the dashboard.",
      required: "Enter both your first and last name.",
      unchanged: "No changes to save.",
    },
    security: {
      title: "Security posture",
      description: "Live status from your account security settings.",
      mfa: "Two-step verification",
      enabled: "Enabled",
      required: "Required",
      codes: "Recovery codes",
      codesRemaining: (count: number) => `${count} remaining`,
      low: "Running low",
      healthy: "Healthy",
      sessions: "Active sessions",
      sessionCount: (count: number) => `${count} signed-in ${count === 1 ? "device" : "devices"}`,
      manage: "Manage security",
      unavailable: "Security status unavailable",
    },
    details: {
      title: "Account details",
      id: "Account ID",
      copy: "Copy account ID",
      copied: "Account ID copied",
      state: "Account state",
      active: "Active",
      access: "Console access",
      accessValue: "Administrator console",
    },
    sessions: {
      title: "Signed-in devices",
      description: "Review the devices that currently have access to your account.",
      signOutOthers: "Sign out other devices",
      signOut: "Sign out",
      current: "This device",
      web: "Web session",
      mobile: "Mobile app",
      unknownIp: "IP unavailable",
      columns: ["Device", "Channel", "IP address", "Last active", "Signed in", ""],
      empty: "No active sessions were returned.",
      revokeTitle: "Sign out this device?",
      revokeDescription: (device: string) => `${device} will need to sign in again to access CabinGuard.`,
      revokeAllTitle: "Sign out all other devices?",
      revokeAllDescription: "Every session except this one will be ended immediately.",
      signedOut: "Device signed out",
      signedOutAll: (count: number) => `${count} other ${count === 1 ? "device was" : "devices were"} signed out.`,
      noneOther: "There are no other devices to sign out.",
    },
    states: {
      loading: "Loading your profile",
      failed: "We couldn't load your profile",
      failedHint: "Check the API connection and try again.",
      retry: "Try again",
      unavailable: "Unavailable",
    },
    platforms: {
      ANDROID: "Android",
      IOS: "iOS",
      WINDOWS: "Windows",
      MACOS: "macOS",
      LINUX: "Linux",
      UNKNOWN: "Unknown",
    } satisfies Record<DevicePlatform, string>,
  },
  fr: {
    title: "Votre profil",
    subtitle: "Gérez votre identité administrateur et vérifiez la sécurité du compte.",
    refresh: "Actualiser le profil",
    overview: {
      verified: "Compte actif",
      admin: "Administrateur",
      photo: "Photo de profil",
      photoHint: "Les initiales sont utilisées car l’API ne fournit pas d’avatar administrateur.",
      memberSince: "Membre depuis",
      lastLogin: "Dernière connexion",
      completion: "État du compte",
      complete: "Prêt",
      completeHint: "L’identité, la sécurité et l’accès au compte sont configurés.",
    },
    identity: {
      title: "Informations personnelles",
      description: "Le nom affiché dans la console et le journal d’audit.",
      firstName: "Prénom",
      lastName: "Nom",
      email: "Adresse e-mail",
      emailHint: "Le changement d’e-mail nécessite une procédure privilégiée distincte.",
      role: "Rôle du compte",
      save: "Enregistrer",
      saving: "Enregistrement",
      saved: "Profil mis à jour",
      savedDescription: "Votre nom a été mis à jour dans le tableau de bord.",
      required: "Saisissez votre prénom et votre nom.",
      unchanged: "Aucune modification à enregistrer.",
    },
    security: {
      title: "Niveau de sécurité",
      description: "État en direct des paramètres de sécurité de votre compte.",
      mfa: "Vérification en deux étapes",
      enabled: "Activée",
      required: "Obligatoire",
      codes: "Codes de récupération",
      codesRemaining: (count: number) => `${count} restant${count > 1 ? "s" : ""}`,
      low: "Stock faible",
      healthy: "Sain",
      sessions: "Sessions actives",
      sessionCount: (count: number) => `${count} appareil${count > 1 ? "s" : ""} connecté${count > 1 ? "s" : ""}`,
      manage: "Gérer la sécurité",
      unavailable: "État de sécurité indisponible",
    },
    details: {
      title: "Détails du compte",
      id: "Identifiant du compte",
      copy: "Copier l’identifiant",
      copied: "Identifiant copié",
      state: "État du compte",
      active: "Actif",
      access: "Accès à la console",
      accessValue: "Console administrateur",
    },
    sessions: {
      title: "Appareils connectés",
      description: "Consultez les appareils qui ont actuellement accès à votre compte.",
      signOutOthers: "Déconnecter les autres",
      signOut: "Déconnecter",
      current: "Cet appareil",
      web: "Session Web",
      mobile: "Application mobile",
      unknownIp: "IP indisponible",
      columns: ["Appareil", "Canal", "Adresse IP", "Dernière activité", "Connexion", ""],
      empty: "Aucune session active n’a été renvoyée.",
      revokeTitle: "Déconnecter cet appareil ?",
      revokeDescription: (device: string) => `${device} devra se reconnecter pour accéder à CabinGuard.`,
      revokeAllTitle: "Déconnecter tous les autres appareils ?",
      revokeAllDescription: "Toutes les sessions sauf celle-ci seront fermées immédiatement.",
      signedOut: "Appareil déconnecté",
      signedOutAll: (count: number) => `${count} autre${count > 1 ? "s" : ""} appareil${count > 1 ? "s ont" : " a"} été déconnecté${count > 1 ? "s" : ""}.`,
      noneOther: "Aucun autre appareil à déconnecter.",
    },
    states: {
      loading: "Chargement de votre profil",
      failed: "Impossible de charger votre profil",
      failedHint: "Vérifiez la connexion à l’API puis réessayez.",
      retry: "Réessayer",
      unavailable: "Indisponible",
    },
    platforms: {
      ANDROID: "Android",
      IOS: "iOS",
      WINDOWS: "Windows",
      MACOS: "macOS",
      LINUX: "Linux",
      UNKNOWN: "Inconnu",
    },
  },
});

interface ProfileData {
  user: CurrentUser;
  account: AdminUser | null;
  mfa: MfaStatus | null;
  sessions: AccountSession[];
}

export function ProfileScreen() {
  const t = useMessages(messages);
  const format = useFormatters();
  const errorText = useErrorText();
  const toast = useToast();
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);

  const load = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);
    setFailed(false);

    try {
      const user = await getCurrentUser();
      const [accountResult, mfaResult, sessionsResult] = await Promise.allSettled([
        getUser(user.userId),
        getMfaStatus(),
        listAccountSessions(),
      ]);
      const next: ProfileData = {
        user,
        account: fulfilled(accountResult),
        mfa: fulfilled(mfaResult),
        sessions: fulfilled(sessionsResult) ?? [],
      };
      setData(next);
      setFirstName(user.firstName);
      setLastName(user.lastName);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const dirty = useMemo(
    () =>
      !!data &&
      (firstName.trim() !== data.user.firstName ||
        lastName.trim() !== data.user.lastName),
    [data, firstName, lastName],
  );

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data || saving) return;
    const nextFirst = firstName.trim();
    const nextLast = lastName.trim();
    if (!nextFirst || !nextLast) {
      setFormError(t.identity.required);
      return;
    }
    if (!dirty) {
      toast.info(t.identity.unchanged);
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      const updated = await updateUser(data.user.userId, {
        firstName: nextFirst,
        lastName: nextLast,
      });
      const user: CurrentUser = {
        ...data.user,
        firstName: updated.firstName,
        lastName: updated.lastName,
      };
      setData({ ...data, user, account: updated });
      setFirstName(user.firstName);
      setLastName(user.lastName);
      window.dispatchEvent(
        new CustomEvent<CurrentUser>("cabinguard:user-updated", { detail: user }),
      );
      toast.success(t.identity.saved, t.identity.savedDescription);
    } catch (error) {
      setFormError(errorText.message(error));
    } finally {
      setSaving(false);
    }
  }

  function requestRevoke(session: AccountSession) {
    setConfirm({
      title: t.sessions.revokeTitle,
      description: t.sessions.revokeDescription(session.device.label),
      actionLabel: t.sessions.signOut,
      destructive: true,
      run: async () => {
        try {
          await revokeAccountSession(session.id);
          setData((current) =>
            current
              ? { ...current, sessions: current.sessions.filter((item) => item.id !== session.id) }
              : current,
          );
          toast.success(t.sessions.signedOut);
        } catch (error) {
          toast.error(errorText.message(error));
        }
      },
    });
  }

  function requestRevokeOthers() {
    const otherCount = data?.sessions.filter((session) => !session.current).length ?? 0;
    if (!otherCount) {
      toast.info(t.sessions.noneOther);
      return;
    }
    setConfirm({
      title: t.sessions.revokeAllTitle,
      description: t.sessions.revokeAllDescription,
      actionLabel: t.sessions.signOutOthers,
      destructive: true,
      run: async () => {
        try {
          const result = await revokeOtherAccountSessions();
          setData((current) =>
            current
              ? { ...current, sessions: current.sessions.filter((item) => item.current) }
              : current,
          );
          toast.success(t.sessions.signedOutAll(result.revoked));
        } catch (error) {
          toast.error(errorText.message(error));
        }
      },
    });
  }

  async function copyAccountId() {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(data.user.userId);
      toast.success(t.details.copied);
    } catch {
      toast.error(t.states.unavailable);
    }
  }

  if (loading) return <ProfileSkeleton label={t.states.loading} />;

  if (failed || !data) {
    return (
      <Card className="mx-auto mt-16 max-w-xl border-danger/20">
        <CardContent className="flex flex-col items-center px-6 py-12 text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-danger-surface text-danger">
            <UserRound className="size-7" />
          </span>
          <h1 className="mt-5 text-xl font-bold">{t.states.failed}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t.states.failedHint}</p>
          <Button className="mt-6" onClick={() => void load()}>
            <RefreshCcw /> {t.states.retry}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const otherSessions = data.sessions.filter((session) => !session.current).length;

  return (
    <motion.div
      variants={stagger(0.08)}
      initial="hidden"
      animate="show"
      className="flex flex-col gap-5 pb-5"
    >
      <motion.header
        variants={sectionMotion}
        className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
      >
        <div>
          <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-primary">
            <span className="h-px w-6 bg-primary/50" />
            {t.overview.admin}
          </div>
          <h1 className="text-[30px] font-extrabold leading-tight tracking-[-0.035em] text-foreground">
            {t.title}
          </h1>
          <p className="mt-1 text-[14px] text-muted-foreground">{t.subtitle}</p>
        </div>
        <Button
          variant="outline"
          className="h-10 self-start bg-card sm:self-auto"
          disabled={refreshing}
          onClick={() => void load(true)}
        >
          <RefreshCcw className={cn(refreshing && "animate-spin")} />
          {t.refresh}
        </Button>
      </motion.header>

      <div className="grid min-w-0 items-start gap-5 2xl:grid-cols-[310px_minmax(0,1fr)]">
        <motion.aside variants={sectionMotion} className="grid min-w-0 gap-5 2xl:sticky 2xl:top-[92px]">
          <Card className="overflow-hidden">
            <div className="h-24 bg-[radial-gradient(circle_at_18%_10%,rgba(255,255,255,.28),transparent_28%),linear-gradient(125deg,#24358c,#3f67e8)]" />
            <CardContent className="-mt-12 px-5 pb-5">
              <div className="flex items-end justify-between gap-3">
                <span className="grid size-24 place-items-center rounded-[24px] border-4 border-card bg-[#e9efff] text-2xl font-extrabold text-primary shadow-sm">
                  {initials(data.user)}
                </span>
                <Badge variant="success" className="mb-2">
                  <CheckCircle2 /> {t.overview.verified}
                </Badge>
              </div>
              <h2 className="mt-4 truncate text-xl font-extrabold tracking-[-0.025em]">
                {fullName(data.user)}
              </h2>
              <p className="mt-1 flex min-w-0 items-center gap-2 text-[13px] text-muted-foreground">
                <Mail className="size-4 shrink-0" />
                <span className="truncate">{data.user.email}</span>
              </p>
              <div className="mt-5 rounded-xl border border-border bg-muted/45 p-3.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[12px] font-semibold text-muted-foreground">
                    {t.overview.completion}
                  </span>
                  <span className="text-[12px] font-bold text-success-strong">
                    {t.overview.complete}
                  </span>
                </div>
                <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-border">
                  <div className="h-full w-full rounded-full bg-success" />
                </div>
                <p className="mt-2.5 text-[11px] leading-5 text-muted-foreground">
                  {t.overview.completeHint}
                </p>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4">
                <MiniDetail
                  icon={CalendarDays}
                  label={t.overview.memberSince}
                  value={data.account ? format.date(data.account.createdAt) : "—"}
                />
                <MiniDetail
                  icon={Clock3}
                  label={t.overview.lastLogin}
                  value={data.account ? format.date(data.account.lastLoginAt) : "—"}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>{t.details.title}</CardTitle>
                <CardDescription>{t.overview.photoHint}</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="grid gap-1 pt-3">
              <DetailRow icon={Fingerprint} label={t.details.id} value={shortId(data.user.userId)}>
                <button
                  type="button"
                  aria-label={t.details.copy}
                  onClick={() => void copyAccountId()}
                  className="grid size-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Copy className="size-4" />
                </button>
              </DetailRow>
              <DetailRow icon={BadgeCheck} label={t.details.state} value={t.details.active} />
              <DetailRow icon={ShieldCheck} label={t.details.access} value={t.details.accessValue} />
            </CardContent>
          </Card>
        </motion.aside>

        <div className="grid min-w-0 gap-5">
          <motion.div variants={sectionMotion} className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,.65fr)]">
            <Card>
              <CardHeader className="border-b border-border pb-4">
                <div>
                  <CardTitle>{t.identity.title}</CardTitle>
                  <CardDescription>{t.identity.description}</CardDescription>
                </div>
                <span className="grid size-10 place-items-center rounded-xl bg-secondary text-primary">
                  <UserRound className="size-5" />
                </span>
              </CardHeader>
              <CardContent className="pt-5">
                <form onSubmit={handleSave} noValidate>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label={t.identity.firstName} htmlFor="profile-first-name">
                      <Input
                        id="profile-first-name"
                        value={firstName}
                        maxLength={100}
                        autoComplete="given-name"
                        disabled={saving}
                        aria-invalid={!!formError && !firstName.trim()}
                        className="h-11"
                        onChange={(event) => {
                          setFirstName(event.target.value);
                          setFormError(null);
                        }}
                      />
                    </Field>
                    <Field label={t.identity.lastName} htmlFor="profile-last-name">
                      <Input
                        id="profile-last-name"
                        value={lastName}
                        maxLength={100}
                        autoComplete="family-name"
                        disabled={saving}
                        aria-invalid={!!formError && !lastName.trim()}
                        className="h-11"
                        onChange={(event) => {
                          setLastName(event.target.value);
                          setFormError(null);
                        }}
                      />
                    </Field>
                    <Field label={t.identity.email} htmlFor="profile-email">
                      <div className="relative">
                        <Mail className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="profile-email"
                          value={data.user.email}
                          readOnly
                          className="h-11 bg-muted/45 pl-10 text-muted-foreground"
                        />
                      </div>
                    </Field>
                    <Field label={t.identity.role} htmlFor="profile-role">
                      <div className="relative">
                        <ShieldCheck className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="profile-role"
                          value={t.overview.admin}
                          readOnly
                          className="h-11 bg-muted/45 pl-10 text-muted-foreground"
                        />
                      </div>
                    </Field>
                  </div>
                  <p className="mt-3 text-[11px] text-muted-foreground">
                    {t.identity.emailHint}
                  </p>
                  {formError && (
                    <p role="alert" className="mt-4 rounded-lg border border-danger/20 bg-danger-surface px-3.5 py-2.5 text-[12px] font-medium text-danger-strong">
                      {formError}
                    </p>
                  )}
                  <div className="mt-5 flex justify-end border-t border-border pt-5">
                    <Button type="submit" className="h-10 px-5" disabled={saving || !dirty}>
                      {saving ? <LoaderCircle className="animate-spin" /> : <Save />}
                      {saving ? t.identity.saving : t.identity.save}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            <SecurityCard
              mfa={data.mfa}
              sessionCount={data.sessions.length}
              labels={t.security}
            />
          </motion.div>

          <motion.div variants={sectionMotion}>
            <Card className="overflow-hidden">
              <CardHeader className="border-b border-border pb-4 sm:flex-row sm:items-center">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <MonitorSmartphone className="size-[18px] text-primary" />
                    {t.sessions.title}
                  </CardTitle>
                  <CardDescription>{t.sessions.description}</CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="self-start sm:self-auto"
                  disabled={!otherSessions}
                  onClick={requestRevokeOthers}
                >
                  <LockKeyhole /> {t.sessions.signOutOthers}
                </Button>
              </CardHeader>
              {data.sessions.length ? (
                <>
                  <div className="hidden md:block">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/35 hover:bg-muted/35">
                          {t.sessions.columns.map((column, index) => (
                            <TableHead key={`${column}-${index}`} className={index === 5 ? "w-28 text-right" : undefined}>
                              {column}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.sessions.map((session) => (
                          <TableRow key={session.id}>
                            <TableCell>
                              <SessionDevice
                                session={session}
                                currentLabel={t.sessions.current}
                                platformLabel={t.platforms[session.device.platform]}
                              />
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {session.device.app ? t.sessions.mobile : t.sessions.web}
                            </TableCell>
                            <TableCell className="font-mono text-[12px] text-muted-foreground">
                              {session.ipAddress ?? t.sessions.unknownIp}
                            </TableCell>
                            <TableCell>
                              <span className="font-medium">{format.ago(session.lastActiveAt)}</span>
                              <span className="mt-0.5 block text-[11px] text-muted-foreground">
                                {format.dateTime(session.lastActiveAt)}
                              </span>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {format.dateTime(session.signedInAt)}
                            </TableCell>
                            <TableCell className="text-right">
                              {!session.current && (
                                <Button variant="ghost" size="sm" className="text-danger hover:bg-danger-surface hover:text-danger-strong" onClick={() => requestRevoke(session)}>
                                  {t.sessions.signOut}
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="divide-y divide-border md:hidden">
                    {data.sessions.map((session) => (
                      <div key={session.id} className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <SessionDevice
                            session={session}
                            currentLabel={t.sessions.current}
                            platformLabel={t.platforms[session.device.platform]}
                          />
                          {!session.current && (
                            <Button variant="ghost" size="sm" className="text-danger" onClick={() => requestRevoke(session)}>
                              {t.sessions.signOut}
                            </Button>
                          )}
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-3 rounded-lg bg-muted/45 p-3 text-[11px]">
                          <span className="text-muted-foreground">{session.ipAddress ?? t.sessions.unknownIp}</span>
                          <span className="text-right font-medium">{format.ago(session.lastActiveAt)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <CardContent className="flex flex-col items-center py-12 text-center">
                  <MonitorSmartphone className="size-8 text-muted-foreground/60" />
                  <p className="mt-3 text-sm font-semibold">{t.sessions.empty}</p>
                </CardContent>
              )}
            </Card>
          </motion.div>
        </div>
      </div>

      <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
    </motion.div>
  );
}

function SecurityCard({
  mfa,
  sessionCount,
  labels,
}: {
  mfa: MfaStatus | null;
  sessionCount: number;
  labels: (typeof messages)["en"]["security"];
}) {
  return (
    <Card>
      <CardHeader className="border-b border-border pb-4">
        <div>
          <CardTitle>{labels.title}</CardTitle>
          <CardDescription>{labels.description}</CardDescription>
        </div>
        <span className="grid size-10 place-items-center rounded-xl bg-success-surface text-success-strong">
          <ShieldCheck className="size-5" />
        </span>
      </CardHeader>
      <CardContent className="grid gap-3 pt-5">
        <SecurityMetric
          icon={KeyRound}
          label={labels.mfa}
          value={mfa ? (mfa.enabled ? labels.enabled : labels.required) : labels.unavailable}
          healthy={!!mfa?.enabled}
        />
        <SecurityMetric
          icon={Check}
          label={labels.codes}
          value={mfa ? labels.codesRemaining(mfa.recoveryCodesRemaining) : labels.unavailable}
          healthy={!!mfa && !mfa.recoveryCodesLow}
          badge={mfa?.recoveryCodesLow ? labels.low : mfa ? labels.healthy : undefined}
        />
        <SecurityMetric
          icon={MonitorSmartphone}
          label={labels.sessions}
          value={labels.sessionCount(sessionCount)}
          healthy={sessionCount > 0}
        />
        <Button asChild variant="outline" className="mt-1 h-10 w-full">
          <Link href="/dashboard/settings">
            <LockKeyhole /> {labels.manage}
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function SecurityMetric({
  icon: Icon,
  label,
  value,
  healthy,
  badge,
}: {
  icon: typeof KeyRound;
  label: string;
  value: string;
  healthy: boolean;
  badge?: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border p-3">
      <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg", healthy ? "bg-success-surface text-success-strong" : "bg-warning-surface text-warning-strong")}>
        <Icon className="size-[17px]" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold text-muted-foreground">{label}</p>
        <p className="truncate text-[13px] font-bold">{value}</p>
      </div>
      {badge && <Badge variant={healthy ? "success" : "warning"}>{badge}</Badge>}
    </div>
  );
}

function SessionDevice({
  session,
  currentLabel,
  platformLabel,
}: {
  session: AccountSession;
  currentLabel: string;
  platformLabel: string;
}) {
  const Icon = session.device.app ? Smartphone : Laptop;
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary text-primary">
        <Icon className="size-[18px]" />
      </span>
      <div className="min-w-0">
        <p className="truncate font-semibold">{session.device.label}</p>
        <div className="mt-0.5 flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground">
            {platformLabel}
          </span>
          {session.current && (
            <Badge variant="success" className="px-1.5 py-0 text-[10px]">
              <Wifi className="size-2.5" /> {currentLabel}
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

function MiniDetail({ icon: Icon, label, value }: { icon: typeof CalendarDays; label: string; value: string }) {
  return (
    <div className="min-w-0">
      <Icon className="size-4 text-primary" />
      <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
      <p className="mt-0.5 truncate text-[12px] font-bold">{value}</p>
    </div>
  );
}

function DetailRow({ icon: Icon, label, value, children }: { icon: typeof Fingerprint; label: string; value: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-muted/45">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="size-[17px]" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">{label}</p>
        <p className="mt-0.5 truncate text-[12px] font-bold">{value}</p>
      </div>
      {children}
    </div>
  );
}

function ProfileSkeleton({ label }: { label: string }) {
  return (
    <div aria-label={label} className="flex flex-col gap-5" aria-busy="true">
      <div>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-2 h-4 w-80 max-w-full" />
      </div>
      <div className="grid min-w-0 gap-5 2xl:grid-cols-[310px_minmax(0,1fr)]">
        <Skeleton className="h-[430px] rounded-xl" />
        <div className="grid gap-5">
          <div className="grid gap-5 lg:grid-cols-[1.35fr_.65fr]">
            <Skeleton className="h-[380px] rounded-xl" />
            <Skeleton className="h-[380px] rounded-xl" />
          </div>
          <Skeleton className="h-[300px] rounded-xl" />
        </div>
      </div>
    </div>
  );
}

function fulfilled<T>(result: PromiseSettledResult<T>): T | null {
  return result.status === "fulfilled" ? result.value : null;
}

function shortId(value: string): string {
  return value.length > 17 ? `${value.slice(0, 8)}…${value.slice(-8)}` : value;
}
