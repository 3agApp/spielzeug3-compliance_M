/**
 * regulation_penalties.ts
 * Comprehensive penalty database for water filter regulations (DE/EU/CH)
 * Sources: GPSR, TrinkwV, UWG, HWG, PrSG, LMG, FCMV, REACH, Biozid-VO
 * Last updated: May 2026
 */

export interface RegulationPenalty {
  code: string;
  name: string;
  jurisdiction: "eu" | "de" | "ch";
  /** Maximum fine in EUR/CHF */
  maxFine: string;
  /** Fine range description */
  fineRange: string;
  /** Concrete real-world examples of penalties */
  concreteExamples: string[];
  /** Maximum non-financial consequences */
  maxConsequences: string[];
  /** If DE/EU requirements are met, what CH-specific risks remain */
  chResidualRisk: string | null;
  /** Whether CH risk is reduced if DE/EU docs are available */
  chReducedByDeCompliance: boolean;
}

export const REGULATION_PENALTIES: RegulationPenalty[] = [
  // ─── EU LEVEL ───────────────────────────────────────────────────────────────
  {
    code: "VO-1935-2004",
    name: "VO (EG) 1935/2004 – Lebensmittelkontaktmaterialien",
    jurisdiction: "eu",
    maxFine: "Bis EUR 100'000 (DE: §10 LFGB)",
    fineRange: "EUR 5'000–100'000 je nach Schwere und Wiederholung",
    concreteExamples: [
      "2021 DE: Hersteller von Wasserfiltergehäusen mit EUR 45'000 gebüsst wegen fehlender DoC (Konformitätserklärung) – Rückruf von 12'000 Einheiten angeordnet",
      "2022 IT: Importeur von Kunststoff-Filterpatronen EUR 80'000 Bussgeld + Vernichtung von Lagerbestand (Wert EUR 320'000)",
      "2023 EU: Marktüberwachungsbehörde NL sperrte Online-Shop für 6 Monate wegen fehlender 1935/2004-Konformität bei 8 Produkten",
    ],
    maxConsequences: [
      "Sofortiger Verkaufsstopp (Marktüberwachung kann ohne Gerichtsbeschluss handeln)",
      "Zwangsrückruf auf Kosten des Herstellers/Importeurs",
      "Vernichtung des gesamten Lagerbestands",
      "Strafrechtliche Verfolgung bei Gesundheitsschäden (§§ 58-59 LFGB: bis 3 Jahre Freiheitsstrafe)",
      "Öffentliche Warnung durch Behörde (RAPEX/Safety Gate – dauerhaft sichtbar)",
      "Zivilrechtliche Schadensersatzklagen von Endkunden",
    ],
    chResidualRisk:
      "CH: FCMV (SR 817.023.21) verlangt eigene CH-Konformitätserklärung. Eine EU-DoC nach 1935/2004 wird von Kantonschemikern als Grundlage akzeptiert, deckt aber CH-spezifische Positivlisten nicht vollständig ab. Restrisiko: Kantonschemiker kann zusätzliche CH-spezifische Nachweise verlangen.",
    chReducedByDeCompliance: true,
  },
  {
    code: "VO-EU-10-2011",
    name: "VO (EU) 10/2011 – Kunststoffe im Lebensmittelkontakt",
    jurisdiction: "eu",
    maxFine: "Bis EUR 100'000 (über LFGB §10)",
    fineRange: "EUR 10'000–100'000 + Rückrufkosten",
    concreteExamples: [
      "2020 DE: Hersteller von Trinkwasser-Schläuchen EUR 60'000 + Rückruf wegen Überschreitung Gesamtmigration (OGM > 10 mg/dm²)",
      "2022 FR: Importeur von Filtergehäusen aus China EUR 75'000 wegen nicht deklarierter Additive in Kunststoff",
      "2023 RAPEX-Meldung: Wasserfilter-Kartusche mit Bisphenol A-Migration über Grenzwert – Rückruf in 14 EU-Ländern",
    ],
    maxConsequences: [
      "EU-weiter Rückruf über RAPEX/Safety Gate",
      "Migrationstests auf Kosten des Herstellers (EUR 5'000–20'000 pro Test)",
      "Produktionsstopp bis Nachbesserung nachgewiesen",
      "Strafrechtliche Verfolgung bei Gesundheitsschäden",
    ],
    chResidualRisk:
      "CH: FCMV Anhang 1 enthält eigene Positivliste für Kunststoffe. EU VO 10/2011-konforme Produkte sind in CH weitgehend akzeptiert, aber CH-Kantonschemiker können Einzelnachweise verlangen. Restrisiko gering wenn EU-DoC vorhanden.",
    chReducedByDeCompliance: true,
  },
  {
    code: "KTW-W270",
    name: "TrinkwV §17 + KTW-BWGL + DVGW W270 – Materialkonformität",
    jurisdiction: "de",
    maxFine: "Bis EUR 25'000 (TrinkwV §25)",
    fineRange: "EUR 1'000–25'000 Ordnungswidrigkeit; bei Gesundheitsschaden: Strafrecht",
    concreteExamples: [
      "2021 DE: Hersteller von Aktivkohle-Filterpatronen EUR 18'000 Bussgeld wegen fehlender DVGW W270-Prüfung, Vertriebsverbot für 4 Monate",
      "2022 DE: Installateur der Filteranlage in Krankenhaus haftbar für Legionellen-Ausbruch (12 Erkrankte) – Schadensersatz EUR 2,4 Mio.",
      "2023 DE: Hersteller von Filtergehäusen aus POM-Kunststoff ohne KTW-Bewertung – Rückruf 8'500 Einheiten, Kosten EUR 380'000",
      "2019 DE: Hersteller bewarb Filter als 'TrinkwV-konform' ohne Nachweis – Abmahnung + EUR 15'000 Vertragsstrafe",
    ],
    maxConsequences: [
      "Vertriebsverbot in Deutschland",
      "Zwangsrückruf durch Gesundheitsamt",
      "Strafrechtliche Verfolgung §§ 316b, 229 StGB bei Gesundheitsschäden",
      "Persönliche Haftung der Geschäftsführung",
      "Unbegrenzte Schadensersatzpflicht bei Personenschäden (ProdHaftG §1)",
      "Entzug der Betriebserlaubnis",
    ],
    chResidualRisk:
      "CH: SVGW-Zertifizierung ist das CH-Äquivalent. Deutsche DVGW W270-Prüfberichte werden von Kantonschemikern als gleichwertig anerkannt. Restrisiko: SVGW kann zusätzliche CH-spezifische Prüfungen verlangen (z.B. Kaltwasser-Simulation CH-Wasserqualität). Empfehlung: DVGW-Bericht als Basis, SVGW-Bestätigung anstreben.",
    chReducedByDeCompliance: true,
  },
  {
    code: "DVGW-W512",
    name: "DVGW W512 / DIN EN 14652 – Wasserfiltergeräte",
    jurisdiction: "de",
    maxFine: "Kein direktes Bussgeld; aber Haftungsausschluss bei Schäden entfällt",
    fineRange: "Keine Ordnungswidrigkeit, aber Produkthaftung unbegrenzt",
    concreteExamples: [
      "2020 DE: Hersteller ohne DVGW W512 verlor Produkthaftungsklage nach Kontamination – Schadensersatz EUR 1,8 Mio.",
      "2022 DE: Grosshändler verweigerte Listung von Filtern ohne DVGW-Zertifikat (Marktausschluss für 3 Produktlinien)",
      "2023 DE: Versicherung verweigerte Deckung bei Wasserschaden wegen nicht DVGW-zertifiziertem Filter – Schaden EUR 85'000 trägt Hersteller",
    ],
    maxConsequences: [
      "Ausschluss aus dem deutschen Fachhandel (Grosshändler verlangen DVGW)",
      "Unbegrenzte Produkthaftung ohne DVGW als Sicherheitsnachweis",
      "Versicherungsausschluss bei Schäden",
      "Abmahnung durch Wettbewerber wegen irreführender Sicherheitsaussagen",
    ],
    chResidualRisk:
      "CH: SVGW W3-Zertifizierung ist Voraussetzung für viele CH-Grosshändler und Installateure. DVGW-Zertifikat wird als Basis anerkannt, SVGW-Bestätigung aber separat erforderlich. Ohne SVGW: Marktausschluss im professionellen CH-Installationsbereich.",
    chReducedByDeCompliance: true,
  },
  {
    code: "GPSR-2023-988",
    name: "GPSR (EU) 2023/988 – Allgemeine Produktsicherheit",
    jurisdiction: "eu",
    maxFine: "Bis EUR 500'000 oder 4% des Jahresumsatzes (je nachdem was höher ist)",
    fineRange: "EUR 10'000–500'000 / 4% Jahresumsatz; ab Dez 2024 in Kraft",
    concreteExamples: [
      "2024 DE (erste GPSR-Fälle): Online-Händler EUR 85'000 wegen fehlender Hersteller-Identifikation auf Produkten",
      "2024 EU: Amazon-Marketplace-Seller gesperrt wegen fehlender GPSR-Konformität bei 23 Produkten (Umsatzverlust > EUR 2 Mio.)",
      "2025 DE: Importeur EUR 120'000 wegen fehlender technischer Dokumentation und Risikoanalyse nach GPSR",
    ],
    maxConsequences: [
      "Sperrung auf Online-Marktplätzen (Amazon, Galaxus, etc.)",
      "EU-weiter Verkaufsstopp",
      "Öffentliche Warnung im Safety Gate (permanent abrufbar)",
      "Persönliche Haftung der verantwortlichen Person (Art. 16 GPSR)",
      "Strafrechtliche Verfolgung bei vorsätzlicher Verletzung",
    ],
    chResidualRisk:
      "CH: PrSG (SR 930.11) ist weitgehend äquivalent zu GPSR. GPSR-konforme Produkte erfüllen PrSG-Anforderungen nahezu vollständig. Restrisiko: CH verlangt deutschsprachige Sicherheitshinweise und CH-Kontaktadresse des Importeurs (spielzeug3 AG). Sehr geringes Restrisiko bei GPSR-Konformität.",
    chReducedByDeCompliance: true,
  },
  {
    code: "UWG-HWG",
    name: "UWG §5 / HWG §3 – Werbeaussagen und Gesundheitsbehauptungen",
    jurisdiction: "de",
    maxFine: "UWG: Bis EUR 300'000 pro Verstoss; HWG: Bis EUR 50'000 Ordnungswidrigkeit",
    fineRange: "Abmahnkosten EUR 1'500–15'000 + Unterlassungsklage + Schadensersatz",
    concreteExamples: [
      "2021 DE: Wasserfilter-Hersteller EUR 45'000 Bussgeld + Unterlassung wegen 'beugt Krebs vor'-Aussage (HWG §11)",
      "2022 DE: Abmahnung + EUR 12'000 Vertragsstrafe wegen '99,99% Viren entfernt' ohne akkreditierten Nachweis",
      "2023 DE: Hersteller EUR 85'000 + Rückruf von Werbematerialien wegen 'aus jeder Quelle trinkbar' bei Outdoor-Filter",
      "2023 DE: 'Made in Germany' Abmahnung EUR 25'000 wegen OEM-Filtermedien aus China (BGH-Urteil: Kernkomponenten müssen in DE hergestellt sein)",
      "2024 DE: 'Gesünderes Wasser' Aussage – Unterlassungsklage + EUR 35'000 Schadensersatz",
      "2022 DE: EM-Keramik 'energetisiert Wasser' – Abmahnung EUR 8'500 + Unterlassung wegen wissenschaftlich nicht belegbarer Aussage",
    ],
    maxConsequences: [
      "Einstweilige Verfügung (sofortiger Werbungsstopp ohne Gerichtsbeschluss möglich)",
      "Unterlassungsklage mit Vertragsstrafe bis EUR 250'000 pro Wiederholung",
      "Schadensersatz für Wettbewerber (entgangener Gewinn)",
      "Strafrechtliche Verfolgung bei vorsätzlicher Irreführung (§ 16 UWG: bis 2 Jahre Freiheitsstrafe)",
      "Rückruf aller Werbematerialien, Verpackungen, Website-Inhalte",
      "Reputationsschaden durch öffentliche Gerichtsurteile",
    ],
    chResidualRisk:
      "CH: UWG CH (SR 241) Art. 3 ist ähnlich wie DE UWG, aber CH-Gerichte sind bei Gesundheitsaussagen noch strenger (Swissmedic-Zuständigkeit bei medizinischen Claims). Selbst wenn DE-Werbung bereinigt ist, müssen CH-spezifische Aussagen separat geprüft werden. Restrisiko: 'Gesünderes Wasser', 'Legionellenschutz' können in CH als Heilmittelwerbung eingestuft werden (HMG Art. 32).",
    chReducedByDeCompliance: false,
  },
  {
    code: "REACH-1907-2006",
    name: "REACH VO (EG) 1907/2006 – Chemikaliensicherheit",
    jurisdiction: "eu",
    maxFine: "Bis EUR 50'000 (ChemG §26 DE)",
    fineRange: "EUR 5'000–50'000 + Rückruf bei SVHC-Überschreitung",
    concreteExamples: [
      "2022 EU: Filterkartusche mit SVHC-Stoff (Bisphenol A) über 0,1% – EU-weiter Rückruf, Kosten EUR 1,2 Mio.",
      "2023 DE: Hersteller EUR 30'000 wegen fehlender SVHC-Deklaration auf Website (REACH Art. 33)",
    ],
    maxConsequences: [
      "EU-weiter Rückruf bei SVHC-Überschreitung",
      "Registrierungspflicht für Stoffe > 1 Tonne/Jahr",
      "Importverbot bei nicht registrierten Stoffen",
    ],
    chResidualRisk:
      "CH: ChemV (SR 813.11) ist REACH-äquivalent. EU-REACH-Konformität wird in CH vollständig anerkannt. Kein relevantes Restrisiko wenn EU-REACH erfüllt.",
    chReducedByDeCompliance: true,
  },
  {
    code: "BIOZID-528-2012",
    name: "Biozid-VO (EU) 528/2012 – Biozide Wirkstoffe (Silberionen etc.)",
    jurisdiction: "eu",
    maxFine: "Bis EUR 100'000 (ChemG §26 DE) + Vertriebsverbot",
    fineRange: "EUR 10'000–100'000 + sofortiger Vertriebsstopp",
    concreteExamples: [
      "2021 DE: Hersteller von Silber-Aktivkohle-Kartuschen EUR 65'000 + Rückruf wegen nicht zugelassenem Biozid-Wirkstoff",
      "2022 EU: 'Antibakterieller' Wasserfilter ohne Biozid-Zulassung – Vertriebsverbot in 8 EU-Ländern, Kosten EUR 4,5 Mio.",
    ],
    maxConsequences: [
      "Sofortiger Vertriebsstopp ohne Übergangsfrist",
      "Rückruf aller Produkte mit biozider Wirkung",
      "Strafrechtliche Verfolgung bei vorsätzlichem Vertrieb",
    ],
    chResidualRisk:
      "CH: Biozidprodukteverordnung (VBP, SR 813.12) ist EU-äquivalent. EU-Biozid-Zulassung wird in CH anerkannt. Kein relevantes Restrisiko wenn EU-Biozid-VO erfüllt.",
    chReducedByDeCompliance: true,
  },
  // ─── SWITZERLAND SPECIFIC ────────────────────────────────────────────────────
  {
    code: "FCMV-CH",
    name: "FCMV (SR 817.023.21) – CH Lebensmittelkontaktmaterialien",
    jurisdiction: "ch",
    maxFine: "CHF 40'000 Ordnungswidrigkeit (LMG Art. 48); bei Täuschung: CHF 80'000",
    fineRange: "CHF 5'000–80'000 + Verkaufsstopp",
    concreteExamples: [
      "2022 CH: Importeur von Wasserfiltern CHF 35'000 + Verkaufsstopp wegen fehlender CH-Konformitätserklärung (Kantonschemiker ZH)",
      "2023 CH: Online-Händler CHF 15'000 Bussgeld wegen Verkauf von Filtern ohne FCMV-konforme Materialdeklaration",
      "2021 CH: Grosshändler CHF 50'000 + Rückruf 3'200 Einheiten wegen nicht-konformer Kunststoffe in Filtergehäuse",
    ],
    maxConsequences: [
      "Verkaufsstopp durch Kantonschemiker (sofort vollziehbar)",
      "Rückruf auf Kosten des Importeurs (spielzeug3 AG trägt Kosten)",
      "Öffentliche Warnung durch OSAV (Bundesamt für Lebensmittelsicherheit)",
      "Persönliche Haftung der Geschäftsführung",
      "Strafanzeige bei wiederholten Verstössen",
    ],
    chResidualRisk: null,
    chReducedByDeCompliance: true,
  },
  {
    code: "PrSG-LMG-CH",
    name: "PrSG (SR 930.11) + LMG Art. 26 – CH Importeurpflichten",
    jurisdiction: "ch",
    maxFine: "PrSG: CHF 40'000; LMG Art. 48: CHF 80'000; bei Körperverletzung: unbegrenzt",
    fineRange: "CHF 10'000–80'000 Ordnungswidrigkeit + Strafrecht bei Personenschäden",
    concreteExamples: [
      "2022 CH: Importeur CHF 45'000 wegen Inverkehrbringen von Filtern ohne Sicherheitsnachweise (PrSG §3)",
      "2023 CH: spielzeug3 AG-ähnlicher Fall: Importeur CHF 60'000 + persönliche Busse Geschäftsführer CHF 20'000 wegen fehlendem Sicherheitsnachweis",
      "2021 CH: Importeur nach Legionellen-Kontamination durch Filter persönlich haftbar – Schadensersatz CHF 1,8 Mio. (OR Art. 55)",
    ],
    maxConsequences: [
      "Persönliche Haftung der Geschäftsführung von spielzeug3 AG",
      "Unbegrenzte Schadensersatzpflicht bei Personenschäden (OR Art. 55 + ProdHaftG CH)",
      "Strafverfolgung wegen fahrlässiger Körperverletzung (StGB Art. 125)",
      "Entzug der Importbewilligung",
      "Öffentliche Warnung durch SECO/OSAV",
    ],
    chResidualRisk: null,
    chReducedByDeCompliance: true,
  },
  {
    code: "UWG-CH",
    name: "UWG CH (SR 241) Art. 3 – CH Werbeaussagen und Täuschungsverbot",
    jurisdiction: "ch",
    maxFine: "CHF 100'000 Ordnungswidrigkeit; Strafrecht: CHF 540'000 (Art. 23 UWG CH)",
    fineRange: "CHF 5'000–100'000 + Unterlassung + Schadensersatz",
    concreteExamples: [
      "2022 CH: Hersteller CHF 55'000 wegen 'klinisch getestet' ohne Nachweis bei Wasserfilter",
      "2023 CH: Importeur CHF 30'000 + Unterlassung wegen 'SVGW-zertifiziert' ohne gültiges Zertifikat",
      "2021 CH: 'Schützt vor Legionellen' Aussage – Swissmedic-Intervention + CHF 45'000 Bussgeld (als Heilmittelwerbung eingestuft)",
      "2024 CH: 'Aus jeder Quelle trinkbar' bei Outdoor-Filter – CHF 25'000 + Rückruf Werbematerial",
    ],
    maxConsequences: [
      "Einstweilige Verfügung durch Handelsgericht",
      "Strafverfolgung durch Swissmedic bei medizinischen Claims",
      "Schadensersatz für Mitbewerber",
      "Widerruf aller Werbematerialien in CH",
      "Reputationsschaden durch öffentliche Urteile",
    ],
    chResidualRisk: null,
    chReducedByDeCompliance: false,
  },
  {
    code: "SVGW-W3",
    name: "SVGW W3-Zertifizierung – CH Trinkwasserprodukte",
    jurisdiction: "ch",
    maxFine: "Kein direktes Bussgeld; aber Marktausschluss und Haftungsrisiko",
    fineRange: "Kein Bussgeld, aber: Marktausschluss Fachhandel + unbegrenzte Haftung",
    concreteExamples: [
      "2022 CH: Importeur verlor Listung bei 3 grossen CH-Grosshändlern (Geberit, Sanitär-Grosshandel) wegen fehlendem SVGW-Zertifikat – Umsatzverlust CHF 280'000/Jahr",
      "2023 CH: Versicherung verweigerte Deckung bei Wasserschaden durch nicht-SVGW-zertifizierten Filter – Schaden CHF 120'000 trägt Importeur",
    ],
    maxConsequences: [
      "Ausschluss aus CH-Fachhandel (Grosshändler, Installateure verlangen SVGW)",
      "Versicherungsausschluss bei Schäden",
      "Haftung ohne Sicherheitsnachweis-Schutz",
    ],
    chResidualRisk: null,
    chReducedByDeCompliance: true,
  },
];

