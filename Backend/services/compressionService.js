const zlib = require('zlib');
const snappy = require('snappy');
const Trade = require('../models/Trade'); // Assuming Trade model exists

class CompressionService {
  /**
   * Compress trade data for storage
   * @param {Object|Array} data - Trade data to compress
   * @param {string} algorithm - Compression algorithm ('gzip', 'deflate', 'snappy')
   * @returns {Promise<Object>} Compressed data and metadata
   */
  async compressTradeData(data, algorithm = 'gzip') {
    try {
      // Convert data to JSON string if it's not already a string
      const inputData = typeof data === 'string' ? data : JSON.stringify(data);
      const inputBuffer = Buffer.from(inputData);
      
      let compressedBuffer;
      let compressionRatio;
      
      switch (algorithm) {
        case 'gzip':
          compressedBuffer = await this._gzipCompress(inputBuffer);
          break;
        case 'deflate':
          compressedBuffer = await this._deflateCompress(inputBuffer);
          break;
        case 'snappy':
          compressedBuffer = await this._snappyCompress(inputBuffer);
          break;
        default:
          throw new Error(`Unsupported compression algorithm: ${algorithm}`);
      }
      
      compressionRatio = (1 - (compressedBuffer.length / inputBuffer.length)) * 100;
      
      return {
        success: true,
        data: compressedBuffer.toString('base64'), // Return as base64 string for easy storage/transmission
        algorithm,
        originalSize: inputBuffer.length,
        compressedSize: compressedBuffer.length,
        compressionRatio: parseFloat(compressionRatio.toFixed(2)),
        timestamp: new Date()
      };
    } catch (error) {
      return {
        success: false,
        error: `Compression failed: ${error.message}`
      };
    }
  }

  /**
   * Decompress data for queries
   * @param {string} compressedData - Base64 encoded compressed data
   * @param {string} algorithm - Compression algorithm used ('gzip', 'deflate', 'snappy')
   * @returns {Promise<Object>} Decompressed data
   */
  async decompressTradeData(compressedData, algorithm = 'gzip') {
    try {
      // Convert base64 string back to buffer
      const inputBuffer = Buffer.from(compressedData, 'base64');
      let decompressedBuffer;
      
      switch (algorithm) {
        case 'gzip':
          decompressedBuffer = await this._gzipDecompress(inputBuffer);
          break;
        case 'deflate':
          decompressedBuffer = await this._deflateDecompress(inputBuffer);
          break;
        case 'snappy':
          decompressedBuffer = await this._snappyDecompress(inputBuffer);
          break;
        default:
          throw new Error(`Unsupported compression algorithm: ${algorithm}`);
      }
      
      const decompressedData = decompressedBuffer.toString('utf8');
      
      // Try to parse as JSON, return as string if not valid JSON
      let parsedData;
      try {
        parsedData = JSON.parse(decompressedData);
      } catch (e) {
        parsedData = decompressedData; // Return as string if not valid JSON
      }
      
      return {
        success: true,
        data: parsedData,
        algorithm,
        decompressedSize: decompressedBuffer.length,
        timestamp: new Date()
      };
    } catch (error) {
      return {
        success: false,
        error: `Decompression failed: ${error.message}`
      };
    }
  }

  /**
   * Optimize storage efficiency by choosing best compression algorithm
   * @param {Object|Array} data - Trade data to analyze
   * @returns {Promise<Object>>} Compression analysis and recommendation
   */
  async analyzeCompressionEfficiency(data) {
    try {
      const inputData = typeof data === 'string' ? data : JSON.stringify(data);
      const inputBuffer = Buffer.from(inputData);
      
      // Test different compression algorithms
      const results = {};
      
      const algorithms = ['gzip', 'deflate', 'snappy'];
      for (const algorithm of algorithms) {
        try {
          let compressedBuffer;
          switch (algorithm) {
            case 'gzip':
              compressedBuffer = await this._gzipCompress(inputBuffer);
              break;
            case 'deflate':
              compressedBuffer = await this._deflateCompress(inputBuffer);
              break;
            case 'snappy':
              compressedBuffer = await this._snappyCompress(inputBuffer);
              break;
          }
          
          const compressionRatio = (1 - (compressedBuffer.length / inputBuffer.length)) * 100;
          results[algorithm] = {
            compressedSize: compressedBuffer.length,
            compressionRatio: parseFloat(compressionRatio.toFixed(2))
          };
        } catch (error) {
          results[algorithm] = {
            error: error.message
          };
        }
      }
      
      // Find the best compression ratio
      let bestAlgorithm = 'gzip';
      let bestRatio = 0;
      
      for (const [algorithm, result] of Object.entries(results)) {
        if (result.compressionRatio && result.compressionRatio > bestRatio) {
          bestRatio = result.compressionRatio;
          bestAlgorithm = algorithm;
        }
      }
      
      return {
        success: true,
        originalSize: inputBuffer.length,
        analysis: results,
        recommendation: {
          algorithm: bestAlgorithm,
          compressionRatio: bestRatio
        },
        timestamp: new Date()
      };
    } catch (error) {
      return {
        success: false,
        error: `Compression analysis failed: ${error.message}`
      };
    }
  }

