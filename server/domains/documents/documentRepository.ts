/**
 * server/domains/documents/documentRepository.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Data-access layer for the Documents domain.
 */

export {
  getDocumentsByProduct,
  createDocument,
  updateDocument,
  deleteDocument,
  getComponentsByProduct,
  getComponentById,
  createComponent,
  updateComponent,
  deleteComponent,
  getDocumentsByComponent,
  getAllComponentDocumentsByProduct,
  createComponentDocument,
  deleteComponentDocument,
  updateComponentDocumentReview,
} from "../../db";
