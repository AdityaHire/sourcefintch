/**
 * mysql2 / parameter coercion helpers.
 *
 * mysql2 throws "Bind parameters must not contain undefined" if any element
 * in the params array is `undefined`.  This is a frequent footgun when
 * fields are optional, come from req.body, or come from external services
 * (e.g. Qdrant payloads where `language` / `qdrant_point_id` may be absent).
 *
 * The rule: use `null` (not `undefined`) for missing values in SQL.
 *
 * `sqlParams(arr)` walks any depth of array/object and converts every
 * `undefined` it finds to `null`.  Use it to wrap every params array
 * passed to `pool.execute(sql, sqlParams(params))`.
 */

const undefinedToNull = (v) => {
  if (v === undefined) return null;
  if (Array.isArray(v)) return v.map(undefinedToNull);
  if (v !== null && typeof v === 'object') {
    const out = {};
    for (const k of Object.keys(v)) out[k] = undefinedToNull(v[k]);
    return out;
  }
  return v;
};

const sqlParams = (params) => undefinedToNull(params);

module.exports = { sqlParams, undefinedToNull };