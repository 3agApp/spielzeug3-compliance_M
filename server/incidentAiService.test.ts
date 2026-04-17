/**
 * server/incidentAiService.test.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Tests für den KI-gestützten Fallbewertungs-Service (erweiterte Produktdaten).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("../server/_core/llm", () => ({
  invokeLLM: vi.fn(),
}));

vi.mock("../server/db", () => ({
  getDb: vi.fn(),
}));

vi.mock("../server/shared", () => ({
  requireRole: vi.fn(),
  Errors: {
    notFound: (msg: string) => new Error(msg),
    forbidden: (msg: string) => new Error(msg),
    precondition: (msg: string) => new Error(msg),
  },
}));

import { invokeLLM } from "../server/_core/llm";
import { getDb } from "../server/db";
import { incidentAiService } from "../server/domains/incidents/incidentAiService";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const mockUser = {
  id: 1,
  complianceRole: "compliance_manager" as const,
  tenantId: 1,
};

const mockIncident = {
  id: 42,
  tenantId: 1,
  productId: 10,
  incidentType: "personal_injury",
  severity: "high",
  title: "Kind hat Kleinteile verschluckt",
  description: "Ein 2-jähriges Kind hat abgebrochene Kleinteile eines Spielzeugautos verschluckt.",
  injuryDescription: "Verschlucken von Kleinteilen, Würgereiz",
  injuredPersonAge: 2,
  injuredPersonType: "child",
  medicalTreatmentRequired: true,
  hospitalisation: false,
  reportedToAuthority: false,
  authorityName: null,
  affectedVersions: JSON.stringify(["v1.2", "v1.3"]),
  affectedBatchNumbers: JSON.stringify(["CH-2024-001"]),
};

const mockProduct = {
  id: 10,
  productName: "Spielzeugauto Turbo",
  internalArticleNumber: "tig8001",
  brand: "tigermedia",
  ean: "4260123456789",
  category: "Fahrzeuge",
  ageGrading: "3+",
  countryOfOrigin: "CN",
};

const mockSafety = {
  productId: 10,
  safetyText: "Nicht geeignet für Kinder unter 3 Jahren",
  warningText: "Enthält Kleinteile – Erstickungsgefahr",
  ageGrading: "3+",
  materialInformation: "ABS-Kunststoff",
  usageRestrictions: "Nur Originalzubehör verwenden. Nicht für Kinder unter 3 Jahren.",
};

const mockEvidences = [
  { id: 1, evidenceType: "photo", fileName: "schadensfoto.jpg", description: "Foto" },
  { id: 2, evidenceType: "customer_statement", fileName: "Kundenaussage.pdf", description: "Elternaussage" },
];

const mockDocs = [
  { id: 1, documentType: "test_report", fileName: "EN71-Prüfbericht.pdf", reviewStatus: "approved", expiryDate: null, includeInAiAnalysis: true },
  { id: 2, documentType: "declaration_of_conformity", fileName: "DoC-2024.pdf", reviewStatus: "approved", expiryDate: null, includeInAiAnalysis: true },
];

const mockDeclarations = [
  {
    id: 1,
    docNumber: "DOC-SZ3-2024-0001",
    version: 1,
    status: "ai_validated",
    standards: JSON.stringify(["EN 71-1", "EN 71-2", "EN 71-3"]),
    euDirectives: JSON.stringify(["2009/48/EG"]),
    chRegulations: JSON.stringify([]),
    testReportRef: "TR-2024-001",
    aiValidationPassed: true,
    aiValidationSummary: "Alle Anforderungen erfüllt",
  },
];

const mockComponents = [
  { id: 1, name: "Karosserie", materialType: "plastic", supplierName: "Plastik GmbH", partNumber: "P-001" },
  { id: 2, name: "Räder", materialType: "rubber", supplierName: "Gummi AG", partNumber: "R-002" },
];

const mockComponentDocs = [
  { id: 1, componentId: 1, documentType: "test_report", fileName: "Karosserie-Test.pdf" },
];

const mockBatches = [
  { id: 1, batchNumber: "CH-2024-001", goodsReceiptDate: new Date("2024-03-01"), notes: "Charge 1" },
];

const mockLabellingChecks = [
  { id: 1, label: "CE-Kennzeichnung", checked: true, isMandatory: true, checkKey: "ce_mark" },
  { id: 2, label: "Altersangabe", checked: true, isMandatory: true, checkKey: "age_grading" },
  { id: 3, label: "Warnhinweise", checked: false, isMandatory: true, checkKey: "warnings" },
];

const mockAiResponse = {
  riskLevel: "critical",
  recallRecommended: true,
  recallScope: "Freiwilliger Rückruf aller betroffenen Chargen",
  regulatoryObligation: true,
  regulatoryObligationReason: "Meldepflicht nach GPSR Art. 9 und PrSG §10",
  regulatoryDeadlineDays: 3,
  applicableRegulations: ["EN 71-1", "GPSR 2023/988", "PrSG SR 930.11"],
  requiredDocuments: ["Prüfbericht EN 71", "Konformitätserklärung", "Arztbericht"],
  assessmentText: "Das Produkt weist eine kritische Sicherheitslücke auf.",
  summary: "Kritischer Personenschaden – sofortiger Rückruf erforderlich.",
  confidence: "high",
  caveats: ["Vollständiger Prüfbericht noch nicht vorliegend"],
};

// ─── Mock DB Builder ──────────────────────────────────────────────────────────

/**
 * Baut einen Mock-DB, der auf Basis von Drizzle-Tabellen-Symbolen antwortet.
 * Da der Service viele parallele Abfragen macht, verwenden wir einen
 * call-counter-basierten Ansatz.
 */
