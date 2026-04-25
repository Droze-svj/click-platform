// Manual Edit History Service - Undo/Redo System
// Tracks edit history and allows undo/redo operations

const logger = require('../utils/logger');
const Content = require('../models/Content');
const fs = require('fs');
const path = require('path');

/**
 * Save edit state to history
 */
async function saveEditState(videoId, editState) {
  try {
    const content = await Content.findById(videoId);
    if (!content) {
      throw new Error('Content not found');
    }

    // Initialize history if not exists
    if (!content.metadata) {
      content.metadata = {};
    }
    if (!content.metadata.editHistory) {
      content.metadata.editHistory = [];
      content.metadata.editHistoryIndex = -1;
    }

    const history = content.metadata.editHistory;
    const currentIndex = content.metadata.editHistoryIndex || -1;

    // Remove any states after current index (when undoing and then making new edit)
    if (currentIndex < history.length - 1) {
      history.splice(currentIndex + 1);
    }

    // Add new state
    history.push({
      ...editState,
      timestamp: new Date().toISOString(),
      id: `edit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    });

    // Limit history to last 50 states
    if (history.length > 50) {
      history.shift();
    }

    content.metadata.editHistoryIndex = history.length - 1;
    await content.save();

    logger.info('Edit state saved', { videoId, historyLength: history.length });
    return {
      success: true,
      historyLength: history.length,
      currentIndex: history.length - 1
    };
  } catch (error) {
    logger.error('Save edit state error', { error: error.message, videoId });
    throw error;
  }
}

/**
 * Undo last edit
 */
async function undoEdit(videoId) {
  try {
    const content = await Content.findById(videoId);
    if (!content) {
      throw new Error('Content not found');
    }

    if (!content.metadata?.editHistory || content.metadata.editHistory.length === 0) {
      return { success: false, message: 'No edit history available' };
    }

    const history = content.metadata.editHistory;
    let currentIndex = content.metadata.editHistoryIndex || history.length - 1;

    if (currentIndex <= 0) {
      return { success: false, message: 'Nothing to undo' };
    }

    currentIndex--;
    content.metadata.editHistoryIndex = currentIndex;

    const previousState = history[currentIndex];
    await content.save();

    logger.info('Edit undone', { videoId, currentIndex });
    return {
      success: true,
      state: previousState,
      currentIndex,
      canUndo: currentIndex > 0,
      canRedo: currentIndex < history.length - 1
    };
  } catch (error) {
    logger.error('Undo edit error', { error: error.message, videoId });
    throw error;
  }
}

/**
 * Redo last undone edit
 */
async function redoEdit(videoId) {
  try {
    const content = await Content.findById(videoId);
    if (!content) {
      throw new Error('Content not found');
    }

    if (!content.metadata?.editHistory || content.metadata.editHistory.length === 0) {
      return { success: false, message: 'No edit history available' };
    }

    const history = content.metadata.editHistory;
    let currentIndex = content.metadata.editHistoryIndex || history.length - 1;

    if (currentIndex >= history.length - 1) {
      return { success: false, message: 'Nothing to redo' };
    }

    currentIndex++;
    content.metadata.editHistoryIndex = currentIndex;

    const nextState = history[currentIndex];
    await content.save();

    logger.info('Edit redone', { videoId, currentIndex });
    return {
      success: true,
      state: nextState,
      currentIndex,
      canUndo: currentIndex > 0,
      canRedo: currentIndex < history.length - 1
    };
  } catch (error) {
    logger.error('Redo edit error', { error: error.message, videoId });
    throw error;
  }
}

/**
 * Get edit history
 */
async function getEditHistory(videoId) {
  try {
    const content = await Content.findById(videoId);
    if (!content) {
      throw new Error('Content not found');
    }

    const history = content.metadata?.editHistory || [];
    const currentIndex = content.metadata?.editHistoryIndex ?? -1;

    return {
      history,
      currentIndex,
      canUndo: currentIndex > 0,
      canRedo: currentIndex < history.length - 1,
      totalStates: history.length
    };
  } catch (error) {
    logger.error('Get edit history error', { error: error.message, videoId });
    throw error;
  }
}

/**
 * Clear edit history
 */
async function clearEditHistory(videoId) {
  try {
    const content = await Content.findById(videoId);
    if (!content) {
      throw new Error('Content not found');
    }

    if (content.metadata) {
      content.metadata.editHistory = [];
      content.metadata.editHistoryIndex = -1;
      await content.save();
    }

    logger.info('Edit history cleared', { videoId });
    return { success: true };
  } catch (error) {
    logger.error('Clear edit history error', { error: error.message, videoId });
    throw error;
  }
}

module.exports = {
  saveEditState,
  undoEdit,
  redoEdit,
  getEditHistory,
  clearEditHistory,
};
