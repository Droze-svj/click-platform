// Microservices Architecture Service

const logger = require('../utils/logger');
const axios = require('axios');

// Service registry
const serviceRegistry = {
  content: {
    url: process.env.CONTENT_SERVICE_URL || 'http://localhost:5002',
    healthy: true,
    lastCheck: null,
  },
  video: {
    url: process.env.VIDEO_SERVICE_URL || 'http://localhost:5003',
    healthy: true,
    lastCheck: null,
  },
  analytics: {
    url: process.env.ANALYTICS_SERVICE_URL || 'http://localhost:5004',
    healthy: true,
    lastCheck: null,
  },
  notification: {
    url: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:5005',
    healthy: true,
    lastCheck: null,
  },
};

/**
 * Call microservice
 */
async function callService(serviceName, endpoint, method = 'GET', data = null) {
  try {
    const service = serviceRegistry[serviceName];

    if (!service) {
      throw new Error(`Service ${serviceName} not found`);
    }

    if (!service.healthy) {
      throw new Error(`Service ${serviceName} is unhealthy`);
    }

    const url = `${service.url}${endpoint}`;
    const config = {
      method,
      url,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'X-Service-Name': 'click-main',
      },
    };

    if (data) {
      config.data = data;
    }

    const response = await axios(config);

    // Update service health
    service.lastCheck = new Date();
    service.healthy = true;

    return response.data;
  } catch (error) {
    // Mark service as unhealthy
    if (serviceRegistry[serviceName]) {
      serviceRegistry[serviceName].healthy = false;
      serviceRegistry[serviceName].lastCheck = new Date();
    }

    logger.error('Call microservice error', {
      error: error.message,
      serviceName,
      endpoint,
    });

    throw error;
  }
}

/**
 * Health check all services
 */
async function healthCheckServices() {
  try {
    const results = {};

    for (const [serviceName, service] of Object.entries(serviceRegistry)) {
      try {
        const response = await axios.get(`${service.url}/health`, {
          timeout: 5000,
        });

        service.healthy = response.status === 200;
        service.lastCheck = new Date();

        results[serviceName] = {
          healthy: service.healthy,
          status: response.status,
        };
      } catch (error) {
        service.healthy = false;
        service.lastCheck = new Date();

        results[serviceName] = {
          healthy: false,
          error: error.message,
        };
      }
    }

    return results;
  } catch (error) {
    logger.error('Health check services error', { error: error.message });
    throw error;
  }
}

/**
 * Register service
 */
function registerService(name, url) {
  serviceRegistry[name] = {
    url,
    healthy: true,
    lastCheck: new Date(),
  };

  logger.info('Service registered', { name, url });
}

/**
 * Get service status
 */
function getServiceStatus(serviceName) {
  const service = serviceRegistry[serviceName];
  if (!service) {
    return null;
  }

  return {
    name: serviceName,
    url: service.url,
    healthy: service.healthy,
    lastCheck: service.lastCheck,
  };
}

/**
 * Get all services status
 */
function getAllServicesStatus() {
  return Object.keys(serviceRegistry).map(name => getServiceStatus(name));
}

/**
 * Circuit breaker pattern
 */
class CircuitBreaker {
  constructor(serviceName, threshold = 5, timeout = 60000) {
    this.serviceName = serviceName;
    this.failureCount = 0;
    this.threshold = threshold;
    this.timeout = timeout;
    this.state = 'closed'; // closed, open, half-open
    this.nextAttempt = null;
  }

  async execute(fn) {
    if (this.state === 'open') {
      if (Date.now() < this.nextAttempt) {
        throw new Error(`Circuit breaker is open for ${this.serviceName}`);
      }
      this.state = 'half-open';
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  onSuccess() {
    this.failureCount = 0;
    this.state = 'closed';
  }

  onFailure() {
    this.failureCount++;
    if (this.failureCount >= this.threshold) {
      this.state = 'open';
      this.nextAttempt = Date.now() + this.timeout;
      logger.warn('Circuit breaker opened', {
        serviceName: this.serviceName,
        failureCount: this.failureCount,
      });
    }
  }
}

// Circuit breakers for each service
const circuitBreakers = {};

function getCircuitBreaker(serviceName) {
  if (!circuitBreakers[serviceName]) {
    circuitBreakers[serviceName] = new CircuitBreaker(serviceName);
  }
  return circuitBreakers[serviceName];
}

/**
 * Call service with circuit breaker
 */
async function callServiceWithCircuitBreaker(serviceName, endpoint, method = 'GET', data = null) {
  const breaker = getCircuitBreaker(serviceName);

  return breaker.execute(async () => {
    return await callService(serviceName, endpoint, method, data);
  });
}

module.exports = {
  callService,
  callServiceWithCircuitBreaker,
  healthCheckServices,
  registerService,
  getServiceStatus,
  getAllServicesStatus,
};






