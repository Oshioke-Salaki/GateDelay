let runbooks = [];
let executions = [];
let analytics = [];

function createRunbook(data) {
  const runbook = {
    id: Date.now().toString(),
    title: data.title,
    description: data.description,
    steps: data.steps || [],
    tags: data.tags || [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  runbooks.push(runbook);
  return runbook;
}

function getRunbooks() {
  return runbooks;
}

function getRunbookById(id) {
  return runbooks.find(r => r.id === id);
}

function updateRunbook(id, data) {
  const index = runbooks.findIndex(r => r.id === id);
  if (index === -1) {
    throw new Error('Runbook not found');
  }
  runbooks[index] = {
    ...runbooks[index],
    ...data,
    updatedAt: new Date().toISOString()
  };
  return runbooks[index];
}

function deleteRunbook(id) {
  const index = runbooks.findIndex(r => r.id === id);
  if (index === -1) {
    throw new Error('Runbook not found');
  }
  runbooks.splice(index, 1);
  return { success: true };
}

function searchRunbooks(query) {
  return runbooks.filter(r => 
    r.title.toLowerCase().includes(query.toLowerCase()) ||
    r.description.toLowerCase().includes(query.toLowerCase()) ||
    r.tags.some(tag => tag.toLowerCase().includes(query.toLowerCase()))
  );
}

function executeRunbook(runbookId, executor) {
  const runbook = getRunbookById(runbookId);
  if (!runbook) {
    throw new Error('Runbook not found');
  }

  const execution = {
    id: Date.now().toString(),
    runbookId,
    executor,
    status: 'in_progress',
    startedAt: new Date().toISOString(),
    completedAt: null,
    stepResults: []
  };
  executions.push(execution);

  const analyticsEntry = {
    executionId: execution.id,
    runbookId,
    startedAt: execution.startedAt
  };
  analytics.push(analyticsEntry);

  return execution;
}

function completeExecution(executionId) {
  const index = executions.findIndex(e => e.id === executionId);
  if (index === -1) {
    throw new Error('Execution not found');
  }
  executions[index].status = 'completed';
  executions[index].completedAt = new Date().toISOString();

  const analyticsIndex = analytics.findIndex(a => a.executionId === executionId);
  if (analyticsIndex !== -1) {
    analytics[analyticsIndex].completedAt = executions[index].completedAt;
  }

  return executions[index];
}

function getExecutions() {
  return executions;
}

function getRunbookAnalytics() {
  return analytics;
}

module.exports = {
  createRunbook,
  getRunbooks,
  getRunbookById,
  updateRunbook,
  deleteRunbook,
  searchRunbooks,
  executeRunbook,
  completeExecution,
  getExecutions,
  getRunbookAnalytics
};
