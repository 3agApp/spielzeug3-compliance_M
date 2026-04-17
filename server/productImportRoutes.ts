/**
 * Product Import Upload Route
 * POST /api/import/products/upload
 *
 * Accepts multipart/form-data with a single file field "file".
 * Stages the buffer in memory and returns an uploadId for use with
 * trpc.productImport.preview and trpc.productImport.commit.
 */

import { Router, type Express } from "express";
import multer from "multer";
import crypto from "crypto";
import { stageUpload } from "./routers/productImport";
import { createContext } from "./_core/context";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB max
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "text/csv",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/octet-stream",
    ];
    const ext = file.originalname.toLowerCase();
    if (allowed.includes(file.mimetype) || ext.endsWith(".csv") || ext.endsWith(".xlsx") || ext.endsWith(".xls")) {
      cb(null, true);
    } else {
      cb(new Error("Only CSV and Excel files are allowed."));
    }
  },
});

export function registerProductImportRoutes(app: Express) {
  const importRouter = Router();

  importRouter.post(
    "/products/upload",
    upload.single("file"),
    async (req, res) => {
      try {
        // Authenticate via session cookie (reuse existing context)
        const ctx = await createContext({ req, res } as any);
        if (!ctx.user) {
          res.status(401).json({ error: "Unauthorized" });
          return;
        }

        if (!req.file) {
          res.status(400).json({ error: "No file uploaded." });
          return;
        }

        const uploadId = crypto.randomUUID();
        stageUpload(uploadId, req.file.buffer, req.file.mimetype, String(ctx.user.id));

        res.json({
          uploadId,
          filename: req.file.originalname,
          size: req.file.size,
          mimeType: req.file.mimetype,
        });
      } catch (err: any) {
        res.status(500).json({ error: err?.message ?? "Upload failed" });
      }
    }
  );

  app.use("/api/import", importRouter);
}
