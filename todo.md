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

## Qualitätssicherung
- [x] Testfall: DB-Funktionen dürfen niemals undefined zurückgeben (null-safety regression test)
- [x] Neues Produkt anlegen: Kategorie- und Vorlagen-Auswahl im Dialog mit automatischer Anforderungs-Zuweisung

## BunnyDoc-Integration (Digitale Signaturen)
- [x] DB: signature_requests Tabelle (envelopeId, productId, status, signerEmail, signingLink, completedAt)
- [x] DB: settings-Tabelle: BUNNYDOC_API_KEY und BUNNYDOC_TEMPLATE_ID speichern
- [x] Backend: BunnyDoc-API-Wrapper (createSignatureRequest, getEnvelopeStatus)
- [x] Backend: bunnydoc tRPC-Router (sendForSignature, listSignatureRequests, getStatus)
- [x] Backend: Webhook-Endpoint POST /api/webhooks/bunnydoc (signatureRequestCompleted → Status-Update)
- [x] Frontend: Einstellungen-Tab "Digitale Signaturen" (API-Key + Template-ID konfigurieren)
- [x] Frontend: "Zur Unterschrift senden"-Button in Produktdetailseite (Compliance Manager / Admin)
- [x] Frontend: Signatur-Status-Badge und Signatur-Historie in Produktdetailseite
- [x] Frontend: Signatur-Tab in Produktdetailseite mit allen Signaturanfragen

## Signatur-Status-Badge im Produkt-Header
- [x] tRPC-Query bunnydoc.getLatestByProduct hinzufügen (neueste Signaturanfrage für ein Produkt)
- [x] Signatur-Status-Badge im Produkt-Header anzeigen (klickbar → springt zum Signaturen-Tab)

## Swiss Product Seal Platform – Multi-Tenant-Transformation

### DB-Migration
- [x] tenants-Tabelle anlegen (id, slug, name, plan, modules_enabled, logo_url, primary_color)
- [x] products: publicUuid (UUID, unique) und qrCodeUrl hinzufügen
- [x] users: tenantId-Spalte hinzufügen (nullable, DEFAULT 1)
- [x] suppliers: tenantId-Spalte hinzufügen (DEFAULT 1)
- [x] Spielzeug 3 AG als Tenant 1 eintragen

### Backend
- [x] super_admin zu complianceRole enum in schema.ts ergänzen
- [x] tenantProcedure-Guard in server/_core/trpc.ts (in tenant router)
- [x] tenant tRPC-Router (getCurrent, getBySlug, list, create, update, activateSeal, getSealInfo, getPublicProduct)
- [x] getSealStatus-Hilfsfunktion (approved → verified, in_progress, not_verified)
- [x] QR-Code-Generierung bei Produkterstellung (qrcode npm, S3-Upload)
- [x] publicProcedure: tenant.getPublicProduct (nach publicUuid, nur sichere Felder)
- [x] DB-Funktionen: getTenantById, getTenantBySlug, createTenant, listTenants, ensureProductPublicUuid

### Frontend – Öffentliche Produktlandingpage
- [x] Route /p/:uuid in App.tsx (public, kein Login)
- [x] PublicProductPage.tsx mit Siegel-Badge, Importeur-Info, Status-Erklärung
- [x] SealBadge.tsx Komponente (verified/in_progress/not_verified mit Siegel-Design + SealStatusPill)

### Frontend – Portal-Erweiterungen
- [ ] useModules-Hook (hasSeal, hasAdvanced aus tenant.getCurrent) – geplant
- [x] QR-Code-Download in Produktdetail (PNG + SVG) im Siegel-Tab
- [x] Siegel-Status-Spalte in Produktliste
- [x] Super-Admin-Dashboard (/super-admin) mit Tenant-Liste und Metriken

## Super-Admin-Dashboard
- [x] SuperAdminDashboard.tsx: Tenant-Liste mit Metriken (Produkte, Lieferanten, Nutzer)
- [x] Tenant-Anlegen-Dialog (Slug, Name, Plan, Module, Kontakt-E-Mail, Primärfarbe, Tarif)
- [x] Tenant-Bearbeiten-Dialog (Plan, Module, Status aktiv/inaktiv)
- [x] Plan-Badge und Modul-Chips pro Tenant
- [x] Navigation: super_admin-Eintrag in ComplianceLayout-Sidebar (Crown-Icon)
- [x] Route /super-admin in App.tsx mit super_admin-Guard
- [x] Vitest-Tests für super_admin-Guard und tenant.create/update (in tenant.test.ts)

