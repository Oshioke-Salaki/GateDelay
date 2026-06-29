const Papa = require('papaparse');
const async = require('async');
const Market = require('../models/Market'); // Assuming Market model exists
const Trade = require('../models/Trade'); // Assuming Trade model exists

class ImportService {
  /**
   * Validate import data format (CSV or JSON)
   * @param {Object} data - Import data to validate
   * @param {string} format - Expected format ('csv' or 'json')
   * @returns {Object} Validation result
   */
  validateImportData(data, format) {
    try {
      if (format === 'csv') {
        // For CSV, we expect it to be a string that can be parsed
        if (typeof data !== 'string') {
          return { valid: false, error: 'CSV data must be a string' };
        }
        
        const parsed = Papa.parse(data, { header: true });
        if (parsed.errors.length > 0) {
          return { valid: false, error: 'Invalid CSV format', details: parsed.errors };
        }
        
        // Check for required fields - adjust based on your market data structure
        const requiredFields = ['symbol', 'price', 'volume', 'timestamp'];
        const missingFields = requiredFields.filter(field => 
          !parsed.data[0] || !(field in parsed.data[0])
        );
        
        if (missingFields.length > 0) {
          return { valid: false, error: `Missing required fields: ${missingFields.join(', ')}` };
        }
        
        return { valid: true, data: parsed.data };
      } else if (format === 'json') {
        // For JSON, we expect an array of objects
        if (!Array.isArray(data)) {
          return { valid: false, error: 'JSON data must be an array' };
        }
        
        if (data.length === 0) {
          return { valid: true, data: [] };
        }
        
        // Check for required fields
        const requiredFields = ['symbol', 'price', 'volume', 'timestamp'];
        const missingFields = requiredFields.filter(field => 
          !data[0] || !(field in data[0])
        );
        
        if (missingFields.length > 0) {
          return { valid: false, error: `Missing required fields: ${missingFields.join(', ')}` };
        }
        
        return { valid: true, data };
      } else {
        return { valid: false, error: 'Unsupported format. Use csv or json.' };
      }
    } catch (error) {
      return { valid: false, error: `Validation error: ${error.message}` };
    }
  }

  /**
   * Process bulk imports with conflict resolution
   * @param {Array} data - Array of market data objects
   * @param {Object} options - Import options
   * @returns {Object} Import result
   */
  async processBulkImport(data, options = {}) {
    const { 
      updateExisting = true, 
      batchSize = 100,
      skipDuplicates = false
    } = options;
    
    const results = {
      total: data.length,
      imported: 0,
      updated: 0,
      skipped: 0,
      errors: []
    };
    
    try {
      // Process in batches to avoid overwhelming the database
      for (let i = 0; i < data.length; i += batchSize) {
        const batch = data.slice(i, i + batchSize);
        
        await async.eachLimit(batch, 5, async (item) => {
          try {
            const { symbol, price, volume, timestamp, ...rest } = item;
            
            // Validate required fields
            if (!symbol || !price || !volume || !timestamp) {
              results.errors.push({
                item: item,
                error: 'Missing required fields'
              });
              results.skipped++;
              return;
            }
            
            // Check if record already exists
            const existingMarket = await Market.findOne({ symbol });
            
            if (existingMarket) {
              if (skipDuplicates) {
                results.skipped++;
                return;
              }
              
              if (updateExisting) {
                // Update existing record
                existingMarket.price = price;
                existingMarket.volume = volume;
                existingMarket.timestamp = new Date(timestamp);
                existingMarket.updatedAt = new Date();
                
                // Update additional fields if provided
                Object.keys(rest).forEach(key => {
                  if (key in existingMarket) {
                    existingMarket[key] = rest[key];
                  }
                });
                
                await existingMarket.save();
                results.updated++;
              } else {
                results.skipped++;
              }
            } else {
              // Create new market record
                const market = new Market({
                  symbol,
                  price,
                  volume,
                  timestamp: new Date(timestamp),
                  ...rest
                });
                
                await market.save();
                results.imported++;
            }
          } catch (error) {
            results.errors.push({
              item: item,
              error: error.message
            });
            results.skipped++;
          }
        });
      }
      
      return {
        success: true,
        results
      };
    } catch (error) {
      return {
        success: false,
        error: `Bulk import failed: ${error.message}`,
        results
      };
    }
  }

  /**
   * Handle import conflicts based on strategy
   * @param {Array} newData - New data to import
   * @param {string} conflictResolution - Strategy ('overwrite', 'skip', 'merge')
   * @returns {Object} Conflict resolution result
   */
  async handleImportConflicts(newData, conflictResolution = 'overwrite') {
    const results = {
      conflicts: 0,
      resolved: 0,
      details: []
    };
    
    try {
      for (const item of newData) {
        const { symbol } = item;
        
        if (!symbol) continue;
        
        const existing = await Market.findOne({ symbol });
        
        if (existing) {
          results.conflicts++;
          
          let action = 'skipped';
          switch (conflictResolution) {
            case 'overwrite':
              // Update existing record
              Object.assign(existing, item);
              existing.updatedAt = new Date();
              await existing.save();
              action = 'overwritten';
              break;
            case 'skip':
              action = 'skipped';
              break;
            case 'merge':
              // Merge logic - keep existing values for unspecified fields
              Object.keys(item).forEach(key => {
                if (item[key] !== undefined && item[key] !== null) {
                  existing[key] = item[key];
                }
              });
              existing.updatedAt = new Date();
              await existing.save();
              action = 'merged';
              break;
          }
          
          results.resolved++;
          results.details.push({
            symbol,
            action,
            timestamp: new Date()
          });
        }
      }
      
      return {
        success: true,
        results
      };
    } catch (error) {
      return {
        success: false,
        error: `Conflict resolution failed: ${error.message}`,
        results
      };
    }
  }

  /**
   * Track import progress
   * @param {string} importId - Unique identifier for the import
   * @param {Object} progress - Progress information
   * @returns {Promise<void>}
   */
  async trackImportProgress(importId, progress) {
    // In a real implementation, this would store progress in a database or cache
    // For now, we'll just log it or use a simple in-memory store
    console.log(`Import ${importId} progress:`, progress);
    
    // You could store this in Redis or a database table for tracking
    // Example: await redis.hset(`import_progress:${importId}`, progress);
  }

  /**
   * Support incremental imports
   * @param {Array} newData - New data since last import
   * @param {Date} lastImportTime - Timestamp of last import
   * @returns {Object} Incremental import result
   */
  async processIncrementalImport(newData, lastImportTime) {
    try {
      // Filter data to only include records newer than last import
      const filteredData = newData.filter(item => {
        const itemTime = new Date(item.timestamp);
        return itemTime > lastImportTime;
      });
      
      if (filteredData.length === 0) {
        return {
          success: true,
          message: 'No new data to import',
          results: { total: 0, imported: 0, updated: 0, skipped: 0 }
        };
      }
      
      // Process the filtered data
      return await this.processBulkImport(filteredData, { updateExisting: true });
    } catch (error) {
      return {
        success: false,
        error: `Incremental import failed: ${error.message}`
      };
    }
  }
}

module.exports = new ImportService();