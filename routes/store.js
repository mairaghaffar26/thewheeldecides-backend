const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const superadmin = require('../middleware/superadmin');
const User = require('../models/User');
const Store = require('../models/Store');
const Purchase = require('../models/Purchase');
const WheelEntry = require('../models/WheelEntry');
const { successResponse, errorResponse, validationErrorResponse, notFoundResponse } = require('../utils/responseHelper');

/**
 * @swagger
 * /store/items:
 *   get:
 *     summary: Get all store items
 *     tags: [Store]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Store items retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get('/items', auth, async (req, res) => {
    try {
        const items = await Store.find({ active: true })
            .select('-__v')
            .sort({ createdAt: -1 });

        return successResponse(res, items, 'Store items retrieved successfully');

    } catch (err) {
        console.error('Get store items error:', err);
        return errorResponse(res, err, 'Server Error');
    }
});

/**
 * @swagger
 * /store/purchase:
 *   post:
 *     summary: Purchase items and earn wheel entries
 *     tags: [Store]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     itemId:
 *                       type: string
 *                     quantity:
 *                       type: number
 *               paymentMethod:
 *                 type: string
 *     responses:
 *       200:
 *         description: Purchase completed successfully
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 */
router.post('/purchase', auth, async (req, res) => {
    try {
        const { items, paymentMethod = 'cash' } = req.body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            return validationErrorResponse(res, 'Items array is required and cannot be empty');
        }

        // Get user
        const user = await User.findById(req.user.id);
        if (!user) {
            return notFoundResponse(res, 'User');
        }

        const purchaseItems = [];
        let totalAmount = 0;
        let totalEntriesEarned = 0;

        // Validate and process each item
        for (const item of items) {
            const { itemId, quantity } = item;

            if (!itemId || !quantity || quantity <= 0) {
                return validationErrorResponse(res, 'Invalid item data');
            }

            const storeItem = await Store.findById(itemId);
            if (!storeItem || !storeItem.active) {
                return notFoundResponse(res, 'Store item not found or inactive');
            }

            if (storeItem.stock < quantity) {
                return validationErrorResponse(res, `Insufficient stock for ${storeItem.name}`);
            }

            const itemTotal = storeItem.price * quantity;
            const entriesEarned = storeItem.entriesPerItem * quantity;

            purchaseItems.push({
                storeItemId: storeItem._id,
                itemName: storeItem.name,
                quantity,
                price: storeItem.price,
                entriesEarned
            });

            totalAmount += itemTotal;
            totalEntriesEarned += entriesEarned;

            // Update stock
            storeItem.stock -= quantity;
            await storeItem.save();
        }

        // Create purchase record
        const purchase = new Purchase({
            userId: user._id,
            items: purchaseItems,
            totalAmount,
            totalEntriesEarned,
            paymentMethod,
            status: 'completed'
        });

        await purchase.save();

        // Update user's total entries and shirt count
        user.totalEntries += totalEntriesEarned;
        user.totalShirtsPurchased += purchaseItems.reduce((sum, item) => 
            item.itemName.toLowerCase().includes('shirt') ? sum + item.quantity : sum, 0
        );
        await user.save();

        // Create wheel entries for the purchase
        for (let i = 0; i < totalEntriesEarned; i++) {
            await WheelEntry.create({
                userId: user._id,
                userName: user.name,
                entryType: 'shirt_purchase',
                shirtQuantity: purchaseItems.reduce((sum, item) => 
                    item.itemName.toLowerCase().includes('shirt') ? sum + item.quantity : sum, 0
                )
            });
        }

        return successResponse(res, {
            purchaseId: purchase._id,
            totalAmount,
            totalEntriesEarned,
            newTotalEntries: user.totalEntries,
            items: purchaseItems
        }, 'Purchase completed successfully');

    } catch (err) {
        console.error('Purchase error:', err);
        return errorResponse(res, err, 'Server Error');
    }
});

