const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const superadmin = require('../middleware/superadmin');
const PlatformSettings = require('../models/PlatformSettings');
const { successResponse, errorResponse, validationErrorResponse } = require('../utils/responseHelper');

// Get platform settings
router.get('/', auth, superadmin, async (req, res) => {
    try {
        let settings = await PlatformSettings.findOne();
        
        if (!settings) {
            // Create default settings if none exist
            settings = new PlatformSettings();
            await settings.save();
        }

        return successResponse(res, settings, 'Platform settings retrieved successfully');

    } catch (err) {
        console.error('Get platform settings error:', err);
        return errorResponse(res, err, 'Server Error');
    }
});

// Update platform settings
router.put('/', auth, superadmin, async (req, res) => {
    try {
        let settings = await PlatformSettings.findOne();
        
        if (!settings) {
            settings = new PlatformSettings();
        }

        // Update all provided fields
        const allowedFields = [
            'platformName', 'platformDescription', 'contactEmail', 'supportEmail',
            'defaultEntriesPerUser', 'maxEntriesPerUser', 'entriesPerShirt', 
            'entriesPerHoodie', 'entriesPerCap', 'minPurchaseAmount', 'maxPurchaseAmount',
            'wheelSpinDuration', 'autoSpinEnabled', 'autoSpinInterval', 'maintenanceMode',
            'defaultPrize', 'prizeDescription', 'maxPrizeValue',
            'emailNotifications', 'smsNotifications', 'pushNotifications', 
            'winnerNotifications', 'purchaseNotifications', 'newUserNotifications',
            'requireEmailVerification', 'allowMultipleAccounts', 'maxLoginAttempts', 'sessionTimeout',
            'shopifyEnabled', 'shopifyStoreUrl', 'shopifyApiKey', 'shopifyWebhookSecret',
            'facebookUrl', 'instagramUrl', 'twitterUrl',
            'termsOfService', 'privacyPolicy', 'refundPolicy'
        ];

        allowedFields.forEach(field => {
            if (req.body[field] !== undefined) {
                settings[field] = req.body[field];
            }
        });

        settings.updatedBy = req.user.id;
        await settings.save();

        return successResponse(res, settings, 'Platform settings updated successfully');

    } catch (err) {
        console.error('Update platform settings error:', err);
        return errorResponse(res, err, 'Server Error');
    }
});

// Get specific setting by key
router.get('/:key', auth, superadmin, async (req, res) => {
    try {
        const { key } = req.params;
        
        let settings = await PlatformSettings.findOne();
        
        if (!settings) {
            settings = new PlatformSettings();
            await settings.save();
        }

        if (!settings[key]) {
            return errorResponse(res, 'Setting not found', 'Not Found', 404);
        }

        return successResponse(res, { key, value: settings[key] }, 'Setting retrieved successfully');

    } catch (err) {
        console.error('Get setting error:', err);
        return errorResponse(res, err, 'Server Error');
    }
});

// Update specific setting by key
router.patch('/:key', auth, superadmin, async (req, res) => {
    try {
        const { key } = req.params;
        const { value } = req.body;
        
        let settings = await PlatformSettings.findOne();
        
        if (!settings) {
            settings = new PlatformSettings();
        }

        // Validate that the key exists in the schema
        const allowedFields = [
            'platformName', 'platformDescription', 'contactEmail', 'supportEmail',
            'defaultEntriesPerUser', 'maxEntriesPerUser', 'entriesPerShirt', 
            'entriesPerHoodie', 'entriesPerCap', 'minPurchaseAmount', 'maxPurchaseAmount',
            'wheelSpinDuration', 'autoSpinEnabled', 'autoSpinInterval', 'maintenanceMode',
            'defaultPrize', 'prizeDescription', 'maxPrizeValue',
            'emailNotifications', 'smsNotifications', 'pushNotifications', 
            'winnerNotifications', 'purchaseNotifications', 'newUserNotifications',
            'requireEmailVerification', 'allowMultipleAccounts', 'maxLoginAttempts', 'sessionTimeout',
            'shopifyEnabled', 'shopifyStoreUrl', 'shopifyApiKey', 'shopifyWebhookSecret',
            'facebookUrl', 'instagramUrl', 'twitterUrl',
            'termsOfService', 'privacyPolicy', 'refundPolicy'
        ];

        if (!allowedFields.includes(key)) {
            return errorResponse(res, 'Invalid setting key', 'Bad Request', 400);
        }

        settings[key] = value;
        settings.updatedBy = req.user.id;
        await settings.save();

        return successResponse(res, { key, value: settings[key] }, 'Setting updated successfully');

    } catch (err) {
        console.error('Update setting error:', err);
        return errorResponse(res, err, 'Server Error');
    }
});

// Reset settings to defaults
router.post('/reset', auth, superadmin, async (req, res) => {
    try {
        await PlatformSettings.deleteMany({});
        
        const defaultSettings = new PlatformSettings();
        defaultSettings.updatedBy = req.user.id;
        await defaultSettings.save();

        return successResponse(res, defaultSettings, 'Settings reset to defaults successfully');

    } catch (err) {
        console.error('Reset settings error:', err);
        return errorResponse(res, err, 'Server Error');
    }
});

module.exports = router;
