const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mongoose = require('mongoose');
const { Sequelize } = require('sequelize');

const MIGRATIONS_DIR = path.join(__dirname, '../migrations');
const STATE_FILE = path.join(__dirname, '../data/migration-state.json');

class MigrationService {
  constructor() {
    this.migrations = new Map();
    this.activeMigration = null;
    this.sequelize = null;
    this._ensureDirs();
    this._loadState();
  }

  _ensureDirs() {
    fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
    fs.mkdirSync(MIGRATIONS_DIR, { recursive: true });
    if (!fs.existsSync(STATE_FILE)) {
      fs.writeFileSync(STATE_FILE, JSON.stringify({ applied: [], history: [] }, null, 2));
    }
  }

  _loadState() {
    try {
      const raw = fs.readFileSync(STATE_FILE, 'utf8');
      this.state = JSON.parse(raw);
    } catch {
      this.state = { applied: [], history: [] };
    }
  }

  _saveState() {
    fs.writeFileSync(STATE_FILE, JSON.stringify(this.state, null, 2));
  }

  _computeChecksum(content) {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  async connectDatabases() {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/gatedelay';
    if (mongoose.connection.readyState === 0) {
      try {
        await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 3000 });
      } catch {
        // SQLite-only migrations can proceed without MongoDB
      }
    }

    if (!this.sequelize) {
      this.sequelize = new Sequelize({
        dialect: 'sqlite',
        storage: path.join(__dirname, '../data/migrations.sqlite'),
        logging: false,
      });
      await this.sequelize.authenticate();
      await this.sequelize.query(`
        CREATE TABLE IF NOT EXISTS migration_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          checksum TEXT NOT NULL,
          applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          status TEXT NOT NULL
        )
      `);
    }
  }

  discoverScripts() {
    if (!fs.existsSync(MIGRATIONS_DIR)) return [];
    return fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.js'))
      .sort()
      .map((filename) => {
        const filePath = path.join(MIGRATIONS_DIR, filename);
        const content = fs.readFileSync(filePath, 'utf8');
        return {
          name: filename.replace('.js', ''),
          filename,
          path: filePath,
          checksum: this._computeChecksum(content),
          applied: this.state.applied.includes(filename.replace('.js', '')),
        };
      });
  }

  validateIntegrity(script) {
    const content = fs.readFileSync(script.path, 'utf8');
    const checksum = this._computeChecksum(content);
    if (checksum !== script.checksum) {
      throw new Error(`Integrity check failed for ${script.name}: checksum mismatch`);
    }
    const migration = require(script.path);
    if (typeof migration.up !== 'function') {
      throw new Error(`Migration ${script.name} missing up() function`);
    }
    return true;
  }

  getStatus() {
    const scripts = this.discoverScripts();
    return {
      active: this.activeMigration,
      total: scripts.length,
      applied: scripts.filter((s) => s.applied).length,
      pending: scripts.filter((s) => !s.applied).length,
      scripts,
      history: this.state.history.slice(-20),
    };
  }

  getProgress(migrationId) {
    const entry = this.migrations.get(migrationId);
    if (!entry) return null;
    return {
      id: migrationId,
      status: entry.status,
      progress: entry.progress,
      currentStep: entry.currentStep,
      totalSteps: entry.totalSteps,
      error: entry.error || null,
    };
  }

  async executeMigration(name) {
    if (this.activeMigration) {
      throw new Error(`Migration already in progress: ${this.activeMigration}`);
    }

    await this.connectDatabases();
    const scripts = this.discoverScripts();
    const script = scripts.find((s) => s.name === name);
    if (!script) throw new Error(`Migration not found: ${name}`);
    if (script.applied) throw new Error(`Migration already applied: ${name}`);

    this.validateIntegrity(script);

    const migrationId = `mig_${Date.now()}`;
    const migration = require(script.path);
    const steps = migration.steps || ['up'];
    const entry = {
      status: 'running',
      progress: 0,
      currentStep: 0,
      totalSteps: steps.length,
      name,
      rollbackFn: migration.down || null,
    };
    this.migrations.set(migrationId, entry);
    this.activeMigration = migrationId;

    try {
      const context = { mongoose, sequelize: this.sequelize };
      for (let i = 0; i < steps.length; i++) {
        entry.currentStep = i + 1;
        entry.progress = Math.round(((i + 1) / steps.length) * 100);
        await migration.up(context, steps[i]);
      }

      entry.status = 'completed';
      entry.progress = 100;
      this.state.applied.push(name);
      this.state.history.push({
        id: migrationId,
        name,
        status: 'completed',
        checksum: script.checksum,
        completedAt: new Date().toISOString(),
      });
      this._saveState();

      await this.sequelize.query(
        `INSERT INTO migration_log (name, checksum, status) VALUES (?, ?, ?)`,
        { replacements: [name, script.checksum, 'completed'] },
      );

      return this.getProgress(migrationId);
    } catch (err) {
      entry.status = 'failed';
      entry.error = err.message;
      this.state.history.push({
        id: migrationId,
        name,
        status: 'failed',
        error: err.message,
        failedAt: new Date().toISOString(),
      });
      this._saveState();
      await this.rollback(migrationId);
      throw err;
    } finally {
      this.activeMigration = null;
    }
  }

  async rollback(migrationId) {
    let entry = this.migrations.get(migrationId);
    if (!entry) {
      const hist = this.state.history.find((h) => h.id === migrationId);
      if (!hist) throw new Error(`Migration not found: ${migrationId}`);
      entry = { name: hist.name, rollbackFn: null };
    }

    const scriptPath = path.join(MIGRATIONS_DIR, `${entry.name}.js`);
    if (fs.existsSync(scriptPath)) {
      const migration = require(scriptPath);
      if (typeof migration.down === 'function') {
        await this.connectDatabases();
        const context = { mongoose, sequelize: this.sequelize };
        await migration.down(context);
      }
    }

    this.state.applied = this.state.applied.filter((n) => n !== entry.name);
    this.state.history.push({
      id: migrationId,
      name: entry.name,
      status: 'rolled_back',
      rolledBackAt: new Date().toISOString(),
    });
    this._saveState();

    if (this.migrations.has(migrationId)) {
      this.migrations.get(migrationId).status = 'rolled_back';
    }

    return { id: migrationId, status: 'rolled_back', name: entry.name };
  }

  async executeAll() {
    const pending = this.discoverScripts().filter((s) => !s.applied);
    const results = [];
    for (const script of pending) {
      results.push(await this.executeMigration(script.name));
    }
    return results;
  }
}

module.exports = new MigrationService();
