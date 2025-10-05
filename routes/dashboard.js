const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const Winner = require('../models/Winner');
const Spin = require('../models/Spin');
const GameSettings = require('../models/GameSettings');
const { successResponse, errorResponse } = require('../utils/responseHelper');

/**
 * @swagger
 * /dashboard:
 *   get:
 *     summary: Get user dashboard data
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard data retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get('/', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id)
            .select('-password -resetPasswordToken -resetPasswordExpires');

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        // Get game settings
        let gameSettings = await GameSettings.findOne();
        if (!gameSettings) {
            gameSettings = new GameSettings();
            await gameSettings.save();
        }

        // Get latest winner
        const latestWinner = await Winner.findOne()
            .populate('userId', 'name instagramHandle')
            .populate('spinId', 'spinId spinTime')
            .sort({ winDate: -1 });

        // Check if current user is the latest winner
        const isCurrentUserWinner = latestWinner && latestWinner.userId && 
            latestWinner.userId._id.toString() === req.user.id.toString();

        // Get user's recent activity
        const userWins = await Winner.find({ userId: req.user.id })
            .populate('spinId', 'spinId spinTime')
            .sort({ winDate: -1 })
            .limit(5);

        // Get wheel statistics
        const totalUsers = await User.countDocuments({ role: 'user', blocked: false });
        const totalSpins = await Spin.countDocuments({ status: 'completed' });
        const totalWinners = await Winner.countDocuments();
        const totalEntries = await User.aggregate([
            { $match: { role: 'user', blocked: false } },
            { $group: { _id: null, total: { $sum: '$totalEntries' } } }
        ]);

        return successResponse(res, {
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                instagramHandle: user.instagramHandle,
                country: user.country,
                totalEntries: user.totalEntries,
                totalShirtsPurchased: user.totalShirtsPurchased,
                isWinner: user.isWinner,
                lastWinDate: user.lastWinDate,
                avatar: user.avatar,
                congratsShown: user.congratsShown
            },
            gameSettings: {
                spinTimer: gameSettings.spinTimer,
                timerActive: gameSettings.timerActive,
                autoSpin: gameSettings.autoSpin,
                gameActive: gameSettings.gameActive,
                maintenanceMode: gameSettings.maintenanceMode
            },
            latestWinner: latestWinner && latestWinner.userId ? {
                userId: latestWinner.userId._id,
                userName: latestWinner.userName,
                instagramHandle: latestWinner.userId.instagramHandle,
                winDate: latestWinner.winDate,
                prize: latestWinner.prize,
                spinId: latestWinner.spinId ? latestWinner.spinId.spinId : null
            } : null,
            isCurrentUserWinner,
            userWins: userWins.map(win => ({
                winDate: win.winDate,
                prize: win.prize,
                spinId: win.spinId ? win.spinId.spinId : null
            })),
            statistics: {
                totalUsers,
                totalSpins,
                totalWinners,
                totalEntries: totalEntries[0]?.total || 0,
                userEntries: user.totalEntries
            }
        }, 'Dashboard data retrieved successfully');

    } catch (err) {
        console.error('Get dashboard error:', err);
        return errorResponse(res, err, 'Server Error');
    }
});

/**
 * @swagger
 * /dashboard/leaderboard:
 *   get:
 *     summary: Get leaderboard (top users by entries)
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Number of top users to return
 *     responses:
 *       200:
 *         description: Leaderboard retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get('/leaderboard', auth, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;

        const leaderboard = await User.find({ role: 'user', blocked: false })
            .select('name instagramHandle totalEntries totalShirtsPurchased isWinner')
            .sort({ totalEntries: -1 })
            .limit(limit);

        return successResponse(res, {
            leaderboard: leaderboard.map((user, index) => ({
                rank: index + 1,
                userId: user._id,
                name: user.name,
                instagramHandle: user.instagramHandle,
                totalEntries: user.totalEntries,
                totalShirtsPurchased: user.totalShirtsPurchased,
                isWinner: user.isWinner
            }))
        }, 'Leaderboard retrieved successfully');

    } catch (err) {
        console.error('Get leaderboard error:', err);
        return errorResponse(res, err, 'Server Error');
    }
});

/**
 * @swagger
 * /dashboard/winners:
 *   get:
 *     summary: Get recent winners
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Number of recent winners to return
 *     responses:
 *       200:
 *         description: Recent winners retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get('/winners', auth, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;

        const recentWinners = await Winner.find()
            .populate('userId', 'name instagramHandle')
            .populate('spinId', 'spinId spinTime')
            .sort({ winDate: -1 })
            .limit(limit);

        return successResponse(res, {
            winners: recentWinners.filter(winner => winner.userId).map(winner => ({
                userId: winner.userId._id,
                userName: winner.userName,
                instagramHandle: winner.userId.instagramHandle,
                winDate: winner.winDate,
                prize: winner.prize,
                spinId: winner.spinId ? winner.spinId.spinId : null
            }))
        }, 'Recent winners retrieved successfully');

    } catch (err) {
        console.error('Get recent winners error:', err);
        return errorResponse(res, err, 'Server Error');
    }
});

module.exports = router;