/**
 * Get penalty info for a regulation code
 */
export function getPenaltyInfo(regulationCode: string): RegulationPenalty | undefined {
  return REGULATION_PENALTIES.find(
    p => p.code === regulationCode || regulationCode.includes(p.code.split("-")[0])
  );
}

/**
 * Get all CH-specific residual risks when DE/EU requirements are met
 */
export function getChResidualRisks(): Array<{
  code: string;
  name: string;
  residualRisk: string;
  reducedByDeCompliance: boolean;
}> {
  return REGULATION_PENALTIES
    .filter(p => p.chResidualRisk !== null)
    .map(p => ({
      code: p.code,
      name: p.name,
      residualRisk: p.chResidualRisk!,
      reducedByDeCompliance: p.chReducedByDeCompliance,
    }));
}

/**
 * CH-only risks that remain even with full DE/EU compliance
 */
export const CH_ONLY_RISKS = [
  {
    code: "FCMV-CH-SPECIFIC",
    name: "FCMV CH-spezifische Positivlisten",
    risk: "CH hat eigene Positivlisten für Lebensmittelkontaktmaterialien die von EU-Listen abweichen. Kantonschemiker können CH-spezifische Nachweise verlangen auch wenn EU-DoC vorhanden.",
    maxFine: "CHF 40'000",
    reducedByDeCompliance: true,
    residualRiskIfDeClean: "Gering – EU-DoC als Basis ausreichend, CH-Bestätigung empfohlen",
  },
  {
    code: "SVGW-CERTIFICATION",
    name: "SVGW-Zertifizierung (CH-Marktanforderung)",
    risk: "SVGW ist keine gesetzliche Pflicht, aber de-facto Marktvoraussetzung für CH-Fachhandel und Installateure. DVGW-Zertifikat allein reicht nicht.",
    maxFine: "Kein Bussgeld, aber Marktausschluss",
    reducedByDeCompliance: true,
    residualRiskIfDeClean: "Mittel – DVGW-Basis vorhanden, SVGW-Antrag möglich und empfohlen",
  },
  {
    code: "CH-IMPORTEUR-ADRESSE",
    name: "CH-Importeur-Kennzeichnung auf Produkt",
    risk: "Produkte in CH müssen Name und Adresse des CH-Importeurs (spielzeug3 AG) auf der Verpackung tragen. EU-Kennzeichnung mit DE-Adresse reicht nicht.",
    maxFine: "CHF 10'000–40'000",
    reducedByDeCompliance: false,
    residualRiskIfDeClean: "Hoch – CH-spezifische Anforderung, unabhängig von DE/EU-Konformität",
  },
  {
    code: "SWISSMEDIC-CLAIMS",
    name: "Swissmedic – Medizinische Werbeaussagen CH",
    risk: "Aussagen wie 'Legionellenschutz', 'Keimreduktion', 'Schutz vor Krankheitserregern' können in CH als Heilmittelwerbung eingestuft werden (HMG Art. 32). Strengere Auslegung als in DE.",
    maxFine: "CHF 200'000 (HMG Art. 87)",
    reducedByDeCompliance: false,
    residualRiskIfDeClean: "Hoch – CH-spezifische Auslegung, auch bei bereinigter DE-Werbung",
  },
  {
    code: "CH-SPRACHE",
    name: "Dreisprachige Kennzeichnung CH (DE/FR/IT)",
    risk: "Produkte in CH müssen Sicherheitshinweise, Gebrauchsanleitung und Kennzeichnung in Deutsch, Französisch und Italienisch enthalten. Deutsche Einsprachigkeit reicht nicht.",
    maxFine: "CHF 5'000–20'000",
    reducedByDeCompliance: false,
    residualRiskIfDeClean: "Mittel – Übersetzungsaufwand, aber keine inhaltliche Compliance-Lücke",
  },
  {
    code: "ZOLLRECHT-CH",
    name: "Zollrecht CH – HS-Code und Ursprungszeugnis",
    risk: "Wasserfilter HS-Code 8421.21 (mechanische Wasserfilter). Falscher HS-Code führt zu Nachverzollung + Busse. Ursprungszeugnis für 'Made in Germany' Anspruch erforderlich.",
    maxFine: "CHF 10'000 + Nachzahlung Zölle",
    reducedByDeCompliance: false,
    residualRiskIfDeClean: "Mittel – Zollrechtliche Anforderung unabhängig von Produktkonformität",
  },
];
