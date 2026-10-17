import express from 'express';
import type { ErrorRequestHandler } from 'express';

export function createApiRequestBodyParser() {
  const router = express.Router();
  // A 600 KiB optimized file needs about 800 KiB when encoded as base64.
  // This larger envelope applies only to endpoints accepting an optimized file.
  router.use(['/api/users/me/identity-document', '/api/stay-issues', '/api/listings/test-create', /^\/api\/bookings\/[^/]+\/inventory$/], express.json({ limit: '900kb' }));
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
