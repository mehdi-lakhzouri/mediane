"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import {
  LoaderCircle,
  MousePointerClick,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@repo/ui/components/ui/alert-dialog";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import { useMessages } from "../../../lib/i18n/locale-provider";
import { defineMessages } from "../../../lib/i18n/messages";
import { HoldToConfirmAction } from "./hold-to-confirm-action";

const messages = defineMessages({
  en: {
    type: "Type",
    placeholder: (text: string) => `Type ${text} to confirm`,
    cancel: "Cancel",
    confirmationRequired: "Confirmation required",
    exactMatchHint: "Enter the value exactly as shown before continuing.",
    holdHint:
      "Press and hold until the red bar is full. Release early to cancel.",
    holdTo: (action: string) => `Hold to ${lowerFirst(action)}`,
    running: (action: string) => `${action}…`,
  },
  fr: {
    type: "Saisissez",
    placeholder: (text: string) => `Saisissez ${text} pour confirmer`,
    cancel: "Annuler",
    confirmationRequired: "Confirmation requise",
    exactMatchHint:
      "Saisissez exactement la valeur affichée avant de continuer.",
    holdHint:
      "Maintenez jusqu’à ce que la barre rouge soit pleine. Relâchez pour annuler.",
    holdTo: (action: string) => `Maintenez pour ${lowerFirst(action)}`,
    running: (action: string) => `${action}…`,
  },
});

function lowerFirst(text: string) {
  return text.length > 0
    ? `${text[0]!.toLocaleLowerCase()}${text.slice(1)}`
    : text;
}

export interface ConfirmRequest {
  title: string;
  description: string;
  actionLabel: string;
  destructive?: boolean;
  /** When set, the action stays disabled until this exact text is typed. */
  confirmText?: string;
  run: () => Promise<unknown>;
}

export function ConfirmDialog({
  request,
  onClose,
}: {
  request: ConfirmRequest | null;
  onClose: () => void;
}) {
  const t = useMessages(messages);
  const [typed, setTyped] = useState("");
  const [running, setRunning] = useState(false);

  useEffect(() => {
    setTyped("");
    setRunning(false);
  }, [request]);

  const open = request !== null;
  const ready = !request?.confirmText || typed.trim() === request.confirmText;
  const destructive = request?.destructive === true;

  async function handleConfirm() {
    if (!request || running || !ready) return;
    setRunning(true);
    try {
      await request.run();
    } finally {
      setRunning(false);
      onClose();
    }
  }

  const confirmField = request?.confirmText ? (
    <div className="cg-form-reveal flex flex-col gap-2 rounded-xl border border-destructive/15 bg-destructive/[0.035] p-4">
      <Label htmlFor="confirm-text">
        {t.type}{" "}
        <span className="font-mono font-semibold">{request.confirmText}</span>
      </Label>
      <div className="relative">
        <Trash2
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3.5 z-10 size-[17px] -translate-y-1/2 text-danger"
          strokeWidth={1.8}
        />
        <Input
          id="confirm-text"
          value={typed}
          autoComplete="off"
          spellCheck={false}
          placeholder={t.placeholder(request.confirmText)}
          disabled={running}
          aria-describedby="confirm-text-hint"
          className="border-destructive/20 bg-card pl-10 focus-visible:border-destructive/50 focus-visible:ring-destructive/15"
          onChange={(event) => setTyped(event.target.value)}
        />
      </div>
      <p id="confirm-text-hint" className="text-[12px] text-muted-foreground">
        {t.exactMatchHint}
      </p>
    </div>
  ) : null;

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !running) onClose();
      }}
    >
      <AlertDialogContent
        className={
          destructive ? "max-w-[32rem] overflow-hidden p-0" : undefined
        }
      >
        {destructive ? (
          <div className="border-b border-destructive/15 bg-gradient-to-br from-destructive/10 via-card to-card px-6 py-5">
            <div className="flex items-start gap-4">
              <div className="grid size-20 shrink-0 place-items-center rounded-2xl border border-destructive/15 bg-card shadow-sm">
                <Image
                  src="/delete-confirmation.png"
                  width={72}
                  height={72}
                  sizes="72px"
                  alt=""
                  aria-hidden="true"
                  className="size-[72px] object-contain"
                />
              </div>
              <AlertDialogHeader className="min-w-0 gap-1.5 text-left">
                <p className="flex items-center gap-1.5 text-[10px] font-bold tracking-[0.14em] text-destructive uppercase">
                  <ShieldAlert aria-hidden="true" className="size-3.5" />
                  {t.confirmationRequired}
                </p>
                <AlertDialogTitle className="text-xl">
                  {request?.title}
                </AlertDialogTitle>
                <AlertDialogDescription className="leading-5">
                  {request?.description}
                </AlertDialogDescription>
              </AlertDialogHeader>
            </div>
          </div>
        ) : (
          <AlertDialogHeader>
            <AlertDialogTitle>{request?.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {request?.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
        )}

        {destructive ? (
          <div className="grid gap-4 px-6 py-5">
            {confirmField}
            <div className="flex items-start gap-3 rounded-xl border border-dashed border-destructive/25 bg-destructive/[0.035] p-3 text-[12px] leading-5 text-muted-foreground">
              <MousePointerClick
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0 text-destructive"
              />
              <p>{t.holdHint}</p>
            </div>
          </div>
        ) : (
          confirmField
        )}

        <AlertDialogFooter
          className={
            destructive
              ? "border-t border-border bg-muted/30 px-6 py-4 sm:items-center sm:justify-between"
              : undefined
          }
        >
          <AlertDialogCancel disabled={running}>{t.cancel}</AlertDialogCancel>
          {request?.destructive ? (
            <HoldToConfirmAction
              label={t.holdTo(request.actionLabel)}
              runningLabel={t.running(request.actionLabel)}
              disabled={!ready}
              running={running}
              onConfirm={() => void handleConfirm()}
            />
          ) : (
            <AlertDialogAction
              disabled={!ready || running}
              onClick={(event) => {
                // Keep the dialog up while the request is in flight.
                event.preventDefault();
                void handleConfirm();
              }}
            >
              {running && <LoaderCircle className="animate-spin" />}
              {request?.actionLabel}
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
