const mongoose = require('mongoose');

const platformSettingsSchema = new mongoose.Schema({
  // Platform Information
  platformName: { type: String, default: 'The Wheel Decides' },
  platformDescription: { type: String, default: 'Spin to win amazing prizes!' },
  contactEmail: { type: String, default: '' },
  supportEmail: { type: String, default: '' },
  
  // Game Configuration
  defaultEntriesPerUser: { type: Number, default: 1 },
  maxEntriesPerUser: { type: Number, default: 1000 },
  entriesPerShirt: { type: Number, default: 10 },
  entriesPerHoodie: { type: Number, default: 20 },
  entriesPerCap: { type: Number, default: 5 },
  minPurchaseAmount: { type: Number, default: 0 },
  maxPurchaseAmount: { type: Number, default: 1000 },
  
  // Wheel Settings
  wheelSpinDuration: { type: Number, default: 5 },
  autoSpinEnabled: { type: Boolean, default: false },
  autoSpinInterval: { type: Number, default: 60 },
  maintenanceMode: { type: Boolean, default: false },
  
  // Prize Settings
  defaultPrize: { type: String, default: 'Mystery Prize' },
  prizeDescription: { type: String, default: 'Amazing prizes await!' },
  maxPrizeValue: { type: Number, default: 1000 },
  
  // Notification Settings
  emailNotifications: { type: Boolean, default: true },
  smsNotifications: { type: Boolean, default: false },
  pushNotifications: { type: Boolean, default: true },
  winnerNotifications: { type: Boolean, default: true },
  purchaseNotifications: { type: Boolean, default: true },
  newUserNotifications: { type: Boolean, default: true },
  
  // Security Settings
  requireEmailVerification: { type: Boolean, default: false },
  allowMultipleAccounts: { type: Boolean, default: true },
  maxLoginAttempts: { type: Number, default: 5 },
  sessionTimeout: { type: Number, default: 24 },
  
  // Integration Settings
  shopifyEnabled: { type: Boolean, default: false },
  shopifyStoreUrl: { type: String, default: '' },
  shopifyApiKey: { type: String, default: '' },
  shopifyWebhookSecret: { type: String, default: '' },
  
  // Social Media
  facebookUrl: { type: String, default: '' },
  instagramUrl: { type: String, default: '' },
  twitterUrl: { type: String, default: '' },
  
  // Legal
  termsOfService: { type: String, default: '' },
  privacyPolicy: { type: String, default: '' },
  refundPolicy: { type: String, default: '' },
  
  // Timestamps
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});

// Update the updatedAt field before saving
platformSettingsSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('PlatformSettings', platformSettingsSchema);
