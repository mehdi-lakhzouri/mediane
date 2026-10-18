import { defineMessages } from "../../../lib/i18n/messages";

export type BulkKind = "suspended" | "reactivated" | "deleted" | "restored";

const s = (n: number) => (n === 1 ? "" : "s");
const fs = (n: number) => (n > 1 ? "s" : "");

export const usersMessages = defineMessages({
  en: {
    title: "Users",
    subtitle: "Invite drivers and administrators, and manage their access.",
    invite: "Invite user",
    columns: {
      selectAll: "Select all rows on this page",
      select: (name: string) => `Select ${name}`,
      user: "User",
      role: "Role",
      state: "State",
      lastLogin: "Last sign-in",
      created: "Created",
      actions: "Actions",
    },
    search: "Search name or email...",
    searchLabel: "Search users",
    filters: {
      role: "Filter by role",
      allRoles: "All roles",
      drivers: "Drivers",
      admins: "Admins",
      status: "Filter by status",
      anyStatus: "Any status",
      invited: "Invited",
      active: "Active",
      suspended: "Suspended",
      deletion: "Deleted accounts",
      activeAccounts: "Active accounts",
      deletedAccounts: "Deleted accounts",
      allAccounts: "All accounts",
    },
    bulk: {
      // Follows the count badge: "3 selected".
      selected: (_count: number) => "selected",
      suspend: "Suspend",
      reactivate: "Reactivate",
      softDelete: "Soft delete",
      restore: "Restore",
      deletePermanently: "Delete permanently",
      mixed: "Select only active or only deleted accounts.",
      clear: "Clear",
      done: {
        suspended: (n: number) => `Suspended ${n} account${s(n)}.`,
        reactivated: (n: number) => `Reactivated ${n} account${s(n)}.`,
        deleted: (n: number) => `Deleted ${n} account${s(n)}.`,
        restored: (n: number) => `Restored ${n} account${s(n)}.`,
      } satisfies Record<BulkKind, (n: number) => string>,
      partial: {
        suspended: (ok: number, total: number) =>
          `Suspended ${ok} of ${total}.`,
        reactivated: (ok: number, total: number) =>
          `Reactivated ${ok} of ${total}.`,
        deleted: (ok: number, total: number) => `Deleted ${ok} of ${total}.`,
        restored: (ok: number, total: number) => `Restored ${ok} of ${total}.`,
      } satisfies Record<BulkKind, (ok: number, total: number) => string>,
      refreshed: "The user list and statistics have been refreshed.",
      someFailed: "Some actions failed.",
      deleteTitle: (n: number) => `Delete ${n} account${s(n)}?`,
      deleteDescription:
        "They lose access immediately and all their sessions end. You can restore them from the Deleted accounts filter.",
    },
    done: {
      default: "The change is now reflected in the user list.",
      failed: "The action could not be completed.",
      retry: "Please try again.",
      resent: "Invitation resent.",
      revoked: "Invitation revoked.",
      suspended: "Account suspended.",
      reactivated: "Account reactivated.",
      restored: "Account restored.",
      hardDeleted: "Account permanently deleted.",
      softDeleted: "Account soft deleted.",
      softDeletedHint:
        "Open the Deleted accounts filter to restore it or delete it permanently.",
      mfaReset: "Two-step verification reset.",
      updated: "User updated.",
      updatedDetail: (name: string) =>
        `${name}’s identity information was saved.`,
      invited: "Invitation sent.",
      invitedDetail: (email: string) =>
        `${email} can now activate the account from the invitation email.`,
    },
    confirm: {
      hardTitle: "Delete permanently?",
      hardTitleNamed: (name: string) => `Permanently delete ${name}?`,
      hardDescription:
        "This permanently erases the profile, sessions, invitations, family links, health events, incidents, and notifications. A paired device is unlinked and the immutable audit trail is kept. Type the email address to confirm.",
      hardDescriptionShort:
        "This permanently erases all user-owned information and cannot be undone. A paired device is unlinked; the immutable audit trail is retained. Type the email address to confirm.",
      hardAction: "Delete permanently",
      deleteTitle: (name: string) => `Delete ${name}?`,
      deleteDescription:
        "They lose access immediately and all their sessions end. You can restore this account afterwards.",
      deleteAction: "Delete",
      softTitle: (name: string) => `Soft delete ${name}?`,
      softDescription:
        "They lose access immediately and all their sessions end. You can restore the account from the Deleted accounts filter, or permanently delete it there.",
      softAction: "Soft delete",
      mfaTitle: "Reset two-step verification?",
      mfaDescription: (name: string) =>
        `Only when ${name} has lost both their phone and their recovery codes. Their authenticator is removed and every session ends; they set up a new one at their next sign-in.`,
      mfaAction: "Reset",
    },
    row: {
      actionsFor: (name: string) => `Actions for ${name}`,
      edit: "View & edit",
      resend: "Resend invitation",
      suspend: "Suspend",
      reactivate: "Reactivate",
      restore: "Restore",
      resetMfa: "Reset 2-step verification",
      softDelete: "Soft delete",
      deletePermanently: "Delete permanently",
    },
    loadFailed: "Could not load users. Please try again.",
    empty: "No users match these filters",
    emptyHint: "Adjust the search or filters, or invite someone new.",
    errorHint: "Check that the API is reachable and try again.",
  },
  fr: {
    title: "Utilisateurs",
    subtitle:
      "Invitez des conducteurs et des administrateurs, et gérez leurs accès.",
    invite: "Inviter un utilisateur",
    columns: {
      selectAll: "Sélectionner toutes les lignes de cette page",
      select: (name: string) => `Sélectionner ${name}`,
      user: "Utilisateur",
      role: "Rôle",
      state: "État",
      lastLogin: "Dernière connexion",
      created: "Créé le",
      actions: "Actions",
    },
    search: "Nom ou e-mail…",
    searchLabel: "Rechercher des utilisateurs",
    filters: {
      role: "Filtrer par rôle",
      allRoles: "Tous les rôles",
      drivers: "Conducteurs",
      admins: "Admins",
      status: "Filtrer par statut",
      anyStatus: "Tous les statuts",
      invited: "Invités",
      active: "Actifs",
      suspended: "Suspendus",
      deletion: "Comptes supprimés",
      activeAccounts: "Comptes actifs",
      deletedAccounts: "Comptes supprimés",
      allAccounts: "Tous les comptes",
    },
    bulk: {
      selected: (count: number) => `sélectionné${fs(count)}`,
      suspend: "Suspendre",
      reactivate: "Réactiver",
      softDelete: "Supprimer",
      restore: "Restaurer",
      deletePermanently: "Supprimer définitivement",
      mixed:
        "Sélectionnez uniquement des comptes actifs ou uniquement des comptes supprimés.",
      clear: "Effacer",
      done: {
        suspended: (n: number) => `${n} compte${fs(n)} suspendu${fs(n)}.`,
        reactivated: (n: number) => `${n} compte${fs(n)} réactivé${fs(n)}.`,
        deleted: (n: number) => `${n} compte${fs(n)} supprimé${fs(n)}.`,
        restored: (n: number) => `${n} compte${fs(n)} restauré${fs(n)}.`,
      },
      partial: {
        suspended: (ok: number, total: number) =>
          `${ok} compte${fs(ok)} suspendu${fs(ok)} sur ${total}.`,
        reactivated: (ok: number, total: number) =>
          `${ok} compte${fs(ok)} réactivé${fs(ok)} sur ${total}.`,
        deleted: (ok: number, total: number) =>
          `${ok} compte${fs(ok)} supprimé${fs(ok)} sur ${total}.`,
        restored: (ok: number, total: number) =>
          `${ok} compte${fs(ok)} restauré${fs(ok)} sur ${total}.`,
      },
      refreshed:
        "La liste des utilisateurs et les statistiques ont été actualisées.",
      someFailed: "Certaines actions ont échoué.",
      deleteTitle: (n: number) => `Supprimer ${n} compte${fs(n)} ?`,
      deleteDescription:
        "Ils perdent immédiatement l’accès et toutes leurs sessions sont fermées. Vous pourrez les restaurer depuis le filtre Comptes supprimés.",
    },
    done: {
      default:
        "La modification apparaît désormais dans la liste des utilisateurs.",
      failed: "L’action n’a pas pu être effectuée.",
      retry: "Veuillez réessayer.",
      resent: "Invitation renvoyée.",
      revoked: "Invitation révoquée.",
      suspended: "Compte suspendu.",
      reactivated: "Compte réactivé.",
      restored: "Compte restauré.",
      hardDeleted: "Compte supprimé définitivement.",
      softDeleted: "Compte supprimé.",
      softDeletedHint:
        "Ouvrez le filtre Comptes supprimés pour le restaurer ou le supprimer définitivement.",
      mfaReset: "Vérification en deux étapes réinitialisée.",
      updated: "Utilisateur mis à jour.",
      updatedDetail: (name: string) =>
        `Les informations d’identité de ${name} ont été enregistrées.`,
      invited: "Invitation envoyée.",
      invitedDetail: (email: string) =>
        `${email} peut maintenant activer le compte depuis l’e-mail d’invitation.`,
    },
    confirm: {
      hardTitle: "Supprimer définitivement ?",
      hardTitleNamed: (name: string) => `Supprimer définitivement ${name} ?`,
      hardDescription:
        "Cette action efface définitivement le profil, les sessions, les invitations, les liens familiaux, les événements de santé, les incidents et les notifications. Un appareil associé est dissocié et le journal d’audit immuable est conservé. Saisissez l’adresse e-mail pour confirmer.",
      hardDescriptionShort:
        "Cette action efface définitivement toutes les informations de l’utilisateur et est irréversible. Un appareil associé est dissocié ; le journal d’audit immuable est conservé. Saisissez l’adresse e-mail pour confirmer.",
      hardAction: "Supprimer définitivement",
      deleteTitle: (name: string) => `Supprimer ${name} ?`,
      deleteDescription:
        "Cette personne perd immédiatement l’accès et toutes ses sessions sont fermées. Vous pourrez restaurer ce compte ensuite.",
      deleteAction: "Supprimer",
      softTitle: (name: string) => `Supprimer ${name} ?`,
      softDescription:
        "Cette personne perd immédiatement l’accès et toutes ses sessions sont fermées. Vous pourrez restaurer le compte depuis le filtre Comptes supprimés, ou l’y supprimer définitivement.",
      softAction: "Supprimer",
      mfaTitle: "Réinitialiser la vérification en deux étapes ?",
      mfaDescription: (name: string) =>
        `Uniquement si ${name} a perdu à la fois son téléphone et ses codes de récupération. Son authentificateur est retiré et toutes ses sessions sont fermées ; un nouveau sera configuré à la prochaine connexion.`,
      mfaAction: "Réinitialiser",
    },
    row: {
      actionsFor: (name: string) => `Actions pour ${name}`,
      edit: "Voir et modifier",
      resend: "Renvoyer l’invitation",
      suspend: "Suspendre",
      reactivate: "Réactiver",
      restore: "Restaurer",
      resetMfa: "Réinitialiser la double authentification",
      softDelete: "Supprimer",
      deletePermanently: "Supprimer définitivement",
    },
    loadFailed: "Impossible de charger les utilisateurs. Veuillez réessayer.",
    empty: "Aucun utilisateur ne correspond à ces filtres",
    emptyHint:
      "Modifiez la recherche ou les filtres, ou invitez une nouvelle personne.",
    errorHint: "Vérifiez que l’API est joignable et réessayez.",
  },
});

export type UsersMessages = (typeof usersMessages)["en"];
