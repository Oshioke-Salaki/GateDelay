const multer = require('multer');
const path = require('path');

/**
 * Threat Assumptions for KYCService
 * ===================================
 * 
 * This service handles sensitive Know Your Customer (KYC) data and documents.
 * The following threat assumptions must be considered:
 * 
 * 1. File Upload Threats
 *    - Assumption: File extension filtering (.pdf, .jpg, .jpeg, .png) prevents malicious uploads
 *    - Risk: File type spoofing, embedded malware, polyglot files
 *    - Mitigation: Current implementation uses extension filtering only (weak)
 *    - Recommendation: Add magic number validation, virus scanning, content sanitization
 * 
 * 2. File Size Threats
 *    - Assumption: 5MB file size limit prevents DoS attacks
 *    - Risk: Memory exhaustion, storage exhaustion, slow upload attacks
 *    - Mitigation: Current limit of 5MB with multer memory storage
 *    - Recommendation: Consider streaming to disk for large files, add rate limiting
 * 
 * 3. Storage Provider Security
 *    - Assumption: Storage provider (S3, GCS, etc.) is secure and properly configured
 *    - Risk: Unauthorized access, data leakage, misconfigured buckets
 *    - Mitigation: Assumes provider implements proper ACLs, encryption at rest
 *    - Recommendation: Implement server-side encryption, signed URLs, access logging
 * 
 * 4. External KYC Provider Trust
 *    - Assumption: Registered KYC providers are trusted and secure
 *    - Risk: Provider compromise, data breach, API abuse
 *    - Mitigation: Provider verification via registration system
 *    - Recommendation: Add provider authentication, rate limiting, audit logging
 * 
 * 5. Database Security (PII)
 *    - Assumption: Database queries are safe from SQL injection
 *    - Risk: SQL injection via userId, docType, requestId parameters
 *    - Mitigation: Uses parameterized queries (assumed by db.query syntax)
 *    - Recommendation: Validate input types, implement query whitelisting
 * 
 * 6. Data Privacy & Compliance
 *    - Assumption: KYC data storage complies with GDPR, CCPA, AML regulations
 *    - Risk: Non-compliance, data retention violations, right to be forgotten
 *    - Mitigation: Not implemented in current code
 *    - Recommendation: Add data retention policies, encryption at rest, audit trails
 * 
 * 7. Document Tampering
 *    - Assumption: Uploaded documents are authentic and unaltered
 *    - Risk: Forged documents, photoshopped IDs deepfake content
 *    - Mitigation: Relies on external KYC provider verification
 *    - Recommendation: Add document integrity checks, metadata validation
 * 
 * 8. Authentication & Authorization
 *    - Assumption: Calling code has validated user identity and permissions
 *    - Risk: Unauthorized access to other users' KYC data
 *    - Mitigation: Not implemented in this service (assumes middleware layer)
 *    - Recommendation: Add user context validation, permission checks per operation
 * 
 * 9. Replay Attacks
 *    - Assumption: requestId uniqueness prevents duplicate submissions
 *    - Risk: Race conditions, duplicate verification requests
 *    - Mitigation: Timestamp-based requestId generation
 *    - Recommendation: Add request deduplication, idempotency keys
 * 
 * 10. Information Leakage
 *     - Assumption: Error messages don't expose sensitive information
 *     - Risk: Stack traces, internal paths, database schema exposure
 *     - Mitigation: Generic error messages in current implementation
 *     - Recommendation: Implement structured logging, sanitize error outputs
 * 
 * Phase 2+ Dependencies:
 * - Implement proper file content validation (magic numbers, virus scanning)
 * - Add comprehensive audit logging for all KYC operations
 * - Implement data retention and deletion workflows
 * - Add encryption at rest for sensitive PII data
 * - Implement rate limiting and abuse detection
 * - Add comprehensive input validation and sanitization
 */
class KYCService {
  constructor(db, storageProvider) {
    this.db = db;
    this.storage = storageProvider;
    this.providers = new Map();
    this.setupMulter();
  }

  setupMulter() {
    this.upload = multer({
      storage: multer.memoryStorage(),
      fileFilter: (req, file, cb) => {
        const allowed = /\.(pdf|jpg|jpeg|png)$/i;
        if (allowed.test(path.extname(file.originalname))) {
          cb(null, true);
        } else {
          cb(new Error('Invalid file type'));
        }
      },
      limits: { fileSize: 5 * 1024 * 1024 } // 5MB
    });
  }

  registerProvider(name, provider) {
    this.providers.set(name, provider);
  }

  async uploadDocument(userId, docType, file) {
    if (!file) throw new Error('No file provided');

    const fileName = `kyc_${userId}_${docType}_${Date.now()}`;
    const url = await this.storage.upload(file, fileName);

    const document = {
      userId,
      docType,
      fileName,
      url,
      uploadedAt: new Date(),
      status: 'pending'
    };

    await this.db.insert('kyc_documents', document);
    return document;
  }

  async createVerificationRequest(userId, docTypes, providerName) {
    const provider = this.providers.get(providerName);
    if (!provider) throw new Error('Unknown KYC provider');

    const documents = await this.db.query(
      'SELECT * FROM kyc_documents WHERE userId = ? AND docType IN (?)',
      [userId, docTypes]
    );

    if (documents.length === 0) throw new Error('No documents found');

    const request = {
      userId,
      requestId: `KYC_${Date.now()}`,
      provider: providerName,
      documents: documents.map(d => d.id),
      status: 'processing',
      createdAt: new Date()
    };

    await this.db.insert('kyc_requests', request);

    // Initiate provider verification
    await provider.verify({
      requestId: request.requestId,
      documents: documents.map(d => ({ type: d.docType, url: d.url }))
    });

    return request;
  }

  async trackVerificationStatus(requestId) {
    const request = await this.db.query(
      'SELECT * FROM kyc_requests WHERE requestId = ?',
      [requestId]
    );

    if (!request) throw new Error('Request not found');

    const provider = this.providers.get(request[0].provider);
    const providerStatus = await provider.getStatus(requestId);

    return {
      requestId,
      userId: request[0].userId,
      status: providerStatus.status,
      result: providerStatus.result,
      submittedAt: request[0].createdAt,
      updatedAt: new Date()
    };
  }

  async generateVerificationReport(userId) {
    const requests = await this.db.query(
      'SELECT * FROM kyc_requests WHERE userId = ? ORDER BY createdAt DESC',
      [userId]
    );

    const documents = await this.db.query(
      'SELECT * FROM kyc_documents WHERE userId = ? ORDER BY uploadedAt DESC',
      [userId]
    );

    return {
      userId,
      totalRequests: requests.length,
      approvedRequests: requests.filter(r => r.status === 'approved').length,
      rejectedRequests: requests.filter(r => r.status === 'rejected').length,
      pendingRequests: requests.filter(r => r.status === 'processing').length,
      documents: documents.map(d => ({
        type: d.docType,
        uploadedAt: d.uploadedAt,
        status: d.status
      })),
      lastVerificationDate: requests.length > 0 ? requests[0].createdAt : null,
      generatedAt: new Date()
    };
  }

  async updateDocumentStatus(documentId, status) {
    await this.db.update('kyc_documents', { id: documentId }, { status });
    return { documentId, status };
  }

  async supportedProviders() {
    return Array.from(this.providers.keys());
  }
}

module.exports = KYCService;
