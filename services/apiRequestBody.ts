import express from 'express';
import type { ErrorRequestHandler } from 'express';

export function createApiRequestBodyParser() {
  const router = express.Router();
  // A 600 KiB optimized file needs about 800 KiB when encoded as base64.
  // This larger envelope applies only to endpoints accepting an optimized file.
  router.use(['/api/users/me/identity-document', '/api/users/me/residence', '/api/stay-issues', '/api/listings/test-create', /^\/api\/bookings\/[^/]+\/inventory$/, /^\/api\/bookings\/[^/]+\/damage-claim$/], express.json({ limit: '900kb' }));
  // Room identification photos are optimized and stored in separate private documents.
  router.use(/^\/api\/listings\/[^/]+\/access-instructions$/, express.json({ limit: '8mb' }));
  // Blog: an optimized image (up to 900 KiB) and long article texts.
  router.use('/api/admin/article-images', express.json({ limit: '1300kb' }));
  router.use(/^\/api\/admin\/articles(?:\/[^/]+)?$/, express.json({ limit: '400kb' }));
  router.use(express.json({ limit: '100kb' }));
  const handleSizeError: ErrorRequestHandler = (error, req, res, next) => {
    if (error?.type !== 'entity.too.large') return next(error);
    const isIdentityDocument = req.path === '/api/users/me/identity-document';
    return res.status(413).json({
      code: '413',
      error: isIdentityDocument
        ? 'Le document envoyé dépasse la taille autorisée. Choisissez une photo à optimiser ou un PDF de 600 Ko maximum.'
        : 'La requête dépasse la taille autorisée.'
    });
  };
  router.use(handleSizeError);
  return router;
}
