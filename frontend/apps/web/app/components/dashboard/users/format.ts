const DATE_TIME = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
});

const DATE = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" });

export function formatDateTime(value: string | null): string {
  return value ? DATE_TIME.format(new Date(value)) : "Never";
}

export function formatDate(value: string | null): string {
  return value ? DATE.format(new Date(value)) : "—";
}

export function fullName(user: {
  firstName: string;
  lastName: string;
}): string {
  return `${user.firstName} ${user.lastName}`.trim();
}

export function initials(user: {
  firstName: string;
  lastName: string;
  email: string;
}): string {
  const letters = `${user.firstName.at(0) ?? ""}${user.lastName.at(0) ?? ""}`;
  return (letters || user.email.slice(0, 2)).toUpperCase();
}
