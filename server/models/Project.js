const mongoose = require('mongoose');

const ProjectSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        default: 'Untitled Project'
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    folderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Folder',
        default: null
    },
    videoId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Content',
        required: true
    },
    videoUrl: String,

    // Editor State
    state: {
        videoFilters: {
            type: Map,
            of: Number,
            default: {}
        },
        textOverlays: {
            type: Array,
            default: []
        },
        timelineSegments: {
            type: Array,
            default: []
        },
        colorGradeSettings: {
            type: Map,
            of: mongoose.Schema.Types.Mixed,
            default: {}
        },
        chromaKeySettings: {
            type: Map,
            of: mongoose.Schema.Types.Mixed,
            default: {}
        },
        playbackSpeed: {
            type: Number,
            default: 1
        }
    },

    status: {
        type: String,
        enum: ['draft', 'editing', 'completed', 'archived'],
        default: 'draft'
    },

    lastSaved: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true,
    minimize: false // Important to preserve empty objects in state
});

module.exports = mongoose.model('Project', ProjectSchema);
