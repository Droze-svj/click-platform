// Seed default membership packages

require('dotenv').config();
const mongoose = require('mongoose');
const MembershipPackage = require('../server/models/MembershipPackage');
const logger = require('../server/utils/logger');

const defaultPackages = [
  {
    name: 'Free',
    slug: 'free',
    description: 'Perfect for trying out Click',
    price: { monthly: 0, yearly: 0 },
    features: {
      videoProcessing: {
        maxVideosPerMonth: 5,
        maxVideoLength: 300, // 5 minutes
        maxVideoSize: 100 * 1024 * 1024, // 100MB
        allowHD: false
      },
      contentGeneration: {
        maxGenerationsPerMonth: 10,
        maxTextLength: 5000,
        platforms: ['twitter', 'linkedin']
      },
      scripts: {
        maxScriptsPerMonth: 3,
        scriptTypes: ['youtube', 'social-media']
      },
      music: {
        maxMusicFiles: 0,
        maxMusicSize: 0
      },
      storage: {
        maxStorage: 1 * 1024 * 1024 * 1024, // 1GB
        maxFiles: 50
      },
      collaboration: {
        maxSharedUsers: 0,
        allowPublicSharing: false
      },
      analytics: {
        advancedAnalytics: false,
        exportData: false,
        apiAccess: false
      },
      support: {
        prioritySupport: false,
        emailSupport: true
      }
    },
    limits: {
      maxProjects: 5,
      maxTeamMembers: 1,
      maxApiCallsPerDay: 100,
      maxBrands: 1,
      maxClientWorkspaces: 0
    },
    agencyFeatures: {
      multiClientWorkspaces: false,
      whiteLabelPortals: false,
      clientApprovalDashboards: false,
      crossClientBenchmarking: false,
      bulkScheduling: false,
      whiteLabelReporting: false,
      perClientBilling: false
    },
    enterpriseFeatures: {
      sso: false,
      sla: false,
      advancedIntegrations: false,
      fullApiAccess: false,
      dedicatedSupport: false,
      customIntegrations: false,
      dataWarehouseExport: false,
      onPremiseDeployment: false
    },
    businessIntelligence: {
      advancedDashboards: false,
      customReports: false,
      dataExport: false,
      roiTracking: false,
      predictiveAnalytics: false
    },
    pricing: {
      isCustom: false,
      contactSales: false
    },
    isActive: true,
    isDefault: true,
    sortOrder: 1
  },
  {
    name: 'Creator',
    slug: 'creator',
    description: 'Competitive with OpusClip/Vizard Creator plans. Perfect for individual creators with limited brands.',
    price: { monthly: 19, yearly: 190 }, // $19/month, $190/year (save $38)
    features: {
      videoProcessing: {
        maxVideosPerMonth: 100, // Competitive with OpusClip Pro (3000 credits/year ≈ 100/month)
        maxVideoLength: 3600, // 1 hour
        maxVideoSize: 500 * 1024 * 1024, // 500MB
        allowHD: true
      },
      contentGeneration: {
        maxGenerationsPerMonth: 300, // More generous than competitors
        maxTextLength: 50000,
        platforms: ['twitter', 'linkedin', 'instagram', 'facebook', 'tiktok', 'youtube']
      },
      scripts: {
        maxScriptsPerMonth: 50,
        scriptTypes: ['youtube', 'podcast', 'blog', 'social-media', 'email']
      },
      music: {
        maxMusicFiles: 20,
        maxMusicSize: 50 * 1024 * 1024 // 50MB per file
      },
      storage: {
        maxStorage: 20 * 1024 * 1024 * 1024, // 20GB
        maxFiles: 1000
      },
      collaboration: {
        maxSharedUsers: 2, // Limited collaboration
        allowPublicSharing: true
      },
      analytics: {
        advancedAnalytics: true,
        exportData: true,
        apiAccess: false // Limited API access
      },
      support: {
        prioritySupport: false,
        emailSupport: true
      }
    },
    limits: {
      maxProjects: 50,
      maxTeamMembers: 2, // Limited to 2 team members
      maxApiCallsPerDay: 2000,
      maxBrands: 2, // Limited brands - key differentiator
      maxClientWorkspaces: 0
    },
    agencyFeatures: {
      multiClientWorkspaces: false,
      whiteLabelPortals: false,
      clientApprovalDashboards: false,
      crossClientBenchmarking: false,
      bulkScheduling: false,
      whiteLabelReporting: false,
      perClientBilling: false
    },
    enterpriseFeatures: {
      sso: false,
      sla: false,
      advancedIntegrations: false,
      fullApiAccess: false,
      dedicatedSupport: false,
      customIntegrations: false,
      dataWarehouseExport: false,
      onPremiseDeployment: false
    },
    businessIntelligence: {
      advancedDashboards: false,
      customReports: false,
      dataExport: true,
      roiTracking: false,
      predictiveAnalytics: false
    },
    pricing: {
      isCustom: false,
      contactSales: false
    },
    isActive: true,
    isDefault: false,
    sortOrder: 2
  },
  {
    name: 'Agency',
    slug: 'agency',
    description: 'For agencies and businesses managing multiple clients. Includes multi-client workspaces, approvals, BI dashboards, and white-label portals.',
    price: { monthly: 149, yearly: 1490 }, // $149/month, $1490/year (save $298)
    features: {
      videoProcessing: {
        maxVideosPerMonth: 500, // Generous for agency use
        maxVideoLength: 7200, // 2 hours
        maxVideoSize: 2 * 1024 * 1024 * 1024, // 2GB
        allowHD: true
      },
      contentGeneration: {
        maxGenerationsPerMonth: 2000, // High volume for multiple clients
        maxTextLength: 200000,
        platforms: ['twitter', 'linkedin', 'instagram', 'facebook', 'tiktok', 'youtube', 'pinterest', 'reddit']
      },
      scripts: {
        maxScriptsPerMonth: 200,
        scriptTypes: ['youtube', 'podcast', 'blog', 'social-media', 'email', 'sales', 'presentation']
      },
      music: {
        maxMusicFiles: 100,
        maxMusicSize: 100 * 1024 * 1024 // 100MB per file
      },
      storage: {
        maxStorage: 200 * 1024 * 1024 * 1024, // 200GB
        maxFiles: -1 // Unlimited
      },
      collaboration: {
        maxSharedUsers: 20, // Team collaboration
        allowPublicSharing: true
      },
      analytics: {
        advancedAnalytics: true,
        exportData: true,
        apiAccess: true // Full API access
      },
      support: {
        prioritySupport: true,
        emailSupport: true
      }
    },
    limits: {
      maxProjects: -1, // Unlimited
      maxTeamMembers: 20,
      maxApiCallsPerDay: 50000,
      maxBrands: 10, // Multiple brands
      maxClientWorkspaces: 10 // Multi-client management - key feature
    },
    agencyFeatures: {
      multiClientWorkspaces: true, // ✅ Key feature
      whiteLabelPortals: true, // ✅ Key feature
      clientApprovalDashboards: true, // ✅ Key feature
      crossClientBenchmarking: true, // ✅ Key feature
      bulkScheduling: true, // ✅ Key feature
      whiteLabelReporting: true, // ✅ Key feature
      perClientBilling: true // ✅ Key feature
    },
    enterpriseFeatures: {
      sso: false,
      sla: false,
      advancedIntegrations: true, // Some advanced integrations
      fullApiAccess: true,
      dedicatedSupport: false,
      customIntegrations: false,
      dataWarehouseExport: true,
      onPremiseDeployment: false
    },
    businessIntelligence: {
      advancedDashboards: true, // ✅ BI feature
      customReports: true, // ✅ BI feature
      dataExport: true,
      roiTracking: true, // ✅ BI feature
      predictiveAnalytics: true // ✅ BI feature
    },
    pricing: {
      isCustom: false,
      contactSales: false
    },
    isActive: true,
    isDefault: false,
    sortOrder: 3
  },
  {
    name: 'Enterprise',
    slug: 'enterprise',
    description: 'Custom pricing with SSO, SLAs, advanced integrations, and full API access. Contact sales for pricing.',
    price: { monthly: 0, yearly: 0 }, // Custom pricing
    features: {
      videoProcessing: {
        maxVideosPerMonth: -1, // Unlimited
        maxVideoLength: 10800, // 3 hours
        maxVideoSize: 5 * 1024 * 1024 * 1024, // 5GB
        allowHD: true
      },
      contentGeneration: {
        maxGenerationsPerMonth: -1, // Unlimited
        maxTextLength: 500000,
        platforms: ['twitter', 'linkedin', 'instagram', 'facebook', 'tiktok', 'youtube', 'pinterest', 'reddit', 'threads', 'snapchat']
      },
      scripts: {
        maxScriptsPerMonth: -1, // Unlimited
        scriptTypes: ['youtube', 'podcast', 'blog', 'social-media', 'email', 'sales', 'presentation', 'webinar', 'course']
      },
      music: {
        maxMusicFiles: -1, // Unlimited
        maxMusicSize: 200 * 1024 * 1024 // 200MB per file
      },
      storage: {
        maxStorage: -1, // Unlimited
        maxFiles: -1 // Unlimited
      },
      collaboration: {
        maxSharedUsers: -1, // Unlimited
        allowPublicSharing: true
      },
      analytics: {
        advancedAnalytics: true,
        exportData: true,
        apiAccess: true
      },
      support: {
        prioritySupport: true,
        emailSupport: true
      }
    },
    limits: {
      maxProjects: -1, // Unlimited
      maxTeamMembers: -1, // Unlimited
      maxApiCallsPerDay: -1, // Unlimited
      maxBrands: -1, // Unlimited
      maxClientWorkspaces: -1 // Unlimited
    },
    agencyFeatures: {
      multiClientWorkspaces: true,
      whiteLabelPortals: true,
      clientApprovalDashboards: true,
      crossClientBenchmarking: true,
      bulkScheduling: true,
      whiteLabelReporting: true,
      perClientBilling: true
    },
    enterpriseFeatures: {
      sso: true, // ✅ SSO
      sla: true, // ✅ SLA
      advancedIntegrations: true, // ✅ Advanced integrations
      fullApiAccess: true, // ✅ Full API access
      dedicatedSupport: true, // ✅ Dedicated support
      customIntegrations: true, // ✅ Custom integrations
      dataWarehouseExport: true, // ✅ Data warehouse export
      onPremiseDeployment: true // ✅ On-premise option
    },
    businessIntelligence: {
      advancedDashboards: true,
      customReports: true,
      dataExport: true,
      roiTracking: true,
      predictiveAnalytics: true
    },
    pricing: {
      isCustom: true, // ✅ Custom pricing
      contactSales: true // ✅ Contact sales
    },
    isActive: true,
    isDefault: false,
    sortOrder: 4
  }
];

async function seedPackages() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/click');
    logger.info('Connected to MongoDB');

    // Clear existing packages (optional - comment out if you want to keep existing)
    // await MembershipPackage.deleteMany({});

    for (const pkg of defaultPackages) {
      const existing = await MembershipPackage.findOne({ slug: pkg.slug });
      if (existing) {
        logger.info(`Package ${pkg.slug} already exists, skipping...`);
        continue;
      }

      const newPackage = new MembershipPackage(pkg);
      await newPackage.save();
      logger.info(`✅ Created package: ${pkg.name}`);
    }

    logger.info('✅ Membership packages seeded successfully!');
    process.exit(0);
  } catch (error) {
    logger.error('Error seeding packages:', error);
    process.exit(1);
  }
}

seedPackages();







