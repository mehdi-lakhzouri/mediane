import type { AdminInvitationStatus } from "../../../../lib/api/admin-invitations";
import { defineMessages } from "../../../../lib/i18n/messages";

const s = (n: number) => (n === 1 ? "" : "s");
const fs = (n: number) => (n > 1 ? "s" : "");

export const invitationsMessages = defineMessages({
  en: {
    title: "Invitations",
    subtitle:
      "Track account activation, replace expired links and control pending access.",
    refresh: "Refresh",
    create: "New invitation",
    columns: {
      selectAll: "Select all invitations on this page",
      select: (email: string) => `Select invitation for ${email}`,
      recipient: "Recipient",
      role: "Role",
      status: "Status",
      invitedBy: "Invited by",
      issued: "Issued",
      expiry: "Expiry",
      actions: "Actions",
    },
    system: "System",
    expiry: {
      accepted: "Accepted",
      revoked: "Revoked",
      replaced: "Replaced",
      expired: "Link expired",
      hours: (hours: number) => `${hours}h remaining`,
      days: (days: number) => `${days}d remaining`,
    },
    row: {
      actionsFor: (email: string) => `Actions for ${email}`,
      view: "View details",
      resend: "Resend invitation",
      revoke: "Revoke invitation",
    },
    search: "Search recipient name or email...",
    searchLabel: "Search invitations",
    filters: {
      status: "Filter by invitation status",
      allStatuses: "All statuses",
      role: "Filter by recipient role",
      allRoles: "All roles",
      drivers: "Drivers",
      admins: "Admins",
    },
    bulk: {
      selected: (_count: number) => "selected",
      resend: (count: number) => `Resend (${count})`,
      revoke: (count: number) => `Revoke (${count})`,
      resent: (n: number) => `${n} invitation${s(n)} issued again.`,
      revoked: (n: number) => `${n} invitation${s(n)} revoked.`,
      partial: (ok: number, total: number) =>
        `${ok} of ${total} invitations updated.`,
      someFailed: "Some actions failed.",
      resendTitle: (n: number) => `Send ${n} new invitations?`,
      revokeTitle: (n: number) => `Revoke ${n} invitations?`,
      resendDescription:
        "Each recipient gets a new link and temporary password. Every older credential stops working.",
      revokeDescription: "The selected active links stop working immediately.",
      resendAction: "Send invitations",
      revokeAction: "Revoke",
    },
    single: {
      resent: "New invitation issued.",
      resentDetail:
        "Email delivery was requested and the previous credentials are no longer valid.",
      revoked: "Invitation revoked.",
      revokedDetail: "The recipient can no longer use that link.",
      failed: "The invitation could not be updated.",
      retry: "Please try again.",
      resendTitle: (name: string) => `Send a new invitation to ${name}?`,
      revokeTitle: (name: string) => `Revoke ${name}'s invitation?`,
      resendDescription:
        "This creates a new single-use link and temporary password. Credentials from every previous invitation stop working.",
      revokeDescription:
        "The current invitation link stops working immediately. You can send a fresh invitation later while the account is still awaiting activation.",
      resendAction: "Send new invitation",
      revokeAction: "Revoke",
    },
    created: (email: string) => `Invitation created for ${email}.`,
    createdDetail:
      "Email delivery was requested. The account stays pending until the recipient accepts.",
    loadFailed: "Could not load invitations. Please try again.",
    noMatch: "No invitation matches these filters",
    none: "No invitations yet",
    emptyHint:
      "Create an invitation to start onboarding a driver or administrator.",
    errorHint: "Check that the API is reachable, then refresh the workspace.",
    sheet: {
      title: "Invitation details",
      subtitle:
        "Review the recipient, invitation lifecycle and available actions.",
      accountDeleted: "Account deleted",
      issued: "Issued",
      expired: "Expired",
      expires: "Expires",
      invitedBy: "Invited by",
      systemAdmin: "System administrator",
      lifecycle: "Lifecycle",
      timeline: "Invitation timeline",
      issuedTitle: "Invitation issued",
      createdBy: (name: string) => `Created by ${name}`,
      secureTitle: "Secure single-use invitation",
      secureBody:
        "The invitation token and temporary password are never exposed in the dashboard. Resending rotates both credentials.",
      copied: "Invitation ID copied.",
      copyFailed: "Could not copy the invitation ID.",
      email: "Email recipient",
      resend: "Resend invitation",
      activated: "Account activated",
      revoke: "Revoke active invitation",
      current: "Current",
      historical: "Historical",
      state: {
        PENDING: "Awaiting acceptance",
        ACCEPTED: "Invitation accepted",
        EXPIRED: "Invitation expired",
        REVOKED: "Invitation revoked",
        SUPERSEDED: "Replaced by a newer invitation",
      } satisfies Record<AdminInvitationStatus, string>,
      stateDetail: {
        PENDING: "The single-use link remains valid until its expiry time.",
        ACCEPTED: "The email address was verified and the account activated.",
        EXPIRED: "The link can no longer be used. Send a new invitation.",
        REVOKED: "An administrator disabled this invitation link.",
        SUPERSEDED:
          "A newer link and temporary password replaced this attempt.",
      } satisfies Record<AdminInvitationStatus, string>,
    },
  },
  fr: {
    title: "Invitations",
    subtitle:
      "Suivez l’activation des comptes, remplacez les liens expirés et contrôlez les accès en attente.",
    refresh: "Actualiser",
    create: "Nouvelle invitation",
    columns: {
      selectAll: "Sélectionner toutes les invitations de cette page",
      select: (email: string) => `Sélectionner l’invitation de ${email}`,
      recipient: "Destinataire",
      role: "Rôle",
      status: "Statut",
      invitedBy: "Invité par",
      issued: "Envoyée le",
      expiry: "Expiration",
      actions: "Actions",
    },
    system: "Système",
    expiry: {
      accepted: "Acceptée",
      revoked: "Révoquée",
      replaced: "Remplacée",
      expired: "Lien expiré",
      hours: (hours: number) => `${hours} h restante${fs(hours)}`,
      days: (days: number) => `${days} j restant${fs(days)}`,
    },
    row: {
      actionsFor: (email: string) => `Actions pour ${email}`,
      view: "Voir le détail",
      resend: "Renvoyer l’invitation",
      revoke: "Révoquer l’invitation",
    },
    search: "Rechercher le nom ou l’e-mail du destinataire...",
    searchLabel: "Rechercher des invitations",
    filters: {
      status: "Filtrer par statut d’invitation",
      allStatuses: "Tous les statuts",
      role: "Filtrer par rôle du destinataire",
      allRoles: "Tous les rôles",
      drivers: "Conducteurs",
      admins: "Admins",
    },
    bulk: {
      selected: (count: number) => `sélectionnée${fs(count)}`,
      resend: (count: number) => `Renvoyer (${count})`,
      revoke: (count: number) => `Révoquer (${count})`,
      resent: (n: number) => `${n} invitation${fs(n)} renvoyée${fs(n)}.`,
      revoked: (n: number) => `${n} invitation${fs(n)} révoquée${fs(n)}.`,
      partial: (ok: number, total: number) =>
        `${ok} invitation${fs(ok)} sur ${total} mise${fs(ok)} à jour.`,
      someFailed: "Certaines actions ont échoué.",
      resendTitle: (n: number) => `Envoyer ${n} nouvelles invitations ?`,
      revokeTitle: (n: number) => `Révoquer ${n} invitations ?`,
      resendDescription:
        "Chaque destinataire reçoit un nouveau lien et un nouveau mot de passe temporaire. Les anciens identifiants cessent de fonctionner.",
      revokeDescription:
        "Les liens actifs sélectionnés cessent immédiatement de fonctionner.",
      resendAction: "Envoyer les invitations",
      revokeAction: "Révoquer",
    },
    single: {
      resent: "Nouvelle invitation envoyée.",
      resentDetail:
        "L’envoi de l’e-mail a été demandé et les anciens identifiants ne sont plus valides.",
      revoked: "Invitation révoquée.",
      revokedDetail: "Le destinataire ne peut plus utiliser ce lien.",
      failed: "L’invitation n’a pas pu être mise à jour.",
      retry: "Veuillez réessayer.",
      resendTitle: (name: string) =>
        `Envoyer une nouvelle invitation à ${name} ?`,
      revokeTitle: (name: string) => `Révoquer l’invitation de ${name} ?`,
      resendDescription:
        "Un nouveau lien à usage unique et un nouveau mot de passe temporaire sont créés. Les identifiants de toutes les invitations précédentes cessent de fonctionner.",
      revokeDescription:
        "Le lien d’invitation actuel cesse immédiatement de fonctionner. Vous pourrez envoyer une nouvelle invitation tant que le compte attend son activation.",
      resendAction: "Envoyer une nouvelle invitation",
      revokeAction: "Révoquer",
    },
    created: (email: string) => `Invitation créée pour ${email}.`,
    createdDetail:
      "L’envoi de l’e-mail a été demandé. Le compte reste en attente jusqu’à l’acceptation.",
    loadFailed: "Impossible de charger les invitations. Veuillez réessayer.",
    noMatch: "Aucune invitation ne correspond à ces filtres",
    none: "Aucune invitation pour l’instant",
    emptyHint:
      "Créez une invitation pour commencer l’intégration d’un conducteur ou d’un administrateur.",
    errorHint:
      "Vérifiez que l’API est joignable, puis actualisez l’espace de travail.",
    sheet: {
      title: "Détails de l’invitation",
      subtitle:
        "Consultez le destinataire, le cycle de vie de l’invitation et les actions disponibles.",
      accountDeleted: "Compte supprimé",
      issued: "Envoyée le",
      expired: "Expirée le",
      expires: "Expire le",
      invitedBy: "Invité par",
      systemAdmin: "Administrateur système",
      lifecycle: "Cycle de vie",
      timeline: "Chronologie de l’invitation",
      issuedTitle: "Invitation envoyée",
      createdBy: (name: string) => `Créée par ${name}`,
      secureTitle: "Invitation sécurisée à usage unique",
      secureBody:
        "Le jeton d’invitation et le mot de passe temporaire ne sont jamais affichés dans le tableau de bord. Un renvoi renouvelle les deux.",
      copied: "ID de l’invitation copié.",
      copyFailed: "Impossible de copier l’ID de l’invitation.",
      email: "Écrire au destinataire",
      resend: "Renvoyer l’invitation",
      activated: "Compte activé",
      revoke: "Révoquer l’invitation active",
      current: "En cours",
      historical: "Historique",
      state: {
        PENDING: "En attente d’acceptation",
        ACCEPTED: "Invitation acceptée",
        EXPIRED: "Invitation expirée",
        REVOKED: "Invitation révoquée",
        SUPERSEDED: "Remplacée par une invitation plus récente",
      },
      stateDetail: {
        PENDING: "Le lien à usage unique reste valable jusqu’à son expiration.",
        ACCEPTED: "L’adresse e-mail a été vérifiée et le compte activé.",
        EXPIRED:
          "Le lien ne peut plus être utilisé. Envoyez une nouvelle invitation.",
        REVOKED: "Un administrateur a désactivé ce lien d’invitation.",
        SUPERSEDED:
          "Un lien et un mot de passe temporaire plus récents ont remplacé cette tentative.",
      },
    },
  },
});

export type InvitationsMessages = (typeof invitationsMessages)["en"];
