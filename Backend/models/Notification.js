const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, indexed: true },
    accountId: { type: String, default: null },
    type: { type: String, required: true },
    data: mongoose.Schema.Types.Mixed,
    channel: {
      type: String,
      enum: ['email', 'sms', 'webhook', 'in-app'],
      default: 'email',
    },
    read: { type: Boolean, default: false },
    sentAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

NotificationSchema.index({ userId: 1, read: 1 });

module.exports =
  mongoose.models.Notification ||
  mongoose.model('Notification', NotificationSchema);
