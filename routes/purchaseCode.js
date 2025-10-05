const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const superadmin = require('../middleware/superadmin');
const User = require('../models/User');
const PurchaseCode = require('../models/PurchaseCode');
const WheelEntry = require('../models/WheelEntry');
const { successResponse, errorResponse, validationErrorResponse, notFoundResponse } = require('../utils/responseHelper');

/**
 * @swagger
 * /purchase-codes/verify:
 *   post:
 *     summary: Verify and use a purchase code
 *     tags: [Purchase Codes]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               code:
 *                 type: string
 *                 description: The purchase verification code
 *     responses:
 *       200:
 *         description: Code verified and entries awarded successfully
 *       400:
 *         description: Invalid code or already used
 *       404:
 *         description: Code not found
 */
router.post('/verify', auth, async (req, res) => {
    try {
        const { code } = req.body;
        
        if (!code || code.trim().length === 0) {
            return validationErrorResponse(res, 'Purchase code is required');
        }
        
        const trimmedCode = code.trim().toUpperCase();
        
        // Find the purchase code
        const purchaseCode = await PurchaseCode.findOne({ code: trimmedCode });
        
        if (!purchaseCode) {
            return notFoundResponse(res, 'Invalid purchase code');
        }
        
        // Check if code is already used
        if (purchaseCode.isUsed) {
            return errorResponse(res, 'This purchase code has already been used', 'Code already used', 400);
        }
        
        // Check if code is expired
        if (purchaseCode.expiresAt && purchaseCode.expiresAt < new Date()) {
            return errorResponse(res, 'This purchase code has expired', 'Code expired', 400);
        }
        
        // Get current user
        const user = await User.findById(req.user.id);
        if (!user) {
            return notFoundResponse(res, 'User not found');
        }
        
        // Mark code as used
        purchaseCode.isUsed = true;
        purchaseCode.usedBy = user._id;
        purchaseCode.usedDate = new Date();
        await purchaseCode.save();
        
        // Award entries to user
        const entriesAwarded = purchaseCode.entriesAwarded || 10;
        user.totalEntries += entriesAwarded;
        user.totalShirtsPurchased += 1;
        
        // Track code usage
        user.codesUsed.push({
            code: trimmedCode,
            usedDate: new Date(),
            entriesAwarded: entriesAwarded
        });
        user.totalCodesUsed += 1;
        user.totalBonusEntries += entriesAwarded;
        
        await user.save();
        
        // Create wheel entry record
        const wheelEntry = new WheelEntry({
            userId: user._id,
            userName: user.name,
            entryType: 'shirt_purchase',
            shirtQuantity: 1
        });
        await wheelEntry.save();
        
        return successResponse(res, {
            entriesAwarded,
            newTotalEntries: user.totalEntries,
            totalShirtsPurchased: user.totalShirtsPurchased,
            codeUsed: trimmedCode
        }, `Successfully verified! You received ${entriesAwarded} entries.`);
        
    } catch (err) {
        console.error('Verify purchase code error:', err);
        return errorResponse(res, err, 'Server Error');
    }
});

/**
 * @swagger
 * /purchase-codes/admin/codes:
 *   get:
 *     summary: Get all purchase codes (Admin only)
 *     tags: [Purchase Codes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Number of items per page
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [used, unused, all]
 *         description: Filter by usage status
 *     responses:
 *       200:
 *         description: Purchase codes retrieved successfully
 *       403:
 *         description: Admin access required
 */
router.get('/admin/codes', auth, superadmin, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        const status = req.query.status || 'all';
        
        // Build query based on status filter
        let query = {};
        if (status === 'used') {
            query.isUsed = true;
        } else if (status === 'unused') {
            query.isUsed = false;
        }
        
        const codes = await PurchaseCode.find(query)
            .populate('usedBy', 'name email instagramHandle')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);
        
        const totalCodes = await PurchaseCode.countDocuments(query);
        const usedCount = await PurchaseCode.countDocuments({ isUsed: true });
        const unusedCount = await PurchaseCode.countDocuments({ isUsed: false });
        
        return successResponse(res, {
            codes,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(totalCodes / limit),
                totalCodes,
                hasNext: page < Math.ceil(totalCodes / limit),
                hasPrev: page > 1
            },
            statistics: {
                total: await PurchaseCode.countDocuments(),
                used: usedCount,
                unused: unusedCount
            }
        }, 'Purchase codes retrieved successfully');
        
    } catch (err) {
        console.error('Get purchase codes error:', err);
        return errorResponse(res, err, 'Server Error');
    }
});

/**
 * @swagger
 * /purchase-codes/admin/generate:
 *   post:
 *     summary: Generate new purchase codes (Admin only)
 *     tags: [Purchase Codes]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               count:
 *                 type: integer
 *                 description: Number of codes to generate
 *               entriesPerCode:
 *                 type: integer
 *                 description: Number of entries each code awards
 *     responses:
 *       200:
 *         description: Codes generated successfully
 *       403:
 *         description: Admin access required
 */
router.post('/admin/generate', auth, superadmin, async (req, res) => {
    try {
        const { count = 50, entriesPerCode = 10 } = req.body;
        
        if (count < 1 || count > 1000) {
            return validationErrorResponse(res, 'Count must be between 1 and 1000');
        }
        
        const { generateUniqueCode } = require('../seeders/generatePurchaseCodes');
        const codes = [];
        
        for (let i = 0; i < count; i++) {
            const code = await generateUniqueCode();
            codes.push({
                code,
                isUsed: false,
                entriesAwarded: entriesPerCode
            });
        }
        
        await PurchaseCode.insertMany(codes);
        
        return successResponse(res, {
            generated: count,
            entriesPerCode,
            codes: codes.map(c => c.code)
        }, `Successfully generated ${count} new purchase codes`);
        
    } catch (err) {
        console.error('Generate purchase codes error:', err);
        return errorResponse(res, err, 'Server Error');
    }
});

/**
 * @swagger
 * /purchase-codes/admin/stats:
 *   get:
 *     summary: Get purchase code statistics (Admin only)
 *     tags: [Purchase Codes]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Statistics retrieved successfully
 *       403:
 *         description: Admin access required
 */
router.get('/admin/stats', auth, superadmin, async (req, res) => {
    try {
        const totalCodes = await PurchaseCode.countDocuments();
        const usedCodes = await PurchaseCode.countDocuments({ isUsed: true });
        const unusedCodes = totalCodes - usedCodes;
        const expiredCodes = await PurchaseCode.countDocuments({ 
            expiresAt: { $lt: new Date() } 
        });
        
        // Recent usage
        const recentUsage = await PurchaseCode.find({ isUsed: true })
            .populate('usedBy', 'name email instagramHandle')
            .sort({ usedDate: -1 })
            .limit(10);
        
        return successResponse(res, {
            statistics: {
                total: totalCodes,
                used: usedCodes,
                unused: unusedCodes,
                expired: expiredCodes,
                usageRate: totalCodes > 0 ? ((usedCodes / totalCodes) * 100).toFixed(1) : 0
            },
            recentUsage
        }, 'Purchase code statistics retrieved successfully');
        
    } catch (err) {
        console.error('Get purchase code stats error:', err);
        return errorResponse(res, err, 'Server Error');
    }
});

module.exports = router;