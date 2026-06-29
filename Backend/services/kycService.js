const multer = require('multer');
const path = require('path');

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
