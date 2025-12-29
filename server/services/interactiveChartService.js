// Interactive Chart Service
// Charts with drill-down capabilities

const logger = require('../utils/logger');

/**
 * Generate interactive chart data with drill-down
 */
async function generateInteractiveChart(metricType, clientWorkspaceId, period, chartType = 'line', drillDownLevel = 0) {
  try {
    // Base chart data
    const chartData = await getBaseChartData(metricType, clientWorkspaceId, period, chartType);

    // Add drill-down capabilities
    if (drillDownLevel === 0) {
      // Add drill-down points
      chartData.drillDown = await addDrillDownPoints(chartData, metricType, clientWorkspaceId, period);
    } else {
      // Get detailed data for drill-down
      chartData.detailed = await getDetailedData(metricType, clientWorkspaceId, period, drillDownLevel);
    }

    return chartData;
  } catch (error) {
    logger.error('Error generating interactive chart', { error: error.message, metricType });
    throw error;
  }
}

/**
 * Get base chart data
 */
async function getBaseChartData(metricType, clientWorkspaceId, period, chartType) {
  // Would query actual data
  // For now, return structure
  return {
    type: chartType,
    labels: [],
    datasets: [{
      label: metricType,
      data: [],
      backgroundColor: getChartColor(chartType),
      borderColor: getChartColor(chartType, true)
    }],
    options: {
      responsive: true,
      interaction: {
        intersect: false,
        mode: 'index'
      },
      plugins: {
        tooltip: {
          enabled: true
        },
        legend: {
          display: true
        }
      }
    }
  };
}

/**
 * Add drill-down points
 */
async function addDrillDownPoints(chartData, metricType, clientWorkspaceId, period) {
  const drillDownPoints = [];

  // Add drill-down capability to each data point
  chartData.datasets[0].data.forEach((value, index) => {
    drillDownPoints.push({
      index,
      label: chartData.labels[index],
      value,
      drillDownUrl: `/api/charts/${metricType}/drill-down?clientId=${clientWorkspaceId}&period=${period.startDate}&point=${index}`
    });
  });

  return drillDownPoints;
}

/**
 * Get detailed data for drill-down
 */
async function getDetailedData(metricType, clientWorkspaceId, period, level) {
  // Would get more granular data based on drill-down level
  return {
    level,
    data: [],
    canDrillDown: level < 3 // Max 3 levels
  };
}

/**
 * Get chart color
 */
function getChartColor(chartType, border = false) {
  const colors = {
    line: border ? '#3B82F6' : 'rgba(59, 130, 246, 0.1)',
    bar: border ? '#10B981' : 'rgba(16, 185, 129, 0.8)',
    pie: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'],
    area: border ? '#8B5CF6' : 'rgba(139, 92, 246, 0.2)'
  };

  return colors[chartType] || colors.line;
}

module.exports = {
  generateInteractiveChart
};


