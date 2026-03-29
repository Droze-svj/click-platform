const loadBalancingService = require('../../server/services/loadBalancingService');
const axios = require('axios');
const logger = require('../../server/utils/logger');

// Mock dependencies
jest.mock('axios');
jest.mock('../../server/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

describe('Load Balancing Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Assuming serverInstances are healthy and load 0 by default when file starts.
    // They are modified in place when testing.
  });

  describe('Health Check', () => {
    it('should mark all servers as healthy on success', async () => {
      axios.get.mockResolvedValue({ status: 200, data: { load: 10 } });

      const results = await loadBalancingService.healthCheckServers();
      expect(results['server-1']).toBeDefined();
      expect(results['server-1'].healthy).toBe(true);
      expect(results['server-1'].load).toBe(10);
    });

    it('should mark servers as unhealthy on failure', async () => {
      axios.get.mockRejectedValue(new Error('Network error'));

      const results = await loadBalancingService.healthCheckServers();
      expect(results['server-1'].healthy).toBe(false);
      expect(results['server-1'].error).toBe('Network error');
    });
  });

  describe('Server Selection', () => {
    beforeEach(async () => {
      // Setup a mixed state
      axios.get.mockImplementation(async (url) => {
        if (url.includes('server-1')) throw new Error('Down');
        if (url.includes('server-2')) return { status: 200, data: { load: 50 } };
        if (url.includes('server-3')) return { status: 200, data: { load: 20 } };
        return { status: 200, data: { load: 0 } };
      });
      await loadBalancingService.healthCheckServers();
    });

    it('should select a server using round-robin', () => {
      const server = loadBalancingService.selectServerRoundRobin();
      expect(server).toBeDefined();
      expect(server.healthy).toBe(true);
      expect(['server-2', 'server-3']).toContain(server.id);
    });

    it('should select server with least load', () => {
      const server = loadBalancingService.selectServerLeastConnections();
      expect(server).toBeDefined();
      expect(server.id).toBe('server-3'); // Load is 20 vs 50
    });

    it('should select server with weighted round robin', () => {
      const server = loadBalancingService.selectServerWeighted();
      expect(server).toBeDefined();
      expect(server.healthy).toBe(true);
      expect(['server-2', 'server-3']).toContain(server.id);
    });
  });

  describe('Status and Autoscaling', () => {
    it('should provide correct load balancer status', async () => {
      axios.get.mockResolvedValue({ status: 200, data: { load: 30 } });
      await loadBalancingService.healthCheckServers();

      const status = loadBalancingService.getLoadBalancerStatus();
      expect(status.totalServers).toBeGreaterThan(0);
      expect(status.healthyServers).toBe(status.totalServers);
      expect(status.averageLoad).toBe(30);
    });

    it('should trigger scale up when load is high', async () => {
      axios.get.mockResolvedValue({ status: 200, data: { load: 90 } });
      await loadBalancingService.healthCheckServers();

      const scaleResult = await loadBalancingService.autoScale();
      expect(scaleResult.action).toBe('scale_up');
      expect(scaleResult.reason).toBe('High load');
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('scale'), expect.any(Object));
    });

    it('should trigger scale down when load is low and servers are plenty', async () => {
      axios.get.mockResolvedValue({ status: 200, data: { load: 10 } });
      await loadBalancingService.healthCheckServers();
      // Initially there are 3 servers, scaling down >2
      const scaleResult = await loadBalancingService.autoScale();
      expect(scaleResult.action).toBe('scale_down');
      expect(scaleResult.reason).toBe('Low load');
    });

    it('should return no_change when load is balanced', async () => {
      axios.get.mockResolvedValue({ status: 200, data: { load: 50 } });
      await loadBalancingService.healthCheckServers();

      const scaleResult = await loadBalancingService.autoScale();
      expect(scaleResult.action).toBe('no_change');
      expect(scaleResult.reason).toBe('Load balanced');
    });
  });
});
