/**
 * 404 catch-all — mounted AFTER all real routes.  If a request reaches
 * this middleware it means no route matched, so we return a clear 404 JSON
 * response instead of Express's default HTML page.
 */

const notFound = (req, res, _next) => {
  res.status(404).json({
    status: 'error',
    statusCode: 404,
    message: `Not Found — ${req.method} ${req.originalUrl}`,
  });
};

module.exports = notFound;