/**
 * @swagger
 * /store/purchases:
 *   get:
 *     summary: Get user's purchase history
 *     tags: [Store]
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
 *     responses:
 *       200:
 *         description: Purchase history retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get('/purchases', auth, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const purchases = await Purchase.find({ userId: req.user.id })
            .populate('items.storeItemId', 'name image')
            .sort({ purchaseDate: -1 })
            .skip(skip)
            .limit(limit);

        const totalPurchases = await Purchase.countDocuments({ userId: req.user.id });

        return successResponse(res, {
            purchases,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(totalPurchases / limit),
                totalPurchases,
                hasNext: page < Math.ceil(totalPurchases / limit),
                hasPrev: page > 1
            }
        }, 'Purchase history retrieved successfully');

    } catch (err) {
        console.error('Get purchase history error:', err);
        return errorResponse(res, err, 'Server Error');
    }
});

/**
 * @swagger
 * /store/admin/items:
 *   post:
 *     summary: Create a new store item (SuperAdmin only)
 *     tags: [Store]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               price:
 *                 type: number
 *               entriesPerItem:
 *                 type: number
 *               image:
 *                 type: string
 *               category:
 *                 type: string
 *               stock:
 *                 type: number
 *     responses:
 *       201:
 *         description: Store item created successfully
 *       400:
 *         description: Bad request
 *       403:
 *         description: SuperAdmin access required
 */
router.post('/admin/items', auth, superadmin, async (req, res) => {
    try {
        const { name, description, price, entriesPerItem, image, category = 'shirt', stock = 0 } = req.body;

        if (!name || !description || !price || !entriesPerItem) {
            return validationErrorResponse(res, 'Name, description, price, and entriesPerItem are required');
        }

        if (price <= 0 || entriesPerItem <= 0) {
            return validationErrorResponse(res, 'Price and entriesPerItem must be positive numbers');
        }

        const storeItem = new Store({
            name,
            description,
            price,
            entriesPerItem,
            image,
            category,
            stock
        });

        await storeItem.save();

        return successResponse(res, storeItem, 'Store item created successfully', 201);

    } catch (err) {
        console.error('Create store item error:', err);
        return errorResponse(res, err, 'Server Error');
    }
});

/**
 * @swagger
 * /store/admin/items/{itemId}:
 *   put:
 *     summary: Update a store item (SuperAdmin only)
 *     tags: [Store]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: itemId
 *         schema:
 *           type: string
 *         required: true
 *         description: Store item ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               price:
 *                 type: number
 *               entriesPerItem:
 *                 type: number
 *               image:
 *                 type: string
 *               category:
 *                 type: string
 *               stock:
 *                 type: number
 *               active:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Store item updated successfully
 *       404:
 *         description: Store item not found
 *       403:
 *         description: SuperAdmin access required
 */
router.put('/admin/items/:itemId', auth, superadmin, async (req, res) => {
    try {
        const { itemId } = req.params;
        const updateData = req.body;

        const storeItem = await Store.findByIdAndUpdate(
            itemId,
            updateData,
            { new: true, runValidators: true }
        );

        if (!storeItem) {
            return notFoundResponse(res, 'Store item');
        }

        return successResponse(res, storeItem, 'Store item updated successfully');

    } catch (err) {
        console.error('Update store item error:', err);
        return errorResponse(res, err, 'Server Error');
    }
});

/**
 * @swagger
 * /store/admin/items/{itemId}:
 *   delete:
 *     summary: Delete a store item (SuperAdmin only)
 *     tags: [Store]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: itemId
 *         schema:
 *           type: string
 *         required: true
 *         description: Store item ID
 *     responses:
 *       200:
 *         description: Store item deleted successfully
 *       404:
 *         description: Store item not found
 *       403:
 *         description: SuperAdmin access required
 */
router.delete('/admin/items/:itemId', auth, superadmin, async (req, res) => {
    try {
        const { itemId } = req.params;

        const storeItem = await Store.findByIdAndDelete(itemId);

        if (!storeItem) {
            return notFoundResponse(res, 'Store item');
        }

        return successResponse(res, null, 'Store item deleted successfully');

    } catch (err) {
        console.error('Delete store item error:', err);
        return errorResponse(res, err, 'Server Error');
    }
});

/**
 * @swagger
 * /store/admin/purchases:
 *   get:
 *     summary: Get all purchases (SuperAdmin only)
 *     tags: [Store]
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
 *     responses:
 *       200:
 *         description: All purchases retrieved successfully
 *       403:
 *         description: SuperAdmin access required
 */
router.get('/admin/purchases', auth, superadmin, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const purchases = await Purchase.find()
            .populate('userId', 'name email instagramHandle')
            .populate('items.storeItemId', 'name image')
            .sort({ purchaseDate: -1 })
            .skip(skip)
            .limit(limit);

        const totalPurchases = await Purchase.countDocuments();

        return successResponse(res, {
            purchases,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(totalPurchases / limit),
                totalPurchases,
                hasNext: page < Math.ceil(totalPurchases / limit),
                hasPrev: page > 1
            }
        }, 'All purchases retrieved successfully');

    } catch (err) {
        console.error('Get all purchases error:', err);
        return errorResponse(res, err, 'Server Error');
    }
});

module.exports = router;
