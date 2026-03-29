/**
 * server/domains/ai/documentExtractor.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Downloads a document from a URL and extracts its text content for AI analysis.
 * Uses pdftotext (poppler-utils) for PDF extraction via a temp file.
 */

import { exec } from "child_process";
import { promisify } from "util";
import { writeFile, unlink } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { randomBytes } from "crypto";

const execAsync = promisify(exec);
const MAX_CHARS = 12_000; // Limit to avoid exceeding LLM context

export interface ExtractedDocument {
  text: string;
  pageCount?: number;
  extractionStatus: "success" | "failed" | "unsupported" | "no_url";
  errorMessage?: string;
}

/**
 * Downloads a file from the given URL and extracts its text content.
 * Returns a structured result with the text and extraction status.
 */
export async function extractDocumentText(
  fileUrl: string | null | undefined,
  fileName: string
): Promise<ExtractedDocument> {
  if (!fileUrl) {
    return {
      text: "",
      extractionStatus: "no_url",
      errorMessage: "No file URL available for this document.",
    };
  }

  const lowerName = fileName.toLowerCase();
  const lowerUrl = fileUrl.toLowerCase();
  const isPdf =
    lowerName.endsWith(".pdf") ||
    lowerUrl.includes(".pdf") ||
    lowerUrl.includes("application%2Fpdf");

  if (!isPdf) {
    return {
      text: "",
      extractionStatus: "unsupported",
      errorMessage: `File type not supported for text extraction (${fileName}). Only PDF files are currently supported.`,
    };
  }

  const tmpFile = join(tmpdir(), `doc_extract_${randomBytes(8).toString("hex")}.pdf`);

  try {
    // Download the PDF
    const response = await fetch(fileUrl, {
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      return {
        text: "",
        extractionStatus: "failed",
        errorMessage: `Failed to download document: HTTP ${response.status} ${response.statusText}`,
      };
    }

    const arrayBuffer = await response.arrayBuffer();
    await writeFile(tmpFile, Buffer.from(arrayBuffer));

    // Extract text using pdftotext (poppler-utils, pre-installed in sandbox)
    const { stdout } = await execAsync(`pdftotext -layout "${tmpFile}" -`, {
      timeout: 20_000,
      maxBuffer: 5 * 1024 * 1024, // 5MB
    });

    // Get page count
    let pageCount: number | undefined;
    try {
      const { stdout: infoOut } = await execAsync(`pdfinfo "${tmpFile}"`, {
        timeout: 5_000,
      });
      const match = infoOut.match(/Pages:\s+(\d+)/);
      if (match) pageCount = parseInt(match[1], 10);
    } catch {
      // pdfinfo optional
    }

    let text = stdout || "";

    // Clean up excessive whitespace
    text = text
      .replace(/\r\n/g, "\n")
      .replace(/\n{4,}/g, "\n\n\n")
      .replace(/[ \t]{4,}/g, "   ")
      .trim();

    // Truncate if too long
    if (text.length > MAX_CHARS) {
      text =
        text.substring(0, MAX_CHARS) +
        `\n\n[... document truncated at ${MAX_CHARS} characters ...]`;
    }

    return {
      text,
      pageCount,
      extractionStatus: "success",
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      text: "",
      extractionStatus: "failed",
      errorMessage: `Text extraction failed: ${message}`,
    };
  } finally {
    // Clean up temp file
    try {
      await unlink(tmpFile);
    } catch {
      // ignore cleanup errors
    }
  }
}
