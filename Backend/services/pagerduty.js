const axios = require('axios');
const config = require('../config/pagerduty');

let alertResponses = [];
let onCallSchedules = [];

const pagerDutyApi = axios.create({
  baseURL: config.apiUrl,
  headers: {
    'Authorization': `Token token=${config.apiKey}`,
    'Accept': 'application/vnd.pagerduty+json;version=2',
    'Content-Type': 'application/json'
  }
});

async function sendIncidentAlert(alert) {
  try {
    const response = await pagerDutyApi.post('/incidents', {
      incident: {
        type: 'incident',
        title: alert.title || alert.message,
        service: {
          id: config.serviceId,
          type: 'service_reference'
        },
        urgency: alert.priority === 'high' ? 'high' : 'low',
        body: {
          type: 'incident_body',
          details: JSON.stringify(alert.metadata || {})
        }
      }
    }, {
      headers: {
        'From': config.fromEmail
      }
    });

    const entry = {
      id: Date.now().toString(),
      incidentId: response.data.incident.id,
      alert,
      status: 'triggered',
      timestamp: new Date().toISOString()
    };
    alertResponses.push(entry);

    return entry;
  } catch (error) {
    console.error('PagerDuty alert failed:', error.response?.data || error.message);
    throw error;
  }
}

async function acknowledgeIncident(incidentId, acknowledger) {
  try {
    await pagerDutyApi.put(`/incidents/${incidentId}`, {
      incident: {
        type: 'incident_reference',
        status: 'acknowledged'
      }
    }, {
      headers: {
        'From': config.fromEmail
      }
    });

    const entry = alertResponses.find(a => a.incidentId === incidentId);
    if (entry) {
      entry.status = 'acknowledged';
      entry.acknowledger = acknowledger;
      entry.acknowledgedAt = new Date().toISOString();
    }

    return { success: true, incidentId };
  } catch (error) {
    console.error('PagerDuty acknowledge failed:', error.response?.data || error.message);
    throw error;
  }
}

async function resolveIncident(incidentId) {
  try {
    await pagerDutyApi.put(`/incidents/${incidentId}`, {
      incident: {
        type: 'incident_reference',
        status: 'resolved'
      }
    }, {
      headers: {
        'From': config.fromEmail
      }
    });

    const entry = alertResponses.find(a => a.incidentId === incidentId);
    if (entry) {
      entry.status = 'resolved';
      entry.resolvedAt = new Date().toISOString();
    }

    return { success: true, incidentId };
  } catch (error) {
    console.error('PagerDuty resolve failed:', error.response?.data || error.message);
    throw error;
  }
}

async function syncOnCallSchedules() {
  try {
    const response = await pagerDutyApi.get('/oncalls');
    onCallSchedules = response.data.oncalls;
    return onCallSchedules;
  } catch (error) {
    console.error('PagerDuty sync schedules failed:', error.response?.data || error.message);
    throw error;
  }
}

function getAlertResponses() {
  return alertResponses;
}

function getOnCallSchedules() {
  return onCallSchedules;
}

module.exports = {
  sendIncidentAlert,
  acknowledgeIncident,
  resolveIncident,
  syncOnCallSchedules,
  getAlertResponses,
  getOnCallSchedules
};
