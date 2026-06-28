/**
 * Zod request validation. Validates and REPLACES req.body/params/query with the
 * parsed, coerced, stripped output (extra fields dropped). Failures -> 422 with
 * a field-level details map.
 *   router.post("/", validate({ body: schema }), asyncHandler(handler))
 */
const { validation } = require("../errors/AppError");

const formatIssues = (error) => {
  const details = {};
  for (const issue of error.issues) {
    const key = issue.path.length ? issue.path.join(".") : "_";
    if (!details[key]) details[key] = issue.message;
  }
  return details;
};

const validate = (schemas = {}) => (req, _res, next) => {
  try {
    for (const key of ["body", "params", "query"]) {
      if (!schemas[key]) continue;
      const result = schemas[key].safeParse(req[key]);
      if (!result.success) {
        return next(
          validation("Invalid request data", {
            in: key,
            fields: formatIssues(result.error),
          })
        );
      }
      req[key] = result.data;
    }
    return next();
  } catch (err) {
    return next(err);
  }
};

module.exports = validate;