## Product Compliance Transparency & Verification System

### DB-Schema-Erweiterungen
- [x] products: publicVisible (boolean, default true), sealStatusOverride (enum: null/verified/in_progress/not_verified), batchInfo (text, JSON), importerName (varchar)
- [ ] system_settings: SEAL_VERIFIED_THRESHOLD (Schwellenwert für Auto-Verified), SEAL_REQUIRE_APPROVED (boolean)

### Backend
- [ ] tenant.getPublicProduct: Safety-Daten, Sicherheitstext, Altersangabe einbeziehen
- [ ] tenant.getPublicProduct: publicVisible prüfen (wenn false → 404)
- [ ] tenant.getSealInfo: sealStatusOverride zurückgeben
- [ ] tenant.setPublicVisible: Sichtbarkeits-Toggle (admin/compliance_manager)
- [ ] tenant.setSealStatusOverride: Status-Override (admin only)
- [x] getSealStatus: sealStatusOverride berücksichtigen (Override hat Vorrang)
- [x] WooCommerce-API: GET /api/v1/products/:uuid (Status, Landing-Page-URL, QR-URL)
- [x] WooCommerce-API: GET /api/v1/products/by-ean/:ean (Suche per EAN)

### Frontend – Öffentliche Produktlandingpage
- [x] Sprach-Umschalter DE/EN auf PublicProductPage (localStorage-Persistenz)
- [x] Sicherheitsinfo-Sektion (safetyText, warningText, ageGrading, materialInformation)
- [x] Batch-/Rückverfolgbarkeits-Sektion (batchInfo, optional)
- [x] Kontakt/Support-Sektion (Importeur-Kontakt)
- [x] Öffentliche Erklärungsseite /about-seal (Was bedeutet dieses Siegel?)
- [x] Link zur Erklärungsseite auf jeder Produktlandingpage

### Frontend – Admin-Erweiterungen (Produktliste & Produktdetail)
- [x] Siegel-Status-Spalte in Produktliste (Icon + Status-Pill)
- [x] "Landingpage anzeigen"-Button in Produktdetail-Header (ExternalLink im Siegel-Tab)
- [x] Sichtbarkeits-Toggle (öffentlich/privat) im Siegel-Tab
- [x] Status-Override-Dropdown im Siegel-Tab (admin only)
- [x] QR-Code-Download-Buttons (PNG + SVG) im Siegel-Tab

## Batch-Informationen in Produktdetailseite
- [x] DB: batchInfo JSON-Spalte in products genutzt (batchNumber, productionDate, expiryDate)
- [x] Backend: updateBatchInfo-Mutation und getBatchInfo-Query im products-Router
- [x] Frontend: BatchTab in Produktdetailseite (Chargennummer, Produktionsdatum, Ablaufdatum, Importeur-Name)
- [x] Frontend: Öffentliche Produktlandingpage zeigt strukturierte Batch-Daten mit Ablaufdatum-Warnung

## Auto-Siegel-Aktivierung bei Genehmigung
- [x] Backend: activateSeal in approve-Mutation integrieren (products-Router oder workflow-Router)
- [x] Backend: System-Setting SEAL_AUTO_ACTIVATE (boolean, default true) in AdminSettings
- [x] Frontend: Siegel-Tab in AdminSettings: Toggle "Siegel bei Genehmigung automatisch aktivieren"
- [x] Vitest-Test: approve löst activateSeal aus wenn SEAL_AUTO_ACTIVATE = true (in products.test.ts)

## Siegel-Vorschau in Einstellungen
- [x] SealPreview-Komponente: Live-Vorschau des Siegels mit Status-Umschalter (verified/in_progress/not_verified)
- [x] QR-Label-Format: Schild + QR-Platzhalter + "Imported by"-Zeilen in Vorschau
- [x] Siegel-Vorschau in AdminSettings Siegel-Tab integrieren

## Siegel-Etikett PDF-Export
- [x] Server-Endpoint GET /api/reports/seal-label?status=verified&tenantId=1 generiert druckfertiges PDF
- [x] PDF enthält Schild, Status-Banner, QR-Code-Platzhalter und Imported-by-Sektion (A6-Format)
- [x] Download-Button in SealPreview mit aktuellem Status
- [x] Vitest-Test für PDF-Export-Endpoint (6 Tests, alle grün)