function makeDbMock(opts: {
  incident?: any;
  product?: any;
  safety?: any;
  evidences?: any[];
  docs?: any[];
  declarations?: any[];
  components?: any[];
  componentDocs?: any[];
  batches?: any[];
  labellingChecks?: any[];
} = {}) {
  const incident = opts.incident !== undefined ? opts.incident : mockIncident;
  const product = opts.product !== undefined ? opts.product : mockProduct;
  const safety = opts.safety !== undefined ? opts.safety : mockSafety;
  const evidences = opts.evidences ?? mockEvidences;
  const docs = opts.docs ?? mockDocs;
  const declarations_ = opts.declarations ?? mockDeclarations;
  const components = opts.components ?? mockComponents;
  const componentDocs = opts.componentDocs ?? mockComponentDocs;
  const batches = opts.batches ?? mockBatches;
  const labellingChecks = opts.labellingChecks ?? mockLabellingChecks;

  let callCount = 0;

  const makeChain = (returnValue: any) => ({
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(returnValue),
  });

  const mockDb = {
    select: vi.fn().mockImplementation(() => {
      callCount++;
      const c = callCount;

      // Call order (sequential, not parallel for test purposes):
      // 1: incidents (getById)
      // 2: products (getById)
      // 3: productSafetyEntries
      // 4: incidentEvidences
      // 5: documents
      // 6: declarations
      // 7: productComponents
      // 8: batchRecords
      // 9: productLabellingChecks
      // 10+: componentDocuments (inArray)

      if (c === 1) return makeChain(incident ? [incident] : []);
      if (c === 2) return makeChain(product ? [product] : []);
      if (c === 3) return makeChain(safety ? [safety] : []);
      if (c === 4) return makeChain(evidences);
      if (c === 5) return makeChain(docs);
      if (c === 6) return makeChain(declarations_);
      if (c === 7) return makeChain(components);
      if (c === 8) return makeChain(batches);
      if (c === 9) return makeChain(labellingChecks);
      // componentDocs (inArray – uses .where with inArray)
      return makeChain(componentDocs);
    }),
  };

  return mockDb;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("incidentAiService.suggestAssessment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("gibt einen vollständigen KI-Vorschlag zurück", async () => {
    (getDb as any).mockResolvedValue(makeDbMock());
    (invokeLLM as any).mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(mockAiResponse) } }],
    });

    const result = await incidentAiService.suggestAssessment(mockUser, 42);

    expect(result.riskLevel).toBe("critical");
    expect(result.recallRecommended).toBe(true);
    expect(result.regulatoryObligation).toBe(true);
    expect(result.regulatoryDeadlineDays).toBe(3);
    expect(result.confidence).toBe("high");
    expect(result.applicableRegulations).toContain("EN 71-1");
    expect(result.requiredDocuments.length).toBeGreaterThan(0);
    expect(result.assessmentText.length).toBeGreaterThan(10);
    expect(result.summary.length).toBeGreaterThan(5);
    expect(Array.isArray(result.caveats)).toBe(true);
  });

  it("ruft invokeLLM mit korrektem JSON-Schema auf", async () => {
    (getDb as any).mockResolvedValue(makeDbMock());
    (invokeLLM as any).mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(mockAiResponse) } }],
    });

    await incidentAiService.suggestAssessment(mockUser, 42);

    expect(invokeLLM).toHaveBeenCalledTimes(1);
    const callArgs = (invokeLLM as any).mock.calls[0][0];
    expect(callArgs.response_format?.type).toBe("json_schema");
    expect(callArgs.response_format?.json_schema?.name).toBe("incident_assessment");
    expect(callArgs.messages[0].role).toBe("system");
    expect(callArgs.messages[1].role).toBe("user");
  });

  it("enthält Produktdaten und Sicherheitsinfos im User-Prompt", async () => {
    (getDb as any).mockResolvedValue(makeDbMock());
    (invokeLLM as any).mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(mockAiResponse) } }],
    });

    await incidentAiService.suggestAssessment(mockUser, 42);

    const callArgs = (invokeLLM as any).mock.calls[0][0];
    const userPrompt = callArgs.messages[1].content as string;
    expect(userPrompt).toContain("Spielzeugauto Turbo");
    expect(userPrompt).toContain("tig8001");
    expect(userPrompt).toContain("Erstickungsgefahr");
    expect(userPrompt).toContain("Personenschaden");
  });

  it("enthält Beweise im User-Prompt", async () => {
    (getDb as any).mockResolvedValue(makeDbMock());
    (invokeLLM as any).mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(mockAiResponse) } }],
    });

    await incidentAiService.suggestAssessment(mockUser, 42);

    const callArgs = (invokeLLM as any).mock.calls[0][0];
    const userPrompt = callArgs.messages[1].content as string;
    expect(userPrompt).toContain("schadensfoto.jpg");
    expect(userPrompt).toContain("Kundenaussage");
  });

  it("enthält Dokumente und Deklarationen im User-Prompt", async () => {
    (getDb as any).mockResolvedValue(makeDbMock());
    (invokeLLM as any).mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(mockAiResponse) } }],
    });

    await incidentAiService.suggestAssessment(mockUser, 42);

    const callArgs = (invokeLLM as any).mock.calls[0][0];
    const userPrompt = callArgs.messages[1].content as string;
    expect(userPrompt).toContain("EN71-Prüfbericht.pdf");
    expect(userPrompt).toContain("DOC-SZ3-2024-0001");
    expect(userPrompt).toContain("EN 71-1");
  });

  it("enthält Komponenten und Chargeninformationen im User-Prompt", async () => {
    (getDb as any).mockResolvedValue(makeDbMock());
    (invokeLLM as any).mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(mockAiResponse) } }],
    });

    await incidentAiService.suggestAssessment(mockUser, 42);

    const callArgs = (invokeLLM as any).mock.calls[0][0];
    const userPrompt = callArgs.messages[1].content as string;
    expect(userPrompt).toContain("Karosserie");
    expect(userPrompt).toContain("CH-2024-001");
  });

  it("enthält Herstellervorgaben und Nutzungsbeschränkungen im Prompt", async () => {
    (getDb as any).mockResolvedValue(makeDbMock());
    (invokeLLM as any).mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(mockAiResponse) } }],
    });

    await incidentAiService.suggestAssessment(mockUser, 42);

    const callArgs = (invokeLLM as any).mock.calls[0][0];
    const userPrompt = callArgs.messages[1].content as string;
    expect(userPrompt).toContain("Originalzubehör");
    expect(userPrompt).toContain("Herstellervorgaben");
  });

  it("meldet fehlende Dokumente wenn keine vorhanden", async () => {
    (getDb as any).mockResolvedValue(makeDbMock({ docs: [] }));
    (invokeLLM as any).mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(mockAiResponse) } }],
    });

    await incidentAiService.suggestAssessment(mockUser, 42);

    const callArgs = (invokeLLM as any).mock.calls[0][0];
    const userPrompt = callArgs.messages[1].content as string;
    expect(userPrompt).toContain("Keine Dokumente hinterlegt");
  });

  it("wirft NOT_FOUND wenn Incident nicht existiert", async () => {
    let firstCall = true;
    const dbMock = {
      select: vi.fn().mockImplementation(() => ({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockImplementation(() => {
          if (firstCall) { firstCall = false; return Promise.resolve([]); }
          return Promise.resolve([]);
        }),
      })),
    };
    (getDb as any).mockResolvedValue(dbMock);

    await expect(
      incidentAiService.suggestAssessment(mockUser, 999)
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("wirft INTERNAL_SERVER_ERROR wenn LLM fehlschlägt", async () => {
    (getDb as any).mockResolvedValue(makeDbMock());
    (invokeLLM as any).mockRejectedValue(new Error("LLM timeout"));

    await expect(
      incidentAiService.suggestAssessment(mockUser, 42)
    ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });

  it("gibt Fallback-Werte zurück wenn LLM-Antwort unvollständig ist", async () => {
    (getDb as any).mockResolvedValue(makeDbMock());
    (invokeLLM as any).mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ riskLevel: "high" }) } }],
    });

    const result = await incidentAiService.suggestAssessment(mockUser, 42);
    expect(result.riskLevel).toBe("high");
    expect(result.recallRecommended).toBe(false);
    expect(result.regulatoryObligation).toBe(false);
    expect(Array.isArray(result.applicableRegulations)).toBe(true);
    expect(Array.isArray(result.requiredDocuments)).toBe(true);
    expect(Array.isArray(result.caveats)).toBe(true);
  });

  it("funktioniert auch ohne verknüpftes Produkt (kein productId)", async () => {
    const noProductIncident = { ...mockIncident, productId: null };
    let callCount = 0;
    const dbMock = {
      select: vi.fn().mockImplementation(() => {
        callCount++;
        const c = callCount;
        return {
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockImplementation(() => {
            if (c === 1) return Promise.resolve([noProductIncident]);
            if (c === 2) return Promise.resolve([]); // evidences
            return Promise.resolve([]);
          }),
        };
      }),
    };
    (getDb as any).mockResolvedValue(dbMock);
    (invokeLLM as any).mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ ...mockAiResponse, riskLevel: "medium" }) } }],
    });

    const result = await incidentAiService.suggestAssessment(mockUser, 42);
    expect(result.riskLevel).toBe("medium");
    const callArgs = (invokeLLM as any).mock.calls[0][0];
    const userPrompt = callArgs.messages[1].content as string;
    expect(userPrompt).not.toContain("Spielzeugauto Turbo");
  });
});
