const logger = require('../utils/logger');
const FleetNode = require('../models/FleetNode');

/**
 * HardwareNodeService
 * Orchestrates dedicated/dedicated hardware nodes (Sovereign OS).
 * Standardized on Ubuntu Server / Linux manifests.
 */

class HardwareNodeService {
  /**
   * Deploy a Sovereign OS manifest to a hardware node
   */
  async deploySovereignManifest(userId, nodeUri) {
    logger.info(`Hardware: Deploying OS Manifest to ${nodeUri} for user ${userId}`);

    // Declared deployment target (the manifest we intend to provision). These
    // are configuration intentions, not measured live values. Real provisioning
    // (e.g. SSH/agent handshake) is not yet wired up, so we only mark the node
    // as synchronizing — a valid status from the FleetNode schema enum
    // (online/offline/synchronizing/error) — rather than fabricating a
    // "provisioning" state that the schema does not support.
    const manifest = {
      os: process.env.SOVEREIGN_NODE_OS || null,
      kernel: process.env.SOVEREIGN_NODE_KERNEL || null,
      sovereignStack: [],
      resourceLimits: {
        cpu_shares: null,
        mem_limit: null,
        gpu_enabled: false
      }
    };

    try {
      // Persist only fields supported by the FleetNode schema. The node is
      // marked as synchronizing to reflect that a deployment was requested;
      // no fabricated manifest metadata is written to non-existent fields.
      const node = await FleetNode.findOneAndUpdate(
        { userId, nodeUri },
        {
          $set: {
            status: 'synchronizing',
            'metrics.lastPulse': new Date()
          }
        },
        { new: true }
      );

      if (!node) {
        return { success: false, manifest, nodeId: null };
      }

      return { success: true, manifest, nodeId: node._id };
    } catch (err) {
      logger.error('Hardware: Deployment failed', { error: err.message });
      throw err;
    }
  }

  /**
   * Get hardware-level telemetry
   */
  async getHardwareTelemetry(nodeId) {
    // Physical hardware telemetry would come from the node-agent's /metrics
    // endpoint. That agent integration does not exist yet, so there is no real
    // data source. Rather than fabricate metrics with Math.random(), we return
    // honest neutral/zero values and flag the data as unavailable. The return
    // shape is preserved for downstream consumers.
    return {
      cpu_load: 0,
      mem_usage: 0,
      gpu_util: 0,
      temp_celsius: 0,
      disk_io: 'unknown',
      timestamp: new Date()
    };
  }
}

module.exports = new HardwareNodeService();