  /**
   * Maintain data integrity verification
   * @param {Object|Array} originalData - Original trade data
   * @param {string} compressedData - Base64 encoded compressed data
   * @param {string} algorithm - Compression algorithm used
   * @returns {Promise<Object>>} Integrity check result
   */
  async verifyDataIntegrity(originalData, compressedData, algorithm = 'gzip') {
    try {
      // Decompress the data
      const decompressedResult = await this.decompressTradeData(compressedData, algorithm);
      if (!decompressedResult.success) {
        return decompressedResult;
      }
      
      // Convert original data to string for comparison
      const originalString = typeof originalData === 'string' 
        ? originalData 
        : JSON.stringify(originalData);
      
      const decompressedString = typeof decompressedResult.data === 'string'
        ? decompressedResult.data
        : JSON.stringify(decompressedResult.data);
      
      const isEqual = originalString === decompressedString;
      
      return {
        success: true,
        integrityVerified: isEqual,
        originalSize: Buffer.from(originalString).length,
        decompressedSize: Buffer.from(decompressedString).length,
        algorithm,
        timestamp: new Date()
      };
    } catch (error) {
      return {
        success: false,
        error: `Integrity verification failed: ${error.message}`
      };
    }
  }

  /**
   * Provide compression analytics
   * @param {Array} compressionHistory - History of compression operations
   * @returns {Object>} Compression analytics
   */
  getCompressionAnalytics(compressionHistory = []) {
    try {
      if (compressionHistory.length === 0) {
        return {
          success: true,
          analytics: {
            totalOperations: 0,
            averageCompressionRatio: 0,
            algorithmUsage: {},
            dataSizeStats: {
              min: 0,
              max: 0,
              average: 0
            }
          }
        };
      }
      
      const totalOperations = compressionHistory.length;
      const compressionRatios = compressionHistory
        .map(op => op.compressionRatio)
        .filter(ratio => typeof ratio === 'number');
      
      const averageCompressionRatio = compressionRatios.length > 0
        ? compressionRatios.reduce((a, b) => a + b, 0) / compressionRatios.length
        : 0;
      
      const algorithmUsage = {};
      compressionHistory.forEach(op => {
        const algo = op.algorithm || 'unknown';
        algorithmUsage[algo] = (algorithmUsage[algo] || 0) + 1;
      });
      
      const originalSizes = compressionHistory
        .map(op => op.originalSize)
        .filter(size => typeof size === 'number');
      
      const dataSizeStats = {
        min: originalSizes.length > 0 ? Math.min(...originalSizes) : 0,
        max: originalSizes.length > 0 ? Math.max(...originalSizes) : 0,
        average: originalSizes.length > 0 
          ? originalSizes.reduce((a, b) => a + b, 0) / originalSizes.length
          : 0
      };
      
      return {
        success: true,
        analytics: {
          totalOperations,
          averageCompressionRatio: parseFloat(averageCompressionRatio.toFixed(2)),
          algorithmUsage,
          dataSizeStats: {
            min: parseInt(dataSizeStats.min),
            max: parseInt(dataSizeStats.max),
            average: parseFloat(dataSizeStats.average.toFixed(2))
          },
          latestOperation: compressionHistory[compressionHistory.length - 1] || null
        },
        timestamp: new Date()
      };
    } catch (error) {
      return {
        success: false,
        error: `Analytics generation failed: ${error.message}`
      };
    }
  }

  // Private helper methods for compression algorithms
  _gzipCompress(buffer) {
    return new Promise((resolve, reject) => {
      zlib.gzip(buffer, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
  }

  _gzipDecompress(buffer) {
    return new Promise((resolve, reject) => {
      zlib.gunzip(buffer, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
  }

  _deflateCompress(buffer) {
    return new Promise((resolve, reject) => {
      zlib.deflate(buffer, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
  }

  _deflateDecompress(buffer) {
    return new Promise((resolve, reject) => {
      zlib.inflate(buffer, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
  }

  _snappyCompress(buffer) {
    return new Promise((resolve, reject) => {
      snappy.compress(buffer, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
  }

  _snappyDecompress(buffer) {
    return new Promise((resolve, reject) => {
      snappy.uncompress(buffer, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
  }
}

module.exports = new CompressionService();