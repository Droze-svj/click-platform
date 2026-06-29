// Regression guard for the production-readiness perf pass: CommandPalette and
// Comment were the only owner-scoped models genuinely missing a userId index
// (the rest already declared `userId: { index: true }` inline). A find({ userId })
// on these must be an index seek, not a collection scan.
const models = ['CommandPalette', 'Comment'];

describe('userId index on owner-scoped models', () => {
  it.each(models)('%s declares a schema.index({ userId: 1 })', (name) => {
    const Model = require(`../../server/models/${name}`);
    const hasUserIdIndex = Model.schema.indexes().some(([spec]) => Object.keys(spec)[0] === 'userId');
    expect(hasUserIdIndex).toBe(true);
  });
});
