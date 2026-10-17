"use client";

import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { FR, GB } from "country-flag-icons/react/3x2";
import PhoneInput, {
  formatPhoneNumberIntl,
  isValidPhoneNumber,
  type Value as PhoneValue,
} from "react-phone-number-input";
import phoneFlags from "react-phone-number-input/flags";
import {
  BarChart3,
  Bell,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  Copy,
  Download,
  Eye,
  EyeOff,
  FileDown,
  Globe2,
  Headphones,
  KeyRound,
  Laptop,
  LifeBuoy,
  LoaderCircle,
  LockKeyhole,
  MapPin,
  Megaphone,
  Monitor,
  MoreVertical,
  Pencil,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  UserRound,
  Users,
  Zap,
} from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/ui/dialog";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import { cn } from "@repo/ui/lib/utils";
import { MfaCodeInput } from "../../components/mfa-code-input";
import { useToast } from "../../components/dashboard/toast-provider";
import {
  changePassword,
  fullName,
  getCurrentUser,
  logoutAll,
  type CurrentUser,
} from "../../../lib/api/auth";
import {
  listUsers,
  updateUser,
  type AdminUser,
} from "../../../lib/api/admin-users";
import { ApiError } from "../../../lib/api/client";
import {
  confirmTotpSetup,
  getMfaStatus,
  regenerateRecoveryCodes,
  startTotpSetup,
  type MfaStatus,
  type TotpSetup,
} from "../../../lib/api/mfa";
import { isLocale, LOCALE_NAMES, LOCALES } from "../../../lib/i18n/config";
import { useErrorText } from "../../../lib/i18n/api-errors";
import {
  useChangeLocale,
  useLocale,
  useMessages,
} from "../../../lib/i18n/locale-provider";
import { settingsMessages } from "./security-settings.messages";

/** Turns a failed settings call into a message in the reader's language. */
function useMessageFor(): (error: unknown) => string {
  const t = useMessages(settingsMessages).errors;
  const errorText = useErrorText();
  return (error) => {
    if (!(error instanceof ApiError)) return t.generic;
    switch (error.code) {
      case "MFA_CODE_INVALID":
        return t.codeInvalid;
      case "MFA_CODE_REQUIRED":
        return t.codeRequired;
      case "INVALID_CURRENT_PASSWORD":
        return t.wrongPassword;
      case "WEAK_PASSWORD": {
        const detail = errorText.detail(error);
        return detail ? t.weakDetail(detail) : t.weak;
      }
      case "PASSWORD_UNCHANGED":
        return t.unchanged;
      case "MFA_SETUP_NOT_STARTED":
        return t.setupExpired;
      case "RATE_LIMITED":
        return t.rateLimited;
      default:
        return errorText.message(error);
    }
  };
}

const settingTabs = [
  { id: "general", icon: Settings2 },
  { id: "security", icon: LockKeyhole },
  { id: "team", icon: Users },
  { id: "notifications", icon: Bell },
  { id: "preferences", icon: SlidersHorizontal },
] as const;

type SettingsTab = (typeof settingTabs)[number]["id"];

/** Sample rows until a sessions API exists; their wording lives in the messages. */
const sessions = [
  {
    device: "MacBook Pro",
    platform: "Chrome · macOS",
    ip: "192.168.1.24",
    icon: Laptop,
  },
  {
    device: "iPhone 14",
    platform: "Safari · iOS",
    ip: "192.168.1.24",
    icon: Smartphone,
  },
  {
    device: "Windows PC",
    platform: "Edge · Windows",
    ip: "192.168.1.35",
    icon: Monitor,
  },
] as const;

const activityIcons = [Settings2, LockKeyhole, Smartphone, Users] as const;

