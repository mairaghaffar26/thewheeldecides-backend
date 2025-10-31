const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const superadmin = require('../middleware/superadmin');
const User = require('../models/User');
const WheelEntry = require('../models/WheelEntry');
const Spin = require('../models/Spin');
const Winner = require('../models/Winner');
const GameSettings = require('../models/GameSettings');
const { successResponse, errorResponse, notFoundResponse, unauthorizedResponse } = require('../utils/responseHelper');
const { sendWinnerEmail } = require('../utils/emailHelper');
const { v4: uuidv4 } = require('uuid');

/**
 * @swagger
 * /wheel/entries:
 *   get:
 *     summary: Get all wheel entries for the current spin
 *     tags: [Wheel]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Wheel entries retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get('/entries', auth, async (req, res) => {
    try {
        // Get all users with their entry counts
        const users = await User.find({ role: 'user', blocked: false })
            .select('name instagramHandle totalEntries');

        // Create wheel entries array
        const wheelEntries = [];
        
        for (const user of users) {
            // Add entries based on user's total entries
            for (let i = 0; i < user.totalEntries; i++) {
                wheelEntries.push({
                    userId: user._id,
                    userName: user.name,
                    instagramHandle: user.instagramHandle
                });
            }
        }

        return successResponse(res, {
            entries: wheelEntries,
            totalEntries: wheelEntries.length,
            totalUsers: users.length
        }, 'Wheel entries retrieved successfully');

    } catch (err) {
        console.error('Get wheel entries error:', err);
        return errorResponse(res, err, 'Server Error');
    }
});

/**
 * @swagger
 * /wheel/public-entries:
 *   get:
 *     summary: Get all wheel entries (public - no auth required)
 *     tags: [Wheel]
 *     responses:
 *       200:
 *         description: Wheel entries retrieved successfully
 */
router.get('/public-entries', async (req, res) => {
    try {
        // Get all users with their entry counts
        const users = await User.find({ role: 'user', blocked: false })
            .select('name instagramHandle totalEntries');

        // Create wheel entries array
        const wheelEntries = [];
        
        for (const user of users) {
            // Add entries based on user's total entries
            for (let i = 0; i < user.totalEntries; i++) {
                wheelEntries.push({
                    userId: user._id,
                    userName: user.name,
                    instagramHandle: user.instagramHandle
                });
            }
        }

        return successResponse(res, {
            entries: wheelEntries,
            totalEntries: wheelEntries.length,
            totalUsers: users.length
        }, 'Wheel entries retrieved successfully');

    } catch (err) {
        console.error('Get public wheel entries error:', err);
        return errorResponse(res, err, 'Server Error');
    }
});

/**
 * @swagger
 * /wheel/spin:
 *   post:
 *     summary: Trigger a manual spin (SuperAdmin only)
 *     tags: [Wheel]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Spin triggered successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: SuperAdmin access required
 */
