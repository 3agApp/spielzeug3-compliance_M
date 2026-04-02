/**
 * Translates a backend error message (e.message from tRPC) into the active UI language.
 * Accepts either a TranslationKeys object (t) or a language string ("de" | "en").
 * Falls back to the original message if no translation is found.
 *
 * This file is intentionally separate from i18n.tsx so that Vite Fast Refresh
 * can handle the React hooks in i18n.tsx without interference from this utility.
 */
import { translations } from "./i18n.translations";
import type { TranslationKeys } from "./i18n.translations";

export function translateError(rawMessage: string | undefined, tOrLang: TranslationKeys | string): string {
  const t: TranslationKeys = typeof tOrLang === "string"
    ? (translations[tOrLang as keyof typeof translations] ?? translations.de) as TranslationKeys
    : tOrLang;
  if (!rawMessage) return t.errors.unknownError;
  const msg = rawMessage.trim();

  // Auth / permissions
  if (msg.includes("10001") || msg.toLowerCase().includes("please login") || msg.toLowerCase().includes("not authenticated")) return t.errors.pleaseLogin;
  if (msg.includes("10002") || msg.toLowerCase().includes("do not have required permission")) return t.errors.noPermission;
  if (msg.toLowerCase() === "insufficient permissions") return t.errors.insufficientPermissions;
  if (msg.toLowerCase().includes("forbidden")) return t.errors.forbidden;
  if (msg.toLowerCase() === "unauthorized") return t.errors.unauthorized;

  // Database
  if (msg.toLowerCase().includes("db unavailable") || msg.toLowerCase().includes("database unavailable")) return t.errors.dbUnavailable;
  if (msg.includes("Datenbankverbindung nicht verfügbar") || msg.includes("Database connection unavailable")) return (t.errors as any).dbConnectionUnavailable ?? t.errors.dbUnavailable;

  // Notifications
  if (msg === "Notification title is required.") return t.errors.notifTitleRequired;
  if (msg === "Notification content is required.") return t.errors.notifContentRequired;
  if (msg.startsWith("Notification title must be at most")) return t.errors.notifTitleTooLong;
  if (msg.startsWith("Notification content must be at most")) return t.errors.notifContentTooLong;
  if (msg === "Notification service URL is not configured.") return t.errors.notifUrlMissing;
  if (msg === "Notification service API key is not configured.") return t.errors.notifKeyMissing;

  // File validation
  if (msg.toLowerCase().includes("datei zu groß") || msg.toLowerCase().includes("file too large") || msg.toLowerCase().includes("max. 5 mb")) return t.errors.fileTooLarge;
  if (msg.toLowerCase().includes("logo-datei zu groß") || msg.toLowerCase().includes("logo file too large")) return t.errors.logoTooLarge;

  // Not found
  if (msg.toLowerCase().includes("produkt nicht gefunden") || msg.toLowerCase().includes("product not found")) return t.errors.productNotFound;
  if (msg.toLowerCase().includes("dokument nicht gefunden") || msg.toLowerCase().includes("document not found")) return t.errors.documentNotFound;
  if (msg.toLowerCase().includes("lieferant nicht gefunden") || msg.toLowerCase().includes("supplier not found")) return t.errors.supplierNotFound;
  if (msg.toLowerCase().includes("vorlage nicht gefunden") || msg.toLowerCase().includes("template not found")) return t.errors.templateNotFound;
  if (msg.toLowerCase().includes("not found")) return t.errors.notFound;

  // BunnyDoc
  if (msg.includes("Kein BunnyDoc API-Schlüssel") || msg.includes("No BunnyDoc API key")) return t.errors.bunnyDocNoApiKey;
  if (msg.includes("Keine BunnyDoc Template-ID") || msg.includes("No BunnyDoc template ID")) return t.errors.bunnyDocNoTemplateId;
  if (msg.includes("Abgeschlossene Signaturanfragen") || msg.includes("Completed signature requests")) return t.errors.signatureAlreadyCompleted;
  if (msg.startsWith("BunnyDoc Fehler:") || msg.startsWith("BunnyDoc error:")) {
    const detail = msg.replace(/^BunnyDoc (Fehler|error): /, "");
    return t.errors.bunnyDocError.replace("{detail}", detail);
  }

  // Permissions (German originals that may come through)
  if (msg.includes("Nur Administratoren") || msg.includes("Only administrators")) return t.errors.adminOnly;
  if (msg.includes("Nur Lieferanten") || msg.includes("Only suppliers")) return t.errors.supplierOnly;

  // Product submission
  if (msg.includes("Bitte bestätigen Sie zuerst die Vollständigkeit") || msg.includes("Please confirm the completeness")) return (t.errors as any).confirmCompletenessFirst ?? msg;

  // Image errors
  if (msg.includes("Das Bild konnte nicht gelesen werden") || msg.includes("image could not be read")) return (t.errors as any).imageReadError ?? msg;

  // General validation
  if (msg.includes("Ungültige Produkt-ID") || msg.includes("Invalid product ID")) return (t.errors as any).invalidProductId ?? msg;
  if (msg.includes("Keine Berechtigung für Logo-Upload") || msg.includes("No permission for logo upload")) return (t.errors as any).logoUploadNoPermission ?? msg;

  // Timeout / network
  if (msg.toLowerCase().includes("timeout") || msg.toLowerCase().includes("timed out")) return t.errors.timeout;
  if (msg.toLowerCase().includes("network") || msg.toLowerCase().includes("netzwerk")) return t.errors.networkError;

  // Internal server errors
  if (msg.toLowerCase().includes("internal server error") || msg.toLowerCase().includes("internal error")) return t.errors.internalError;

  // Return original message if no match found (already translated or domain-specific)
  return msg;
}