## QR-Code im Siegel-Etikett PDF
- [x] Endpoint /api/reports/seal-label: optionaler productId-Parameter, QR-Code-PNG aus S3 laden
- [x] sealLabelPdf.ts: echtes QR-Code-PNG einbetten statt Platzhalter
- [x] SealPreview: Download-Button übergibt productId wenn vorhanden (aus Einstellungen)
- [x] Produktdetailseite Siegel-Tab: "Etikett drucken"-Button mit echtem QR-Code
- [x] Tests für QR-Code-Einbettung aktualisiert (7 Tests, alle grün)

## Batch-Export Siegel-Etiketten (Produktliste)
- [x] archiver-Paket installiert (ZIP-Generierung serverseitig)
- [x] Server: POST /api/reports/seal-labels-batch – nimmt productIds[], generiert PDFs, liefert ZIP
- [x] Frontend: Checkboxen in Produktliste (Zeile auswählen + "Alle auswählen")
- [x] Frontend: "Etiketten exportieren"-Button neben KI-Analyse-Button (erscheint bei Auswahl)
- [x] Frontend: Download-Logik (Blob → ZIP-Datei)
- [x] Tests für Batch-Export (7 Tests, alle grün)

## Öffentliche QR-Landingpage + Supplier-Bestätigung
- [x] DB: products-Tabelle um supplierConfirmedAt (timestamp) und supplierConfirmedBy (varchar) erweitert
- [x] DB: Migration ausgeführt
- [x] Server: tRPC-Mutation products.supplierConfirm (nur Supplier-Rolle)
- [x] Server: getPublicProduct um Dokumenten-Übersicht (Typ + reviewStatus) und supplierConfirmedAt erweitert
- [x] Frontend Supplier: Vollständigkeitserklärung-Karte mit Checkliste + Bestätigungs-Button im Siegel-Tab
- [x] Frontend Public: Dokumenten-Prüfstatus-Sektion auf Landingpage (Anzahl geprüfte Dokumente, Kategorien)
- [x] Frontend Public: Supplier-Bestätigungs-Badge auf Landingpage
- [x] Frontend Public: Redesign mit Trust-Indikatoren, farbigem Hero-Banner, Vertrauens-Sektion
- [x] Tests für supplierConfirm-Mutation und getPublicProduct-Erweiterung (12 Tests, alle grün)

## Einreichen-Button erst nach Vollständigkeitserklärung
- [x] Frontend: supplierConfirmedAt aus Produkt-Query gelesen
- [x] Frontend: Einreichen-Button ausgegraut + Hinweis-Banner wenn supplierConfirmedAt null
- [x] Frontend: Klick auf gesperrten Button navigiert zum Siegel-Tab mit Toast-Hinweis
- [x] Backend: submit-Mutation wirft PRECONDITION_FAILED wenn Supplier nicht bestätigt hat
- [x] Tests für submit-Blockierung (5 neue Tests, 131 gesamt, alle grün)

## Pflichtdokumenten-Checkliste im Siegel-Tab
- [x] Backend: tRPC-Query products.getMissingRequirements bereits vorhanden, direkt genutzt
- [x] Frontend: Checkliste im Siegel-Tab (grüner Haken = vorhanden, rotes X = fehlend)
- [x] Frontend: Bestätigungs-Button gesperrt (Toast + kein Mutate) wenn Pflichtdoks fehlen
- [x] Frontend: Fortschrittsanzeige "X von Y vollständig" im Checklisten-Header
- [x] Frontend: Hinweis-Link zum Dokumente-Tab wenn Pflichtdoks fehlen
- [x] Tests für Checklisten-Logik (7 neue Tests, 138 gesamt, alle grün)

## Bestätigungs-Reset bei Dokumentänderung
- [x] Backend: upload-Mutation setzt supplierConfirmedAt auf null wenn Supplier bereits bestätigt hatte
- [x] Backend: delete-Mutation setzt supplierConfirmedAt auf null wenn Supplier bereits bestätigt hatte
- [x] Backend: Rückgabe-Flag confirmedAtReset: true damit Frontend Toast anzeigen kann
- [x] Backend: Audit-Log-Eintrag supplier_confirmation_reset mit Grund (document_uploaded / document_deleted)
- [x] Frontend: Amber-Toast "Vollständigkeitserklärung zurückgesetzt" nach Upload wenn reset erfolgte
- [x] Frontend: Siegel-Tab-Daten (getById) nach Dokumentänderung invalidiert
- [x] Tests für Reset-Logik (11 neue Tests, 149 gesamt, alle grün)