router.post('/spin', auth, superadmin, async (req, res) => {
    try {
        // Get all users with their entry counts
        const users = await User.find({ role: 'user', blocked: false })
            .select('name instagramHandle totalEntries');

        if (users.length === 0) {
            return errorResponse(res, 'No users available for spinning', 'No users found', 400);
        }

        // Create wheel entries
        const wheelEntries = [];
        const participants = [];
        
        for (const user of users) {
            if (user.totalEntries > 0) {
                participants.push({
                    userId: user._id,
                    userName: user.name,
                    entryCount: user.totalEntries
                });

                // Add entries based on user's total entries
                for (let i = 0; i < user.totalEntries; i++) {
                    wheelEntries.push({
                        userId: user._id,
                        userName: user.name
                    });
                }
            }
        }

        if (wheelEntries.length === 0) {
            return errorResponse(res, 'No entries available for spinning', 'No entries found', 400);
        }

        // Create spin record
        const spinId = uuidv4();
        const spin = new Spin({
            spinId,
            triggeredBy: req.user.id,
            spinType: 'manual',
            totalEntries: wheelEntries.length,
            participants,
            status: 'pending'
        });

        await spin.save();

        // Select random winner
        const randomIndex = Math.floor(Math.random() * wheelEntries.length);
        const winner = wheelEntries[randomIndex];

        // Update spin with winner
        spin.winner = {
            userId: winner.userId,
            userName: winner.userName,
            entryCount: participants.find(p => p.userId.toString() === winner.userId.toString())?.entryCount || 1
        };
        spin.status = 'completed';
        spin.completedAt = new Date();
        await spin.save();

        // Create winner record
        const winnerRecord = new Winner({
            userId: winner.userId,
            userName: winner.userName,
            spinId: spin._id,
            prize: 'Mystery Prize'
        });
        await winnerRecord.save();

        // Update user as winner
        await User.findByIdAndUpdate(winner.userId, {
            isWinner: true,
            lastWinDate: new Date(),
            congratsShown: false // Reset to show congrats on next login
        });

        // Reset all users' entries to 1 (keeping only registration entry)
        // and reset shirts purchased count
        await User.updateMany(
            { role: 'user' },
            { 
                totalEntries: 1,
                totalShirtsPurchased: 0
            }
        );

        // Clear all wheel entries from shirt purchases
        await WheelEntry.deleteMany({ entryType: 'shirt_purchase' });

        // Send winner notification email
        try {
            const winnerUser = await User.findById(winner.userId);
            if (winnerUser) {
                await sendWinnerEmail(winnerUser, {
                    spinId: spin.spinId,
                    winDate: new Date(),
                    prize: 'Mystery Prize'
                });
            }
        } catch (emailError) {
            console.error('Error sending winner email:', emailError);
        }

        // Emit real-time update
        const io = req.app.get('io');
        io.to('wheel').emit('spin-completed', {
            spinId: spin.spinId,
            winner: {
                userId: winner.userId,
                userName: winner.userName,
                instagramHandle: users.find(u => u._id.toString() === winner.userId.toString())?.instagramHandle
            },
            totalEntries: wheelEntries.length,
            participants: participants.length
        });

        return successResponse(res, {
            spinId: spin.spinId,
            winner: {
                userId: winner.userId,
                userName: winner.userName,
                instagramHandle: users.find(u => u._id.toString() === winner.userId.toString())?.instagramHandle
            },
            totalEntries: wheelEntries.length,
            participants: participants.length,
            spinTime: spin.spinTime
        }, 'Spin completed successfully');

    } catch (err) {
        console.error('Spin error:', err);
        return errorResponse(res, err, 'Server Error');
    }
});

/**
 * @swagger
 * /wheel/latest-winner:
 *   get:
 *     summary: Get the latest winner
 *     tags: [Wheel]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Latest winner retrieved successfully
 *       404:
 *         description: No winner found
 */
router.get('/latest-winner', auth, async (req, res) => {
    try {
        const latestWinner = await Winner.findOne()
            .populate('userId', 'name instagramHandle')
            .populate('spinId', 'spinId spinTime')
            .sort({ winDate: -1 });

        if (!latestWinner || !latestWinner.userId) {
            return notFoundResponse(res, 'No winner found');
        }

        return successResponse(res, {
            winner: {
                userId: latestWinner.userId._id,
                userName: latestWinner.userName,
                instagramHandle: latestWinner.userId.instagramHandle,
                winDate: latestWinner.winDate,
                prize: latestWinner.prize,
                spinId: latestWinner.spinId ? latestWinner.spinId.spinId : null
            }
        }, 'Latest winner retrieved successfully');

    } catch (err) {
        console.error('Get latest winner error:', err);
        return errorResponse(res, err, 'Server Error');
    }
});

/**
 * @swagger
 * /wheel/check-winner:
 *   get:
 *     summary: Check if current user is the latest winner
 *     tags: [Wheel]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Winner status checked successfully
 */
