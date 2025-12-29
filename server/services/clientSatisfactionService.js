// Client Satisfaction Service
// Track NPS and satisfaction scores

const ClientSatisfaction = require('../models/ClientSatisfaction');
const logger = require('../utils/logger');

/**
 * Create satisfaction survey
 */
async function createSatisfactionSurvey(agencyWorkspaceId, clientWorkspaceId, surveyData) {
  try {
    const {
      type = 'nps',
      sentBy,
      customQuestions = []
    } = surveyData;

    const survey = new ClientSatisfaction({
      agencyWorkspaceId,
      clientWorkspaceId,
      survey: {
        type,
        date: new Date(),
        sentBy,
        status: 'sent'
      },
      customQuestions
    });

    await survey.save();

    logger.info('Satisfaction survey created', { agencyWorkspaceId, clientWorkspaceId, type });
    return survey;
  } catch (error) {
    logger.error('Error creating satisfaction survey', { error: error.message, agencyWorkspaceId });
    throw error;
  }
}

/**
 * Submit satisfaction response
 */
async function submitSatisfactionResponse(surveyId, responseData) {
  try {
    const {
      nps,
      csat,
      ces,
      customQuestions,
      overallSatisfaction,
      feedback
    } = responseData;

    const survey = await ClientSatisfaction.findByIdAndUpdate(
      surveyId,
      {
        $set: {
          nps,
          csat,
          ces,
          customQuestions,
          overallSatisfaction,
          feedback,
          'survey.completedAt': new Date(),
          'survey.status': 'completed'
        }
      },
      { new: true }
    );

    if (!survey) {
      throw new Error('Survey not found');
    }

    logger.info('Satisfaction response submitted', { surveyId });
    return survey;
  } catch (error) {
    logger.error('Error submitting satisfaction response', { error: error.message, surveyId });
    throw error;
  }
}

/**
 * Calculate NPS
 */
async function calculateNPS(agencyWorkspaceId, filters = {}) {
  try {
    const {
      startDate,
      endDate
    } = filters;

    const query = {
      agencyWorkspaceId,
      'survey.type': 'nps',
      'survey.status': 'completed',
      'nps.score': { $exists: true }
    };

    if (startDate || endDate) {
      query['survey.date'] = {};
      if (startDate) query['survey.date'].$gte = new Date(startDate);
      if (endDate) query['survey.date'].$lte = new Date(endDate);
    }

    const surveys = await ClientSatisfaction.find(query).lean();

    const promoters = surveys.filter(s => s.nps.category === 'promoter').length;
    const passives = surveys.filter(s => s.nps.category === 'passive').length;
    const detractors = surveys.filter(s => s.nps.category === 'detractor').length;
    const total = surveys.length;

    if (total === 0) {
      return {
        nps: 0,
        promoters: 0,
        passives: 0,
        detractors: 0,
        total: 0,
        percentage: {
          promoters: 0,
          passives: 0,
          detractors: 0
        }
      };
    }

    const nps = ((promoters - detractors) / total) * 100;

    return {
      nps: Math.round(nps * 100) / 100,
      promoters,
      passives,
      detractors,
      total,
      percentage: {
        promoters: Math.round((promoters / total) * 100 * 100) / 100,
        passives: Math.round((passives / total) * 100 * 100) / 100,
        detractors: Math.round((detractors / total) * 100 * 100) / 100
      }
    };
  } catch (error) {
    logger.error('Error calculating NPS', { error: error.message, agencyWorkspaceId });
    throw error;
  }
}

/**
 * Get satisfaction metrics
 */
async function getSatisfactionMetrics(agencyWorkspaceId, filters = {}) {
  try {
    const {
      startDate,
      endDate
    } = filters;

    const query = {
      agencyWorkspaceId,
      'survey.status': 'completed'
    };

    if (startDate || endDate) {
      query['survey.date'] = {};
      if (startDate) query['survey.date'].$gte = new Date(startDate);
      if (endDate) query['survey.date'].$lte = new Date(endDate);
    }

    const surveys = await ClientSatisfaction.find(query).lean();

    // NPS
    const nps = await calculateNPS(agencyWorkspaceId, { startDate, endDate });

    // CSAT
    const csatSurveys = surveys.filter(s => s.csat && s.csat.score);
    const averageCSAT = csatSurveys.length > 0
      ? csatSurveys.reduce((sum, s) => sum + s.csat.score, 0) / csatSurveys.length
      : 0;

    // Overall satisfaction
    const overallSurveys = surveys.filter(s => s.overallSatisfaction && s.overallSatisfaction.score);
    const averageOverall = overallSurveys.length > 0
      ? overallSurveys.reduce((sum, s) => sum + s.overallSatisfaction.score, 0) / overallSurveys.length
      : 0;

    // Satisfaction by factor
    const factors = {
      service: [],
      results: [],
      communication: [],
      value: [],
      support: []
    };

    surveys.forEach(s => {
      if (s.overallSatisfaction && s.overallSatisfaction.factors) {
        Object.keys(factors).forEach(factor => {
          if (s.overallSatisfaction.factors[factor]) {
            factors[factor].push(s.overallSatisfaction.factors[factor]);
          }
        });
      }
    });

    const averageFactors = {};
    Object.keys(factors).forEach(factor => {
      if (factors[factor].length > 0) {
        averageFactors[factor] = Math.round(
          (factors[factor].reduce((sum, score) => sum + score, 0) / factors[factor].length) * 100
        ) / 100;
      }
    });

    return {
      nps,
      csat: {
        average: Math.round(averageCSAT * 100) / 100,
        total: csatSurveys.length
      },
      overall: {
        average: Math.round(averageOverall * 100) / 100,
        total: overallSurveys.length
      },
      factors: averageFactors,
      totalSurveys: surveys.length
    };
  } catch (error) {
    logger.error('Error getting satisfaction metrics', { error: error.message, agencyWorkspaceId });
    throw error;
  }
}

module.exports = {
  createSatisfactionSurvey,
  submitSatisfactionResponse,
  calculateNPS,
  getSatisfactionMetrics
};


