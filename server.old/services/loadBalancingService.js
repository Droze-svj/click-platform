// Load Balancing Service

const logger = require('../utils/logger');

// Server instances (in production, from service discovery)
const serverInstances = [
  { id: 'server-1', url: process.env.SERVER_1_URL || 'http://localhost:5000', healthy: true, load: 0 },
  { id: 'server-2', url: process.env.SERVER_2_URL || 'http://localhost:5001', healthy: true, load: 0 },
  { id: 'server-3', url: process.env.SERVER_3_URL || 'http://localhost:5002', healthy: true, load: 0 },
];

/**
 * Health check all servers
 */
async function healthCheckServers() {
  try {
    const axios = require('axios');
    const results = {};

    for (const server of serverInstances) {
      try {
        const response = await axios.get(`${server.url}/health`, {
          timeout: 5000,
        });

        server.healthy = response.status === 200;
        server.load = response.data?.load || 0;
        results[server.id] = {
          healthy: true,
          load: server.load,
        };
      } catch (error) {
        server.healthy = false;
        results[server.id] = {
          healthy: false,
          error: error.message,
        };
      }
    }

    return results;
  } catch (error) {
    logger.error('Health check servers error', { error: error.message });
    throw error;
  }
}

/**
 * Select server using round-robin
 */
function selectServerRoundRobin() {
  const healthyServers = serverInstances.filter(s => s.healthy);
  if (healthyServers.length === 0) {
    return null;
  }

  // Simple round-robin
  const index = Math.floor(Math.random() * healthyServers.length);
  return healthyServers[index];
}

/**
 * Select server using least connections
 */
function selectServerLeastConnections() {
  const healthyServers = serverInstances
    .filter(s => s.healthy)
    .sort((a, b) => a.load - b.load);

  if (healthyServers.length === 0) {
    return null;
  }

  return healthyServers[0];
}

/**
 * Select server using weighted round-robin
 */
function selectServerWeighted() {
  const healthyServers = serverInstances.filter(s => s.healthy);
  if (healthyServers.length === 0) {
    return null;
  }

  // Weight based on inverse load
  const weights = healthyServers.map(server => ({
    server,
    weight: 100 - server.load, // Higher weight for lower load
  }));

  const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0);
  let random = Math.random() * totalWeight;

  for (const item of weights) {
    random -= item.weight;
    if (random <= 0) {
      return item.server;
    }
  }

  return weights[0].server;
}

/**
 * Get load balancer status
 */
function getLoadBalancerStatus() {
  const healthy = serverInstances.filter(s => s.healthy).length;
  const total = serverInstances.length;
  const avgLoad = serverInstances.reduce((sum, s) => sum + s.load, 0) / total;

  return {
    totalServers: total,
    healthyServers: healthy,
    unhealthyServers: total - healthy,
    averageLoad: Math.round(avgLoad * 100) / 100,
    servers: serverInstances.map(s => ({
      id: s.id,
      healthy: s.healthy,
      load: s.load,
    })),
  };
}

/**
 * Auto-scale based on load
 */
async function autoScale() {
  try {
    const status = getLoadBalancerStatus();
    const avgLoad = status.averageLoad;

    // Scale up if average load > 80%
    if (avgLoad > 80 && status.healthyServers < 5) {
      logger.info('Auto-scaling: Adding server', { currentLoad: avgLoad });
      // In production, trigger server provisioning
      return { action: 'scale_up', reason: 'High load' };
    }

    // Scale down if average load < 30%
    if (avgLoad < 30 && status.healthyServers > 2) {
      logger.info('Auto-scaling: Removing server', { currentLoad: avgLoad });
      // In production, trigger server deprovisioning
      return { action: 'scale_down', reason: 'Low load' };
    }

    return { action: 'no_change', reason: 'Load balanced' };
  } catch (error) {
    logger.error('Auto-scale error', { error: error.message });
    throw error;
  }
}

module.exports = {
  healthCheckServers,
  selectServerRoundRobin,
  selectServerLeastConnections,
  selectServerWeighted,
  getLoadBalancerStatus,
  autoScale,
};






