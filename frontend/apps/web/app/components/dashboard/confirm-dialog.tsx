"use client";

import { useEffect, useState } from "react";
import { LoaderCircle, Trash2 } from "lucide-react";
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
  const [typed, setTyped] = useState("");
  const [running, setRunning] = useState(false);

  useEffect(() => {
    setTyped("");
    setRunning(false);
  }, [request]);

  const open = request !== null;
  const ready = !request?.confirmText || typed.trim() === request.confirmText;

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

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !running) onClose();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{request?.title}</AlertDialogTitle>
          <AlertDialogDescription>
            {request?.description}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {request?.confirmText && (
          <div className="cg-form-reveal flex flex-col gap-2">
            <Label htmlFor="confirm-text">
              Type <span className="font-mono">{request.confirmText}</span>
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
                placeholder={`Type ${request.confirmText} to confirm`}
                disabled={running}
                className="pl-10"
                onChange={(event) => setTyped(event.target.value)}
              />
            </div>
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={running}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant={request?.destructive ? "destructive" : "default"}
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
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
