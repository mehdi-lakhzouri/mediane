"use client";

import { useCallback, useMemo } from "react";
import { ApiError, type ApiErrorDetail } from "../api/client";
import { useMessages } from "./locale-provider";
import { defineMessages } from "./messages";

/**
 * The API answers in English with a stable `code`; the console shows its own
 * translation of that code, and only falls back to the server's text for a
 * code it does not know yet.
 */
const messages = defineMessages({
  en: {
    codes: {
      NETWORK_ERROR:
        "Unable to reach the server. Check your connection and try again.",
      HTTP_ERROR: "Unexpected response from the server.",
      BAD_REQUEST: "The request is invalid.",
      UNAUTHENTICATED: "Authentication is required.",
      METHOD_NOT_ALLOWED: "Method not allowed.",
      CONFLICT: "The request conflicts with the current state.",
      PAYLOAD_TOO_LARGE: "The request payload is too large.",
      UNSUPPORTED_MEDIA_TYPE: "Unsupported media type.",
      RATE_LIMITED: "Too many attempts. Wait a moment and try again.",
      SERVICE_UNAVAILABLE: "The service is temporarily unavailable.",
      INTERNAL_ERROR: "An unexpected error occurred.",
      REQUEST_ERROR: "The request could not be processed.",
      NOT_FOUND: "The requested resource was not found.",
      NOT_IMPLEMENTED: "This feature is not available yet.",
      VALIDATION_FAILED: "The request contains invalid data.",
      INVALID_EMAIL: "The email address is invalid.",
      CANNOT_ACT_ON_SELF: "You cannot do this to your own account.",
      USER_NOT_SOFT_DELETED:
        "Delete the account first. Permanent deletion only applies to an already deleted account.",
      USER_ALREADY_IN_STATE: "The account is already in this state.",
      CONFIRMATION_MISMATCH: "The email you typed does not match this account.",
      AUTHENTICATION_REQUIRED: "Authentication is required.",
      SESSION_INVALID: "Your session is no longer valid.",
      INVALID_CREDENTIALS: "Invalid email or password.",
      TEMPORARY_PASSWORD_EXPIRED:
        "Your temporary password has expired. Ask an administrator for a new invitation.",
      INVALID_CURRENT_PASSWORD: "The current password is incorrect.",
      PASSWORD_UNCHANGED:
        "The new password must be different from the current one.",
      PASSWORD_RESET_TOKEN_INVALID:
        "This password reset link is invalid or has expired.",
      FORBIDDEN: "You are not allowed to perform this action.",
      PASSWORD_CHANGE_REQUIRED:
        "Complete the required account steps before accessing this resource.",
      MFA_SETUP_REQUIRED:
        "Complete the required account steps before accessing this resource.",
      PROFILE_SETUP_REQUIRED:
        "Complete the required account steps before accessing this resource.",
      ACCOUNT_STATE_FORBIDDEN:
        "Complete the required account steps before accessing this resource.",
      DEVICE_NOT_FOUND: "This device does not exist.",
      DEVICE_SERIAL_TAKEN:
        "A device with this serial number is already registered.",
      DEVICE_REVOKED: "This device has been revoked.",
      DRIVER_ALREADY_PAIRED:
        "This driver already has a device. Unpair it first.",
      DEVICE_PAIRING_INVALID:
        "Devices can only be paired with an existing, non-suspended driver.",
      DEVICE_NOT_PAIRED: "This device is not paired with a driver.",
      FAMILY_NOT_FOUND: "This family does not exist.",
      NOT_IN_FAMILY: "You are not part of a family.",
      FAMILY_OWNER_ONLY: "Only the family owner can do this.",
      FAMILY_FULL: "This family has reached its member limit.",
      FAMILY_INVITE_INVALID:
        "This family code is not valid. Ask the family owner for a new one.",
      JOIN_REQUEST_ALREADY_PENDING:
        "You already have a request waiting. Cancel it before asking another family.",
      JOIN_REQUEST_NOT_FOUND: "This request no longer exists.",
      JOIN_REQUEST_CLOSED: "This request was already handled or has expired.",
      FAMILY_MEMBER_NOT_FOUND: "This person is not in the family.",
      CANNOT_REMOVE_YOURSELF: 'Use "leave the family" to remove yourself.',
      NOT_A_DRIVER: "Only driver accounts can be family members.",
      INVITATION_INVALID: "This invitation is invalid or has expired.",
      INVITATION_NOT_FOUND: "Invitation not found.",
      MFA_CODE_INVALID: "The verification code is not valid.",
      MFA_CODE_REQUIRED:
        "Enter a code from your authenticator app (or a recovery code) to confirm.",
      MFA_CHALLENGE_INVALID: "This sign-in attempt has expired. Sign in again.",
      MFA_NOT_ENABLED: "Two-step verification is not enabled.",
      MFA_SETUP_NOT_STARTED:
        "Start the authenticator setup again: it was not started or has expired.",
      MFA_REQUIRED:
        "Two-step verification is mandatory for this account and cannot be turned off.",
      NOTIFICATION_NOT_FOUND: "This notification does not exist.",
      INVALID_IMAGE: "The image could not be used as a profile photo.",
      PROFILE_INVALID: "Some profile information is invalid.",
      MEDICAL_EVENT_NOT_FOUND: "This event does not exist.",
      INCIDENT_NOT_FOUND: "This incident does not exist.",
      NO_ACTIVE_INCIDENT: "There is no active incident to answer.",
      WEAK_PASSWORD: "The password does not meet the policy.",
      CSRF_VALIDATION_FAILED: "The request could not be verified.",
      SESSION_NOT_FOUND: "This device is not signed in.",
      SESSION_IS_CURRENT: "Use sign out to end the session on this device.",
      FILE_NOT_FOUND: "The requested file was not found.",
      USER_NOT_FOUND: "User not found.",
      EMAIL_ALREADY_IN_USE: "An account already uses this email.",
    },
    details: {
      minLength: (min: string) => `must be at least ${min} characters`,
      maxLength: (max: string) => `must be at most ${max} characters`,
      noEmail: "must not contain the email address",
      differ: "must differ from the current password",
      incorrect: "is incorrect",
    },
    fallback: "Something went wrong. Please try again.",
  },
  fr: {
    codes: {
      NETWORK_ERROR:
        "Impossible de joindre le serveur. Vérifiez votre connexion et réessayez.",
      HTTP_ERROR: "Réponse inattendue du serveur.",
      BAD_REQUEST: "La requête est invalide.",
      UNAUTHENTICATED: "Une authentification est requise.",
      METHOD_NOT_ALLOWED: "Méthode non autorisée.",
      CONFLICT: "La requête est en conflit avec l’état actuel.",
      PAYLOAD_TOO_LARGE: "Le contenu envoyé est trop volumineux.",
      UNSUPPORTED_MEDIA_TYPE: "Type de contenu non pris en charge.",
      RATE_LIMITED: "Trop de tentatives. Patientez un instant puis réessayez.",
      SERVICE_UNAVAILABLE: "Le service est momentanément indisponible.",
      INTERNAL_ERROR: "Une erreur inattendue s’est produite.",
      REQUEST_ERROR: "La requête n’a pas pu être traitée.",
      NOT_FOUND: "La ressource demandée est introuvable.",
      NOT_IMPLEMENTED: "Cette fonctionnalité n’est pas encore disponible.",
      VALIDATION_FAILED: "La requête contient des données invalides.",
      INVALID_EMAIL: "L’adresse e-mail est invalide.",
      CANNOT_ACT_ON_SELF:
        "Vous ne pouvez pas faire cela sur votre propre compte.",
      USER_NOT_SOFT_DELETED:
        "Supprimez d’abord le compte. La suppression définitive ne s’applique qu’à un compte déjà supprimé.",
      USER_ALREADY_IN_STATE: "Le compte est déjà dans cet état.",
      CONFIRMATION_MISMATCH:
        "L’adresse e-mail saisie ne correspond pas à ce compte.",
      AUTHENTICATION_REQUIRED: "Une authentification est requise.",
      SESSION_INVALID: "Votre session n’est plus valide.",
      INVALID_CREDENTIALS: "Adresse e-mail ou mot de passe incorrect.",
      TEMPORARY_PASSWORD_EXPIRED:
        "Votre mot de passe temporaire a expiré. Demandez une nouvelle invitation à un administrateur.",
      INVALID_CURRENT_PASSWORD: "Le mot de passe actuel est incorrect.",
      PASSWORD_UNCHANGED:
        "Le nouveau mot de passe doit être différent de l’actuel.",
      PASSWORD_RESET_TOKEN_INVALID:
        "Ce lien de réinitialisation est invalide ou a expiré.",
      FORBIDDEN: "Vous n’êtes pas autorisé à effectuer cette action.",
      PASSWORD_CHANGE_REQUIRED:
        "Terminez les étapes requises de votre compte avant d’accéder à cette ressource.",
      MFA_SETUP_REQUIRED:
        "Terminez les étapes requises de votre compte avant d’accéder à cette ressource.",
      PROFILE_SETUP_REQUIRED:
        "Terminez les étapes requises de votre compte avant d’accéder à cette ressource.",
      ACCOUNT_STATE_FORBIDDEN:
        "Terminez les étapes requises de votre compte avant d’accéder à cette ressource.",
      DEVICE_NOT_FOUND: "Cet appareil n’existe pas.",
      DEVICE_SERIAL_TAKEN:
        "Un appareil avec ce numéro de série est déjà enregistré.",
      DEVICE_REVOKED: "Cet appareil a été révoqué.",
      DRIVER_ALREADY_PAIRED:
        "Ce conducteur a déjà un appareil. Dissociez-le d’abord.",
      DEVICE_PAIRING_INVALID:
        "Un appareil ne peut être associé qu’à un conducteur existant et non suspendu.",
      DEVICE_NOT_PAIRED: "Cet appareil n’est associé à aucun conducteur.",
      FAMILY_NOT_FOUND: "Cette famille n’existe pas.",
      NOT_IN_FAMILY: "Vous ne faites partie d’aucune famille.",
      FAMILY_OWNER_ONLY: "Seul le propriétaire de la famille peut faire cela.",
      FAMILY_FULL: "Cette famille a atteint sa limite de membres.",
      FAMILY_INVITE_INVALID:
        "Ce code famille n’est pas valide. Demandez-en un nouveau au propriétaire de la famille.",
      JOIN_REQUEST_ALREADY_PENDING:
        "Vous avez déjà une demande en attente. Annulez-la avant d’en envoyer une autre.",
      JOIN_REQUEST_NOT_FOUND: "Cette demande n’existe plus.",
      JOIN_REQUEST_CLOSED: "Cette demande a déjà été traitée ou a expiré.",
      FAMILY_MEMBER_NOT_FOUND:
        "Cette personne ne fait pas partie de la famille.",
      CANNOT_REMOVE_YOURSELF:
        "Utilisez « Quitter la famille » pour vous retirer vous-même.",
      NOT_A_DRIVER:
        "Seuls les comptes conducteur peuvent être membres d’une famille.",
      INVITATION_INVALID: "Cette invitation est invalide ou a expiré.",
      INVITATION_NOT_FOUND: "Invitation introuvable.",
      MFA_CODE_INVALID: "Le code de vérification n’est pas valide.",
      MFA_CODE_REQUIRED:
        "Saisissez un code de votre application d’authentification (ou un code de récupération) pour confirmer.",
      MFA_CHALLENGE_INVALID:
        "Cette tentative de connexion a expiré. Connectez-vous à nouveau.",
      MFA_NOT_ENABLED: "La vérification en deux étapes n’est pas activée.",
      MFA_SETUP_NOT_STARTED:
        "Recommencez la configuration de l’authentificateur : elle n’a pas été lancée ou a expiré.",
      MFA_REQUIRED:
        "La vérification en deux étapes est obligatoire pour ce compte et ne peut pas être désactivée.",
      NOTIFICATION_NOT_FOUND: "Cette notification n’existe pas.",
      INVALID_IMAGE: "Cette image ne peut pas servir de photo de profil.",
      PROFILE_INVALID: "Certaines informations du profil sont invalides.",
      MEDICAL_EVENT_NOT_FOUND: "Cet événement n’existe pas.",
      INCIDENT_NOT_FOUND: "Cet incident n’existe pas.",
      NO_ACTIVE_INCIDENT: "Aucun incident actif auquel répondre.",
      WEAK_PASSWORD:
        "Le mot de passe ne respecte pas la politique de sécurité.",
      CSRF_VALIDATION_FAILED: "La requête n’a pas pu être vérifiée.",
      SESSION_NOT_FOUND: "Cet appareil n’est pas connecté.",
      SESSION_IS_CURRENT:
        "Utilisez « Se déconnecter » pour fermer la session sur cet appareil.",
      FILE_NOT_FOUND: "Le fichier demandé est introuvable.",
      USER_NOT_FOUND: "Utilisateur introuvable.",
      EMAIL_ALREADY_IN_USE: "Un compte utilise déjà cette adresse e-mail.",
    },
    details: {
      minLength: (min: string) => `doit contenir au moins ${min} caractères`,
      maxLength: (max: string) => `doit contenir au plus ${max} caractères`,
      noEmail: "ne doit pas contenir l’adresse e-mail",
      differ: "doit être différent du mot de passe actuel",
      incorrect: "est incorrect",
    },
    fallback: "Une erreur s’est produite. Veuillez réessayer.",
  },
});

