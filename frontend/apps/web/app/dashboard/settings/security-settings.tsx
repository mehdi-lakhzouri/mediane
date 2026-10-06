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

function messageFor(error: unknown): string {
  if (!(error instanceof ApiError))
    return "Something went wrong. Please try again.";
  switch (error.code) {
    case "MFA_CODE_INVALID":
      return "That code is not valid. Use the current code from your app, or an unused recovery code.";
    case "MFA_CODE_REQUIRED":
      return "Enter a code from your authenticator app.";
    case "INVALID_CURRENT_PASSWORD":
      return "Your current password is incorrect.";
    case "WEAK_PASSWORD":
      return error.details[0]?.message
        ? `The new password ${error.details[0].message}.`
        : "Choose a stronger password.";
    case "PASSWORD_UNCHANGED":
      return "The new password must be different from the current one.";
    case "MFA_SETUP_NOT_STARTED":
      return "The setup expired. Start again.";
    case "RATE_LIMITED":
      return "Too many attempts. Wait a few minutes, then try again.";
    default:
      return error.message;
  }
}

const settingTabs = [
  { id: "general", label: "General", icon: Settings2 },
  { id: "security", label: "Security", icon: LockKeyhole },
  { id: "team", label: "Team Access", icon: Users },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "preferences", label: "Preferences", icon: SlidersHorizontal },
] as const;

type SettingsTab = (typeof settingTabs)[number]["id"];

const sessions = [
  {
    device: "MacBook Pro",
    platform: "Chrome · macOS",
    location: "New York, USA",
    ip: "192.168.1.24",
    active: "Active now",
    status: "Current",
    icon: Laptop,
  },
  {
    device: "iPhone 14",
    platform: "Safari · iOS",
    location: "New York, USA",
    ip: "192.168.1.24",
    active: "2 hours ago",
    status: "Active",
    icon: Smartphone,
  },
  {
    device: "Windows PC",
    platform: "Edge · Windows",
    location: "Toronto, Canada",
    ip: "192.168.1.35",
    active: "1 day ago",
    status: "Active",
    icon: Monitor,
  },
] as const;

const activities = [
  {
    title: "Updated notification preferences",
    detail: "Enabled security alerts and product updates.",
    time: "3 days ago",
    icon: Settings2,
  },
  {
    title: "Changed password",
    detail: "Your password was successfully updated.",
    time: "3 days ago",
    icon: LockKeyhole,
  },
  {
    title: "New device sign-in",
    detail: "Chrome on MacBook Pro · New York, USA",
    time: "5 days ago",
    icon: Smartphone,
  },
  {
    title: "Team member invited",
    detail: "You invited sarah@cabinguard.com to the organization.",
    time: "1 week ago",
    icon: Users,
  },
] as const;

