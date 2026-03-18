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
});

export type AppRouter = typeof appRouter;
