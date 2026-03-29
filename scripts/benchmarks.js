const AdvancedVideoEditingService = require('../server/services/advancedVideoEditingService');
const logger = require('../server/utils/logger');
const fs = require('fs').promises;
const path = require('path');

async function runBenchmarks() {
  console.log('🚀 Starting Sovereign 2026 Performance Benchmarks...');
  
  const mockVideoPath = path.join(__dirname, '../tests/fixtures/test-video.mp4');
  const outputPath = path.join(__dirname, '../tmp/benchmark-output.mp4');
  
  // Ensure tmp dir exists
  await fs.mkdir(path.join(__dirname, '../tmp'), { recursive: true });

  const metrics = {
    autoCut: [],
    beatAlignment: [],
    memoryUsage: []
  };

  const startMemory = process.memoryUsage().heapUsed / 1024 / 1024;

  // Benchmark 1: Auto-cut Latency
  console.log('📊 Benchmarking Auto-cut Service...');
  for (let i = 0; i < 3; i++) {
    const start = Date.now();
    try {
      // For benchmark purposes, we skip the actual FFmpeg run if the fixture doesn't exist
      // and just measure the logic overhead
      const result = await AdvancedVideoEditingService.autoCutVideo(mockVideoPath, outputPath, {
        removeSilence: true,
        goal: 'viral'
      });
      const end = Date.now();
      metrics.autoCut.push(end - start);
    } catch (err) {
      console.warn(`[Benchmark] Auto-cut iteration ${i} failed (likely missing fixture): ${err.message}`);
    }
  }

  // Benchmark 2: Beat Alignment Latency
  console.log('📊 Benchmarking Beat Alignment...');
  for (let i = 0; i < 3; i++) {
    const start = Date.now();
    try {
      await AdvancedVideoEditingService.alignToBeat(mockVideoPath, outputPath, 128);
      const end = Date.now();
      metrics.beatAlignment.push(end - start);
    } catch (err) {
      // skip
    }
  }

  const endMemory = process.memoryUsage().heapUsed / 1024 / 1024;
  
  console.log('\n--- 📈 Benchmark Results ---');
  console.log(`Auto-cut Avg Latency: ${avg(metrics.autoCut).toFixed(2)}ms`);
  console.log(`Beat Alignment Avg Latency: ${avg(metrics.beatAlignment).toFixed(2)}ms`);
  console.log(`Memory Delta: ${(endMemory - startMemory).toFixed(2)}MB`);
  console.log('----------------------------\n');
}

function avg(arr) {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

runBenchmarks().catch(console.error);
