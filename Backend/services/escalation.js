const cron = require('node-cron');

let escalationPolicies = [];
let activeEscalations = [];
let escalationAnalytics = [];

function createPolicy(policyData) {
  const policy = {
    id: Date.now().toString(),
    name: policyData.name,
    rules: policyData.rules || [],
    createdAt: new Date().toISOString()
  };
  escalationPolicies.push(policy);
  return policy;
}

function getPolicies() {
  return escalationPolicies;
}

function triggerEscalation(policyId, alert) {
  const policy = escalationPolicies.find(p => p.id === policyId);
  if (!policy) {
    throw new Error('Policy not found');
  }

  const escalation = {
    id: Date.now().toString(),
    policyId,
    alert,
    status: 'triggered',
    currentStep: 0,
    createdAt: new Date().toISOString()
  };

  activeEscalations.push(escalation);
  processEscalationStep(escalation);
  
  return escalation;
}

function processEscalationStep(escalation) {
  const policy = escalationPolicies.find(p => p.id === escalation.policyId);
  if (!policy || escalation.currentStep >= policy.rules.length) {
    escalation.status = 'completed';
    return;
  }

  const step = policy.rules[escalation.currentStep];
  escalation.status = `escalating_to_${step.target}`;
  escalation.currentStepStartedAt = new Date().toISOString();

  if (step.delay) {
    setTimeout(() => {
      if (escalation.status !== 'acknowledged' && escalation.status !== 'resolved') {
        escalation.currentStep++;
        processEscalationStep(escalation);
      }
    }, step.delay * 1000);
  }

  const analyticsEntry = {
    escalationId: escalation.id,
    step: escalation.currentStep,
    target: step.target,
    timestamp: new Date().toISOString()
  };
  escalationAnalytics.push(analyticsEntry);
}

function acknowledgeEscalation(escalationId, acknowledger) {
  const escalation = activeEscalations.find(e => e.id === escalationId);
  if (!escalation) {
    throw new Error('Escalation not found');
  }

  escalation.status = 'acknowledged';
  escalation.acknowledger = acknowledger;
  escalation.acknowledgedAt = new Date().toISOString();
  
  return escalation;
}

function resolveEscalation(escalationId) {
  const escalation = activeEscalations.find(e => e.id === escalationId);
  if (!escalation) {
    throw new Error('Escalation not found');
  }

  escalation.status = 'resolved';
  escalation.resolvedAt = new Date().toISOString();
  
  return escalation;
}

function getActiveEscalations() {
  return activeEscalations;
}

function getEscalationAnalytics() {
  return escalationAnalytics;
}

module.exports = {
  createPolicy,
  getPolicies,
  triggerEscalation,
  acknowledgeEscalation,
  resolveEscalation,
  getActiveEscalations,
  getEscalationAnalytics
};
