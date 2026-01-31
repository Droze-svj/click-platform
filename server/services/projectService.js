const Project = require('../models/Project');
const logger = require('../utils/logger');

/**
 * Create or Update a project (Autosave)
 */
async function saveProject(userId, projectData) {
    try {
        const { videoId, state, name, folderId } = projectData;

        if (!videoId) throw new Error('videoId is required to save project');

        // Look for existing project for this user and video
        let project = await Project.findOne({ owner: userId, videoId });

        if (project) {
            // Update existing
            project.state = state;
            if (name) project.name = name;
            if (folderId) project.folderId = folderId;
            project.lastSaved = Date.now();
            await project.save();
            logger.info('Project autosaved', { projectId: project._id, userId });
        } else {
            // Create new
            project = new Project({
                owner: userId,
                videoId,
                state,
                name: name || 'Untitled Project',
                folderId: folderId || null
            });
            await project.save();
            logger.info('New project created', { projectId: project._id, userId });
        }

        return project;
    } catch (error) {
        logger.error('Save project error', { error: error.message, userId });
        throw error;
    }
}

/**
 * Get project by videoId
 */
async function getProjectByVideo(userId, videoId) {
    try {
        const project = await Project.findOne({ owner: userId, videoId });
        return project;
    } catch (error) {
        logger.error('Get project error', { error: error.message, userId });
        throw error;
    }
}

/**
 * List user projects with folder filtering
 */
async function listProjects(userId, folderId = null) {
    try {
        const query = { owner: userId };
        if (folderId) query.folderId = folderId;

        const projects = await Project.find(query).sort({ lastSaved: -1 });
        return projects;
    } catch (error) {
        logger.error('List projects error', { error: error.message, userId });
        throw error;
    }
}

module.exports = {
    saveProject,
    getProjectByVideo,
    listProjects
};
