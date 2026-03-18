// ─── i18n System for DE/EN ────────────────────────────────────────────────────

export type Language = "de" | "en";

export const translations = {
  de: {
    // Navigation
    nav: {
      dashboard: "Dashboard",
      products: "Produkte",
      reviewQueue: "Prüfwarteschlange",
      suppliers: "Lieferanten",
      users: "Benutzer",
      auditLog: "Audit-Log",
      syncLogs: "Sync-Protokoll",
      settings: "Einstellungen",
      requirements: "Anforderungstypen",
      apiConfig: "API-Konfiguration",
      notifications: "Benachrichtigungen",
      sync: "Kontor-Sync",
    },
    // Auth
    auth: {
      login: "Anmelden",
      logout: "Abmelden",
      loginTitle: "Anmelden beim Compliance-Portal",
      loginSubtitle: "spielzeug3 AG – Supplier Compliance Portal",
      loginButton: "Mit Manus anmelden",
    },
    // Status labels
    status: {
      open: "Offen",
      in_progress: "In Bearbeitung",
      submitted: "Eingereicht",
      under_review: "In Prüfung",
      clarification_needed: "Rückfrage",
      approved: "Genehmigt",
      rejected: "Abgelehnt",
      completed: "Vollständig",
    },
    // Document types
    docType: {
      test_report: "Prüfbericht",
      declaration_of_conformity: "Konformitätserklärung",
      manual: "Bedienungsanleitung",
      certificate: "Zertifikat",
      product_image: "Produktbild",
      safety_image: "Sicherheitsbild",
      regulatory_document: "Regulatorisches Dokument",
      other: "Sonstiges",
    },
    // Requirement types
    reqType: {
      test_report: "Prüfbericht",
      declaration_of_conformity: "Konformitätserklärung",
      manual: "Bedienungsanleitung",
      certificate: "Zertifikat",
      product_image: "Produktbild",
      safety_image: "Sicherheitsbild",
      regulatory_document: "Regulatorisches Dokument",
      safety_text: "Sicherheitstext",
      warning_text: "Warnhinweis",
      age_grading: "Altersangabe",
      material_information: "Materialangaben",
      usage_restrictions: "Verwendungseinschränkungen",
      safety_instructions: "Sicherheitshinweise",
      additional_notes: "Zusätzliche Hinweise",
    },
    // Roles
    role: {
      supplier: "Lieferant",
      internal_employee: "Interner Mitarbeiter",
      compliance_manager: "Compliance Manager",
      administrator: "Administrator",
    },
    // Actions
    action: {
      submit: "Zur Prüfung einreichen",
      approve: "Genehmigen",
      reject: "Ablehnen",
      requestClarification: "Rückfrage stellen",
      markComplete: "Als vollständig markieren",
      upload: "Hochladen",
      save: "Speichern",
      cancel: "Abbrechen",
      edit: "Bearbeiten",
      delete: "Löschen",
      view: "Ansehen",
      create: "Erstellen",
      filter: "Filtern",
      search: "Suchen",
      export: "Exportieren",
      import: "Importieren",
      sync: "Synchronisieren",
      addComment: "Kommentar hinzufügen",
      saveDraft: "Entwurf speichern",
    },
    // Dashboard
    dashboard: {
      openItems: "Offene Elemente",
      submittedItems: "Eingereichte Elemente",
      clarificationItems: "Rückfragen",
      completedItems: "Abgeschlossene Elemente",
      awaitingReview: "Warten auf Prüfung",
      totalProducts: "Produkte gesamt",
      totalSuppliers: "Lieferanten gesamt",
      activeSuppliers: "Aktive Lieferanten",
      completenessRate: "Vollständigkeitsrate",
      recentActivity: "Letzte Aktivitäten",
      approvalQueue: "Genehmigungswarteschlange",
      syncStatus: "Sync-Status",
      rejectedItems: "Abgelehnte Elemente",
    },
    // Product detail
    product: {
      internalArticleNumber: "Interne Artikelnummer",
      supplierArticleNumber: "Lieferanten-Artikelnummer",
      orderNumber: "Bestellnummer",
      productName: "Produktname",
      ean: "EAN",
      brand: "Marke",
      supplier: "Lieferant",
      status: "Status",
      completenessScore: "Vollständigkeitsgrad",
      missingRequirements: "Fehlende Anforderungen",
      documents: "Dokumente",
      safetyData: "Sicherheitsdaten",
      timeline: "Verlauf",
      comments: "Kommentare",
      lastUpdated: "Zuletzt aktualisiert",
      assignedTo: "Zugewiesen an",
    },
    // Safety form
    safety: {
      safetyText: "Sicherheitstext",
      warningText: "Warnhinweis",
      ageGrading: "Altersangabe",
      materialInformation: "Materialangaben",
      usageRestrictions: "Verwendungseinschränkungen",
      safetyNotes: "Sicherheitshinweise",
    },
    // Messages
    msg: {
      noProducts: "Keine Produkte gefunden",
      noDocuments: "Keine Dokumente vorhanden",
      noComments: "Noch keine Kommentare",
      noNotifications: "Keine Benachrichtigungen",
      uploadSuccess: "Dokument erfolgreich hochgeladen",
      submitSuccess: "Produkt erfolgreich eingereicht",
      approveSuccess: "Produkt genehmigt",
      rejectSuccess: "Produkt abgelehnt",
      clarificationSent: "Rückfrage gesendet",
      saveSuccess: "Erfolgreich gespeichert",
      deleteConfirm: "Möchten Sie diesen Eintrag wirklich löschen?",
      internalOnly: "Nur intern sichtbar",
      loading: "Wird geladen...",
      error: "Ein Fehler ist aufgetreten",
    },
    // Compliance review
    review: {
      note: "Anmerkung",
      notePlaceholder: "Geben Sie eine Anmerkung ein...",
      approveTitle: "Produkt genehmigen",
      rejectTitle: "Produkt ablehnen",
      clarificationTitle: "Rückfrage stellen",
      rejectReason: "Ablehnungsgrund (erforderlich)",
      clarificationQuestion: "Rückfragefrage (erforderlich)",
    },
    // Sync
    sync: {
      importFromKontor: "Von Kontor importieren",
      exportToKontor: "Zu Kontor exportieren",
      lastSync: "Letzter Sync",
      syncSuccess: "Sync erfolgreich",
      syncError: "Sync-Fehler",
      direction: {
        import: "Import",
        export: "Export",
      },
    },
    // Common
    common: {
      yes: "Ja",
      no: "Nein",
      all: "Alle",
      none: "Keine",
      active: "Aktiv",
      inactive: "Inaktiv",
      required: "Pflichtfeld",
      optional: "Optional",
      version: "Version",
      date: "Datum",
      uploadedBy: "Hochgeladen von",
      uploadedAt: "Hochgeladen am",
      expiryDate: "Ablaufdatum",
      language: "Sprache",
      german: "Deutsch",
      english: "Englisch",
      back: "Zurück",
      next: "Weiter",
      close: "Schließen",
      confirm: "Bestätigen",
      of: "von",
      items: "Elemente",
    },
  },
  en: {
    nav: {
      dashboard: "Dashboard",
      products: "Products",
      reviewQueue: "Review Queue",
      suppliers: "Suppliers",
      users: "Users",
      auditLog: "Audit Log",
      syncLogs: "Sync Logs",
      settings: "Settings",
      requirements: "Requirement Types",
      apiConfig: "API Configuration",
      notifications: "Notifications",
      sync: "Kontor Sync",
    },
    // Auth
    auth: {
      login: "Sign In",
      logout: "Sign Out",
      loginTitle: "Sign in to Compliance Portal",
      loginSubtitle: "spielzeug3 AG – Supplier Compliance Portal",
      loginButton: "Sign in with Manus",
    },
    status: {
      open: "Open",
      in_progress: "In Progress",
      submitted: "Submitted",
      under_review: "Under Review",
      clarification_needed: "Clarification Needed",
      approved: "Approved",
      rejected: "Rejected",
      completed: "Complete",
    },
    docType: {
      test_report: "Test Report",
      declaration_of_conformity: "Declaration of Conformity",
      manual: "Manual / Instructions",
      certificate: "Certificate",
      product_image: "Product Image",
      safety_image: "Safety Image",
      regulatory_document: "Regulatory Document",
      other: "Other",
    },
    reqType: {
      test_report: "Test Report",
      declaration_of_conformity: "Declaration of Conformity",
      manual: "Manual / Instructions",
      certificate: "Certificate",
      product_image: "Product Image",
      safety_image: "Safety Image",
      regulatory_document: "Regulatory Document",
      safety_text: "Safety Text",
      warning_text: "Warning Text",
      age_grading: "Age Grading",
      material_information: "Material Information",
      usage_restrictions: "Usage Restrictions",
      safety_instructions: "Safety Instructions",
      additional_notes: "Additional Notes",
    },
    role: {
      supplier: "Supplier",
      internal_employee: "Internal Employee",
      compliance_manager: "Compliance Manager",
      administrator: "Administrator",
    },
    action: {
      submit: "Submit for Review",
      approve: "Approve",
      reject: "Reject",
      requestClarification: "Request Clarification",
      markComplete: "Mark as Complete",
      upload: "Upload",
      save: "Save",
      cancel: "Cancel",
      edit: "Edit",
      delete: "Delete",
      view: "View",
      create: "Create",
      filter: "Filter",
      search: "Search",
      export: "Export",
      import: "Import",
      sync: "Synchronize",
      addComment: "Add Comment",
      saveDraft: "Save Draft",
    },
    dashboard: {
      openItems: "Open Items",
      submittedItems: "Submitted Items",
      clarificationItems: "Clarification Needed",
      completedItems: "Completed Items",
      awaitingReview: "Awaiting Review",
      totalProducts: "Total Products",
      totalSuppliers: "Total Suppliers",
      activeSuppliers: "Active Suppliers",
      completenessRate: "Completeness Rate",
      recentActivity: "Recent Activity",
      approvalQueue: "Approval Queue",
      syncStatus: "Sync Status",
      rejectedItems: "Rejected Items",
    },
    product: {
      internalArticleNumber: "Internal Article No.",
      supplierArticleNumber: "Supplier Article No.",
      orderNumber: "Order Number",
      productName: "Product Name",
      ean: "EAN",
      brand: "Brand",
      supplier: "Supplier",
      status: "Status",
      completenessScore: "Completeness Score",
      missingRequirements: "Missing Requirements",
      documents: "Documents",
      safetyData: "Safety Data",
      timeline: "Timeline",
      comments: "Comments",
      lastUpdated: "Last Updated",
      assignedTo: "Assigned To",
    },
    safety: {
      safetyText: "Safety Text",
      warningText: "Warning Text",
      ageGrading: "Age Grading",
      materialInformation: "Material Information",
      usageRestrictions: "Usage Restrictions",
      safetyNotes: "Safety Notes",
    },
    msg: {
      noProducts: "No products found",
      noDocuments: "No documents available",
      noComments: "No comments yet",
      noNotifications: "No notifications",
      uploadSuccess: "Document uploaded successfully",
      submitSuccess: "Product submitted successfully",
      approveSuccess: "Product approved",
      rejectSuccess: "Product rejected",
      clarificationSent: "Clarification request sent",
      saveSuccess: "Saved successfully",
      deleteConfirm: "Are you sure you want to delete this entry?",
      internalOnly: "Internal only",
      loading: "Loading...",
      error: "An error occurred",
    },
    review: {
      note: "Note",
      notePlaceholder: "Enter a note...",
      approveTitle: "Approve Product",
      rejectTitle: "Reject Product",
      clarificationTitle: "Request Clarification",
      rejectReason: "Rejection reason (required)",
      clarificationQuestion: "Clarification question (required)",
    },
    sync: {
      importFromKontor: "Import from Kontor",
      exportToKontor: "Export to Kontor",
      lastSync: "Last Sync",
      syncSuccess: "Sync successful",
      syncError: "Sync error",
      direction: {
        import: "Import",
        export: "Export",
      },
    },
    common: {
      yes: "Yes",
      no: "No",
      all: "All",
      none: "None",
      active: "Active",
      inactive: "Inactive",
      required: "Required",
      optional: "Optional",
      version: "Version",
      date: "Date",
      uploadedBy: "Uploaded by",
      uploadedAt: "Uploaded at",
      expiryDate: "Expiry Date",
      language: "Language",
      german: "German",
      english: "English",
      back: "Back",
      next: "Next",
      close: "Close",
      confirm: "Confirm",
      of: "of",
      items: "items",
    },
  },
} as const;

export type TranslationKeys = typeof translations.de;

// ─── Language Context ─────────────────────────────────────────────────────────
import { createContext, useContext, useState, ReactNode } from "react";

const LanguageContext = createContext<{
  lang: Language;
  setLang: (l: Language) => void;
  t: TranslationKeys;
}>({
  lang: "de",
  setLang: () => {},
  t: translations.de as TranslationKeys,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(() => {
    return (localStorage.getItem("lang") as Language) ?? "de";
  });

  const setLang = (l: Language) => {
    setLangState(l);
    localStorage.setItem("lang", l);
  };

  const t = translations[lang] as TranslationKeys;

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLang() {
  return useContext(LanguageContext);
}
