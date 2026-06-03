class UserAdaptiveFeedbackService {
  constructor() {
    this.goals = new Map();
  }

  async setStrategicGoal(userId, goal) {
    this.goals.set(userId, goal);
    return true;
  }

  getStrategicGoal(userId) {
    return this.goals.get(userId) || 'viral';
  }
}

module.exports = new UserAdaptiveFeedbackService();
