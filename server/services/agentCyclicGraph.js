/**
 * agentCyclicGraph.js
 * Native implementation of a LangGraph-style Cyclic State Machine for the Autonomous Agent.
 * Replaces linear pipelines with a true self-correcting Editor -> Critic -> Revision loop.
 */

const { generateContent } = require('../utils/googleAI');

// The shared state container passed between agents
class AgentState {
  constructor(initialData) {
    this.context = initialData.context || '';
    this.timelineJSON = null; // The generated product
    this.criticFeedback = [];
    this.score = 0;
    this.iterations = 0;
    this.maxIterations = 3;
    this.history = []; // Conversation/Execution history
  }
}

/**
 * The Editor Agent constructs the initial Timeline JSON.
 */
async function editorAgent(state) {
  
  state.history.push({ agent: 'Editor', action: 'Drafting initial timeline' });

  // Simulated or AI-Generated initial JSON
  const prompt = `Act as an expert video editor. Construct a JSON timeline for this video context: ${state.context}. Return ONLY valid JSON structured as { "clips": [], "duration": number }.`;

  let result;
  try {
    const aiResponse = await generateContent(prompt, { temperature: 0.5, maxTokens: 800 });
    // Parse out potential markdown blocks
    const cleanJSON = aiResponse ? aiResponse.replace(/```json|```/g, '').trim() : null;
    result = JSON.parse(cleanJSON);
  } catch (err) {
    
    result = {
      duration: 60,
      clips: [{ id: "c1", startTime: 0, duration: 15, type: "hook" }]
    };
  }

  state.timelineJSON = result;
  return state;
}

/**
 * The Critic Agent acts like `PredictionEngineView.tsx`, identifying retention drops.
 */
async function criticAgent(state) {
  

  // Logic to calculate retention drops / pacing errors
  let defects = [];
  let score = 100;

  if (!state.timelineJSON || !state.timelineJSON.clips || state.timelineJSON.clips.length < 3) {
    defects.push("Timeline has too few cuts. Pacing is too slow (retention drop likely). Include at least 3 clips.");
    score -= 30;
  }

  if (state.timelineJSON && state.timelineJSON.clips) {
    const hasHook = state.timelineJSON.clips.some(c => c.type === 'hook' || c.duration <= 5);
    if (!hasHook) {
      defects.push("Missing a rapid $<5s hook at the beginning.");
      score -= 20;
    }
  }

  // Simulate AI Critic (e.g. LLM looking for poor narrative structure)
  if (state.iterations === 0 && score === 100) {
    // Force an artificial AI critique on first pass for demonstration of the cyclic loop
    defects.push("Audio pacing feels flat in the mid-section. Add b-roll overlays to bridge clips 1 and 2.");
    score -= 15;
  }

  state.criticFeedback = defects;
  state.score = score;
  state.history.push({ agent: 'Critic', score, defects });
  return state;
}

/**
 * The Revision Agent applies Critic feedback to the Timeline JSON.
 */
async function revisionAgent(state) {
  
  state.history.push({ agent: 'Revision', action: `Revising based on ${state.criticFeedback.length} defects` });

  const prompt = `Act as an expert video editor. Revise this timeline: ${JSON.stringify(state.timelineJSON)}.
  Critique to fix: ${state.criticFeedback.join('; ')}.
  Return ONLY the updated valid JSON.`;

  try {
    const aiResponse = await generateContent(prompt, { temperature: 0.4, maxTokens: 800 });
    const cleanJSON = aiResponse ? aiResponse.replace(/```json|```/g, '').trim() : null;
    state.timelineJSON = JSON.parse(cleanJSON);
  } catch (err) {
    
    // Programmatic fallback
    if (state.criticFeedback.some(d => d.includes('too few cuts'))) {
      state.timelineJSON.clips.push({ id: `c-added-${Date.now()}`, startTime: 15, duration: 5, type: 'b-roll' });
      state.timelineJSON.clips.push({ id: `c-added-2-${Date.now()}`, startTime: 20, duration: 10, type: 'content' });
    }
    if (state.criticFeedback.some(d => d.includes('Missing a rapid'))) {
      state.timelineJSON.clips.unshift({ id: `hook-${Date.now()}`, startTime: 0, duration: 3, type: 'hook' });
    }
  }

  return state;
}

/**
 * Executor routing logic connecting the Agents into a cyclic graph.
 */
async function runSelfReflectiveLoop(initialContext) {
  
  const state = new AgentState({ context: initialContext });

  // 1. Initial Draft
  await editorAgent(state);

  // 2. Cyclic Loop
  while (state.iterations < state.maxIterations) {
    await criticAgent(state);

    if (state.score >= 90) {
      
      break;
    }

    
    await revisionAgent(state);
    state.iterations++;
  }

  if (state.score < 90) {
    
  }

  return {
    finalTimeline: state.timelineJSON,
    finalScore: state.score,
    totalIterations: state.iterations,
    history: state.history,
  };
}

module.exports = {
  AgentState,
  runSelfReflectiveLoop,
};
