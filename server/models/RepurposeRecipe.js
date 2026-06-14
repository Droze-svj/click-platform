// RepurposeRecipe — a shareable, remixable "formula" for the Repurpose Studio.
//
// A recipe captures the REUSABLE part of a repurpose job (target formats, niche,
// look/filters, caption style) but NOT a specific source video — so another
// creator can apply ("remix") it onto their own footage. Public recipes power a
// community gallery; remixCount + forkedFrom give attribution and lineage.

const mongoose = require('mongoose');

const RepurposeRecipeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, default: '', maxlength: 600 },
    niche: { type: String, default: 'other', trim: true, lowercase: true, maxlength: 40 },

    // Owner + a denormalised display name so the gallery can attribute without
    // an extra User lookup per row.
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    createdByName: { type: String, default: 'Creator', maxlength: 120 },

    isPublic: { type: Boolean, default: false, index: true },

    // The sanitised, bounded recipe config: { targets, niche, quality,
    // videoFilters, textOverlays }. Stored as Mixed (validated by the service).
    recipe: { type: mongoose.Schema.Types.Mixed, required: true },

    // How many times this recipe has been applied to a new video (popularity).
    remixCount: { type: Number, default: 0 },
    // Lineage: set when this recipe was itself forked from another.
    forkedFrom: { type: mongoose.Schema.Types.ObjectId, ref: 'RepurposeRecipe', default: null },
  },
  { timestamps: true }
);

// Gallery sort: public recipes by popularity then recency.
RepurposeRecipeSchema.index({ isPublic: 1, remixCount: -1, createdAt: -1 });

module.exports =
  mongoose.models.RepurposeRecipe || mongoose.model('RepurposeRecipe', RepurposeRecipeSchema);
