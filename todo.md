# spielzeug3 AG – Supplier Compliance Portal TODO

## Phase 2: Datenbankschema & Migration
- [x] Erweitertes Datenbankschema definieren (suppliers, products, documents, compliance records, etc.)
- [x] Drizzle-Migration generieren und ausführen

## Phase 3: Backend API (tRPC Router)
- [x] Auth-Router (me, logout, role-based procedures)
- [x] Supplier-Router (CRUD, Produkte pro Lieferant)
- [x] Products-Router (Liste, Detail, Status-Updates, Compliance-Score)
- [x] Documents-Router (Upload via S3, Versionierung, Metadaten)
- [x] ProductSafety-Router (Sicherheitsdaten erfassen und bearbeiten)
- [x] Compliance-Workflow-Router (submit, approve, reject, request-clarification)
- [x] Comments-Router (Kommentare und Timeline)
- [x] MissingRequirements-Router (fehlende Anforderungen verwalten)
- [x] Admin-Router (Benutzerverwaltung, Systemkonfiguration)
- [x] Kontor-Sync-Router (Import/Export API)
- [x] AuditLog-Router (Protokollierung aller Aktionen)
- [x] Notifications-Router (Benachrichtigungen)

## Phase 4: Frontend – Design-System & Grundstruktur
- [x] Design-System: Farben, Typografie, CSS-Variablen (Swiss Enterprise Look)
- [x] i18n-System (DE/EN) mit Sprachumschaltung
- [x] DashboardLayout mit rollenbasierter Navigation (ComplianceLayout)
- [x] Auth-Flow: Login-Seite, Sprachauswahl
- [x] Routing-Struktur für alle 4 Rollen

## Phase 5: Supplier-Bereich
- [x] Supplier Dashboard (offene Items, eingereichte Items, Status-Übersicht)
- [x] Produktliste (eigene Produkte mit Status und fehlenden Anforderungen)
- [x] Produktdetail-Seite (Anforderungen, Dokumente, Sicherheitsdaten, Timeline)
- [x] Dokument-Upload (S3, Dokumenttyp, Metadaten)
- [x] Produktsicherheits-Formular (Sicherheitstext, Warnhinweise, Altersangabe, Material)
- [x] Submit-Workflow (Entwurf speichern, zur Prüfung einreichen)
- [x] Kommentarfunktion für Supplier

## Phase 6: Interner Bereich & Compliance Manager
- [x] Internes Dashboard (fehlende Dokumente nach Lieferant/Marke, Review-Queue)
- [x] Globale Artikelliste mit Filtern (Lieferant, Marke, Status, Anforderungstyp)
- [x] Review-Queue (eingereichte Artikel zur Prüfung)
- [x] Produktdetail für interne Mitarbeiter (Bearbeiten, Hochladen, Kommentieren)
- [x] Compliance Manager Dashboard (Vollständigkeitsrate, Genehmigungsqueue, Sync-Status)
- [x] Approve/Reject/Request Clarification Workflow
- [x] Lieferanten-Detailseite

## Phase 7: Admin-Bereich
- [x] Benutzerverwaltung (Erstellen, Bearbeiten, Rollen zuweisen, Deaktivieren)
- [x] Lieferantenverwaltung (CRUD)
- [x] Anforderungstypen-Verwaltung (Required Document Types konfigurieren)
- [x] Sync-Logs anzeigen
- [x] Audit-Logs anzeigen

## Phase 8: Audit, Kommentare, Benachrichtigungen & Kontor-Sync
- [x] Audit-Log für alle Entitäten und Aktionen
- [x] Activity Timeline auf Produktdetailseiten
- [x] Interne und externe Kommentare (Sichtbarkeitssteuerung)
- [x] Benachrichtigungssystem (offene Items, Submissions, Approvals, Rejections)
- [x] Kontor ERP Import (Suppliers, Products, Orders, Missing Flags)
- [x] Kontor ERP Export (Approved Data, Completeness Status)

## Phase 9: Demo-Daten & Tests
- [x] Demo-Daten für alle Rollen (Lieferanten, Produkte, Anforderungstypen)
- [x] Vitest-Tests für kritische Backend-Prozeduren (10 Tests, alle grün)
- [x] Checkpoint und Ablieferung

## Bugfixes
- [x] Einstellungen-Seite (/admin/settings) fehlt → 404
- [x] Genehmigungen-Seite (/approvals) für Compliance Manager mit Approve/Reject/Clarification-Workflow
- [x] Lieferanten-Detailseite (/suppliers/:id) mit Kontaktdaten, Compliance-Score, Produktliste und Statusverteilung
- [x] KI-Plausibilitätsprüfung: OpenAI-Key in Einstellungen hinterlegen
- [x] KI-Analyse-Router: GPT-4o analysiert Dokumente und gibt Score zurück
- [x] Produktliste: Checkbox-Selektion und KI-Analyse-Button mit Fortschrittsanzeige
- [x] AI-Score-Visualisierung: Score-Karte mit Kategorie-Aufschlüsselung und Begründung
- [x] PDF-Export des KI-Analyseberichts im KI-Analyse-Tab

## Hochprio-Features (Runde 2)
- [x] Feature 1: Ablaufdaten-Tracking für Dokumente/Zertifikate (DB, Backend, Dashboard-Widget, Dokumentenliste)
- [x] Feature 2: Lieferanten-Einladungssystem mit Magic-Link-Onboarding (DB, Backend, Admin-UI, Registrierungsseite)
- [x] Feature 3: Produktvorlagen/Anforderungs-Templates nach Produktkategorie (DB, Backend, Admin-Konfiguration, Produkt-Anlegen-Flow)
- [x] Bugfix: aiAnalysis.getLatest und safety.getByProduct geben undefined statt null zurück

## Komponenten-Feature
- [x] DB: product_components und component_documents Tabellen
- [x] Backend: components-Router (CRUD, Dokument-Upload, Vollständigkeit)
- [x] Frontend: Komponenten-Tab in Produktdetailseite
- [x] KI-Analyse: Komponenten-Dokumente einbeziehen
