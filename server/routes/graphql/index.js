// GraphQL API Endpoint

const express = require('express');
const router = express.Router();
const { graphqlHTTP } = require('express-graphql');
const { buildSchema } = require('graphql');
const { authenticate } = require('../../middleware/auth');
const Content = require('../../models/Content');
const User = require('../../models/User');
const logger = require('../../utils/logger');
const { clampInt } = require('../../utils/pagination');

// GraphQL Schema
const schema = buildSchema(`
  type Content {
    id: ID!
    userId: ID!
    title: String
    description: String
    type: String!
    status: String!
    transcript: String
    createdAt: String!
    updatedAt: String!
    tags: [String!]
    analytics: ContentAnalytics
  }

  type ContentAnalytics {
    views: Int
    engagement: Int
    bestPerforming: String
  }

  type User {
    id: ID!
    email: String!
    name: String
    createdAt: String!
  }

  type Query {
    content(id: ID!): Content
    contents(userId: ID, type: String, limit: Int, offset: Int): [Content!]!
    user(id: ID!): User
    me: User
  }

  type Mutation {
    updateContent(id: ID!, title: String, description: String): Content
    createContent(title: String!, type: String!, description: String): Content
  }

  type Subscription {
    contentUpdated(contentId: ID!): Content
  }
`);

// Root resolver
const root = {
  // Queries
  content: async ({ id }, context) => {
    try {
      const content = await Content.findById(id);
      if (!content) {
        throw new Error('Content not found');
      }
      // Check permissions
      if (content.userId.toString() !== context.userId) {
        throw new Error('Unauthorized');
      }
      return formatContent(content);
    } catch (error) {
      logger.error('GraphQL content query error', { error: error.message, id });
      throw error;
    }
  },

  contents: async ({ userId, type, limit = 20, offset = 0 }, context) => {
    try {
      // BOLA/IDOR guard: the `userId` arg must NOT let a caller read another
      // user's content. Previously `if (userId) query.userId = userId` honored
      // any client-supplied id, so passing a victim's id returned their content.
      // Always scope to the authenticated caller; a mismatching arg is rejected.
      if (userId && String(userId) !== String(context.userId)) {
        throw new Error('Unauthorized');
      }
      const query = { userId: context.userId };
      if (type) {
        query.type = type;
      }

      const contents = await Content.find(query)
        .sort({ createdAt: -1 })
        .limit(clampInt(limit, 20, 500))
        .skip(clampInt(offset, 0, 100000, 0))
        .lean();

      return contents.map(formatContent);
    } catch (error) {
      logger.error('GraphQL contents query error', { error: error.message });
      throw error;
    }
  },

  user: async ({ id }, context) => {
    try {
      // IDOR guard: this used to return ANY user's profile (email/name) by id
      // with no ownership check — an arbitrary-PII leak. Restrict to self; the
      // `me` query is the canonical self-lookup, and admin user lookup lives on
      // the dedicated admin routes, not this public GraphQL surface.
      if (String(id) !== String(context.userId)) {
        throw new Error('Unauthorized');
      }
      const user = await User.findById(id).select('-password').lean();
      if (!user) {
        throw new Error('User not found');
      }
      return formatUser(user);
    } catch (error) {
      logger.error('GraphQL user query error', { error: error.message });
      throw error;
    }
  },

  me: async (args, context) => {
    try {
      const user = await User.findById(context.userId).select('-password').lean();
      if (!user) {
        throw new Error('User not found');
      }
      return formatUser(user);
    } catch (error) {
      logger.error('GraphQL me query error', { error: error.message });
      throw error;
    }
  },

  // Mutations
  updateContent: async ({ id, title, description }, context) => {
    try {
      const content = await Content.findById(id);
      if (!content) {
        throw new Error('Content not found');
      }
      if (content.userId.toString() !== context.userId) {
        throw new Error('Unauthorized');
      }

      if (title !== undefined) content.title = title;
      if (description !== undefined) content.description = description;
      await content.save();

      return formatContent(content);
    } catch (error) {
      logger.error('GraphQL updateContent mutation error', { error: error.message });
      throw error;
    }
  },

  createContent: async ({ title, type, description }, context) => {
    try {
      const content = new Content({
        userId: context.userId,
        title,
        type,
        description,
        status: 'draft',
      });
      await content.save();

      return formatContent(content);
    } catch (error) {
      logger.error('GraphQL createContent mutation error', { error: error.message });
      throw error;
    }
  },
};

// Helper functions
function formatContent(content) {
  return {
    id: content._id.toString(),
    userId: content.userId.toString(),
    title: content.title,
    description: content.description,
    type: content.type,
    status: content.status,
    transcript: content.transcript,
    createdAt: content.createdAt?.toISOString() || new Date().toISOString(),
    updatedAt: content.updatedAt?.toISOString() || new Date().toISOString(),
    tags: content.tags || [],
    analytics: content.analytics ? {
      views: content.analytics.views || 0,
      engagement: content.analytics.engagement || 0,
      bestPerforming: content.analytics.bestPerforming,
    } : null,
  };
}

function formatUser(user) {
  return {
    id: user._id.toString(),
    email: user.email,
    name: user.name || user.email,
    createdAt: user.createdAt?.toISOString() || new Date().toISOString(),
  };
}

// GraphQL endpoint with authentication
router.use(
  '/',
  authenticate,
  graphqlHTTP((req) => ({
    schema,
    rootValue: root,
    context: {
      userId: req.user.id || req.user._id,
      user: req.user,
    },
    graphiql: process.env.NODE_ENV !== 'production', // Enable GraphiQL in development
    customFormatErrorFn: (error) => {
      logger.error('GraphQL error', {
        message: error.message,
        locations: error.locations,
        path: error.path,
        stack: error.stack,
      });
      return {
        message: error.message,
        locations: error.locations,
        path: error.path,
      };
    },
  }))
);

module.exports = router;
// Exported for unit tests — the resolvers carry the ownership/IDOR guards, so
// they are asserted directly (guards throw before any DB access).
module.exports.root = root;