type DetailMessages = (typeof messages)["en"]["details"];

/** Field-level policy messages the API sends in English ("must be at least 12 characters"). */
function translateDetail(message: string, t: DetailMessages): string {
  const min = /^must be at least (\d+) characters$/.exec(message);
  if (min?.[1]) return t.minLength(min[1]);
  const max = /^must be at most (\d+) characters$/.exec(message);
  if (max?.[1]) return t.maxLength(max[1]);
  if (message === "must not contain the email address") return t.noEmail;
  if (message === "must differ from the current password") return t.differ;
  if (message === "is incorrect") return t.incorrect;
  return message;
}

export interface ErrorText {
  /** Localized message for an API error code; `fallback` for anything else. */
  message: (error: unknown, fallback?: string) => string;
  /** Localized field detail ("must be at least 12 characters"), if any. */
  detail: (error: unknown) => string | null;
}

export function useErrorText(): ErrorText {
  const t = useMessages(messages);

  const message = useCallback(
    (error: unknown, fallback?: string) => {
      if (!(error instanceof ApiError)) return fallback ?? t.fallback;
      const codes: Record<string, string | undefined> = t.codes;
      return codes[error.code] ?? (error.message || fallback || t.fallback);
    },
    [t],
  );

  const detail = useCallback(
    (error: unknown) => {
      const first: ApiErrorDetail | undefined =
        error instanceof ApiError ? error.details[0] : undefined;
      return first ? translateDetail(first.message, t.details) : null;
    },
    [t],
  );

  // Stable identity: callers list it in hook dependencies.
  return useMemo(() => ({ message, detail }), [message, detail]);
}