router.get('/check-winner', auth, async (req, res) => {
    try {
        const currentUser = await User.findById(req.user.id);
        const latestWinner = await Winner.findOne()
            .populate('userId', 'name instagramHandle')
            .populate('spinId', 'spinId spinTime')
            .sort({ winDate: -1 });

        const isLatestWinner = latestWinner && latestWinner.userId && 
            latestWinner.userId._id.toString() === req.user.id.toString();

        // Only show winner notification if user is latest winner AND hasn't seen congrats yet
        const showWinnerNotification = isLatestWinner && currentUser && !currentUser.congratsShown;

        return successResponse(res, {
            isWinner: isLatestWinner,
            showWinnerNotification,
            winner: isLatestWinner ? {
                userName: latestWinner.userName,
                instagramHandle: latestWinner.userId.instagramHandle,
                winDate: latestWinner.winDate,
                prize: latestWinner.prize,
                spinId: latestWinner.spinId ? latestWinner.spinId.spinId : null
            } : null
        }, 'Winner status checked successfully');

    } catch (err) {
        console.error('Check winner error:', err);
        return errorResponse(res, err, 'Server Error');
    }
});

/**
 * @swagger
 * /wheel/spin-history:
 *   get:
 *     summary: Get spin history (SuperAdmin only)
 *     tags: [Wheel]
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
 *         description: Spin history retrieved successfully
 *       403:
 *         description: SuperAdmin access required
 */
router.get('/spin-history', auth, superadmin, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const spins = await Spin.find()
            .populate('triggeredBy', 'name email')
            .populate('winner.userId', 'name instagramHandle')
            .sort({ spinTime: -1 })
            .skip(skip)
            .limit(limit);

        const totalSpins = await Spin.countDocuments();

        return successResponse(res, {
            spins,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(totalSpins / limit),
                totalSpins,
                hasNext: page < Math.ceil(totalSpins / limit),
                hasPrev: page > 1
            }
        }, 'Spin history retrieved successfully');

    } catch (err) {
        console.error('Get spin history error:', err);
        return errorResponse(res, err, 'Server Error');
    }
});

/**
 * @swagger
 * /wheel/stats:
 *   get:
 *     summary: Get wheel statistics
 *     tags: [Wheel]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Wheel statistics retrieved successfully
 */
router.get('/stats', auth, async (req, res) => {
    try {
        const totalUsers = await User.countDocuments({ role: 'user', blocked: false });
        const totalSpins = await Spin.countDocuments({ status: 'completed' });
        const totalWinners = await Winner.countDocuments();
        const totalEntries = await User.aggregate([
            { $match: { role: 'user', blocked: false } },
            { $group: { _id: null, total: { $sum: '$totalEntries' } } }
        ]);

        const latestWinner = await Winner.findOne()
            .populate('userId', 'name instagramHandle')
            .sort({ winDate: -1 });

        return successResponse(res, {
            totalUsers,
            totalSpins,
            totalWinners,
            totalEntries: totalEntries[0]?.total || 0,
            latestWinner: latestWinner && latestWinner.userId ? {
                userName: latestWinner.userName,
                instagramHandle: latestWinner.userId.instagramHandle,
                winDate: latestWinner.winDate
            } : null
        }, 'Wheel statistics retrieved successfully');

    } catch (err) {
        console.error('Get wheel stats error:', err);
        return errorResponse(res, err, 'Server Error');
    }
});

/**
 * @swagger
 * /wheel/mark-congrats-shown:
 *   post:
 *     summary: Mark congratulations message as shown for current user
 *     tags: [Wheel]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Congratulations marked as shown
 */
router.post('/mark-congrats-shown', auth, async (req, res) => {
    try {
        await User.findByIdAndUpdate(req.user.id, {
            congratsShown: true
        });

        return successResponse(res, null, 'Congratulations marked as shown');

    } catch (err) {
        console.error('Mark congrats shown error:', err);
        return errorResponse(res, err, 'Server Error');
    }
});

/**
 * @swagger
 * /wheel/game-settings:
 *   get:
 *     summary: Get public game settings (no auth required)
 *     tags: [Wheel]
 *     responses:
 *       200:
 *         description: Game settings retrieved successfully
 */
