// Seed Add-Ons
// Populate add-ons for subscription packages

require('dotenv').config();
const mongoose = require('mongoose');
const AddOn = require('../server/models/AddOn');
const logger = require('../server/utils/logger');

const addOns = [
  {
    name: 'Extra Videos',
    slug: 'extra-videos',
    description: 'Additional 50 videos per month',
    category: 'usage',
    price: {
      monthly: 9,
      yearly: 90
    },
    features: {
      additionalVideos: 50
    },
    compatiblePackages: [], // All packages
    isActive: true,
    sortOrder: 1
  },
  {
    name: 'Extra Content Generations',
    slug: 'extra-content',
    description: 'Additional 200 content generations per month',
    category: 'usage',
    price: {
      monthly: 7,
      yearly: 70
    },
    features: {
      additionalContentGenerations: 200
    },
    compatiblePackages: [],
    isActive: true,
    sortOrder: 2
  },
  {
    name: 'Extra Storage',
    slug: 'extra-storage',
    description: 'Additional 50GB storage',
    category: 'storage',
    price: {
      monthly: 5,
      yearly: 50
    },
    features: {
      additionalStorage: 50 * 1024 * 1024 * 1024 // 50GB
    },
    compatiblePackages: [],
    isActive: true,
    sortOrder: 3
  },
  {
    name: 'Additional Brand',
    slug: 'additional-brand',
    description: 'Add one more brand/workspace',
    category: 'feature',
    price: {
      monthly: 15,
      yearly: 150
    },
    features: {
      additionalBrands: 1
    },
    compatiblePackages: [], // All packages
    isActive: true,
    sortOrder: 4
  },
  {
    name: 'Additional Client Workspace',
    slug: 'additional-client-workspace',
    description: 'Add one more client workspace (Agency only)',
    category: 'feature',
    price: {
      monthly: 25,
      yearly: 250
    },
    features: {
      additionalClientWorkspaces: 1
    },
    compatiblePackages: [], // Will be set to Agency package ID
    isActive: true,
    sortOrder: 5
  },
  {
    name: 'Priority Support',
    slug: 'priority-support',
    description: 'Priority email and chat support',
    category: 'support',
    price: {
      monthly: 19,
      yearly: 190
    },
    features: {
      prioritySupport: true
    },
    compatiblePackages: [],
    isActive: true,
    sortOrder: 6
  },
  {
    name: 'Additional Team Member',
    slug: 'additional-team-member',
    description: 'Add one more team member',
    category: 'team',
    price: {
      monthly: 10,
      yearly: 100
    },
    features: {
      additionalTeamMembers: 1
    },
    compatiblePackages: [],
    isActive: true,
    sortOrder: 7
  }
];

async function seedAddOns() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/click', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    logger.info('Connected to MongoDB');

    // Get Agency package ID for client workspace add-on
    const MembershipPackage = require('../server/models/MembershipPackage');
    const agencyPackage = await MembershipPackage.findOne({ slug: 'agency' });
    if (agencyPackage) {
      const clientWorkspaceAddOn = addOns.find(a => a.slug === 'additional-client-workspace');
      if (clientWorkspaceAddOn) {
        clientWorkspaceAddOn.compatiblePackages = [agencyPackage._id];
      }
    }

    for (const addOn of addOns) {
      const existing = await AddOn.findOne({ slug: addOn.slug });
      if (existing) {
        logger.info(`Add-on ${addOn.slug} already exists, skipping...`);
        continue;
      }

      const newAddOn = new AddOn(addOn);
      await newAddOn.save();
      logger.info(`✅ Created add-on: ${addOn.name}`);
    }

    logger.info('✅ Add-ons seeded successfully!');
    process.exit(0);
  } catch (error) {
    logger.error('Error seeding add-ons:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  seedAddOns();
}

module.exports = { seedAddOns, addOns };


