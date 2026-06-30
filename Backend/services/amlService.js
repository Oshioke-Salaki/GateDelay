class AMLService {
  constructor(db, amlProvider) {
    this.db = db;
    this.provider = amlProvider; // Third-party AML API
    this.screeningCache = new Map();
  }

  async screenUser(userId, userDetails) {
    const cacheKey = `aml_${userId}`;
    
    if (this.screeningCache.has(cacheKey)) {
      const cached = this.screeningCache.get(cacheKey);
      if (Date.now() - cached.timestamp < 3600000) { // 1 hour cache
        return cached.result;
      }
    }

    try {
      const screeningResult = await this.provider.screen({
        name: userDetails.name,
        email: userDetails.email,
        country: userDetails.country
      });

      const result = {
        userId,
        screeningId: screeningResult.id,
        status: screeningResult.status,
        risk_level: screeningResult.risk_level,
        matches: screeningResult.matches || [],
        timestamp: new Date(),
        flagged: screeningResult.risk_level !== 'low'
      };

      this.screeningCache.set(cacheKey, { result, timestamp: Date.now() });
      await this.db.insert('aml_screenings', result);

      return result;
    } catch (error) {
      console.error('AML screening failed:', error);
      throw new Error('Failed to perform AML screening');
    }
  }

  async flagSuspiciousActivity(userId, activity) {
    const flag = {
      userId,
      activityType: activity.type,
      description: activity.description,
      severity: activity.severity || 'medium',
      timestamp: new Date(),
      status: 'open'
    };

    await this.db.insert('aml_flags', flag);
    return flag;
  }

  async generateScreeningReport(userId, startDate, endDate) {
    const screenings = await this.db.query(
      'SELECT * FROM aml_screenings WHERE userId = ? AND timestamp BETWEEN ? AND ?',
      [userId, startDate, endDate]
    );

    const flags = await this.db.query(
      'SELECT * FROM aml_flags WHERE userId = ? AND timestamp BETWEEN ? AND ?',
      [userId, startDate, endDate]
    );

    return {
      userId,
      period: { startDate, endDate },
      totalScreenings: screenings.length,
      screeningsWithMatches: screenings.filter(s => s.matches.length > 0).length,
      flaggedActivities: flags,
      riskAssessment: this.calculateRiskScore(screenings, flags),
      generatedAt: new Date()
    };
  }

  calculateRiskScore(screenings, flags) {
    let score = 0;
    screenings.forEach(s => {
      if (s.risk_level === 'high') score += 40;
      if (s.risk_level === 'medium') score += 20;
    });
    flags.forEach(f => {
      if (f.severity === 'high') score += 30;
      if (f.severity === 'medium') score += 15;
    });
    return Math.min(score, 100);
  }

  async submitFilings(userId) {
    const screenings = await this.db.query(
      'SELECT * FROM aml_screenings WHERE userId = ?',
      [userId]
    );

    const filing = {
      userId,
      screenings: screenings.length,
      submittedAt: new Date(),
      status: 'pending',
      referenceId: `FILING_${Date.now()}`
    };

    await this.db.insert('regulatory_filings', filing);
    return filing;
  }
}

module.exports = AMLService;
