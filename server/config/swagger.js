// Swagger/OpenAPI configuration

const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Click API',
      version: '1.0.0',
      description: 'API documentation for Click - A platform for creators to transform long-form content into social-ready formats',
      contact: {
        name: 'API Support',
        email: 'support@example.com'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: process.env.API_URL || 'http://localhost:5001/api',
        description: 'Development server'
      },
      {
        url: 'https://api.example.com/api',
        description: 'Production server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            email: { type: 'string', format: 'email' },
            name: { type: 'string' },
            subscription: {
              type: 'object',
              properties: {
                status: { type: 'string', enum: ['active', 'cancelled', 'expired', 'trial'] },
                plan: { type: 'string', enum: ['monthly', 'annual'] }
              }
            },
            niche: { type: 'string' },
            usage: {
              type: 'object',
              properties: {
                videosProcessed: { type: 'number' },
                contentGenerated: { type: 'number' },
                quotesCreated: { type: 'number' },
                postsScheduled: { type: 'number' }
              }
            }
          }
        },
        Content: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            type: { type: 'string', enum: ['video', 'article', 'podcast', 'transcript'] },
            title: { type: 'string' },
            status: { type: 'string', enum: ['uploading', 'processing', 'completed', 'failed'] },
            generatedContent: { type: 'object' }
          }
        },
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: { type: 'string' },
            details: { type: 'array', items: { type: 'string' } }
          }
        },
        Success: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string' },
            data: { type: 'object' }
          }
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ]
  },
  apis: [
    './server/routes/*.js',
    './server/index.js'
  ]
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;

