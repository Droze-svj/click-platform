// Cohort Analysis Service
// Analyze client cohorts and retention curves

const ClientRetention = require('../models/ClientRetention');
const logger = require('../utils/logger');

/**
 * Analyze client cohorts
 */
async function analyzeCohorts(agencyWorkspaceId, filters = {}) {
  try {
    const {
      cohortType = 'month', // 'month', 'quarter', 'year'
      startDate,
      endDate
    } = filters;

    const clients = await ClientRetention.find({
      agencyWorkspaceId
    }).lean();

    // Group by cohort
    const cohorts = {};
    clients.forEach(client => {
      const cohortDate = new Date(client.subscription.startDate);
      let cohortKey;

      if (cohortType === 'month') {
        cohortKey = `${cohortDate.getFullYear()}-${String(cohortDate.getMonth() + 1).padStart(2, '0')}`;
      } else if (cohortType === 'quarter') {
        const quarter = Math.floor(cohortDate.getMonth() / 3) + 1;
        cohortKey = `${cohortDate.getFullYear()}-Q${quarter}`;
      } else {
        cohortKey = cohortDate.getFullYear().toString();
      }

      if (!cohorts[cohortKey]) {
        cohorts[cohortKey] = {
          cohort: cohortKey,
          startDate: cohortDate,
          clients: [],
          total: 0,
          active: 0,
          churned: 0,
          retentionRate: 0,
          averageLTV: 0,
          averageLifetime: 0
        };
      }

      cohorts[cohortKey].clients.push(client);
      cohorts[cohortKey].total++;
      if (client.subscription.status === 'active') {
        cohorts[cohortKey].active++;
      } else if (client.subscription.status === 'cancelled' || client.subscription.status === 'expired') {
        cohorts[cohortKey].churned++;
      }
    });

    // Calculate metrics for each cohort
    Object.keys(cohorts).forEach(key => {
      const cohort = cohorts[key];
      cohort.retentionRate = cohort.total > 0 ? (cohort.active / cohort.total) * 100 : 0;
      cohort.averageLTV = cohort.clients.length > 0
        ? cohort.clients.reduce((sum, c) => sum + (c.retention.lifetimeValue || 0), 0) / cohort.clients.length
        : 0;
      cohort.averageLifetime = cohort.clients.length > 0
        ? cohort.clients.reduce((sum, c) => sum + (c.retention.monthsActive || 0), 0) / cohort.clients.length
        : 0;
    });

    // Sort by cohort date
    const sortedCohorts = Object.values(cohorts).sort((a, b) => 
      a.startDate.getTime() - b.startDate.getTime()
    );

    return {
      cohorts: sortedCohorts,
      summary: {
        totalCohorts: sortedCohorts.length,
        averageRetentionRate: sortedCohorts.length > 0
          ? sortedCohorts.reduce((sum, c) => sum + c.retentionRate, 0) / sortedCohorts.length
          : 0,
        averageLTV: sortedCohorts.length > 0
          ? sortedCohorts.reduce((sum, c) => sum + c.averageLTV, 0) / sortedCohorts.length
          : 0
      }
    };
  } catch (error) {
    logger.error('Error analyzing cohorts', { error: error.message, agencyWorkspaceId });
    throw error;
  }
}

/**
 * Generate retention curve
 */
async function generateRetentionCurve(agencyWorkspaceId, cohortKey) {
  try {
    const clients = await ClientRetention.find({
      agencyWorkspaceId
    }).lean();

    // Filter by cohort if specified
    let cohortClients = clients;
    if (cohortKey) {
      cohortClients = clients.filter(c => {
        const cohortDate = new Date(c.subscription.startDate);
        const key = `${cohortDate.getFullYear()}-${String(cohortDate.getMonth() + 1).padStart(2, '0')}`;
        return key === cohortKey;
      });
    }

    // Calculate retention by month
    const retentionCurve = [];
    const maxMonths = 24; // 2 years

    for (let month = 0; month <= maxMonths; month++) {
      const monthClients = cohortClients.filter(c => {
        const monthsActive = Math.floor((new Date() - new Date(c.subscription.startDate)) / (1000 * 60 * 60 * 24 * 30));
        return monthsActive >= month;
      });

      const activeAtMonth = monthClients.filter(c => {
        if (c.subscription.status !== 'active') {
          const churnMonth = c.churn.date 
            ? Math.floor((new Date(c.churn.date) - new Date(c.subscription.startDate)) / (1000 * 60 * 60 * 24 * 30))
            : null;
          return churnMonth === null || churnMonth > month;
        }
        return true;
      }).length;

      const retentionRate = cohortClients.length > 0
        ? (activeAtMonth / cohortClients.length) * 100
        : 0;

      retentionCurve.push({
        month,
        clients: activeAtMonth,
        retentionRate: Math.round(retentionRate * 100) / 100
      });
    }

    return {
      cohort: cohortKey || 'all',
      totalClients: cohortClients.length,
      retentionCurve
    };
  } catch (error) {
    logger.error('Error generating retention curve', { error: error.message, agencyWorkspaceId });
    throw error;
  }
}

module.exports = {
  analyzeCohorts,
  generateRetentionCurve
};


