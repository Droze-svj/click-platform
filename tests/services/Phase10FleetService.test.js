const phase10FleetService = require('../../server/services/Phase10FleetService');
const loggingService = require('../../server/services/loggingService');

// Mock dependencies
jest.mock('../../server/services/loggingService', () => ({
  logInfo: jest.fn(),
  logError: jest.fn(),
}));

describe('Phase 10 Fleet Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset internal state
    phase10FleetService.activeNodes.clear();
  });

  it('should provision a new node', () => {
    const niche = 'tech-finance';
    const manifest = phase10FleetService.provisionNode(niche);

    expect(manifest).toHaveProperty('nodeId');
    expect(manifest.nodeId).toMatch(/^node_/);
    expect(manifest.niche).toBe(niche);
    expect(manifest.status).toBe('LIVE_DARK_POST');
    expect(manifest.insulation).toHaveProperty('ip');
    expect(manifest.insulation).toHaveProperty('deviceFingerprint');
    expect(manifest.insulation.behavioralDelayMs).toBeGreaterThan(0);

    expect(loggingService.logInfo).toHaveBeenCalledWith(
      expect.stringContaining(`Node ${manifest.nodeId} provisioned for ${niche}`)
    );
  });

  it('should get fleet status correctly', () => {
    phase10FleetService.provisionNode('niche1');
    phase10FleetService.provisionNode('niche2');
    phase10FleetService.provisionNode('niche3');

    const status = phase10FleetService.getFleetStatus();

    expect(status.totalNodes).toBe(3);
    expect(status.statuses).toHaveProperty('LIVE_DARK_POST', 3);
    expect(status.activeNodes.length).toBe(3);
  });

  it('should initiate a swarm attack', () => {
    const niche = 'crypto-trading';
    const swarmResult = phase10FleetService.initiateSwarmAttack(niche);

    expect(swarmResult).toHaveProperty('missionId');
    expect(swarmResult.missionId).toMatch(/^swarm_/);
    expect(swarmResult.status).toBe('EXECUTING');
    expect(swarmResult.nodesDeployed).toBe(10);
    expect(swarmResult.nodes.length).toBe(10);

    // Validate nodes are in fleet
    const fleetStatus = phase10FleetService.getFleetStatus();
    expect(fleetStatus.totalNodes).toBe(10);
    
    expect(loggingService.logInfo).toHaveBeenCalledWith(
      expect.stringContaining(`Fleet Commander: Initiating Swarm Attack on ${niche}`)
    );
  });
});
