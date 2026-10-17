import type {
  AuditActorType,
  AuditCategory,
  AuditOutcome,
  AuditTargetType,
} from "../../../lib/api/admin-audit";
import type { AdminInvitationStatus } from "../../../lib/api/admin-invitations";
import type { AccountState } from "../../../lib/api/admin-users";
import type { Role } from "../../../lib/api/auth";
import { defineMessages } from "../../../lib/i18n/messages";

/**
 * Display names for the API's enums, shared by every console screen so a
 * status reads the same in a table, a badge and a detail sheet.
 */
export const labelMessages = defineMessages({
  en: {
    role: { ADMIN: "Admin", DRIVER: "Driver" } satisfies Record<Role, string>,
    accountState: {
      INVITED: "Invited",
      PASSWORD_CHANGE_REQUIRED: "Temporary password",
      MFA_SETUP_REQUIRED: "2-step setup pending",
      PROFILE_SETUP_REQUIRED: "Profile pending",
      ACTIVE: "Active",
      SUSPENDED: "Suspended",
      DELETED: "Deleted",
    } satisfies Record<AccountState, string>,
    invitationStatus: {
      PENDING: "Pending",
      ACCEPTED: "Accepted",
      EXPIRED: "Expired",
      REVOKED: "Revoked",
      SUPERSEDED: "Superseded",
    } satisfies Record<AdminInvitationStatus, string>,
    auditCategory: {
      ACCOUNT: "Account",
      ACCESS: "Access",
      SECURITY: "Security",
      FAMILY: "Family",
      DEVICE: "Device",
      SAFETY: "Safety",
      SYSTEM: "System",
    } satisfies Record<AuditCategory, string>,
    auditOutcome: {
      SUCCESS: "Success",
      FAILURE: "Failure",
    } satisfies Record<AuditOutcome, string>,
    actorType: {
      USER: "User",
      DEVICE: "Vehicle device",
      CLI: "Command line",
      SYSTEM: "System",
    } satisfies Record<AuditActorType, string>,
    targetType: {
      USER: "User",
      INVITATION: "Invitation",
      SESSION: "Session",
      FAMILY: "Family",
      DEVICE: "Device",
      INCIDENT: "Incident",
    } satisfies Record<AuditTargetType, string>,
    auditAction: {
      ADMIN_BOOTSTRAPPED: "Admin bootstrapped",
      USER_CREATED: "User created",
      USER_UPDATED: "User updated",
      USER_SOFT_DELETED: "User deleted",
      USER_RESTORED: "User restored",
      USER_HARD_DELETED: "User permanently deleted",
      USER_SUSPENDED: "User suspended",
      USER_REACTIVATED: "User reactivated",
      INVITATION_SENT: "Invitation sent",
      INVITATION_RESENT: "Invitation resent",
      INVITATION_REVOKED: "Invitation revoked",
      INVITATION_ACCEPTED: "Invitation accepted",
      LOGIN_SUCCEEDED: "Login succeeded",
      LOGIN_FAILED: "Login failed",
      PASSWORD_CHANGED: "Password changed",
      PASSWORD_RESET_REQUESTED: "Password reset requested",
      PASSWORD_RESET_COMPLETED: "Password reset completed",
      SESSION_REVOKED: "Session revoked",
      ALL_SESSIONS_REVOKED: "All sessions revoked",
      REFRESH_TOKEN_REUSE_DETECTED: "Refresh token reuse detected",
      PROFILE_COMPLETED: "Profile completed",
      PROFILE_UPDATED: "Profile updated",
      PROFILE_AVATAR_UPDATED: "Profile photo updated",
      PROFILE_AVATAR_REMOVED: "Profile photo removed",
      MFA_ENABLED: "MFA enabled",
      MFA_AUTHENTICATOR_REPLACED: "MFA authenticator replaced",
      MFA_DISABLED: "MFA disabled",
      MFA_RESET_BY_ADMIN: "MFA reset by admin",
      MFA_RECOVERY_CODES_REGENERATED: "MFA recovery codes regenerated",
      MFA_RECOVERY_CODE_USED: "MFA recovery code used",
      MFA_VERIFICATION_FAILED: "MFA verification failed",
      MFA_CHALLENGE_ISSUED: "MFA challenge issued",
      FAMILY_CREATED: "Family created",
      FAMILY_RENAMED: "Family renamed",
      FAMILY_DISSOLVED: "Family dissolved",
      FAMILY_INVITE_ROTATED: "Family invite code rotated",
      FAMILY_JOIN_REQUESTED: "Family join requested",
      FAMILY_JOIN_APPROVED: "Family join approved",
      FAMILY_JOIN_REJECTED: "Family join rejected",
      FAMILY_JOIN_CANCELLED: "Family join cancelled",
      FAMILY_MEMBER_ADDED: "Family member added",
      FAMILY_MEMBER_REMOVED: "Family member removed",
      FAMILY_MEMBER_LEFT: "Family member left",
      FAMILY_OWNERSHIP_TRANSFERRED: "Family ownership transferred",
      FAMILY_SHARING_UPDATED: "Family sharing updated",
      DEVICE_REGISTERED: "Device registered",
      DEVICE_PAIRED: "Device paired",
      DEVICE_UNPAIRED: "Device unpaired",
      DEVICE_REVOKED: "Device revoked",
      DEVICE_SECRET_ROTATED: "Device secret rotated",
      INCIDENT_OPENED: "Incident opened",
      INCIDENT_ACKNOWLEDGED: "Incident acknowledged",
      INCIDENT_ESCALATED: "Incident escalated",
      INCIDENT_RESOLVED: "Incident resolved",
      SOS_TRIGGERED: "SOS triggered",
      ANNOUNCEMENT_SENT: "Announcement sent",
    },
  },
  fr: {
    role: { ADMIN: "Admin", DRIVER: "Conducteur" },
    accountState: {
      INVITED: "Invité",
      PASSWORD_CHANGE_REQUIRED: "Mot de passe temporaire",
      MFA_SETUP_REQUIRED: "Double authentification à configurer",
      PROFILE_SETUP_REQUIRED: "Profil à compléter",
      ACTIVE: "Actif",
      SUSPENDED: "Suspendu",
      DELETED: "Supprimé",
    },
    invitationStatus: {
      PENDING: "En attente",
      ACCEPTED: "Acceptée",
      EXPIRED: "Expirée",
      REVOKED: "Révoquée",
      SUPERSEDED: "Remplacée",
    },
    auditCategory: {
      ACCOUNT: "Compte",
      ACCESS: "Accès",
      SECURITY: "Sécurité",
      FAMILY: "Famille",
      DEVICE: "Appareil",
      SAFETY: "Sécurité routière",
      SYSTEM: "Système",
    },
    auditOutcome: {
      SUCCESS: "Réussite",
      FAILURE: "Échec",
    },
    actorType: {
      USER: "Utilisateur",
      DEVICE: "Appareil du véhicule",
      CLI: "Ligne de commande",
      SYSTEM: "Système",
    },
    targetType: {
      USER: "Utilisateur",
      INVITATION: "Invitation",
      SESSION: "Session",
      FAMILY: "Famille",
      DEVICE: "Appareil",
      INCIDENT: "Incident",
    },
    auditAction: {
      ADMIN_BOOTSTRAPPED: "Administrateur initial créé",
      USER_CREATED: "Utilisateur créé",
      USER_UPDATED: "Utilisateur modifié",
      USER_SOFT_DELETED: "Utilisateur supprimé",
      USER_RESTORED: "Utilisateur restauré",
      USER_HARD_DELETED: "Utilisateur supprimé définitivement",
      USER_SUSPENDED: "Utilisateur suspendu",
      USER_REACTIVATED: "Utilisateur réactivé",
      INVITATION_SENT: "Invitation envoyée",
      INVITATION_RESENT: "Invitation renvoyée",
      INVITATION_REVOKED: "Invitation révoquée",
      INVITATION_ACCEPTED: "Invitation acceptée",
      LOGIN_SUCCEEDED: "Connexion réussie",
      LOGIN_FAILED: "Échec de connexion",
      PASSWORD_CHANGED: "Mot de passe modifié",
      PASSWORD_RESET_REQUESTED: "Réinitialisation du mot de passe demandée",
      PASSWORD_RESET_COMPLETED: "Mot de passe réinitialisé",
      SESSION_REVOKED: "Session révoquée",
      ALL_SESSIONS_REVOKED: "Toutes les sessions révoquées",
      REFRESH_TOKEN_REUSE_DETECTED: "Réutilisation de jeton détectée",
      PROFILE_COMPLETED: "Profil complété",
      PROFILE_UPDATED: "Profil modifié",
      PROFILE_AVATAR_UPDATED: "Photo de profil modifiée",
      PROFILE_AVATAR_REMOVED: "Photo de profil supprimée",
      MFA_ENABLED: "Double authentification activée",
      MFA_AUTHENTICATOR_REPLACED: "Authentificateur remplacé",
      MFA_DISABLED: "Double authentification désactivée",
      MFA_RESET_BY_ADMIN: "Double authentification réinitialisée par un admin",
      MFA_RECOVERY_CODES_REGENERATED: "Codes de récupération régénérés",
      MFA_RECOVERY_CODE_USED: "Code de récupération utilisé",
      MFA_VERIFICATION_FAILED: "Échec de la vérification en deux étapes",
      MFA_CHALLENGE_ISSUED: "Vérification en deux étapes demandée",
      FAMILY_CREATED: "Famille créée",
      FAMILY_RENAMED: "Famille renommée",
      FAMILY_DISSOLVED: "Famille dissoute",
      FAMILY_INVITE_ROTATED: "Code d’invitation familial renouvelé",
      FAMILY_JOIN_REQUESTED: "Demande d’adhésion à une famille",
      FAMILY_JOIN_APPROVED: "Adhésion à la famille approuvée",
      FAMILY_JOIN_REJECTED: "Adhésion à la famille refusée",
      FAMILY_JOIN_CANCELLED: "Demande d’adhésion annulée",
      FAMILY_MEMBER_ADDED: "Membre ajouté à la famille",
      FAMILY_MEMBER_REMOVED: "Membre retiré de la famille",
      FAMILY_MEMBER_LEFT: "Membre parti de la famille",
      FAMILY_OWNERSHIP_TRANSFERRED: "Propriété de la famille transférée",
      FAMILY_SHARING_UPDATED: "Partage familial modifié",
      DEVICE_REGISTERED: "Appareil enregistré",
      DEVICE_PAIRED: "Appareil associé",
      DEVICE_UNPAIRED: "Appareil dissocié",
      DEVICE_REVOKED: "Appareil révoqué",
      DEVICE_SECRET_ROTATED: "Secret de l’appareil renouvelé",
      INCIDENT_OPENED: "Incident ouvert",
      INCIDENT_ACKNOWLEDGED: "Incident pris en compte",
      INCIDENT_ESCALATED: "Incident escaladé",
      INCIDENT_RESOLVED: "Incident résolu",
      SOS_TRIGGERED: "SOS déclenché",
      ANNOUNCEMENT_SENT: "Annonce envoyée",
    },
  },
});

export type Labels = (typeof labelMessages)["en"];

/**
 * Display name of an audit action code. Unknown codes (a newer API) fall
 * back to a readable version of the code itself.
 */
export function auditActionLabel(labels: Labels, action: string): string {
  const known: Record<string, string | undefined> = labels.auditAction;
  return (
    known[action] ??
    action
      .toLowerCase()
      .split("_")
      .map((word) =>
        word === "mfa" || word === "sos"
          ? word.toUpperCase()
          : word.charAt(0).toUpperCase() + word.slice(1),
      )
      .join(" ")
  );
}
