// Email identity ignores surrounding whitespace and letter casing.
export function normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
}