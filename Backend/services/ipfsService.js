const pinataSDK = require('@pinata/sdk');
const { create } = require('ipfs-http-client');
const axios = require('axios');

/**
 * IPFS SERVICE
 * Handles file/data uploads, retrieval, and pinning using IPFS and Pinata
 */

// Initialize Pinata
const pinata = new pinataSDK(
  process.env.PINATA_API_KEY || 'your_pinata_key',
  process.env.PINATA_SECRET_API_KEY || 'your_pinata_secret'
);

// Initialize IPFS Client (optional, for local/custom nodes)
let ipfs;
try {
  ipfs = create(process.env.IPFS_NODE_URL || 'https://ipfs.infura.io:5001/api/v0');
} catch (error) {
  console.warn('IPFS Client failed to initialize:', error.message);
}

const DEFAULT_GATEWAY = process.env.IPFS_GATEWAY || 'https://gateway.pinata.cloud/ipfs/';

/**
 * Upload JSON data to IPFS
 * @param {object} data - Data to upload
 * @param {object} options - Metadata for Pinata
 * @returns {Promise<string>} IPFS Hash (CID)
 */
async function uploadJSON(data, options = {}) {
  console.log('Uploading JSON to IPFS...');
  try {
    const result = await pinata.pinJSONToIPFS(data, {
      pinataMetadata: {
        name: options.name || 'GateDelay-Data-' + Date.now(),
        ...options.metadata
      }
    });
    return result.IpfsHash;
  } catch (error) {
    console.error('IPFS JSON Upload Error:', error.message);
    throw error;
  }
}

/**
 * Upload File/Buffer to IPFS
 * @param {Buffer|ReadableStream} fileStream - File content
 * @param {string} fileName - Name for the file
 * @returns {Promise<string>} IPFS Hash (CID)
 */
async function uploadFile(fileStream, fileName) {
  console.log(`Uploading file ${fileName} to IPFS...`);
  try {
    const result = await pinata.pinFileToIPFS(fileStream, {
      pinataMetadata: {
        name: fileName || 'GateDelay-File-' + Date.now()
      }
    });
    return result.IpfsHash;
  } catch (error) {
    console.error('IPFS File Upload Error:', error.message);
    throw error;
  }
}

/**
 * Retrieve data from IPFS by hash
 * @param {string} hash - IPFS CID
 * @returns {Promise<any>} Parsed data or raw content
 */
async function retrieve(hash) {
  console.log(`Retrieving data for hash: ${hash}...`);
  try {
    const response = await axios.get(`${DEFAULT_GATEWAY}${hash}`);
    return response.data;
  } catch (error) {
    console.error('IPFS Retrieval Error:', error.message);
    throw new Error(`Failed to retrieve data from IPFS: ${error.message}`);
  }
}

/**
 * Pin an existing IPFS hash to Pinata
 * @param {string} hash - IPFS CID
 * @param {string} name - Optional name for the pin
 * @returns {Promise<boolean>}
 */
async function pinHash(hash, name) {
  console.log(`Pinning hash ${hash} to Pinata...`);
  try {
    await pinata.pinByHash(hash, {
      pinataMetadata: {
        name: name || 'Pinned-Hash-' + Date.now()
      }
    });
    return true;
  } catch (error) {
    console.error('IPFS Pinning Error:', error.message);
    throw error;
  }
}

/**
 * Get IPFS Gateway URL for a hash
 * @param {string} hash - IPFS CID
 * @returns {string} Full Gateway URL
 */
function getGatewayUrl(hash) {
  return `${DEFAULT_GATEWAY}${hash}`;
}

module.exports = {
  uploadJSON,
  uploadFile,
  retrieve,
  pinHash,
  getGatewayUrl
};