/** Account settings surface. Live account and MFA data are used where APIs exist. */
export function SecuritySettings() {
  const t = useMessages(settingsMessages).page;
  const [status, setStatus] = useState<MfaStatus | null>(null);
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [phone, setPhone] = useState<PhoneValue | undefined>();
  const [failed, setFailed] = useState(false);
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");
  const [profileOpen, setProfileOpen] = useState(false);
  const [dialog, setDialog] = useState<"codes" | "replace" | null>(null);

  const selectTab = useCallback((tab: SettingsTab) => {
    setActiveTab(tab);
    window.history.replaceState(null, "", `/dashboard/settings#${tab}`);
  }, []);

  const refresh = useCallback(async () => {
    try {
      setStatus(await getMfaStatus());
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
    void getCurrentUser()
      .then(setUser)
      .catch(() => undefined);
  }, [refresh]);

  useEffect(() => {
    if (!user) return;
    try {
      const saved = localStorage.getItem(`cg.admin-phone.${user.userId}`);
      setPhone(saved ? (saved as PhoneValue) : undefined);
    } catch {
      setPhone(undefined);
    }
  }, [user]);

  useEffect(() => {
    const syncFromHash = () => {
      const hash = window.location.hash.slice(1);
      if (settingTabs.some((tab) => tab.id === hash)) {
        setActiveTab(hash as SettingsTab);
      }
    };
    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, []);

  return (
    <div className="flex flex-col gap-5 pb-5">
      <div>
        <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-primary">
          <span className="h-px w-6 bg-primary/50" /> CabinGuard
        </div>
        <h1 className="text-[30px] font-extrabold leading-[1.15] tracking-[-0.035em] text-foreground">
          {t.title}
        </h1>
        <p className="mt-1 text-[14px] text-muted-foreground">{t.subtitle}</p>
      </div>

      <div
        role="tablist"
        aria-label={t.sections}
        className="cg-scroll flex overflow-x-auto overflow-y-hidden rounded-[14px] border border-border bg-card p-1.5 shadow-[0_1px_3px_rgba(16,24,40,.04)]"
      >
        {settingTabs.map(({ id, icon: Icon }) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              id={`settings-tab-${id}`}
              aria-selected={active}
              aria-controls={`settings-panel-${id}`}
              onClick={() => selectTab(id)}
              className={cn(
                "relative flex h-12 min-w-[148px] flex-1 items-center justify-center gap-2.5 rounded-[10px] text-[12px] font-semibold text-muted-foreground transition focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-w-0",
                active
                  ? "bg-secondary text-primary shadow-[0_1px_3px_rgba(31,61,148,.1)]"
                  : "hover:bg-muted hover:text-foreground",
              )}
            >
              <span
                className={cn(
                  "grid size-8 place-items-center rounded-lg bg-muted transition",
                  active && "bg-card text-primary shadow-sm",
                )}
              >
                <Icon className="size-[16px]" strokeWidth={1.9} />
              </span>
              {t.tabs[id]}
            </button>
          );
        })}
      </div>

      <div
        id={`settings-panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`settings-tab-${activeTab}`}
      >
        {activeTab === "general" && (
          <div className="grid min-w-0 items-start gap-[14px] 2xl:grid-cols-[minmax(0,1fr)_300px]">
            <div className="grid min-w-0 gap-[14px]">
              <div className="grid gap-[14px] lg:grid-cols-[1.2fr_1fr]">
                <AccountCard
                  user={user}
                  phone={phone}
                  onEdit={() => setProfileOpen(true)}
                />
                <SecurityOverview
                  status={status}
                  failed={failed}
                  onReplace={() => setDialog("replace")}
                  onCodes={() => setDialog("codes")}
                />
              </div>

              <div className="grid items-start gap-[14px] lg:grid-cols-[.69fr_1fr]">
                <PasswordCard />
                <SessionsCard />
              </div>
              <NotificationCard expanded />
              <ActivityCard />
            </div>

            <aside className="grid gap-[14px]">
              <SecurityAssurance enabled={status?.enabled ?? true} />
              <QuickActions onSelectTab={selectTab} />
            </aside>
          </div>
        )}

        {activeTab === "security" && (
          <SecurityTab
            status={status}
            failed={failed}
            onReplace={() => setDialog("replace")}
            onCodes={() => setDialog("codes")}
          />
        )}

        {activeTab === "team" && <TeamAccessTab />}
        {activeTab === "notifications" && <NotificationsTab />}
        {activeTab === "preferences" && <PreferencesTab />}
      </div>

      <EditProfileDialog
        user={user}
        phone={phone}
        open={profileOpen}
        onOpenChange={setProfileOpen}
        onSaved={(updated) => {
          setUser(updated);
          window.dispatchEvent(
            new CustomEvent<CurrentUser>("cabinguard:user-updated", {
              detail: updated,
            }),
          );
        }}
        onPhoneSaved={setPhone}
      />

      <RegenerateCodesDialog
        open={dialog === "codes"}
        onClose={() => {
          setDialog(null);
          void refresh();
        }}
      />
      <ReplaceAuthenticatorDialog
        open={dialog === "replace"}
        onClose={() => {
          setDialog(null);
          void refresh();
        }}
      />
    </div>
  );
}

function SettingsCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-[12px] border border-[#e2e7ef] bg-white p-[15px] shadow-[0_1px_2px_rgba(16,24,40,.025)]",
        className,
      )}
    >
      {children}
    </section>
  );
}

function CardHeading({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: typeof UserRound;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      <span className="grid size-11 shrink-0 place-items-center rounded-[12px] bg-[#eef3ff] text-[#1e5bf4]">
        <Icon className="size-[21px]" strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1 pt-0.5">
        <h2 className="truncate text-[14px] font-bold leading-5 text-[#101a35]">
          {title}
        </h2>
        <p className="truncate text-[11px] leading-4 text-[#667596]">
          {description}
        </p>
      </div>
      {action}
    </div>
  );
}

function FieldShell({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="grid min-w-0 gap-1 text-[11px] font-semibold text-[#14213d]">
      {label}
      <span className="flex h-[33px] min-w-0 items-center gap-2 rounded-[6px] border border-[#dce3ed] bg-[#fbfcfe] px-2.5 text-[12px] font-normal text-[#263450] shadow-[0_1px_2px_rgba(16,24,40,.025)]">
        {children}
      </span>
    </label>
  );
}

function AccountCard({
  user,
  phone,
  onEdit,
}: {
  user: CurrentUser | null;
  phone: PhoneValue | undefined;
  onEdit: () => void;
}) {
  const t = useMessages(settingsMessages).account;
  return (
    <SettingsCard>
      <CardHeading
        icon={UserRound}
        title={t.title}
        description={t.description}
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={onEdit}
            disabled={!user}
            className="h-[30px] rounded-[7px] border-[#dce4f1] px-3 text-[12px] font-semibold text-[#1451df]"
          >
            <Pencil className="size-3.5" /> {t.edit}
          </Button>
        }
      />
      <AccountFields user={user} phone={phone} />
    </SettingsCard>
  );
}

function EditProfileDialog({
  user,
  phone,
  open,
  onOpenChange,
  onSaved,
  onPhoneSaved,
}: {
  user: CurrentUser | null;
  phone: PhoneValue | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (user: CurrentUser) => void;
  onPhoneSaved: (phone: PhoneValue | undefined) => void;
}) {
  const t = useMessages(settingsMessages).profile;
  const messageFor = useMessageFor();
  const toast = useToast();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState<PhoneValue | undefined>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !user) return;
    setFirstName(user.firstName);
    setLastName(user.lastName);
    setPhoneNumber(phone);
    setError(null);
  }, [open, phone, user]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!user) return;
    if (!firstName.trim() || !lastName.trim()) {
      setError(t.nameRequired);
      return;
    }
    if (phoneNumber && !isValidPhoneNumber(phoneNumber)) {
      setError(t.phoneInvalid);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const updated = await updateUser(user.userId, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      });
      const current: CurrentUser = {
        ...user,
        firstName: updated.firstName,
        lastName: updated.lastName,
      };
      try {
        if (phoneNumber) {
          localStorage.setItem(`cg.admin-phone.${user.userId}`, phoneNumber);
        } else {
          localStorage.removeItem(`cg.admin-phone.${user.userId}`);
        }
      } catch {
        // The server does not expose an administrator phone field yet.
      }
      onSaved(current);
      onPhoneSaved(phoneNumber);
      onOpenChange(false);
      toast.success(t.saved, t.savedDetail);
    } catch (failure) {
      setError(messageFor(failure));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[480px] overflow-hidden rounded-[18px] border-[#dbe4f2] shadow-[0_24px_70px_rgba(25,42,84,.22)]">
        <DialogHeader className="border-b border-[#e6ebf3] bg-[linear-gradient(135deg,#f7f9ff,#eef3ff)] p-6">
          <DialogTitle>{t.title}</DialogTitle>
          <DialogDescription>{t.description}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4 p-6">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="profile-first-name">{t.firstName}</Label>
              <Input
                id="profile-first-name"
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                maxLength={100}
                autoComplete="given-name"
                className="h-11 rounded-[9px]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-last-name">{t.lastName}</Label>
              <Input
                id="profile-last-name"
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                maxLength={100}
                autoComplete="family-name"
                className="h-11 rounded-[9px]"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="profile-email">{t.email}</Label>
            <Input
              id="profile-email"
              value={user?.email ?? ""}
              disabled
              className="h-11 rounded-[9px]"
            />
            <p className="text-[12px] text-muted-foreground">{t.emailHint}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="profile-phone">{t.phone}</Label>
            <PhoneInput
              id="profile-phone"
              international
              countryCallingCodeEditable={false}
              defaultCountry="NG"
              flags={phoneFlags}
              value={phoneNumber}
              onChange={(value) => {
                setPhoneNumber(value);
                if (error) setError(null);
              }}
              autoComplete="tel"
              placeholder={t.phonePlaceholder}
              className="cg-phone-input"
            />
            <p className="text-[12px] text-muted-foreground">{t.phoneHint}</p>
          </div>
          <ErrorLine message={error} />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={busy}
            >
              {t.cancel}
            </Button>
            <Button
              type="submit"
              disabled={busy || !firstName.trim() || !lastName.trim()}
            >
              {busy && <LoaderCircle className="animate-spin" />} {t.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AccountFields({
  user,
  phone,
}: {
  user: CurrentUser | null;
  phone: PhoneValue | undefined;
}) {
  const t = useMessages(settingsMessages).account;
  return (
    <div className="mt-3 grid grid-cols-1 gap-x-3 gap-y-2.5 sm:grid-cols-2">
      <FieldShell label={t.fullName}>
        <span className="truncate">{user ? fullName(user) : t.loading}</span>
      </FieldShell>
      <FieldShell label={t.email}>
        <span className="truncate">{user?.email ?? t.loading}</span>
      </FieldShell>
      <FieldShell label={t.phone}>
        <Smartphone className="size-4 text-[#60708f]" />
        <span className={phone ? "text-[#263450]" : "text-[#667596]"}>
          {phone ? formatPhoneNumberIntl(phone) : t.notConfigured}
        </span>
      </FieldShell>
      <FieldShell label={t.role}>
        <span>{user?.role === "DRIVER" ? t.driver : t.admin}</span>
        <ChevronDown className="ml-auto size-3 text-[#60708f]" />
      </FieldShell>
      <FieldShell label={t.organization}>
        <Building2 className="size-4 text-[#60708f]" />
        <span>CabinGuard</span>
      </FieldShell>
      <FieldShell label={t.timezone}>
        <Globe2 className="size-4 text-[#60708f]" />
        <span className="truncate">{t.browserDefault}</span>
        <ChevronDown className="ml-auto size-3 shrink-0 text-[#60708f]" />
      </FieldShell>
    </div>
  );
}

function SecurityOverview({
  status,
  failed,
  onReplace,
  onCodes,
}: {
  status: MfaStatus | null;
  failed: boolean;
  onReplace: () => void;
  onCodes: () => void;
}) {
  const t = useMessages(settingsMessages).overview;
  const enabled = status?.enabled ?? true;
  const rows = [
    {
      icon: ShieldCheck,
      title: t.mfa,
      detail: enabled ? t.mfaOn : t.mfaOff,
      action: t.manage,
      onClick: onReplace,
      green: true,
    },
    {
      icon: Smartphone,
      title: t.app,
      detail: enabled ? t.appOn : t.appOff,
      action: enabled ? t.replace : t.connect,
      onClick: onReplace,
    },
    {
      icon: KeyRound,
      title: t.codes,
      detail: t.codesLeft(status?.recoveryCodesRemaining ?? 10),
      action: t.generate,
      onClick: onCodes,
    },
  ];

  return (
    <SettingsCard className="p-[14px]">
      <CardHeading
        icon={ShieldCheck}
        title={t.title}
        description={t.description}
        action={
          <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-[#e3f7ea] px-3 text-[10px] font-semibold text-[#15803d]">
            <CheckCircle2 className="size-3 fill-[#16a34a] text-white" />
            {failed ? t.checkStatus : enabled ? t.strong : t.actionNeeded}
          </span>
        }
      />
      <div className="mt-3 divide-y divide-[#e7ebf2] overflow-hidden rounded-[10px] border border-[#e3e8f0]">
        {rows.map((row) => (
          <div
            key={row.title}
            className="flex h-[62px] items-center gap-3 px-3"
          >
            <span
              className={cn(
                "grid size-9 shrink-0 place-items-center rounded-[10px] bg-[#eef3ff] text-[#175cf5]",
                row.green && "bg-[#eaf9ef] text-[#16a34a]",
              )}
            >
              <row.icon className="size-[19px]" strokeWidth={2} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-[12px] font-semibold text-[#101a35]">
                  {row.title}
                </p>
                {row.green && (
                  <span className="rounded-full bg-[#def6e7] px-2 py-0.5 text-[10px] font-semibold text-[#168548]">
                    {enabled ? t.on : t.off}
                  </span>
                )}
              </div>
              <p className="truncate text-[11px] text-[#667596]">
                {row.detail}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={row.onClick}
              className="h-[30px] rounded-[7px] border-[#dce4f1] px-4 text-[11px] font-semibold text-[#1451df]"
            >
              {row.action}
            </Button>
          </div>
        ))}
      </div>
    </SettingsCard>
  );
}

function PasswordCard() {
  const t = useMessages(settingsMessages).password;
  const messageFor = useMessageFor();
  const toast = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [code, setCode] = useState("");
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [visible, setVisible] = useState({
    current: false,
    next: false,
    confirm: false,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const strengthScore = [
    next.length >= 12,
    /[a-z]/.test(next) && /[A-Z]/.test(next),
    /\d/.test(next) && /[^A-Za-z0-9]/.test(next),
  ].filter(Boolean).length;
  const strengthLabel = next ? t.levels[strengthScore] : t.strength;
  const strengthColor =
    strengthScore === 3
      ? "bg-[#16a34a]"
      : strengthScore === 2
        ? "bg-[#f59e0b]"
        : "bg-[#ef4444]";
  const passwordsMatch = confirmation.length > 0 && next === confirmation;
  const canSubmit =
    current.length > 0 &&
    next.length >= 12 &&
    next !== current &&
    passwordsMatch;

  async function save(mfaCode?: string) {
    setBusy(true);
    setError(null);
    try {
      await changePassword({
        currentPassword: current,
        newPassword: next,
        mfaCode,
      });
      toast.success(t.changed, t.changedDetail);
      setCurrent("");
      setNext("");
      setConfirmation("");
      setCode("");
      setVisible({ current: false, next: false, confirm: false });
      setVerifyOpen(false);
    } catch (failure) {
      setError(messageFor(failure));
    } finally {
      setBusy(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (next.length < 12) return setError(t.tooShort);
    if (next === current) return setError(t.unchanged);
    if (next !== confirmation) return setError(t.mismatch);
    setError(null);
    setCode("");
    setVerifyOpen(true);
  }

  const fields = [
    ["current", t.current, current, setCurrent, t.currentPlaceholder],
    ["next", t.next, next, setNext, t.nextPlaceholder],
    ["confirm", t.confirm, confirmation, setConfirmation, t.confirmPlaceholder],
  ] as const;

  return (
    <>
      <SettingsCard className="p-[14px] pb-[7px]">
        <CardHeading
          icon={LockKeyhole}
          title={t.title}
          description={t.description}
        />
        <form onSubmit={submit} className="mt-3 grid gap-[7px]">
          {fields.map(([id, label, value, setter, placeholder]) => (
            <div key={id} className="contents">
              <label className="grid gap-1 text-[11px] font-semibold leading-3 text-[#14213d]">
                {label}
                <span className="relative">
                  <Input
                    type={visible[id] ? "text" : "password"}
                    value={value}
                    onChange={(event) => {
                      setter(event.target.value);
                      if (error) setError(null);
                    }}
                    placeholder={placeholder}
                    autoComplete={
                      id === "current" ? "current-password" : "new-password"
                    }
                    aria-invalid={
                      id === "confirm" && confirmation.length > 0
                        ? !passwordsMatch
                        : undefined
                    }
                    className="h-[30px] rounded-[6px] border-[#dce3ed] bg-[#fbfcfe] pr-9 text-[12px]"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setVisible((currentVisibility) => ({
                        ...currentVisibility,
                        [id]: !currentVisibility[id],
                      }))
                    }
                    aria-label={visible[id] ? t.hide(label) : t.show(label)}
                    aria-pressed={visible[id]}
                    className="absolute inset-y-0 right-0 grid w-9 place-items-center text-[#60708f]"
                  >
                    {visible[id] ? (
                      <EyeOff className="size-3.5" />
                    ) : (
                      <Eye className="size-3.5" />
                    )}
                  </button>
                </span>
              </label>
              {id === "next" && (
                <div className="flex h-[10px] items-start gap-1.5">
                  {[1, 2, 3].map((level) => (
                    <span
                      key={level}
                      className={cn(
                        "mt-0.5 h-1 flex-1 rounded-full bg-[#dce3ef] transition-colors",
                        strengthScore >= level && strengthColor,
                      )}
                    />
                  ))}
                  <span
                    className={cn(
                      "ml-2 min-w-[82px] text-right text-[9px] leading-[10px] text-[#667596]",
                      next &&
                        (strengthScore === 3
                          ? "text-[#15803d]"
                          : strengthScore === 2
                            ? "text-[#a86100]"
                            : "text-danger"),
                    )}
                  >
                    {strengthLabel}
                  </span>
                </div>
              )}
              {id === "confirm" && confirmation.length > 0 && (
                <p
                  className={cn(
                    "text-[9px] font-medium",
                    passwordsMatch ? "text-[#15803d]" : "text-danger",
                  )}
                >
                  {passwordsMatch ? t.match : t.noMatch}
                </p>
              )}
            </div>
          ))}
          {error && !verifyOpen && (
            <p className="text-[10px] font-medium text-danger">{error}</p>
          )}
          <Button
            type="submit"
            disabled={busy || !canSubmit}
            className="mt-0.5 h-[32px] rounded-[6px] text-[12px] font-semibold"
          >
            {busy && <LoaderCircle className="animate-spin" />} {t.submit}
          </Button>
        </form>
      </SettingsCard>

      <Dialog open={verifyOpen} onOpenChange={setVerifyOpen}>
        <DialogContent className="max-w-[480px] overflow-hidden rounded-[18px] border-[#dbe4f2] shadow-[0_24px_70px_rgba(25,42,84,.22)]">
          <DialogHeader className="border-b border-[#e6ebf3] bg-[linear-gradient(135deg,#f7f9ff,#eef3ff)] p-6">
            <DialogTitle>{t.verifyTitle}</DialogTitle>
            <DialogDescription>{t.verifyDescription}</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4 p-6"
            onSubmit={(event) => {
              event.preventDefault();
              void save(code.trim());
            }}
          >
            <CodeField
              id="password-mfa"
              label={t.verifyLabel}
              value={code}
              onChange={setCode}
              hint={t.verifyHint}
            />
            <ErrorLine message={error} />
            <DialogFooter>
              <Button type="submit" disabled={busy || code.trim().length < 6}>
                {busy && <LoaderCircle className="animate-spin" />}{" "}
                {t.verifySubmit}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function NotificationCard({ expanded = false }: { expanded?: boolean }) {
  const t = useMessages(settingsMessages).notifications;
  const [preferences, setPreferences] = useState([true, true, false]);
  useEffect(() => {
    try {
      const saved = localStorage.getItem("cg.notification-preferences");
      if (saved) setPreferences(JSON.parse(saved) as boolean[]);
    } catch {
      // Device-local preferences are optional until a server API is available.
    }
  }, []);

  function togglePreference(index: number) {
    setPreferences((current) => {
      const next = current.map((value, i) => (i === index ? !value : value));
      try {
        localStorage.setItem(
          "cg.notification-preferences",
          JSON.stringify(next),
        );
      } catch {
        // The switch still works for this page view when storage is unavailable.
      }
      return next;
    });
  }
  const icons = [ShieldCheck, Megaphone, BarChart3];
  const rows = t.rows.map((row, index) => ({
    ...row,
    icon: icons[index % icons.length]!,
  }));
  return (
    <SettingsCard className={expanded ? "p-[18px]" : undefined}>
      <CardHeading icon={Bell} title={t.title} description={t.description} />
      <div
        className={cn(
          "mt-2.5 grid gap-1.5",
          expanded &&
            "mt-4 gap-0 divide-y divide-[#e5eaf2] overflow-hidden rounded-[10px] border border-[#e5eaf2]",
        )}
      >
        {rows.map((row, index) => (
          <div
            key={index}
            className={cn(
              "flex items-center gap-2",
              expanded && "min-h-[62px] gap-3 px-4 py-2.5",
            )}
          >
            <span
              className={cn(
                "grid size-7 shrink-0 place-items-center rounded-[8px] bg-[#eef3ff] text-[#1d5cf3]",
                expanded && "size-9 rounded-[10px]",
              )}
            >
              <row.icon className={expanded ? "size-4" : "size-3.5"} />
            </span>
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  "text-[10px] font-semibold leading-3.5 text-[#14213d]",
                  expanded && "text-[12px] leading-4",
                )}
              >
                {row.title}
              </p>
              <p
                className={cn(
                  "text-[9px] leading-3 text-[#667596]",
                  expanded && "mt-0.5 text-[11px] leading-4",
                )}
              >
                {row.detail}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={preferences[index]}
              aria-label={row.title}
              onClick={() => togglePreference(index)}
              className={cn(
                "relative h-[19px] w-[34px] shrink-0 rounded-full bg-[#bdc8da] transition-colors",
                expanded && "h-6 w-11",
                preferences[index] && "bg-[#225cf0]",
              )}
            >
              <span
                className={cn(
                  "absolute top-[2px] left-[2px] size-[15px] rounded-full bg-white shadow-sm transition-transform",
                  expanded && "size-5",
                  preferences[index] &&
                    (expanded ? "translate-x-5" : "translate-x-[15px]"),
                )}
              />
            </button>
          </div>
        ))}
      </div>
    </SettingsCard>
  );
}

function SecurityTab({
  status,
  failed,
  onReplace,
  onCodes,
}: {
  status: MfaStatus | null;
  failed: boolean;
  onReplace: () => void;
  onCodes: () => void;
}) {
  return (
    <div className="grid min-w-0 items-start gap-[14px] 2xl:grid-cols-[minmax(0,1fr)_300px]">
      <div className="grid gap-[14px]">
        <SecurityOverview
          status={status}
          failed={failed}
          onReplace={onReplace}
          onCodes={onCodes}
        />
        <div className="grid items-start gap-[14px] lg:grid-cols-[.7fr_1fr]">
          <PasswordCard />
          <SessionsCard />
        </div>
      </div>
      <aside className="grid gap-[14px]">
        <SecurityAssurance enabled={status?.enabled ?? true} />
      </aside>
    </div>
  );
}

function TeamAccessTab() {
  const t = useMessages(settingsMessages).team;
  const messageFor = useMessageFor();
  const [members, setMembers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  // The failure, not its text: the message follows a language switch.
  const [error, setError] = useState<{ cause: unknown } | null>(null);

  useEffect(() => {
    let active = true;
    listUsers({ page: 1, pageSize: 5, sortBy: "lastLoginAt", sortDir: "desc" })
      .then((page) => {
        if (!active) return;
        setMembers(page.items);
        setTotal(page.totalItems);
        setError(null);
      })
      .catch((failure) => {
        if (active) setError({ cause: failure });
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="grid min-w-0 gap-[14px] 2xl:grid-cols-[minmax(0,1fr)_300px]">
      <SettingsCard className="p-0">
        <div className="p-[18px]">
          <CardHeading
            icon={Users}
            title={t.title}
            description={t.description}
            action={
              <Button asChild className="h-9 rounded-[8px] text-[12px]">
                <Link href="/dashboard/drivers">{t.manage}</Link>
              </Button>
            }
          />
        </div>
        <div className="grid grid-cols-[1fr_110px_110px] border-y border-[#e5eaf2] bg-[#f7f9fc] px-5 py-2.5 text-[10px] font-semibold uppercase text-[#60708f]">
          {t.columns.map((column) => (
            <span key={column}>{column}</span>
          ))}
        </div>
        <div className="divide-y divide-[#e5eaf2]">
          {loading && (
            <div className="grid h-40 place-items-center">
              <LoaderCircle className="size-5 animate-spin text-primary" />
            </div>
          )}
          {!loading && error && (
            <div className="grid h-40 place-items-center px-6 text-center text-[13px] text-danger">
              {messageFor(error.cause)}
            </div>
          )}
          {!loading && !error && members.length === 0 && (
            <div className="grid h-40 place-items-center text-[13px] text-muted-foreground">
              {t.empty}
            </div>
          )}
          {!loading &&
            !error &&
            members.map((member) => (
              <div
                key={member.id}
                className="grid min-h-[62px] grid-cols-[1fr_110px_110px] items-center px-5 text-[12px]"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#eaf0ff] text-[11px] font-bold text-[#2744c7]">
                    {(member.firstName.at(0) ?? "") +
                      (member.lastName.at(0) ?? "")}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-[#14213d]">
                      {member.firstName} {member.lastName}
                    </p>
                    <p className="truncate text-[11px] text-[#667596]">
                      {member.email}
                    </p>
                  </div>
                </div>
                <span className="text-[#4f5f80]">
                  {member.role === "ADMIN" ? t.admin : t.driver}
                </span>
                <span
                  className={cn(
                    "w-fit rounded-full px-2.5 py-1 text-[10px] font-semibold",
                    member.status === "ACTIVE"
                      ? "bg-[#dff5e7] text-[#168548]"
                      : "bg-[#fff1d7] text-[#a86100]",
                  )}
                >
                  {t.status[member.status]}
                </span>
              </div>
            ))}
        </div>
      </SettingsCard>
      <div className="grid content-start gap-[14px]">
        <SettingsCard>
          <span className="grid size-11 place-items-center rounded-[12px] bg-[#eef3ff] text-[#1e5bf4]">
            <Users className="size-5" />
          </span>
          <p className="mt-4 text-[28px] font-bold tracking-[-0.04em] text-[#101a35]">
            {loading ? "—" : total}
          </p>
          <p className="text-[12px] font-semibold text-[#263450]">{t.total}</p>
          <p className="mt-1 text-[11px] leading-4 text-[#667596]">
            {t.totalHint}
          </p>
        </SettingsCard>
      </div>
    </div>
  );
}

function NotificationsTab() {
  const t = useMessages(settingsMessages).notifications;
  return (
    <div className="grid min-w-0 gap-[14px] xl:grid-cols-[minmax(0,720px)_300px]">
      <NotificationCard expanded />
      <SettingsCard>
        <CardHeading
          icon={Bell}
          title={t.deliveryTitle}
          description={t.deliveryDescription}
        />
        <p className="mt-4 text-[12px] leading-5 text-[#667596]">
          {t.deliveryBody}
        </p>
      </SettingsCard>
    </div>
  );
}

const TIMEZONES = ["browser", "Africa/Lagos", "UTC", "America/New_York"];
const DENSITIES = ["comfortable", "compact"] as const;

/** Earlier versions stored display labels; read them as the matching value. */
const LEGACY_PREFERENCE: Record<string, string> = {
  "Browser default": "browser",
  Comfortable: "comfortable",
  Compact: "compact",
};

function PreferencesTab() {
  const t = useMessages(settingsMessages).preferences;
  const toast = useToast();
  const currentLocale = useLocale();
  const { changeLocale } = useChangeLocale();
  const [language, setLanguage] = useState<string>(currentLocale);
  const [timezone, setTimezone] = useState("browser");
  const [density, setDensity] = useState("comfortable");

  useEffect(() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem("cg.dashboard-preferences") ?? "{}",
      ) as { timezone?: string; density?: string };
      if (saved.timezone)
        setTimezone(LEGACY_PREFERENCE[saved.timezone] ?? saved.timezone);
      if (saved.density)
        setDensity(LEGACY_PREFERENCE[saved.density] ?? saved.density);
    } catch {
      // Defaults remain usable when browser storage is unavailable.
    }
  }, []);

  function savePreferences(event: FormEvent) {
    event.preventDefault();
    // The language lives in its own cookie so the server renders in it too.
    if (isLocale(language) && language !== currentLocale) {
      changeLocale(language);
    }
    try {
      localStorage.setItem(
        "cg.dashboard-preferences",
        JSON.stringify({ timezone, density }),
      );
      window.dispatchEvent(
        new CustomEvent("cabinguard:preferences-updated", {
          detail: { timezone, density },
        }),
      );
      toast.success(t.saved, t.savedDetail);
    } catch {
      toast.error(t.failed, t.failedDetail);
    }
  }

  return (
    <SettingsCard className="max-w-[900px] p-0">
      <div className="border-b border-border bg-[linear-gradient(135deg,#fbfcff,#f2f6ff)] p-5">
      <CardHeading
        icon={SlidersHorizontal}
        title={t.title}
        description={t.description}
      />
      </div>
      <form onSubmit={savePreferences} className="grid gap-6 p-5">
        <fieldset>
          <legend className="text-[13px] font-bold text-foreground">
            {t.language}
          </legend>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {t.languageHint}
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {LOCALES.map((code) => {
              const active = language === code;
              const Flag = code === "en" ? GB : FR;
              return (
                <button
                  key={code}
                  type="button"
                  lang={code}
                  aria-pressed={active}
                  onClick={() => setLanguage(code)}
                  className={cn(
                    "group flex items-center gap-3 rounded-xl border p-3.5 text-left outline-none transition focus-visible:ring-2 focus-visible:ring-ring",
                    active
                      ? "border-primary bg-secondary shadow-[0_4px_16px_rgba(48,71,217,.08)]"
                      : "border-border bg-card hover:border-primary/35 hover:bg-muted/40",
                  )}
                >
                  <span className="overflow-hidden rounded-lg shadow-[0_0_0_1px_rgba(15,23,42,.12),0_3px_8px_rgba(15,23,42,.1)]">
                    <Flag aria-hidden="true" className="h-8 w-12 object-cover" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-bold text-foreground">
                      {LOCALE_NAMES[code]}
                    </span>
                    <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      {code}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "grid size-6 place-items-center rounded-full border text-transparent",
                      active && "border-primary bg-primary text-white",
                    )}
                  >
                    <Check className="size-3.5" strokeWidth={3} />
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="grid gap-5 border-t border-border pt-5 md:grid-cols-2">
          <label className="grid gap-2 text-[12px] font-semibold text-foreground">
            <span className="flex items-center gap-2">
              <Globe2 className="size-4 text-primary" /> {t.timezone}
            </span>
            <select
              value={timezone}
              onChange={(event) => setTimezone(event.target.value)}
              className="h-11 rounded-[9px] border border-input bg-card px-3 text-[13px] font-normal outline-none focus:border-ring focus:ring-[3px] focus:ring-ring/50"
            >
              {TIMEZONES.map((zone) => (
                <option key={zone} value={zone}>
                  {zone === "browser" ? t.browserDefault : zone}
                </option>
              ))}
            </select>
          </label>

          <fieldset className="grid gap-2">
            <legend className="flex items-center gap-2 text-[12px] font-semibold text-foreground">
              <SlidersHorizontal className="size-4 text-primary" /> {t.density}
            </legend>
            <div className="grid h-11 grid-cols-2 rounded-[9px] border border-input bg-muted/50 p-1">
              {DENSITIES.map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={density === value}
                  onClick={() => setDensity(value)}
                  className={cn(
                    "rounded-[6px] text-[12px] font-semibold text-muted-foreground outline-none transition focus-visible:ring-2 focus-visible:ring-ring",
                    density === value &&
                      "bg-card text-primary shadow-[0_1px_4px_rgba(16,24,40,.12)]",
                  )}
                >
                  {t[value]}
                </button>
              ))}
            </div>
          </fieldset>
        </div>

        <div className="flex justify-end border-t border-border pt-5">
          <Button type="submit" className="rounded-[8px] px-6">
            <Check /> {t.save}
          </Button>
        </div>
      </form>
    </SettingsCard>
  );
}

function SessionsCard() {
  const t = useMessages(settingsMessages).sessions;
  const messageFor = useMessageFor();
  const router = useRouter();
  const toast = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function signOutEverywhere() {
    setBusy(true);
    try {
      await logoutAll();
      router.replace("/sign-in");
    } catch (failure) {
      toast.error(t.failed, messageFor(failure));
      setBusy(false);
      setConfirmOpen(false);
    }
  }

  return (
    <>
      <SettingsCard className="p-0">
        <div className="p-[15px] pb-2.5">
          <CardHeading
            icon={Monitor}
            title={t.title}
            description={t.description}
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmOpen(true)}
                className="h-[30px] rounded-[7px] border-[#dce4f1] px-3 text-[10px] font-semibold text-[#1451df]"
              >
                <LogOutMini /> {t.signOutAll}
              </Button>
            }
          />
        </div>
        <div className="mx-[15px] grid grid-cols-[1.35fr_1.15fr_1fr_.65fr_24px] rounded-t-[9px] bg-[#f7f9fc] px-3 py-2 text-[9px] font-semibold uppercase text-[#4f5f80]">
          {t.columns.map((column) => (
            <span key={column}>{column}</span>
          ))}
          <span />
        </div>
        <div className="mx-[15px] mb-2 divide-y divide-[#e7ebf2]">
          {sessions.map((session, index) => {
            const copy = t.demo[index];
            return (
              <div
                key={session.device}
                className="grid min-h-[44px] grid-cols-[1.35fr_1.15fr_1fr_.65fr_24px] items-center px-3 text-[10px]"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <session.icon className="size-[18px] shrink-0 text-[#111a32]" />
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-[#14213d]">
                      {session.device}
                    </p>
                    <p className="truncate text-[#667596]">
                      {session.platform}
                    </p>
                  </div>
                </div>
                <div className="flex min-w-0 items-start gap-2">
                  <MapPin className="mt-0.5 size-3.5 shrink-0 text-[#52688f]" />
                  <div className="min-w-0">
                    <p className="truncate text-[#25334e]">{copy?.location}</p>
                    <p className="text-[#667596]">{session.ip}</p>
                  </div>
                </div>
                <span
                  className={cn(
                    "text-[#60708f]",
                    index === 0 && "font-medium text-[#159447]",
                  )}
                >
                  {copy?.active}
                </span>
                <span className="w-fit rounded-full bg-[#dff5e7] px-2.5 py-1 font-semibold text-[#168548]">
                  {copy?.status}
                </span>
                <button
                  type="button"
                  aria-label={t.actionsFor(session.device)}
                  className="grid size-6 place-items-center"
                >
                  <MoreVertical className="size-4" />
                </button>
              </div>
            );
          })}
        </div>
      </SettingsCard>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-[480px] overflow-hidden rounded-[18px] border-[#dbe4f2] shadow-[0_24px_70px_rgba(25,42,84,.22)]">
          <DialogHeader className="border-b border-[#e6ebf3] bg-[linear-gradient(135deg,#f7f9ff,#eef3ff)] p-6">
            <DialogTitle>{t.confirmTitle}</DialogTitle>
            <DialogDescription>{t.confirmDescription}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="p-6">
            <Button
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              disabled={busy}
            >
              {t.cancel}
            </Button>
            <Button onClick={() => void signOutEverywhere()} disabled={busy}>
              {busy && <LoaderCircle className="animate-spin" />} {t.signOutAll}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function LogOutMini() {
  return <span className="block size-3 rounded-[2px] border border-current" />;
}

function ActivityCard() {
  const t = useMessages(settingsMessages).activity;
  const activities = t.demo.map((activity, index) => ({
    ...activity,
    icon: activityIcons[index % activityIcons.length]!,
  }));
  return (
    <SettingsCard>
      <CardHeading
        icon={Clock3}
        title={t.title}
        description={t.description}
        action={
          <Button
            asChild
            variant="outline"
            size="sm"
            className="h-[30px] rounded-[7px] px-4 text-[10px] text-[#1451df]"
          >
            <Link href="/dashboard/audit">{t.viewAll}</Link>
          </Button>
        }
      />
      <div className="relative mt-3 grid grid-cols-2 gap-x-6 gap-y-4 pl-8 before:absolute before:top-2 before:bottom-2 before:left-[10px] before:w-px before:bg-[#d9e1ef]">
        {activities.map((activity, index) => (
          <div
            key={index}
            className="relative flex min-w-0 gap-2.5 before:absolute before:top-2 before:left-[-31px] before:size-2 before:rounded-full before:bg-[#2862f5] before:ring-4 before:ring-white"
          >
            <span className="grid size-8 shrink-0 place-items-center rounded-[9px] bg-[#eef3ff] text-[#2762f4]">
              <activity.icon className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex gap-2">
                <p className="truncate text-[10px] font-semibold text-[#14213d]">
                  {activity.title}
                </p>
                <span className="ml-auto shrink-0 text-[9px] text-[#667596]">
                  {activity.time}
                </span>
              </div>
              <p className="mt-0.5 line-clamp-2 text-[9px] leading-3 text-[#667596]">
                {activity.detail}
              </p>
            </div>
          </div>
        ))}
      </div>
    </SettingsCard>
  );
}

function SecurityAssurance({ enabled }: { enabled: boolean }) {
  const t = useMessages(settingsMessages).assurance;
  return (
    <SettingsCard className="p-[10px]">
      <div className="rounded-[12px] bg-[linear-gradient(145deg,#f4f8ff,#edf4ff)] px-5 pt-4 pb-5 text-center">
        <div className="relative mx-auto grid h-[76px] w-[140px] place-items-center before:absolute before:bottom-0 before:h-8 before:w-[128px] before:rounded-[50%] before:bg-[#dbe7ff]">
          <span className="absolute left-2 top-8 size-8 rotate-12 rounded-[45%] bg-[#e2ebff]" />
          <span className="absolute right-3 top-7 size-10 -rotate-12 rounded-[45%] bg-[#e6eeff]" />
          <span className="relative z-10 grid size-[68px] place-items-center rounded-[22px] border-2 border-[#6c91ff] bg-[linear-gradient(145deg,#a9c1ff,#4f7ef5)] text-white shadow-[0_8px_20px_rgba(53,99,255,.24)] ring-4 ring-[#dce7ff]">
            <ShieldCheck className="size-9" strokeWidth={2.3} />
          </span>
        </div>
        <h2 className="mt-1 text-[15px] font-bold text-[#101a35]">{t.title}</h2>
        <p className="mx-auto mt-1 max-w-[230px] text-[12px] leading-5 text-[#6374a0]">
          {enabled ? t.enabled : t.available}
        </p>
        <div className="my-3 h-px bg-[#dce4f1]" />
        <ul className="grid gap-2 text-left text-[12px] text-[#283650]">
          {t.checks.map((label) => (
            <li key={label} className="flex items-center gap-2">
              <CheckCircle2 className="size-4 fill-[#16a34a] text-white" />
              {label}
            </li>
          ))}
        </ul>
      </div>
    </SettingsCard>
  );
}

function QuickActions({
  onSelectTab,
}: {
  onSelectTab: (tab: SettingsTab) => void;
}) {
  const t = useMessages(settingsMessages).quick;
  const items = [
    { label: t.download, icon: FileDown },
    { label: t.team, icon: Users, tab: "team" as const },
    { label: t.audit, icon: Building2, href: "/dashboard/audit" },
    { label: t.support, icon: Headphones },
  ];
  return (
    <SettingsCard className="p-0">
      <div className="flex items-center gap-3 border-b border-[#e5eaf2] p-[14px]">
        <span className="grid size-8 place-items-center rounded-[9px] bg-[#fff4dc] text-[#f59e0b]">
          <Zap className="size-4 fill-current" />
        </span>
        <h2 className="text-[14px] font-bold text-[#101a35]">{t.title}</h2>
      </div>
      <div className="divide-y divide-[#e5eaf2]">
        {items.map((item) => {
          const content = (
            <>
              <item.icon className="size-4 text-[#506183]" />
              <span className="flex-1">{item.label}</span>
              <ChevronRight className="size-4 text-[#506183]" />
            </>
          );
          const className =
            "flex h-[42px] items-center gap-3 px-5 text-[12px] text-[#18243e] transition-colors hover:bg-[#f7f9fc]";
          return item.href ? (
            <Link key={item.label} href={item.href} className={className}>
              {content}
            </Link>
          ) : (
            <button
              key={item.label}
              type="button"
              onClick={() => item.tab && onSelectTab(item.tab)}
              className={cn(className, "w-full text-left")}
            >
              {content}
            </button>
          );
        })}
      </div>
    </SettingsCard>
  );
}

// -------------------------------------------------------------- shared bits

function CodeField({
  id,
  label,
  value,
  onChange,
  hint,
  allowRecovery = true,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint: string;
  allowRecovery?: boolean;
}) {
  const t = useMessages(settingsMessages).code;
  const [recoveryMode, setRecoveryMode] = useState(false);

  function switchMode() {
    onChange("");
    setRecoveryMode((current) => !current);
  }

  return (
    <div className="rounded-[14px] border border-[#e0e7f2] bg-[linear-gradient(180deg,#fbfcff,#f5f8ff)] p-4 shadow-[inset_0_1px_0_white]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <Label htmlFor={recoveryMode ? id : undefined}>{label}</Label>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {recoveryMode ? t.recoveryHint : t.appHint}
          </p>
        </div>
        <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-[#e9efff] text-[#245cf0]">
          {recoveryMode ? (
            <LifeBuoy className="size-[18px]" />
          ) : (
            <ShieldCheck className="size-[18px]" />
          )}
        </span>
      </div>

      {recoveryMode ? (
        <div className="relative">
          <KeyRound className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-[#60708f]" />
          <Input
            id={id}
            value={value}
            onChange={(event) => onChange(event.target.value.toUpperCase())}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            autoFocus
            maxLength={11}
            placeholder="XXXXX-XXXXX"
            className="h-12 rounded-[10px] border-[#d8e1ef] bg-white pl-10 font-mono text-[15px] tracking-[0.12em] shadow-[0_4px_12px_rgba(35,58,105,.05)]"
          />
        </div>
      ) : (
        <MfaCodeInput
          value={value}
          onChange={onChange}
          autoFocus
          variant="settings"
        />
      )}

      <div className="mt-4 flex min-h-5 items-center justify-between gap-3">
        <p className="text-[11px] text-muted-foreground">{hint}</p>
        {allowRecovery && (
          <button
            type="button"
            onClick={switchMode}
            className="shrink-0 text-[11px] font-semibold text-[#2456d8] hover:underline"
          >
            {recoveryMode ? t.useApp : t.useRecovery}
          </button>
        )}
      </div>
    </div>
  );
}

function ErrorLine({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-[13px] font-medium text-danger">
      {message}
    </p>
  );
}

/** Shown once: copy, download, and an explicit "stored" check before closing. */
function RecoveryCodesPanel({
  codes,
  onDone,
}: {
  codes: string[];
  onDone: () => void;
}) {
  const t = useMessages(settingsMessages).codes;
  const [stored, setStored] = useState(false);
  const [copied, setCopied] = useState(false);
  const text = `${t.fileHeader}\n${t.fileNote}\n\n${codes.join("\n")}\n`;

  return (
    <>
      <ol className="grid grid-cols-2 gap-x-6 gap-y-2 rounded-[12px] border border-border bg-secondary/40 px-5 py-4 font-mono text-[14px] font-semibold tracking-[0.08em] text-foreground">
        {codes.map((code) => (
          <li key={code} className="select-all">
            {code}
          </li>
        ))}
      </ol>
      <div className="grid grid-cols-2 gap-3">
        <Button
          variant="outline"
          className="rounded-[9px]"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text);
              setCopied(true);
            } catch {
              // Clipboard blocked: codes stay selectable and downloadable.
            }
          }}
        >
          {copied ? <Check /> : <Copy />} {copied ? t.copied : t.copyAll}
        </Button>
        <Button
          variant="outline"
          className="rounded-[9px]"
          onClick={() => {
            const url = URL.createObjectURL(
              new Blob([text], { type: "text/plain" }),
            );
            const link = document.createElement("a");
            link.href = url;
            link.download = "cabinguard-recovery-codes.txt";
            link.click();
            URL.revokeObjectURL(url);
          }}
        >
          <Download /> {t.download}
        </Button>
      </div>
      <label className="flex items-center gap-2.5 text-[13px] text-foreground">
        <input
          type="checkbox"
          checked={stored}
          onChange={(event) => setStored(event.target.checked)}
          className="size-4 accent-[var(--color-primary)]"
        />
        {t.stored}
      </label>
      <DialogFooter>
        <Button disabled={!stored} onClick={onDone} className="rounded-[9px]">
          {t.done}
        </Button>
      </DialogFooter>
    </>
  );
}

// -------------------------------------------------------------- dialogs

function RegenerateCodesDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const t = useMessages(settingsMessages).regenerate;
  const messageFor = useMessageFor();
  const toast = useToast();
  const [code, setCode] = useState("");
  const [codes, setCodes] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setCode("");
      setCodes(null);
      setError(null);
    }
  }, [open]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setCodes((await regenerateRecoveryCodes(code.trim())).recoveryCodes);
      toast.success(t.generated, t.generatedDetail);
    } catch (failure) {
      setError(messageFor(failure));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      // Closing is only allowed through "Done" once codes are on screen.
      onOpenChange={(next) => !next && !codes && onClose()}
    >
      <DialogContent className="max-w-[480px] overflow-hidden rounded-[18px] border-[#dbe4f2] shadow-[0_24px_70px_rgba(25,42,84,.22)]">
        <DialogHeader className="border-b border-[#e6ebf3] bg-[linear-gradient(135deg,#f7f9ff,#eef3ff)] p-6">
          <DialogTitle>{codes ? t.newTitle : t.title}</DialogTitle>
          <DialogDescription>
            {codes ? t.shownOnce : t.warning}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 p-6">
          {codes ? (
            <RecoveryCodesPanel codes={codes} onDone={onClose} />
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <CodeField
                id="regen-code"
                label={t.label}
                value={code}
                onChange={setCode}
                hint={t.hint}
              />
              <ErrorLine message={error} />
              <DialogFooter>
                <Button
                  type="submit"
                  disabled={busy || code.trim().length < 6}
                  className="rounded-[9px]"
                >
                  {busy && <LoaderCircle className="animate-spin" />}
                  {t.submit}
                </Button>
              </DialogFooter>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ReplaceAuthenticatorDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const t = useMessages(settingsMessages).replace;
  const messageFor = useMessageFor();
  const toast = useToast();
  const [step, setStep] = useState<"verify" | "scan" | "codes">("verify");
  const [proof, setProof] = useState("");
  const [setup, setSetup] = useState<TotpSetup | null>(null);
  const [qr, setQr] = useState("");
  const [newCode, setNewCode] = useState("");
  const [codes, setCodes] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setStep("verify");
      setProof("");
      setSetup(null);
      setQr("");
      setNewCode("");
      setCodes([]);
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    if (!setup) return;
    let active = true;
    QRCode.toDataURL(setup.otpauthUri, { width: 360, margin: 1 })
      .then((url) => active && setQr(url))
      .catch(() => active && setError(t.qrFailed));
    return () => {
      active = false;
    };
  }, [setup, t.qrFailed]);

  async function verify(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setSetup(await startTotpSetup(proof.trim()));
      setStep("scan");
    } catch (failure) {
      setError(messageFor(failure));
    } finally {
      setBusy(false);
    }
  }

  async function confirm(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setCodes((await confirmTotpSetup(newCode.trim())).recoveryCodes);
      setStep("codes");
      toast.success(t.replaced, t.replacedDetail);
    } catch (failure) {
      setError(messageFor(failure));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !next && step !== "codes" && onClose()}
    >
      <DialogContent className="max-w-md">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle>
            {step === "verify" && t.verifyTitle}
            {step === "scan" && t.scanTitle}
            {step === "codes" && t.codesTitle}
          </DialogTitle>
          <DialogDescription>
            {step === "verify" && t.verifyDescription}
            {step === "scan" && t.scanDescription}
            {step === "codes" && t.codesDescription}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 p-6">
          {step === "verify" && (
            <form onSubmit={verify} className="space-y-4">
              <CodeField
                id="replace-proof"
                label={t.proofLabel}
                value={proof}
                onChange={setProof}
                hint={t.proofHint}
              />
              <ErrorLine message={error} />
              <DialogFooter>
                <Button
                  type="submit"
                  disabled={busy || proof.trim().length < 6}
                  className="rounded-[9px]"
                >
                  {busy && <LoaderCircle className="animate-spin" />}
                  {t.next}
                </Button>
              </DialogFooter>
            </form>
          )}
          {step === "scan" && setup && (
            <form onSubmit={confirm} className="space-y-4">
              <div className="mx-auto w-fit rounded-xl border border-border bg-white p-2">
                {qr ? (
                  <Image
                    src={qr}
                    alt={t.qrAlt}
                    width={180}
                    height={180}
                    unoptimized
                  />
                ) : (
                  <div className="grid size-[180px] place-items-center">
                    <LoaderCircle className="animate-spin text-muted-foreground" />
                  </div>
                )}
              </div>
              <p className="text-center font-mono text-[12px] tracking-[0.12em] break-all text-muted-foreground">
                {setup.secret.match(/.{1,4}/g)?.join(" ")}
              </p>
              <CodeField
                id="replace-new-code"
                label={t.newLabel}
                value={newCode}
                onChange={setNewCode}
                hint={t.newHint}
                allowRecovery={false}
              />
              <ErrorLine message={error} />
              <DialogFooter>
                <Button
                  type="submit"
                  disabled={busy || newCode.trim().length !== 6}
                  className="rounded-[9px]"
                >
                  {busy && <LoaderCircle className="animate-spin" />}
                  <KeyRound /> {t.confirm}
                </Button>
              </DialogFooter>
            </form>
          )}
          {step === "codes" && (
            <RecoveryCodesPanel codes={codes} onDone={onClose} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