## Backend-Refactoring: Domain-Driven Architecture
- [x] Shared: server/shared/errors.ts – AppError, typed factory functions, toTRPCError()
- [x] Shared: server/shared/tenantGuard.ts – assertSupplierOrInternal, requireRole helpers
- [x] Shared: server/shared/validation.ts – Zod-Schemas für gemeinsame Typen
- [x] Domain services: server/domains/products/productService.ts
- [x] Domain services: server/domains/documents/documentService.ts
- [x] Domain services: server/domains/suppliers/supplierService.ts
- [x] Domain services: server/domains/tenants/tenantService.ts
- [x] Domain services: server/domains/compliance/complianceWorkflowService.ts
- [x] Domain services: server/domains/seal/sealService.ts
- [x] Domain services: server/domains/ai/aiAnalysisService.ts
- [x] Domain services: server/domains/invitations/invitationService.ts
- [x] Repositories: server/domains/*/repository.ts (Re-Export-Fassaden pro Domain)
- [x] Router-Schicht dünn gemacht: products.ts auf Service-Schicht umgestellt
- [x] Alle 149 Tests weiterhin grün, 0 TypeScript-Fehler
- [x] ARCHITECTURE.md erstellt (vollständige Architektur-Dokumentation)

## Router-Refactoring: Alle verbleibenden Router dünn machen
- [x] documents.ts → documentService (upload, delete, review, confirmedAt-Reset)
- [x] aiAnalysis.ts → aiAnalysisService (analyze, getLatest, getHistory, settings)
- [x] invitations.ts → invitationService (list, create, accept, revoke)
- [x] suppliers.ts → supplierService (list, getById, create, update)
- [x] admin.ts → adminService (Benutzerverwaltung, Systemkonfiguration)
- [x] safety.ts → safetyService (getByProduct, upsert)
- [x] comments.ts → commentsService (list, create, delete)
- [x] 0 TypeScript-Fehler, alle 149 Tests grün

## Router-Refactoring: tenant.ts und bunnydoc.ts
- [x] tenantService.ts um getSealInfo, getPublicProduct, activateSeal, setPublicVisible, setSealStatusOverride erweitert
- [x] tenant.ts Router dünn gemacht (nur Input-Validierung + Service-Aufrufe)
- [x] bunnydocService.ts erstellt (getSettings, saveSettings, send, cancel, latestByProduct, listByProduct)
- [x] bunnydoc.ts Router dünn gemacht
- [x] UserContext um id-Feld erweitert für Service-Kompatibilität
- [x] 0 TypeScript-Fehler, 149 Tests grün

## Siegel-Redesign und HTML-Embed-Widget
- [x] SealPreview komplett neu gestaltet: sauberes, professionelles Layout ohne Verschiebungen
- [x] Siegel: korrektes Schild-SVG, QR-Code zentriert, Status-Banner korrekt positioniert
- [x] Siegel: Imported-by-Sektion sauber und lesbar
- [x] HTML-Embed-Widget: generierbarer <script>-Tag + <div> Snippet
- [x] HTML-Widget: zeigt Siegel-Badge mit QR-Code, Status und Firmenname
- [x] HTML-Widget: Copy-to-Clipboard-Button im Siegel-Tab
- [x] HTML-Widget: Anleitung für WooCommerce, Shopify und normale Webseiten
- [x] Tenant-Name und URL aus Datenbank in SealPreview eingebunden
- [x] 0 TypeScript-Fehler, 149 Tests grün

## Produktspezifischer HTML-Einbettungscode im Siegel-Tab
- [x] ProductEmbedCode-Komponente mit drei Varianten (Widget, Badge, Minimal)
- [x] Embed-Code zeigt echten QR-Code als <img>-Tag (qrCodeUrl aus S3)
- [x] Embed-Code enthält Link zur öffentlichen Landingpage (/p/:uuid)
- [x] Embed-Code-Sektion im Siegel-Tab der Produktdetailseite (nur wenn Siegel aktiv + QR-Code vorhanden)
- [x] Kopieren-Button mit Toast-Bestätigung
- [x] Anleitungen für WooCommerce, Shopify und Webseiten
- [x] 0 TypeScript-Fehler, 149 Tests grün

## Live-Vorschau im Einbettungscode-Block
- [x] ProductEmbedCode: Live-Vorschau-Sektion unter dem Code-Block
- [x] Vorschau rendert das Widget isoliert (srcdoc-iframe, sandbox=allow-same-origin)
- [x] Vorschau aktualisiert sich beim Wechsel der Variante (key=currentCode erzwingt Re-Render)
- [x] Iframe-Höhe passt sich automatisch dem Inhalt an (onLoad-Handler)
- [x] Ein-/Ausblenden-Toggle mit Pfeil-Indikator
- [x] 0 TypeScript-Fehler, 149 Tests grün

## Dynamisches Widget (API-basiert, Laufzeit-Status)
- [x] Öffentlicher Endpoint GET /api/v1/products/:uuid → JSON (sealStatus, productName, qrCodeUrl, landingPageUrl, importer)
- [x] Öffentlicher Endpoint GET /api/v1/products/by-ean/:ean → JSON (EAN-Suche)
- [x] CORS-Header für Cross-Origin-Zugriff aus Onlineshops (Access-Control-Allow-Origin: *)
- [x] OPTIONS-Preflight-Handler für /api/v1/*
- [x] Cache-Control: public, max-age=60, stale-while-revalidate=300
- [x] Dynamisches JS-Widget-Snippet: lädt Status per fetch(), rendert Widget selbst in den DOM
- [x] Statischer Fallback im <noscript>-Tag
- [x] Neue Variante "Dynamisch (empfohlen)" im Einbettungscode-Block (neben Widget/Badge/Minimal)
- [x] Live-Vorschau zeigt auch die dynamische Variante korrekt (allow-scripts im iframe)
- [x] 11 neue Tests für den öffentlichen Endpoint (publicApiRoutes.test.ts), alle grün
- [x] 0 TypeScript-Fehler, 160 Tests grün

## Siegel-Redesign: Professionelle SVG-Grafiken (konsistent HTML + PDF)
- [x] Drei hochwertige SVG-Siegel-Grafiken erstellt (verified/in_progress/not_verified)
- [x] SVGs als CDN-Assets hochgeladen
- [x] SealPreview-Komponente auf neue SVG-Assets umgestellt (CDN-img statt inline-SVG)
- [x] sealLabelPdf.ts auf neue SVG-Assets umgestellt (sharp SVG→PNG, pixel-identisch mit HTML)
- [x] QR-Code-Platzhalter ohne Logo-Overlay (sauber lesbar)
- [x] Embed-Widget-Code nutzt CDN-SVG-URL
- [x] 160 Tests grün, 0 TypeScript-Fehler

## Siegel-Grafik Upload-System
- [x] Vorschau-Bug behoben (SVG hatte content-type: application/octet-stream → auf PNG umgestellt)
- [x] DB-Tabelle seal_assets (status, url, fileKey, tenantId, uploadedByUserId)
- [x] S3-Upload-Endpoint für Siegel-Grafiken (Admin/Compliance Manager only)
- [x] Upload-UI in Einstellungen → Siegel-Tab: pro Status Grafik hochladen/ersetzen/zurücksetzen
- [x] SealPreview lädt aktuelle Grafik aus DB via trpc.sealAssets.getActive (Fallback auf CDN-PNG)
- [x] PDF-Generator lädt aktuelle Grafik aus DB via getActiveSealUrl (3-stufiger Fallback)
- [x] 160 Tests grün, 0 TypeScript-Fehler

## Siegel-Grafik Upload-Validierung
- [x] Client: Dateityp-Prüfung (PNG/JPG/SVG/WebP)
- [x] Client: Dateigröße max. 5 MB
- [x] Client: Mindestauflösung 300×300 px via Image-Objekt (SVG übersprungen)
- [x] Client: Seitenverhältnis 0.75–1.25 mit verständlicher Fehlermeldung
- [x] Client: Vorschau-Bild erst nach bestandener Validierung anzeigen
- [x] Client: Inline-Fehlermeldung in der Karte (AlertCircle + Titel + Beschreibung)
- [x] Client: Anforderungen-Hinweis-Box in jeder Status-Karte
- [x] Server: sharp-basierte Auflösungsprüfung (≥300×300 px)
- [x] Server: Seitenverhältnis-Prüfung (0.70–1.30, etwas toleranter als Client)
- [x] Server: TRPCError BAD_REQUEST mit präziser Fehlermeldung (Ist-Wert + Soll-Wert)
- [x] 12 neue Tests (sealAssets.validation.test.ts): Auflösung, Verhältnis, SVG-Skip, korrupt
- [x] 172 Tests grün (14 Testdateien), 0 TypeScript-Fehler

## Bugfix: Siegel-Etikett – tenantUrl statt Slug anzeigen
- [x] DB-Schema: websiteUrl-Feld zur tenants-Tabelle hinzugefügt (Default: swiss-product-seal.ch)
- [x] SealPreview.tsx: tenantWebsiteUrl aus DB statt Slug übergeben
- [x] pdfRoutes.ts: tenantUrl aus websiteUrl-Feld (statt contactEmail-Ableitung)
- [x] tenantDb.ts: updateTenant um websiteUrl-Feld erweitert
- [x] 172 Tests grün, 0 TypeScript-Fehler

## Portal-Tab: Website-URL des Mandanten editierbar
- [x] Backend: neue updateMyTenant-Prozedur (admin/compliance_manager) mit websiteUrl, name, contactEmail
- [x] tenantService.updateMyTenant: Mandanten-eigene Einstellungen ohne super_admin-Rechte änderbar
- [x] tenant-Router: updateMyTenant-Endpoint registriert
- [x] Frontend: Eingabefelder für Unternehmensname, Website-URL und Kontakt-E-Mail im Portal-Tab
- [x] Felder werden beim Laden aus DB befüllt (einmalig via portalLoaded-Flag)
- [x] Speichern-Button mit tRPC-Mutation, Loading-State und Toast-Feedback
- [x] Hinweistexte unter jedem Feld erklären wo der Wert erscheint
- [x] 172 Tests grün, 0 TypeScript-Fehler

## Logo-Upload im Portal-Tab
- [x] Backend: uploadLogo-Endpoint (S3, base64, max. 5 MB, PNG/JPG/WebP/SVG)
- [x] Backend: logoUrl in updateMyTenant-Prozedur speicherbar
- [x] UpdateMyTenantInput-Interface um logoUrl erweitert
- [x] Frontend: Logo-Upload-Karte im Portal-Tab (Klick-Zone, Vorschau, Entfernen-Button)
- [x] SealPreview: Logo statt Unternehmensname anzeigen wenn vorhanden (32px H, max 120px B)
- [x] PDF-Generator: Logo vor new Promise() laden (async-safe), im Importer-Block einbetten (80×26 pt)
- [x] pdfRoutes.ts: tenantLogoUrl aus Tenant-Daten an PDF-Generator übergeben
- [x] 172 Tests grün, 0 TypeScript-Fehler

## Logo auf öffentlicher Produkt-Landingpage
- [x] Backend: logoUrl und websiteUrl des Mandanten in getPublicProduct-Antwort einbezogen
- [x] Frontend: Logo im Importeur-Block der PublicProductPage (48px H, max 140px B, object-contain)
- [x] Fallback: farbiger Avatar-Block mit Anfangsbuchstaben wenn kein Logo vorhanden
- [x] websiteUrl statt Slug als Unterzeile angezeigt (https:// wird abgeschnitten)
- [x] 172 Tests grün, 0 TypeScript-Fehler

## Primärfarbe des Siegels anpassbar
- [x] Backend: updateMyTenant-Schema um primaryColor erweitert (Regex-Validierung #RRGGBB)
- [x] tenantService.UpdateMyTenantInput um primaryColor erweitert
- [x] Frontend: Farbwähler-Karte im Portal-Tab (native color input + Hex-Textfeld + Vorschau-Chip)
- [x] Live-Vorschau: Farbänderung wirkt sofort auf SealPreview ohne Speichern
- [x] SealPreview: tenantPrimaryColor-Prop, überschreibt borderColor/accentColor für verified-Status
- [x] PDF-Generator: tenantPrimaryColor-Prop, überschreibt Rahmen- und URL-Farbe für verified-Status
- [x] pdfRoutes.ts: primaryColor aus Tenant-Daten an generateSealLabelPdf übergeben
- [x] 172 Tests grün, 0 TypeScript-Fehler

## Betreiber-Dokument/Safety-Upload mit Audit-Log
- [x] DB-Schema: actorRole + actorName zur audit_logs-Tabelle hinzugefügt (Migration ausgeführt)
- [x] documentService: actorRole/actorName in allen Audit-Log-Einträgen, Betreiber-Rollen freigeschaltet
- [x] safetyService: actorRole/actorName in Audit-Log, Betreiber-Rollen freigeschaltet
- [x] getAuditLogsByProduct-Funktion in db.ts hinzugefügt
- [x] getTimeline-Prozedur liefert jetzt auch auditEntries (Approval-History + Audit-Logs gemergt)
- [x] ProductDetail: UploadDocumentCard für Betreiber-Rollen freigeschaltet + Betreiber-Badge im Dialog
- [x] ProductDetail: SafetyDataCard canEdit auf alle internen Rollen erweitert + Betreiber-Badge
- [x] TimelineCard: Supplier (violett), Betreiber (blau), System (grau) farbkodiert mit Legende
- [x] Akteur-Name und Payload-Details (Dateiname/Dokumenttyp) in jedem Timeline-Eintrag
- [x] Aktions-Labels deutschübersetzt (document_uploaded, safety_upserted, etc.)
- [x] 172 Tests grün, 0 TypeScript-Fehler

## Timeline-Filter
- [x] Filter-Schaltflächen „Alle / Supplier / Betreiber / System–Workflow“ in TimelineCard
- [x] Aktive Filterauswahl per useState<TimelineFilter>, gefilterte visibleEvents-Liste
- [x] Anzahl-Badge pro Filter-Button (zeigt Anzahl passender Einträge)
- [x] Leer-State „Keine Einträge für diesen Filter“ wenn Filter 0 Treffer liefert
- [x] Verbindungs-Linie korrekt auf visibleEvents.length bezogen
- [x] 172 Tests grün, 0 TypeScript-Fehler

## Betreiber-Kommentar beim Dokument-Upload
- [x] Backend: operatorComment (optional, max. 500 Zeichen) im documents.upload-Input-Schema (z.string().max(500).optional())
- [x] Backend: documentService speichert operatorComment im Audit-Log-Payload (JSON) wenn vorhanden
- [x] Frontend: Textarea mit Zeichenzähler im Upload-Dialog (nur für Betreiber-Rollen sichtbar)
- [x] Frontend: Kommentar-State wird beim Schließen des Dialogs zurückgesetzt
- [x] Frontend: Kommentar in der Timeline als blaue Info-Box mit MessageSquare-Icon angezeigt
- [x] 172 Tests grün, 0 TypeScript-Fehler

## Betreiber-Kommentar beim Dokument-Löschen
- [x] Backend: operatorComment (optional, max. 500 Zeichen) im documents.delete-Input-Schema
- [x] Backend: documentService speichert operatorComment im Audit-Log-Payload beim Löschen
- [x] Frontend: Trash2-Icon-Button in Dokumententabelle (für Supplier und Betreiber)
- [x] Frontend: Bestätigungs-Dialog mit Dateiname, Kommentarfeld (nur Betreiber) und Zeichenzähler
- [x] Frontend: Kommentar in der Timeline als blaue Info-Box (gleiche Darstellung wie beim Upload)
- [x] State-Reset beim Schließen des Dialogs
- [x] Vollständigkeitserklärungs-Reset-Toast wenn Supplier-Bestätigung zurückgesetzt wurde
- [x] 172 Tests grün, 0 TypeScript-Fehler

## Dokumenten-Versionierung
- [x] DB-Schema: isArchived (boolean, default false) und replacedByDocumentId (int) in documents-Tabelle
- [x] Migration: ALTER TABLE documents ADD isArchived / replacedByDocumentId
- [x] db.ts: getDocumentsByProduct filtert archivierte Dokumente (includeArchived-Flag)
- [x] db.ts: getDocumentById, getArchivedDocumentVersions, archiveDocument neue Hilfsfunktionen
- [x] documentService.upload: archiviert alle aktiven Vorgänger-Dokumente desselben Typs vor dem Insert
- [x] documentService.listArchivedVersions: gibt archivierte Versionen für Typ zurück
- [x] tRPC Router: documents.listArchivedVersions Endpoint
- [x] Frontend: DocumentRow-Komponente mit aufklappbarem Versionsverlauf (Amber-Badge mit History-Icon)
- [x] Frontend: Archivierte Versionen in separater Tabelle mit Download-Button
- [x] 14 neue Vitest-Tests, 186 Tests gesamt grün, 0 TypeScript-Fehler
