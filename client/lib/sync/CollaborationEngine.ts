export interface Delta {
  userId: string;
  action: 'trim' | 'move' | 'effect';
  payload: any;
  timestamp: number;
}

export class CollaborationEngine {
  private socket: WebSocket | null = null;
  private presence = new Map<string, { x: number, y: number }>();

  constructor(private projectId: string) {}

  connect(url: string) {
    this.socket = new WebSocket(`${url}?project=${this.projectId}`);
    this.socket.onmessage = (event) => this.handleRemoteDelta(JSON.parse(event.data));
  }

  // Broadcasts your move to the "Swarm"
  broadcastAction(action: Delta['action'], payload: any) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ action, payload, timestamp: Date.now() }));
    }
  }

  private handleRemoteDelta(delta: Delta) {
    console.log(`[Swarm] Remote action from ${delta.userId}:`, delta.action);
    // Logic to update the local MemoryBridge without a full refresh
  }
}