router.get('/game-settings', async (req, res) => {
    try {
        let gameSettings = await GameSettings.findOne();
        if (!gameSettings) {
            gameSettings = new GameSettings();
            await gameSettings.save();
        }

        return successResponse(res, {
            currentPrize: gameSettings.currentPrize || 'iPhone 15 Pro Max',
            prizeDescription: gameSettings.prizeDescription || 'Latest iPhone with 256GB storage',
            spinCountdownDays: gameSettings.spinCountdownDays || 0,
            spinCountdownHours: gameSettings.spinCountdownHours || 0,
            spinCountdownMinutes: gameSettings.spinCountdownMinutes || 0,
            isGameActive: gameSettings.gameActive,
            autoSpinEnabled: gameSettings.autoSpin,
            timerActive: gameSettings.timerActive,
            maintenanceMode: gameSettings.maintenanceMode,
            entriesPerShirt: gameSettings.entriesPerShirt,
            shopifyStoreUrl: gameSettings.shopifyStoreUrl || '',
            shopifyEnabled: gameSettings.shopifyEnabled || false,
            gameStartTime: gameSettings.gameStartTime,
            gameEndTime: gameSettings.gameEndTime,
            countdownActive: gameSettings.timerActive
        }, 'Game settings retrieved successfully');

    } catch (err) {
        console.error('Get public game settings error:', err);
        return errorResponse(res, err, 'Server Error');
    }
});

/**
 * @swagger
 * /wheel/public-stats:
 *   get:
 *     summary: Get public wheel statistics (no auth required)
 *     tags: [Wheel]
 *     responses:
 *       200:
 *         description: Public statistics retrieved successfully
 */
router.get('/public-stats', async (req, res) => {
    try {
        const totalUsers = await User.countDocuments({ role: 'user', blocked: false });
        const totalSpins = await Spin.countDocuments({ status: 'completed' });
        const totalWinners = await Winner.countDocuments();
        const totalEntries = await User.aggregate([
            { $match: { role: 'user', blocked: false } },
            { $group: { _id: null, total: { $sum: '$totalEntries' } } }
        ]);

        // Get latest winner
        const latestWinner = await Winner.findOne()
            .populate('userId', 'name instagramHandle')
            .populate('spinId', 'spinId spinTime')
            .sort({ winDate: -1 });

        // Get recent winners
        const recentWinners = await Winner.find()
            .populate('userId', 'name instagramHandle')
            .populate('spinId', 'spinId spinTime')
            .sort({ winDate: -1 })
            .limit(10);

        // Get leaderboard
        const leaderboard = await User.find({ role: 'user', blocked: false })
            .select('name instagramHandle totalEntries totalShirtsPurchased isWinner')
            .sort({ totalEntries: -1 })
            .limit(10);

        return successResponse(res, {
            statistics: {
                totalUsers,
                totalSpins,
                totalWinners,
                totalEntries: totalEntries[0]?.total || 0
            },
            latestWinner: latestWinner && latestWinner.userId ? {
                userId: latestWinner.userId._id,
                userName: latestWinner.userName,
                instagramHandle: latestWinner.userId.instagramHandle,
                winDate: latestWinner.winDate,
                prize: latestWinner.prize,
                spinId: latestWinner.spinId ? latestWinner.spinId.spinId : null
            } : null,
            recentWinners: recentWinners.filter(winner => winner.userId).map(winner => ({
                userId: winner.userId._id,
                userName: winner.userName,
                instagramHandle: winner.userId.instagramHandle,
                winDate: winner.winDate,
                prize: winner.prize,
                spinId: winner.spinId ? winner.spinId.spinId : null
            })),
            leaderboard: leaderboard.map((user, index) => ({
                rank: index + 1,
                userId: user._id,
                name: user.name,
                instagramHandle: user.instagramHandle,
                totalEntries: user.totalEntries,
                totalShirtsPurchased: user.totalShirtsPurchased,
                isWinner: user.isWinner
            }))
        }, 'Public statistics retrieved successfully');

    } catch (err) {
        console.error('Get public stats error:', err);
        return errorResponse(res, err, 'Server Error');
    }
});

module.exports = router;
