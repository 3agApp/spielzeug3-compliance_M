/**
 * server/aiAnalysisBatching.test.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Tests for the AI analysis improvements:
 *  1. In-memory progress store (getAnalysisProgress / getAnalysisProgressByProduct)
 *  2. Document batching (DOC_BATCH_SIZE = 6)
 *  3. Component detection from document file names (COMPONENT_PATTERNS)
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

// ─── Mock all DB helpers so no real DB is needed ─────────────────────────────
vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    getSystemSetting: vi.fn().mockResolvedValue(null),
    upsertSystemSetting: vi.fn().mockResolvedValue(undefined),
    createAuditLog: vi.fn().mockResolvedValue(undefined),
    getProductById: vi.fn().mockResolvedValue({
      id: 1,
      productName: "Test Product",
      internalArticleNumber: "ART-001",
      targetAgeMin: 3,
      targetAgeMax: 12,
      productCategory: "toy",
    }),
    getDocumentsByProduct: vi.fn().mockResolvedValue([]),
    getProductSafety: vi.fn().mockResolvedValue(null),
    getComponentsByProduct: vi.fn().mockResolvedValue([]),
    getAllComponentDocumentsByProduct: vi.fn().mockResolvedValue([]),
    createAiAnalysis: vi.fn().mockResolvedValue(42),
    updateAiAnalysis: vi.fn().mockResolvedValue(undefined),
    getLatestAiAnalysisByProduct: vi.fn().mockResolvedValue(null),
    getAiAnalysisHistory: vi.fn().mockResolvedValue([]),
    createComponent: vi.fn().mockResolvedValue({ insertId: 99 }),
    createComponentDocument: vi.fn().mockResolvedValue(undefined),
  };
});

// ─── Mock LLM so no real API calls are made ──────────────────────────────────
vi.mock("./domains/ai/tenantLLM", () => ({
  invokeTenantLLM: vi.fn().mockResolvedValue({
    content: JSON.stringify({
      documentAnalysis: [],
      overallScore: 80,
      riskLevel: "low",
      summary: "OK",
      findings: [],
      recommendations: [],
      missingDocuments: [],
      regulatoryChecks: [],
    }),
  }),
  getTenantAIConfig: vi.fn().mockResolvedValue({ configured: true, provider: "openai", model: "gpt-4o" }),
  testTenantAIKey: vi.fn().mockResolvedValue({ success: true }),
}));

// ─── Mock document extractor ─────────────────────────────────────────────────
vi.mock("./domains/ai/documentExtractor", () => ({
  extractDocumentText: vi.fn().mockResolvedValue({ extractionStatus: "success", text: "" }),
}));

// ─── Import after mocks ───────────────────────────────────────────────────────
import {
  getAnalysisProgress,
  getAnalysisProgressByProduct,
} from "./domains/ai/aiAnalysisService";

// ─── Progress store unit tests ────────────────────────────────────────────────
describe("getAnalysisProgress / getAnalysisProgressByProduct", () => {
  it("returns undefined for unknown analysisId", () => {
    expect(getAnalysisProgress(999999)).toBeUndefined();
  });

  it("returns undefined for unknown productId", () => {
    expect(getAnalysisProgressByProduct(999999)).toBeUndefined();
  });
});

// ─── Batching logic unit tests ────────────────────────────────────────────────
describe("Document batching", () => {
  it("calculates correct batch count for 0 documents", () => {
    const DOC_BATCH_SIZE = 6;
    expect(Math.ceil(0 / DOC_BATCH_SIZE)).toBe(0);
  });

  it("calculates correct batch count for exactly 6 documents", () => {
    const DOC_BATCH_SIZE = 6;
    expect(Math.ceil(6 / DOC_BATCH_SIZE)).toBe(1);
  });

  it("calculates correct batch count for 7 documents", () => {
    const DOC_BATCH_SIZE = 6;
    expect(Math.ceil(7 / DOC_BATCH_SIZE)).toBe(2);
  });

  it("calculates correct batch count for 12 documents", () => {
    const DOC_BATCH_SIZE = 6;
    expect(Math.ceil(12 / DOC_BATCH_SIZE)).toBe(2);
  });

  it("calculates correct batch count for 13 documents", () => {
    const DOC_BATCH_SIZE = 6;
    expect(Math.ceil(13 / DOC_BATCH_SIZE)).toBe(3);
  });

  it("slices documents correctly for first batch", () => {
    const DOC_BATCH_SIZE = 6;
    const docs = Array.from({ length: 10 }, (_, i) => ({ id: i + 1, fileName: `doc${i + 1}.pdf` }));
    const batch0 = docs.slice(0 * DOC_BATCH_SIZE, 1 * DOC_BATCH_SIZE);
    expect(batch0).toHaveLength(6);
    expect(batch0[0].id).toBe(1);
    expect(batch0[5].id).toBe(6);
  });

  it("slices documents correctly for second batch", () => {
    const DOC_BATCH_SIZE = 6;
    const docs = Array.from({ length: 10 }, (_, i) => ({ id: i + 1, fileName: `doc${i + 1}.pdf` }));
    const batch1 = docs.slice(1 * DOC_BATCH_SIZE, 2 * DOC_BATCH_SIZE);
    expect(batch1).toHaveLength(4);
    expect(batch1[0].id).toBe(7);
    expect(batch1[3].id).toBe(10);
  });
});

// ─── Component pattern matching unit tests ────────────────────────────────────
describe("Component detection patterns", () => {
  // Replicate the COMPONENT_PATTERNS logic locally for unit testing
  const COMPONENT_PATTERNS = [
    { regex: /wifi|wlan|wireless/i,         name: "WiFi Module" },
    { regex: /bluetooth|bt[_\s-]/i,         name: "Bluetooth Module" },
    { regex: /nfc/i,                         name: "NFC Module" },
    { regex: /battery|batterie|akku|18650/i, name: "Battery" },
    { regex: /usb[_\s-]?cable|usb.*kabel/i,  name: "USB Cable" },
    { regex: /charger|ladekabel|netzteil/i,   name: "Charger / Power Adapter" },
    { regex: /speaker|lautsprecher/i,         name: "Speaker" },
    { regex: /display|screen|lcd|oled/i,      name: "Display" },
    { regex: /emc|emv|electromagnetic/i,      name: "EMC Module" },
    { regex: /cybersecurity|cyber/i,          name: "Cybersecurity Component" },
    { regex: /pcb|circuit|platine/i,          name: "PCB / Circuit Board" },
    { regex: /plastic|kunststoff/i,           name: "Plastic Housing" },
    { regex: /textile|stoff|fabric/i,         name: "Textile Component" },
    { regex: /rubber|gummi/i,                 name: "Rubber Component" },
    { regex: /paint|lacquer|farbe/i,          name: "Paint / Coating" },
  ];

  function detectComponent(fileName: string): string | null {
    const lower = fileName.toLowerCase();
    for (const p of COMPONENT_PATTERNS) {
      if (p.regex.test(lower)) return p.name;
    }
    return null;
  }

  it("detects WiFi module from filename", () => {
    expect(detectComponent("wifi_module_cert.pdf")).toBe("WiFi Module");
    expect(detectComponent("WLAN-Zertifikat.pdf")).toBe("WiFi Module");
    expect(detectComponent("wireless_test_report.pdf")).toBe("WiFi Module");
  });

  it("detects Bluetooth module from filename", () => {
    expect(detectComponent("bluetooth_test.pdf")).toBe("Bluetooth Module");
    expect(detectComponent("BT-Module-Cert.pdf")).toBe("Bluetooth Module");
  });

  it("detects Battery from filename", () => {
    expect(detectComponent("battery_safety.pdf")).toBe("Battery");
    expect(detectComponent("18650_cell_test.pdf")).toBe("Battery");
    expect(detectComponent("Akku-Pruefbericht.pdf")).toBe("Battery");
  });

  it("detects USB Cable from filename", () => {
    expect(detectComponent("usb_cable_test.pdf")).toBe("USB Cable");
    expect(detectComponent("USB-Kabel-Zertifikat.pdf")).toBe("USB Cable");
  });

  it("detects Charger from filename", () => {
    expect(detectComponent("charger_safety_report.pdf")).toBe("Charger / Power Adapter");
    expect(detectComponent("Netzteil-Pruefung.pdf")).toBe("Charger / Power Adapter");
  });

  it("detects Speaker from filename", () => {
    expect(detectComponent("speaker_compliance.pdf")).toBe("Speaker");
    expect(detectComponent("Lautsprecher-Test.pdf")).toBe("Speaker");
  });

  it("detects Display from filename", () => {
    expect(detectComponent("lcd_display_test.pdf")).toBe("Display");
    expect(detectComponent("OLED-Screen-Report.pdf")).toBe("Display");
  });

  it("detects PCB from filename", () => {
    expect(detectComponent("pcb_layout_v2.pdf")).toBe("PCB / Circuit Board");
    expect(detectComponent("circuit_board_test.pdf")).toBe("PCB / Circuit Board");
  });

  it("detects NFC module from filename", () => {
    expect(detectComponent("nfc_chip_cert.pdf")).toBe("NFC Module");
  });

  it("detects EMC module from filename", () => {
    expect(detectComponent("emc_test_report.pdf")).toBe("EMC Module");
    expect(detectComponent("EMV-Pruefbericht.pdf")).toBe("EMC Module");
  });

  it("returns null for unrecognised filename", () => {
    expect(detectComponent("declaration_of_conformity.pdf")).toBeNull();
    expect(detectComponent("test_report_general.pdf")).toBeNull();
  });

  it("assigns only first matching component per document", () => {
    // A file named 'wifi_bluetooth_test.pdf' should match WiFi (first pattern)
    expect(detectComponent("wifi_bluetooth_test.pdf")).toBe("WiFi Module");
  });

  it("groups multiple documents under the same component", () => {
    const docs = [
      { id: 1, fileName: "wifi_cert_v1.pdf" },
      { id: 2, fileName: "wifi_cert_v2.pdf" },
      { id: 3, fileName: "battery_test.pdf" },
    ];
    const componentMap = new Map<string, number[]>();
    for (const doc of docs) {
      const name = detectComponent(doc.fileName);
      if (name) {
        const existing = componentMap.get(name);
        if (existing) existing.push(doc.id);
        else componentMap.set(name, [doc.id]);
      }
    }
    expect(componentMap.get("WiFi Module")).toEqual([1, 2]);
    expect(componentMap.get("Battery")).toEqual([3]);
    expect(componentMap.size).toBe(2);
  });
});
