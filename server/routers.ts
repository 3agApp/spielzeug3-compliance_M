import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { suppliersRouter } from "./routers/suppliers";
import { productsRouter } from "./routers/products";
import { documentsRouter } from "./routers/documents";
import { safetyRouter } from "./routers/safety";
import { commentsRouter } from "./routers/comments";
import { adminRouter } from "./routers/admin";
import { notificationsRouter } from "./routers/notifications";
import { syncRouter } from "./routers/sync";
import { aiAnalysisRouter } from "./routers/aiAnalysis";
import { riskAssessmentRouter } from "./routers/riskAssessment";
import { expiryRouter } from "./routers/expiry";
import { invitationsRouter } from "./routers/invitations";
import { templatesRouter } from "./routers/templates";
import { componentsRouter } from "./routers/components";
import { bunnydocRouter } from "./routers/bunnydoc";
import { tenantRouter } from "./routers/tenant";
import { sealAssetsRouter } from "./routers/sealAssets";
import { productImagesRouter } from "./routers/productImages";
import { emailRouter } from "./routers/email";
export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  suppliers: suppliersRouter,
  products: productsRouter,
  documents: documentsRouter,
  safety: safetyRouter,
  comments: commentsRouter,
  admin: adminRouter,
  notifications: notificationsRouter,
  sync: syncRouter,
  aiAnalysis: aiAnalysisRouter,
  riskAssessment: riskAssessmentRouter,
  expiry: expiryRouter,
  invitations: invitationsRouter,
  templates: templatesRouter,
  components: componentsRouter,
  bunnydoc: bunnydocRouter,
  tenant: tenantRouter,
  sealAssets: sealAssetsRouter,
  productImages: productImagesRouter,
  email: emailRouter,
});

export type AppRouter = typeof appRouter;
