// Database query optimization utilities

/**
 * Optimize Mongoose query with select and lean
 */
function optimizeQuery(query, options = {}) {
  const {
    select = '',
    lean = true,
    populate = null,
    limit = null,
    skip = null,
    sort = null
  } = options;

  if (select) {
    query.select(select);
  }

  if (lean) {
    query.lean();
  }

  if (populate) {
    if (Array.isArray(populate)) {
      populate.forEach(p => query.populate(p));
    } else {
      query.populate(populate);
    }
  }

  if (limit) {
    query.limit(limit);
  }

  if (skip) {
    query.skip(skip);
  }

  if (sort) {
    query.sort(sort);
  }

  return query;
}

/**
 * Batch find operations
 */
async function batchFind(Model, conditions, options = {}) {
  const {
    batchSize = 100,
    select = '',
    lean = true
  } = options;

  const results = [];
  let skip = 0;

  while (true) {
    let query = Model.find(conditions);
    
    if (select) query = query.select(select);
    if (lean) query = query.lean();
    
    query = query.limit(batchSize).skip(skip);

    const batch = await query;
    
    if (batch.length === 0) {
      break;
    }

    results.push(...batch);
    skip += batchSize;

    if (batch.length < batchSize) {
      break;
    }
  }

  return results;
}

/**
 * Optimize aggregation pipeline
 */
function optimizeAggregation(pipeline) {
  // Add $match early in pipeline
  // Add $project to limit fields
  // Add indexes hints
  return pipeline;
}

module.exports = {
  optimizeQuery,
  batchFind,
  optimizeAggregation
};







