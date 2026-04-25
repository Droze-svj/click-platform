// Seed Integration Marketplace
// Populate marketplace with popular integrations

const mongoose = require('mongoose');
require('dotenv').config();
const IntegrationMarketplace = require('../models/IntegrationMarketplace');
const logger = require('../utils/logger');

const integrations = [
  // CMS Integrations
  {
    provider: 'contentful',
    name: 'Contentful',
    description: 'Headless CMS for managing content across platforms',
    category: 'cms',
    logo: 'https://images.ctfassets.net/3ouphkrynjol/3YrH9h5N9kUXvqVU2tZv5f/5e4f40b8f93415755e7c8e3b3c4e4e4e/contentful-logo.png',
    website: 'https://www.contentful.com',
    documentation: 'https://www.contentful.com/developers/docs/',
    authType: 'api_key',
    features: ['content_sync', 'asset_sync', 'webhook_support', 'real_time'],
    api: {
      baseUrl: 'https://api.contentful.com',
      endpoints: {
        content: '/spaces/{space_id}/entries',
        assets: '/spaces/{space_id}/assets'
      },
      rateLimit: {
        requests: 100,
        period: 60
      },
      authentication: 'api_key'
    },
    config: {
      requiredFields: ['apiKey', 'spaceId'],
      optionalFields: ['environment'],
      fieldDescriptions: {
        apiKey: 'Contentful Management API Key',
        spaceId: 'Contentful Space ID',
        environment: 'Contentful Environment (default: master)'
      }
    },
    pricing: {
      tier: 'paid',
      cost: 0,
      currency: 'USD'
    },
    isActive: true,
    isVerified: true
  },
  {
    provider: 'strapi',
    name: 'Strapi',
    description: 'Open-source headless CMS',
    category: 'cms',
    logo: 'https://strapi.io/assets/strapi-logo-dark.svg',
    website: 'https://strapi.io',
    documentation: 'https://docs.strapi.io',
    authType: 'bearer',
    features: ['content_sync', 'asset_sync', 'webhook_support', 'real_time'],
    api: {
      baseUrl: 'https://api.strapi.io',
      endpoints: {
        content: '/api/{content_type}',
        assets: '/api/upload'
      },
      rateLimit: {
        requests: 1000,
        period: 60
      },
      authentication: 'bearer'
    },
    config: {
      requiredFields: ['apiKey', 'baseUrl'],
      optionalFields: [],
      fieldDescriptions: {
        apiKey: 'Strapi API Token',
        baseUrl: 'Strapi API Base URL'
      }
    },
    pricing: {
      tier: 'free',
      cost: 0,
      currency: 'USD'
    },
    isActive: true,
    isVerified: true
  },
  // DAM Integrations
  {
    provider: 'cloudinary',
    name: 'Cloudinary',
    description: 'Cloud-based image and video management',
    category: 'dam',
    logo: 'https://cloudinary.com/logo.png',
    website: 'https://cloudinary.com',
    documentation: 'https://cloudinary.com/documentation',
    authType: 'api_key',
    features: ['asset_sync', 'webhook_support', 'real_time'],
    api: {
      baseUrl: 'https://api.cloudinary.com',
      endpoints: {
        upload: '/v1_1/{cloud_name}/upload',
        resources: '/v1_1/{cloud_name}/resources'
      },
      rateLimit: {
        requests: 500,
        period: 60
      },
      authentication: 'api_key'
    },
    config: {
      requiredFields: ['apiKey', 'apiSecret', 'cloudName'],
      optionalFields: [],
      fieldDescriptions: {
        apiKey: 'Cloudinary API Key',
        apiSecret: 'Cloudinary API Secret',
        cloudName: 'Cloudinary Cloud Name'
      }
    },
    pricing: {
      tier: 'free',
      cost: 0,
      currency: 'USD'
    },
    isActive: true,
    isVerified: true
  },
  {
    provider: 'bynder',
    name: 'Bynder',
    description: 'Digital asset management platform',
    category: 'dam',
    logo: 'https://www.bynder.com/logo.png',
    website: 'https://www.bynder.com',
    documentation: 'https://developer.bynder.com',
    authType: 'oauth',
    features: ['asset_sync', 'webhook_support', 'real_time'],
    api: {
      baseUrl: 'https://{subdomain}.bynder.com',
      endpoints: {
        assets: '/api/v4/media/',
        upload: '/api/v4/upload/'
      },
      rateLimit: {
        requests: 100,
        period: 60
      },
      authentication: 'oauth'
    },
    config: {
      requiredFields: ['clientId', 'clientSecret', 'subdomain'],
      optionalFields: [],
      fieldDescriptions: {
        clientId: 'Bynder OAuth Client ID',
        clientSecret: 'Bynder OAuth Client Secret',
        subdomain: 'Bynder Subdomain'
      }
    },
    pricing: {
      tier: 'paid',
      cost: 0,
      currency: 'USD'
    },
    isActive: true,
    isVerified: true
  },
  // CRM Integrations
  {
    provider: 'hubspot',
    name: 'HubSpot',
    description: 'CRM and marketing automation platform',
    category: 'crm',
    logo: 'https://www.hubspot.com/logo.png',
    website: 'https://www.hubspot.com',
    documentation: 'https://developers.hubspot.com',
    authType: 'oauth',
    features: ['content_sync', 'user_sync', 'analytics_sync', 'webhook_support'],
    api: {
      baseUrl: 'https://api.hubapi.com',
      endpoints: {
        contacts: '/crm/v3/objects/contacts',
        companies: '/crm/v3/objects/companies',
        deals: '/crm/v3/objects/deals'
      },
      rateLimit: {
        requests: 100,
        period: 10
      },
      authentication: 'oauth'
    },
    config: {
      requiredFields: ['clientId', 'clientSecret'],
      optionalFields: [],
      fieldDescriptions: {
        clientId: 'HubSpot OAuth Client ID',
        clientSecret: 'HubSpot OAuth Client Secret'
      }
    },
    pricing: {
      tier: 'free',
      cost: 0,
      currency: 'USD'
    },
    isActive: true,
    isVerified: true
  },
  {
    provider: 'salesforce',
    name: 'Salesforce',
    description: 'Customer relationship management platform',
    category: 'crm',
    logo: 'https://www.salesforce.com/logo.png',
    website: 'https://www.salesforce.com',
    documentation: 'https://developer.salesforce.com',
    authType: 'oauth',
    features: ['content_sync', 'user_sync', 'analytics_sync', 'webhook_support'],
    api: {
      baseUrl: 'https://{instance}.salesforce.com',
      endpoints: {
        sobjects: '/services/data/v57.0/sobjects',
        query: '/services/data/v57.0/query'
      },
      rateLimit: {
        requests: 1000,
        period: 60
      },
      authentication: 'oauth'
    },
    config: {
      requiredFields: ['clientId', 'clientSecret', 'instance'],
      optionalFields: [],
      fieldDescriptions: {
        clientId: 'Salesforce OAuth Client ID',
        clientSecret: 'Salesforce OAuth Client Secret',
        instance: 'Salesforce Instance URL'
      }
    },
    pricing: {
      tier: 'paid',
      cost: 0,
      currency: 'USD'
    },
    isActive: true,
    isVerified: true
  },
  // Ad Platform Integrations
  {
    provider: 'google_ads',
    name: 'Google Ads',
    description: 'Google advertising platform',
    category: 'ad_platform',
    logo: 'https://ads.google.com/logo.png',
    website: 'https://ads.google.com',
    documentation: 'https://developers.google.com/google-ads/api',
    authType: 'oauth',
    features: ['analytics_sync', 'webhook_support'],
    api: {
      baseUrl: 'https://googleads.googleapis.com',
      endpoints: {
        campaigns: '/v14/customers/{customer_id}/campaigns',
        adGroups: '/v14/customers/{customer_id}/adGroups'
      },
      rateLimit: {
        requests: 10000,
        period: 60
      },
      authentication: 'oauth'
    },
    config: {
      requiredFields: ['clientId', 'clientSecret', 'developerToken', 'customerId'],
      optionalFields: [],
      fieldDescriptions: {
        clientId: 'Google OAuth Client ID',
        clientSecret: 'Google OAuth Client Secret',
        developerToken: 'Google Ads Developer Token',
        customerId: 'Google Ads Customer ID'
      }
    },
    pricing: {
      tier: 'paid',
      cost: 0,
      currency: 'USD'
    },
    isActive: true,
    isVerified: true
  },
  {
    provider: 'facebook_ads',
    name: 'Facebook Ads',
    description: 'Facebook advertising platform',
    category: 'ad_platform',
    logo: 'https://www.facebook.com/logo.png',
    website: 'https://www.facebook.com/business',
    documentation: 'https://developers.facebook.com/docs/marketing-apis',
    authType: 'oauth',
    features: ['analytics_sync', 'webhook_support'],
    api: {
      baseUrl: 'https://graph.facebook.com',
      endpoints: {
        campaigns: '/v18.0/{ad_account_id}/campaigns',
        adSets: '/v18.0/{ad_account_id}/adsets'
      },
      rateLimit: {
        requests: 200,
        period: 60
      },
      authentication: 'oauth'
    },
    config: {
      requiredFields: ['appId', 'appSecret', 'accessToken', 'adAccountId'],
      optionalFields: [],
      fieldDescriptions: {
        appId: 'Facebook App ID',
        appSecret: 'Facebook App Secret',
        accessToken: 'Facebook Access Token',
        adAccountId: 'Facebook Ad Account ID'
      }
    },
    pricing: {
      tier: 'paid',
      cost: 0,
      currency: 'USD'
    },
    isActive: true,
    isVerified: true
  },
  // Data Warehouse Integrations
  {
    provider: 'snowflake',
    name: 'Snowflake',
    description: 'Cloud data warehouse',
    category: 'data_warehouse',
    logo: 'https://www.snowflake.com/logo.png',
    website: 'https://www.snowflake.com',
    documentation: 'https://docs.snowflake.com',
    authType: 'basic',
    features: ['analytics_sync', 'batch_operations'],
    api: {
      baseUrl: 'https://{account}.snowflakecomputing.com',
      endpoints: {
        query: '/api/v2/statements',
        data: '/api/v2/statements/{statement_id}/result'
      },
      rateLimit: {
        requests: 100,
        period: 60
      },
      authentication: 'basic'
    },
    config: {
      requiredFields: ['account', 'username', 'password', 'warehouse', 'database', 'schema'],
      optionalFields: [],
      fieldDescriptions: {
        account: 'Snowflake Account Identifier',
        username: 'Snowflake Username',
        password: 'Snowflake Password',
        warehouse: 'Snowflake Warehouse',
        database: 'Snowflake Database',
        schema: 'Snowflake Schema'
      }
    },
    pricing: {
      tier: 'paid',
      cost: 0,
      currency: 'USD'
    },
    isActive: true,
    isVerified: true
  },
  {
    provider: 'bigquery',
    name: 'Google BigQuery',
    description: 'Google Cloud data warehouse',
    category: 'data_warehouse',
    logo: 'https://cloud.google.com/bigquery/logo.png',
    website: 'https://cloud.google.com/bigquery',
    documentation: 'https://cloud.google.com/bigquery/docs',
    authType: 'oauth',
    features: ['analytics_sync', 'batch_operations'],
    api: {
      baseUrl: 'https://bigquery.googleapis.com',
      endpoints: {
        query: '/bigquery/v2/projects/{project_id}/queries',
        tables: '/bigquery/v2/projects/{project_id}/datasets/{dataset_id}/tables'
      },
      rateLimit: {
        requests: 100,
        period: 60
      },
      authentication: 'oauth'
    },
    config: {
      requiredFields: ['clientId', 'clientSecret', 'projectId', 'dataset'],
      optionalFields: [],
      fieldDescriptions: {
        clientId: 'Google OAuth Client ID',
        clientSecret: 'Google OAuth Client Secret',
        projectId: 'BigQuery Project ID',
        dataset: 'BigQuery Dataset ID'
      }
    },
    pricing: {
      tier: 'paid',
      cost: 0,
      currency: 'USD'
    },
    isActive: true,
    isVerified: true
  }
];

async function seedMarketplace() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/click', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    logger.info('Connected to MongoDB');

    for (const integration of integrations) {
      const existing = await IntegrationMarketplace.findOne({ provider: integration.provider });
      if (existing) {
        logger.info(`Integration ${integration.provider} already exists, skipping`);
        continue;
      }

      const marketplaceIntegration = new IntegrationMarketplace(integration);
      await marketplaceIntegration.save();
      logger.info(`Created integration: ${integration.name}`);
    }

    logger.info('Marketplace seeding completed');
    process.exit(0);
  } catch (error) {
    logger.error('Error seeding marketplace', { error: error.message });
    process.exit(1);
  }
}

if (require.main === module) {
  seedMarketplace();
}

module.exports = { seedMarketplace, integrations };