/** Account settings surface. Live account and MFA data are used where APIs exist. */
export function SecuritySettings() {
  const [status, setStatus] = useState<MfaStatus | null>(null);
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [phone, setPhone] = useState<PhoneValue | undefined>();
  const [failed, setFailed] = useState(false);
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");
  const [profileOpen, setProfileOpen] = useState(false);
  const [dialog, setDialog] = useState<"codes" | "replace" | null>(null);

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

  return (
    <div className="-mt-[14px] flex flex-col gap-[14px] pb-4 xl:-mt-[17px] xl:w-[calc(100%_-_18px)]">
      <div>
        <h1 className="text-[32px] font-bold leading-[1.15] tracking-[-0.035em] text-foreground">
          Settings
        </h1>
        <p className="mt-1 text-[15px] text-[#60708f]">
          Manage your account, security, team access and preferences for
          CabinGuard.
        </p>
      </div>

      <div
        role="tablist"
        aria-label="Settings sections"
        className="cg-scroll flex h-[48px] overflow-x-auto overflow-y-hidden rounded-[11px] border border-border bg-white px-1 shadow-[0_1px_2px_rgba(16,24,40,.025)]"
      >
        {settingTabs.map(({ id, label, icon: Icon }) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              id={`settings-tab-${id}`}
              aria-selected={active}
              aria-controls={`settings-panel-${id}`}
              onClick={() => setActiveTab(id)}
              className={cn(
                "relative flex min-w-[148px] flex-1 items-center justify-center gap-3 border-r border-[#edf0f5] text-[13px] font-semibold text-[#14213d] last:border-r-0 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#3563ff] sm:min-w-0",
                active && "bg-[#f3f6ff] text-[#1545df]",
              )}
            >
              <Icon className="size-[18px]" strokeWidth={1.9} />
              {label}
              {active && (
                <span className="absolute inset-x-[-1px] bottom-0 h-0.5 bg-[#3563ff]" />
              )}
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
          <div className="grid items-start gap-[14px] xl:grid-cols-[minmax(0,1fr)_300px]">
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
              <QuickActions onSelectTab={setActiveTab} />
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
  return (
    <SettingsCard>
      <CardHeading
        icon={UserRound}
        title="Account & Organization"
        description="Your personal information and organization details."
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={onEdit}
            disabled={!user}
            className="h-[30px] rounded-[7px] border-[#dce4f1] px-3 text-[12px] font-semibold text-[#1451df]"
          >
            <Pencil className="size-3.5" /> Edit profile
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
      setError("Enter both your first and last name.");
      return;
    }
    if (phoneNumber && !isValidPhoneNumber(phoneNumber)) {
      setError("Enter a valid international phone number.");
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
      toast.success(
        "Profile updated.",
        "Your account details have been saved.",
      );
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
          <DialogTitle>Edit profile</DialogTitle>
          <DialogDescription>
            Update your account identity and contact details.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4 p-6">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="profile-first-name">First name</Label>
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
              <Label htmlFor="profile-last-name">Last name</Label>
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
            <Label htmlFor="profile-email">Work email</Label>
            <Input
              id="profile-email"
              value={user?.email ?? ""}
              disabled
              className="h-11 rounded-[9px]"
            />
            <p className="text-[12px] text-muted-foreground">
              Email changes require a separate verified-email workflow.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="profile-phone">Phone number</Label>
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
              placeholder="Enter phone number"
              className="cg-phone-input"
            />
            <p className="text-[12px] text-muted-foreground">
              Choose a country to apply its flag, dialing prefix and format.
            </p>
          </div>
          <ErrorLine message={error} />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={busy || !firstName.trim() || !lastName.trim()}
            >
              {busy && <LoaderCircle className="animate-spin" />} Save changes
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
  return (
    <div className="mt-3 grid grid-cols-1 gap-x-3 gap-y-2.5 sm:grid-cols-2">
      <FieldShell label="Full name">
        <span className="truncate">{user ? fullName(user) : "Loading…"}</span>
      </FieldShell>
      <FieldShell label="Work email">
        <span className="truncate">{user?.email ?? "Loading…"}</span>
      </FieldShell>
      <FieldShell label="Phone number">
        <Smartphone className="size-4 text-[#60708f]" />
        <span className={phone ? "text-[#263450]" : "text-[#667596]"}>
          {phone ? formatPhoneNumberIntl(phone) : "Not configured"}
        </span>
      </FieldShell>
      <FieldShell label="Role">
        <span>{user?.role === "DRIVER" ? "Driver" : "Administrator"}</span>
        <ChevronDown className="ml-auto size-3 text-[#60708f]" />
      </FieldShell>
      <FieldShell label="Company / Organization">
        <Building2 className="size-4 text-[#60708f]" />
        <span>CabinGuard</span>
      </FieldShell>
      <FieldShell label="Timezone">
        <Globe2 className="size-4 text-[#60708f]" />
        <span className="truncate">Browser default</span>
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
  const enabled = status?.enabled ?? true;
  const rows = [
    {
      icon: ShieldCheck,
      title: "Two-step verification",
      detail: enabled
        ? "Your account is protected with 2FA."
        : "Add another layer of account protection.",
      action: "Manage",
      onClick: onReplace,
      green: true,
    },
    {
      icon: Smartphone,
      title: "Authenticator app",
      detail: enabled ? "Connected via Google Authenticator" : "Not connected",
      action: enabled ? "Replace" : "Connect",
      onClick: onReplace,
    },
    {
      icon: KeyRound,
      title: "Recovery codes",
      detail: `${status?.recoveryCodesRemaining ?? 10} of 10 codes remaining`,
      action: "Generate",
      onClick: onCodes,
    },
  ];

  return (
    <SettingsCard className="p-[14px]">
      <CardHeading
        icon={ShieldCheck}
        title="Security Overview"
        description="Keep your account secure and protected."
        action={
          <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-[#e3f7ea] px-3 text-[10px] font-semibold text-[#15803d]">
            <CheckCircle2 className="size-3 fill-[#16a34a] text-white" />
            {failed
              ? "Check status"
              : enabled
                ? "Strong security"
                : "Action needed"}
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
                    {enabled ? "On" : "Off"}
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
  const strengthLabel = next
    ? (["Too short", "Weak", "Good", "Strong"] as const)[strengthScore]
    : "Password strength";
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
      toast.success(
        "Password changed.",
        "Your other sessions were signed out.",
      );
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
    if (next.length < 12)
      return setError("The new password needs at least 12 characters.");
    if (next === current)
      return setError(
        "The new password must be different from the current one.",
      );
    if (next !== confirmation)
      return setError("The new passwords do not match.");
    setError(null);
    setCode("");
    setVerifyOpen(true);
  }

  const fields = [
    [
      "current",
      "Current password",
      current,
      setCurrent,
      "Enter your current password",
    ],
    ["next", "New password", next, setNext, "Enter a new password"],
    [
      "confirm",
      "Confirm new password",
      confirmation,
      setConfirmation,
      "Confirm your new password",
    ],
  ] as const;

  return (
    <>
      <SettingsCard className="p-[14px] pb-[7px]">
        <CardHeading
          icon={LockKeyhole}
          title="Change Password"
          description="Use a strong password to keep your account safe."
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
                    aria-label={`${visible[id] ? "Hide" : "Show"} ${label.toLowerCase()}`}
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
                  {passwordsMatch
                    ? "Passwords match"
                    : "Passwords do not match"}
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
            {busy && <LoaderCircle className="animate-spin" />} Update password
          </Button>
        </form>
      </SettingsCard>

      <Dialog open={verifyOpen} onOpenChange={setVerifyOpen}>
        <DialogContent className="max-w-[480px] overflow-hidden rounded-[18px] border-[#dbe4f2] shadow-[0_24px_70px_rgba(25,42,84,.22)]">
          <DialogHeader className="border-b border-[#e6ebf3] bg-[linear-gradient(135deg,#f7f9ff,#eef3ff)] p-6">
            <DialogTitle>Confirm password change</DialogTitle>
            <DialogDescription>
              Enter a code from your authenticator app or an unused recovery
              code.
            </DialogDescription>
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
              label="Verification code"
              value={code}
              onChange={setCode}
              hint="This protects changes to your sign-in credentials."
            />
            <ErrorLine message={error} />
            <DialogFooter>
              <Button type="submit" disabled={busy || code.trim().length < 6}>
                {busy && <LoaderCircle className="animate-spin" />} Confirm &
                update
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function NotificationCard({ expanded = false }: { expanded?: boolean }) {
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
  const rows = [
    {
      icon: ShieldCheck,
      title: "Security alerts",
      detail:
        "Get notified about new sign-ins, device changes, and security events.",
    },
    {
      icon: Megaphone,
      title: "Product updates",
      detail: "Receive updates about new features and improvements.",
    },
    {
      icon: BarChart3,
      title: "Weekly summary",
      detail: "Get a weekly summary of account activity.",
    },
  ];
  return (
    <SettingsCard className={expanded ? "p-[18px]" : undefined}>
      <CardHeading
        icon={Bell}
        title="Notification Preferences"
        description="Choose what you'd like to be notified about."
      />
      <div
        className={cn(
          "mt-2.5 grid gap-1.5",
          expanded &&
            "mt-4 gap-0 divide-y divide-[#e5eaf2] overflow-hidden rounded-[10px] border border-[#e5eaf2]",
        )}
      >
        {rows.map((row, index) => (
          <div
            key={row.title}
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
    <div className="grid items-start gap-[14px] xl:grid-cols-[minmax(0,1fr)_300px]">
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
  const [members, setMembers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        if (active) setError(messageFor(failure));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="grid gap-[14px] lg:grid-cols-[minmax(0,1fr)_300px]">
      <SettingsCard className="p-0">
        <div className="p-[18px]">
          <CardHeading
            icon={Users}
            title="Team Access"
            description="Administrators and drivers with access to CabinGuard."
            action={
              <Button asChild className="h-9 rounded-[8px] text-[12px]">
                <Link href="/dashboard/drivers">Manage all users</Link>
              </Button>
            }
          />
        </div>
        <div className="grid grid-cols-[1fr_110px_110px] border-y border-[#e5eaf2] bg-[#f7f9fc] px-5 py-2.5 text-[10px] font-semibold uppercase text-[#60708f]">
          <span>User</span>
          <span>Role</span>
          <span>Status</span>
        </div>
        <div className="divide-y divide-[#e5eaf2]">
          {loading && (
            <div className="grid h-40 place-items-center">
              <LoaderCircle className="size-5 animate-spin text-primary" />
            </div>
          )}
          {!loading && error && (
            <div className="grid h-40 place-items-center px-6 text-center text-[13px] text-danger">
              {error}
            </div>
          )}
          {!loading && !error && members.length === 0 && (
            <div className="grid h-40 place-items-center text-[13px] text-muted-foreground">
              No team members found.
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
                  {member.role === "ADMIN" ? "Administrator" : "Driver"}
                </span>
                <span
                  className={cn(
                    "w-fit rounded-full px-2.5 py-1 text-[10px] font-semibold",
                    member.status === "ACTIVE"
                      ? "bg-[#dff5e7] text-[#168548]"
                      : "bg-[#fff1d7] text-[#a86100]",
                  )}
                >
                  {member.status.toLowerCase()}
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
          <p className="text-[12px] font-semibold text-[#263450]">
            Total team members
          </p>
          <p className="mt-1 text-[11px] leading-4 text-[#667596]">
            Live count from the administrator users API.
          </p>
        </SettingsCard>
      </div>
    </div>
  );
}

function NotificationsTab() {
  return (
    <div className="grid gap-[14px] lg:grid-cols-[minmax(0,720px)_300px]">
      <NotificationCard expanded />
      <SettingsCard>
        <CardHeading
          icon={Bell}
          title="Delivery status"
          description="Notification controls are saved on this device."
        />
        <p className="mt-4 text-[12px] leading-5 text-[#667596]">
          Server-side notification delivery is not exposed by the current API.
          Your choices will remain in this browser until account preferences are
          added to the backend.
        </p>
      </SettingsCard>
    </div>
  );
}

function PreferencesTab() {
  const toast = useToast();
  const [language, setLanguage] = useState("English");
  const [timezone, setTimezone] = useState("Browser default");
  const [density, setDensity] = useState("Comfortable");

  useEffect(() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem("cg.dashboard-preferences") ?? "{}",
      ) as { language?: string; timezone?: string; density?: string };
      if (saved.language) setLanguage(saved.language);
      if (saved.timezone) setTimezone(saved.timezone);
      if (saved.density) setDensity(saved.density);
    } catch {
      // Defaults remain usable when browser storage is unavailable.
    }
  }, []);

  function savePreferences(event: FormEvent) {
    event.preventDefault();
    try {
      localStorage.setItem(
        "cg.dashboard-preferences",
        JSON.stringify({ language, timezone, density }),
      );
      toast.success(
        "Preferences saved.",
        "These settings are stored on this device.",
      );
    } catch {
      toast.error(
        "Preferences could not be saved.",
        "Browser storage is unavailable.",
      );
    }
  }

  return (
    <SettingsCard className="max-w-[760px]">
      <CardHeading
        icon={SlidersHorizontal}
        title="Dashboard Preferences"
        description="Customize how the administrator console appears on this device."
      />
      <form onSubmit={savePreferences} className="mt-6 grid gap-5">
        {[
          ["Language", language, setLanguage, ["English", "French", "Arabic"]],
          [
            "Timezone",
            timezone,
            setTimezone,
            ["Browser default", "Africa/Lagos", "UTC", "America/New_York"],
          ],
          [
            "Interface density",
            density,
            setDensity,
            ["Comfortable", "Compact"],
          ],
        ].map(([label, value, setter, options]) => (
          <label
            key={label as string}
            className="grid gap-2 text-[12px] font-semibold text-[#14213d]"
          >
            {label as string}
            <select
              value={value as string}
              onChange={(event) =>
                (setter as (value: string) => void)(event.target.value)
              }
              className="h-11 rounded-[9px] border border-input bg-white px-3 text-[13px] font-normal outline-none focus:border-ring focus:ring-[3px] focus:ring-ring/50"
            >
              {(options as string[]).map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </label>
        ))}
        <Button type="submit" className="mt-1 w-fit rounded-[8px] px-6">
          Save preferences
        </Button>
      </form>
    </SettingsCard>
  );
}

function SessionsCard() {
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
      toast.error("Could not sign out all sessions.", messageFor(failure));
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
            title="Active Sessions & Devices"
            description="Manage your active sessions across different devices."
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmOpen(true)}
                className="h-[30px] rounded-[7px] border-[#dce4f1] px-3 text-[10px] font-semibold text-[#1451df]"
              >
                <LogOutMini /> Sign out all
              </Button>
            }
          />
        </div>
        <div className="mx-[15px] grid grid-cols-[1.35fr_1.15fr_1fr_.65fr_24px] rounded-t-[9px] bg-[#f7f9fc] px-3 py-2 text-[9px] font-semibold uppercase text-[#4f5f80]">
          <span>Device</span>
          <span>Location</span>
          <span>Last active</span>
          <span>Status</span>
          <span />
        </div>
        <div className="mx-[15px] mb-2 divide-y divide-[#e7ebf2]">
          {sessions.map((session, index) => (
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
                  <p className="truncate text-[#667596]">{session.platform}</p>
                </div>
              </div>
              <div className="flex min-w-0 items-start gap-2">
                <MapPin className="mt-0.5 size-3.5 shrink-0 text-[#52688f]" />
                <div className="min-w-0">
                  <p className="truncate text-[#25334e]">{session.location}</p>
                  <p className="text-[#667596]">{session.ip}</p>
                </div>
              </div>
              <span
                className={cn(
                  "text-[#60708f]",
                  index === 0 && "font-medium text-[#159447]",
                )}
              >
                {session.active}
              </span>
              <span className="w-fit rounded-full bg-[#dff5e7] px-2.5 py-1 font-semibold text-[#168548]">
                {session.status}
              </span>
              <button
                type="button"
                aria-label={`Actions for ${session.device}`}
                className="grid size-6 place-items-center"
              >
                <MoreVertical className="size-4" />
              </button>
            </div>
          ))}
        </div>
      </SettingsCard>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-[480px] overflow-hidden rounded-[18px] border-[#dbe4f2] shadow-[0_24px_70px_rgba(25,42,84,.22)]">
          <DialogHeader className="border-b border-[#e6ebf3] bg-[linear-gradient(135deg,#f7f9ff,#eef3ff)] p-6">
            <DialogTitle>Sign out on every device?</DialogTitle>
            <DialogDescription>
              This revokes all web and mobile sessions, including this one. You
              will return to the sign-in page.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="p-6">
            <Button
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button onClick={() => void signOutEverywhere()} disabled={busy}>
              {busy && <LoaderCircle className="animate-spin" />} Sign out all
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
  return (
    <SettingsCard>
      <CardHeading
        icon={Clock3}
        title="Recent Activity"
        description="A log of recent changes to your account."
        action={
          <Button
            asChild
            variant="outline"
            size="sm"
            className="h-[30px] rounded-[7px] px-4 text-[10px] text-[#1451df]"
          >
            <Link href="/dashboard/audit">View all</Link>
          </Button>
        }
      />
      <div className="relative mt-3 grid grid-cols-2 gap-x-6 gap-y-4 pl-8 before:absolute before:top-2 before:bottom-2 before:left-[10px] before:w-px before:bg-[#d9e1ef]">
        {activities.map((activity) => (
          <div
            key={activity.title}
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
        <h2 className="mt-1 text-[15px] font-bold text-[#101a35]">
          Your account is secure
        </h2>
        <p className="mx-auto mt-1 max-w-[230px] text-[12px] leading-5 text-[#6374a0]">
          Two-step verification is {enabled ? "enabled" : "available"} and your
          account is protected.
        </p>
        <div className="my-3 h-px bg-[#dce4f1]" />
        <ul className="grid gap-2 text-left text-[12px] text-[#283650]">
          {[
            "Strong password",
            "Two-step verification",
            "No recent security issues",
          ].map((label) => (
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
  const items = [
    { label: "Download my data", icon: FileDown },
    { label: "Manage team access", icon: Users, tab: "team" as const },
    { label: "View audit log", icon: Building2, href: "/dashboard/audit" },
    { label: "Contact support", icon: Headphones },
  ];
  return (
    <SettingsCard className="p-0">
      <div className="flex items-center gap-3 border-b border-[#e5eaf2] p-[14px]">
        <span className="grid size-8 place-items-center rounded-[9px] bg-[#fff4dc] text-[#f59e0b]">
          <Zap className="size-4 fill-current" />
        </span>
        <h2 className="text-[14px] font-bold text-[#101a35]">Quick actions</h2>
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
            {recoveryMode
              ? "Enter one of your saved recovery codes."
              : "Enter the current six-digit code."}
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
            {recoveryMode ? "Use authenticator code" : "Use recovery code"}
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
  const [stored, setStored] = useState(false);
  const [copied, setCopied] = useState(false);
  const text = `CabinGuard recovery codes\nEach code works once. Keep them private.\n\n${codes.join("\n")}\n`;

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
          {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy all"}
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
          <Download /> Download .txt
        </Button>
      </div>
      <label className="flex items-center gap-2.5 text-[13px] text-foreground">
        <input
          type="checkbox"
          checked={stored}
          onChange={(event) => setStored(event.target.checked)}
          className="size-4 accent-[var(--color-primary)]"
        />
        I have stored these codes somewhere safe.
      </label>
      <DialogFooter>
        <Button disabled={!stored} onClick={onDone} className="rounded-[9px]">
          Done
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
      toast.success(
        "New recovery codes generated.",
        "The previous ones no longer work.",
      );
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
          <DialogTitle>
            {codes ? "Your new recovery codes" : "Generate new recovery codes"}
          </DialogTitle>
          <DialogDescription>
            {codes
              ? "Shown only once. Your previous codes no longer work."
              : "Your current recovery codes will stop working."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 p-6">
          {codes ? (
            <RecoveryCodesPanel codes={codes} onDone={onClose} />
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <CodeField
                id="regen-code"
                label="Confirm with a code"
                value={code}
                onChange={setCode}
                hint="From your authenticator app, or an unused recovery code."
              />
              <ErrorLine message={error} />
              <DialogFooter>
                <Button
                  type="submit"
                  disabled={busy || code.trim().length < 6}
                  className="rounded-[9px]"
                >
                  {busy && <LoaderCircle className="animate-spin" />}
                  Generate
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
      .catch(
        () =>
          active &&
          setError("The QR code could not be drawn. Use the setup key."),
      );
    return () => {
      active = false;
    };
  }, [setup]);

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
      toast.success(
        "Authenticator replaced.",
        "Only the new app works from now on.",
      );
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
            {step === "verify" && "Replace your authenticator"}
            {step === "scan" && "Scan with the new app"}
            {step === "codes" && "Your new recovery codes"}
          </DialogTitle>
          <DialogDescription>
            {step === "verify" &&
              "Prove it's you with your current app. Lost the phone? Use a recovery code."}
            {step === "scan" &&
              "Your current app keeps working until you confirm the new one."}
            {step === "codes" &&
              "Shown only once. Your previous codes no longer work."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 p-6">
          {step === "verify" && (
            <form onSubmit={verify} className="space-y-4">
              <CodeField
                id="replace-proof"
                label="Current code or recovery code"
                value={proof}
                onChange={setProof}
                hint="6 digits from your current app, or XXXXX-XXXXX."
              />
              <ErrorLine message={error} />
              <DialogFooter>
                <Button
                  type="submit"
                  disabled={busy || proof.trim().length < 6}
                  className="rounded-[9px]"
                >
                  {busy && <LoaderCircle className="animate-spin" />}
                  Continue
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
                    alt="QR code for the new authenticator"
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
                label="Code from the new app"
                value={newCode}
                onChange={setNewCode}
                hint="The 6 digits now shown in the app you just set up."
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
                  <KeyRound /> Confirm new app
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
