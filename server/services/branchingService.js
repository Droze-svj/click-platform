const Content = require('../models/Content');

/**
 * branchingService.js
 * Handles Git-style timeline branching, diffing, and merging for Task 4.2.
 */

/**
 * Create a new branch from current master editorState
 */
async function createBranch(videoId, branchName, userId) {
    const content = await Content.findById(videoId);
    if (!content) throw new Error('Content not found');

    const masterState = content.generatedContent.editorState;
    const newBranch = {
        name: branchName,
        editorState: JSON.parse(JSON.stringify(masterState)), // Deep copy
        createdBy: userId,
        createdAt: new Date()
    };

    content.timelineBranches.push(newBranch);
    await content.save();
    return newBranch;
}

/**
 * Merge a branch back into master
 */
async function mergeBranch(videoId, branchId) {
    const content = await Content.findById(videoId);
    if (!content) throw new Error('Content not found');

    const branch = content.timelineBranches.id(branchId);
    if (!branch) throw new Error('Branch not found');

    // Nondestructive: backup current master to a 'pre-merge' branch
    const preMergeBranch = {
        name: `pre-merge-${branch.name}-${Date.now()}`,
        editorState: content.generatedContent.editorState,
        createdBy: 'system',
        createdAt: new Date()
    };
    content.timelineBranches.push(preMergeBranch);

    // Perform merge
    content.generatedContent.editorState = branch.editorState;

    // Remove the branch after merge (optional, or keep index)
    // branch.remove();

    await content.save();
    return { success: true, mergedState: content.generatedContent.editorState };
}

/**
 * Calculate a simple diff between two timeline states
 */
function diffTimelines(stateA, stateB) {
    if (!stateA || !stateB) return { additions: [], deletions: [] };

    const clipsA = stateA.segments || [];
    const clipsB = stateB.segments || [];

    const additions = clipsB.filter(b => !clipsA.some(a => a.id === b.id));
    const deletions = clipsA.filter(a => !clipsB.some(b => b.id === a.id));
    const modifications = clipsB.filter(b => {
        const a = clipsA.find(x => x.id === b.id);
        return a && JSON.stringify(a) !== JSON.stringify(b);
    });

    return { additions, deletions, modifications };
}

module.exports = {
    createBranch,
    mergeBranch,
    diffTimelines
};
