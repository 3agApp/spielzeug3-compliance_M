/**
 * server/incidentAiService.test.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Tests für den KI-gestützten Fallbewertungs-Service.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ────────────────────────────────────────────────────────────────────

// Mock LLM
vi.mock("../server/_core/llm", () => ({
  invokeLLM: vi.fn(),
}));

// Mock DB
vi.mock("../server/db", () => ({
  getDb: vi.fn(),
}));

// Mock requireRole (no-op)
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

// ─── Test Fixtures ────────────────────────────────────────────────────────────

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
  description: "Ein 2-jähriges Kind hat abgebrochene Kleinteile eines Spielzeugautos verschluckt. Eltern berichten von Würgereiz.",
  injuryDescription: "Verschlucken von Kleinteilen, Würgereiz",
  injuredPersonAge: 2,
  injuredPersonType: "child",
  medicalTreatmentRequired: true,
  hospitalisation: false,
  reportedToAuthority: false,
  authorityName: null,
  affectedVersions: JSON.stringify(["v1.2", "v1.3"]),
  affectedBatchNumbers: JSON.stringify(["CH-2024-001", "CH-2024-002"]),
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
};

const mockEvidences = [
  {
    id: 1,
    evidenceType: "photo",
    fileName: "schadensfoto.jpg",
    description: "Foto des beschädigten Spielzeugautos",
  },
  {
    id: 2,
    evidenceType: "customer_statement",
    fileName: "Kundenaussage – 15.04.2026",
    description: "Aussage der Eltern",
  },
];

const mockAiResponse = {
  riskLevel: "critical",
  recallRecommended: true,
  recallScope: "Freiwilliger Rückruf aller betroffenen Chargen",
  regulatoryObligation: true,
  regulatoryObligationReason: "Gemäss GPSR Art. 9 und PrSG §10 besteht Meldepflicht bei Personenschäden durch Spielzeug",
  regulatoryDeadlineDays: 3,
  applicableRegulations: ["EN 71-1", "GPSR 2023/988", "PrSG SR 930.11", "Spielzeugverordnung SR 817.023.11"],
  requiredDocuments: ["Prüfbericht EN 71", "Konformitätserklärung", "Arztbericht", "Fotos des Schadens"],
  assessmentText: "Das Produkt weist eine kritische Sicherheitslücke auf: Kleinteile können sich lösen und von Kleinkindern verschluckt werden. Da das Produkt mit Altersangabe 3+ gekennzeichnet ist, aber offensichtlich auch für jüngere Kinder zugänglich war, besteht erhöhtes Risiko.",
  summary: "Kritischer Personenschaden durch Kleinteile – sofortiger Rückruf und Behördenmeldung erforderlich.",
  confidence: "high",
  caveats: ["Vollständiger Prüfbericht noch nicht vorliegend", "Anzahl betroffener Einheiten unbekannt"],
};

// ─── Helper: Mock DB Setup ────────────────────────────────────────────────────

function makeDbMock(overrides: {
  incident?: any;
  product?: any;
  safety?: any;
  evidences?: any[];
} = {}) {
  const incident = overrides.incident ?? mockIncident;
  const product = overrides.product ?? mockProduct;
  const safety = overrides.safety ?? mockSafety;
  const evidences = overrides.evidences ?? mockEvidences;

  let selectCallCount = 0;

  const mockDb = {
    select: vi.fn().mockImplementation(() => {
      selectCallCount++;
      const callNum = selectCallCount;
      return {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockImplementation(() => {
          // Call 1: incidents query
          if (callNum === 1) return Promise.resolve([incident]);
          // Call 2: products query
          if (callNum === 2) return Promise.resolve(product ? [product] : []);
          // Call 3: productSafetyEntries query
          if (callNum === 3) return Promise.resolve(safety ? [safety] : []);
          return Promise.resolve([]);
        }),
      };
    }),
  };

  // Evidences query uses a different pattern (no where clause on last select)
  let evidenceCallDone = false;
  const originalSelect = mockDb.select;
  mockDb.select = vi.fn().mockImplementation(() => {
    selectCallCount++;
    const callNum = selectCallCount;
    return {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockImplementation(() => {
        if (callNum === 1) return Promise.resolve([incident]);
        if (callNum === 2) return Promise.resolve(product ? [product] : []);
        if (callNum === 3) return Promise.resolve(safety ? [safety] : []);
        // Call 4: evidences query
        if (callNum === 4) return Promise.resolve(evidences);
        return Promise.resolve([]);
      }),
    };
  });

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

  it("enthält Produktdaten im User-Prompt", async () => {
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

  it("wirft NOT_FOUND wenn Incident nicht existiert", async () => {
    const dbMock = makeDbMock({ incident: null });
    // Override: first select returns empty array
    (dbMock.select as any).mockImplementationOnce(() => ({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([]),
    }));
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

  it("funktioniert auch ohne verknüpftes Produkt", async () => {
    (getDb as any).mockResolvedValue(makeDbMock({ product: null, safety: null }));
    const noProductIncident = { ...mockIncident, productId: null };
    // Rebuild mock for incident without product
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
    // Kein Produktname im Prompt
    const callArgs = (invokeLLM as any).mock.calls[0][0];
    const userPrompt = callArgs.messages[1].content as string;
    expect(userPrompt).not.toContain("Spielzeugauto Turbo");
  });

  it("gibt Fallback-Werte zurück wenn LLM-Antwort unvollständig ist", async () => {
    (getDb as any).mockResolvedValue(makeDbMock());
    // LLM gibt unvollständige Antwort zurück
    (invokeLLM as any).mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ riskLevel: "high" }) } }],
    });

    const result = await incidentAiService.suggestAssessment(mockUser, 42);
    expect(result.riskLevel).toBe("high");
    expect(result.recallRecommended).toBe(false); // Fallback
    expect(result.regulatoryObligation).toBe(false); // Fallback
    expect(Array.isArray(result.applicableRegulations)).toBe(true);
    expect(Array.isArray(result.requiredDocuments)).toBe(true);
    expect(Array.isArray(result.caveats)).toBe(true);
  });

  it("parst JSON korrekt wenn LLM content ein String ist", async () => {
    (getDb as any).mockResolvedValue(makeDbMock());
    (invokeLLM as any).mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(mockAiResponse) } }], // String
    });

    const result = await incidentAiService.suggestAssessment(mockUser, 42);
    expect(result.riskLevel).toBe("critical");
  });
});
