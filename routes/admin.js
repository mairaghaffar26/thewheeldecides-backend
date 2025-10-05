const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const superadmin = require('../middleware/superadmin');
const User = require('../models/User');
const GameSettings = require('../models/GameSettings');
const Spin = require('../models/Spin');
const Winner = require('../models/Winner');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { successResponse, errorResponse, validationErrorResponse, notFoundResponse } = require('../utils/responseHelper');

/**
 * @swagger
 * /admin/dashboard:
 *   get:
 *     summary: Get admin dashboard data
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard data retrieved successfully
 *       403:
 *         description: SuperAdmin access required
 */
router.get('/dashboard', auth, superadmin, async (req, res) => {
    try {
        // Get game settings
        let gameSettings = await GameSettings.findOne();
        if (!gameSettings) {
            gameSettings = new GameSettings();
            await gameSettings.save();
        }

        // Get statistics
        const totalUsers = await User.countDocuments({ role: 'user', blocked: false });
        const totalSpins = await Spin.countDocuments({ status: 'completed' });
        const totalWinners = await Winner.countDocuments();
        const totalEntries = await User.aggregate([
            { $match: { role: 'user', blocked: false } },
            { $group: { _id: null, total: { $sum: '$totalEntries' } } }
        ]);

        // Get recent activity
        const recentSpins = await Spin.find({ status: 'completed' })
            .populate('triggeredBy', 'name')
            .populate('winner.userId', 'name instagramHandle')
            .sort({ completedAt: -1 })
            .limit(5);

        const recentWinners = await Winner.find()
            .populate('userId', 'name instagramHandle')
            .populate('spinId', 'spinId spinTime')
            .sort({ winDate: -1 })
            .limit(5);

        return successResponse(res, {
            gameSettings: {
                spinTimer: gameSettings.spinTimer,
                timerActive: gameSettings.timerActive,
                autoSpin: gameSettings.autoSpin,
                gameActive: gameSettings.gameActive,
                maintenanceMode: gameSettings.maintenanceMode,
                entriesPerShirt: gameSettings.entriesPerShirt
            },
            statistics: {
                totalUsers,
                totalSpins,
                totalWinners,
                totalEntries: totalEntries[0]?.total || 0
            },
            recentActivity: {
                recentSpins,
                recentWinners
            }
        }, 'Dashboard data retrieved successfully');

    } catch (err) {
        console.error('Get dashboard error:', err);
        return errorResponse(res, err, 'Server Error');
    }
});

/**
 * @swagger
 * /admin/settings:
 *   get:
 *     summary: Get game settings
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Game settings retrieved successfully
 *       403:
 *         description: SuperAdmin access required
 */
router.get('/settings', auth, superadmin, async (req, res) => {
    try {
        let gameSettings = await GameSettings.findOne();
        if (!gameSettings) {
            gameSettings = new GameSettings();
            await gameSettings.save();
        }

        return successResponse(res, gameSettings, 'Game settings retrieved successfully');

    } catch (err) {
        console.error('Get settings error:', err);
        return errorResponse(res, err, 'Server Error');
    }
});

/**
 * @swagger
 * /admin/settings:
 *   put:
 *     summary: Update game settings
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               spinTimer:
 *                 type: number
 *               timerActive:
 *                 type: boolean
 *               autoSpin:
 *                 type: boolean
 *               gameActive:
 *                 type: boolean
 *               maintenanceMode:
 *                 type: boolean
 *               entriesPerShirt:
 *                 type: number
 *     responses:
 *       200:
 *         description: Game settings updated successfully
 *       400:
 *         description: Bad request
 *       403:
 *         description: SuperAdmin access required
 */
router.put('/settings', auth, superadmin, async (req, res) => {
    try {
        const updateData = req.body;
        updateData.updatedBy = req.user.id;

        let gameSettings = await GameSettings.findOne();
        if (!gameSettings) {
            gameSettings = new GameSettings(updateData);
        } else {
            Object.assign(gameSettings, updateData);
        }

        await gameSettings.save();

        // Emit real-time update
        const io = req.app.get('io');
        io.to('admin').emit('settings-updated', gameSettings);

        return successResponse(res, gameSettings, 'Game settings updated successfully');

    } catch (err) {
        console.error('Update settings error:', err);
        return errorResponse(res, err, 'Server Error');
    }
});

/**
 * @swagger
 * /admin/users:
 *   get:
 *     summary: Get all users
 *     tags: [Admin]
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
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term for name or email
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [user, super_admin]
 *         description: Filter by user role
 *     responses:
 *       200:
 *         description: Users retrieved successfully
 *       403:
 *         description: SuperAdmin access required
 */
router.get('/users', auth, superadmin, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const search = req.query.search || '';
        const role = req.query.role || 'user'; // Default to 'user' for backward compatibility

        // Build search query
        const searchQuery = search ? {
            $or: [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { instagramHandle: { $regex: search, $options: 'i' } }
            ]
        } : {};

        // Build role query
        const roleQuery = role ? { role } : {};

        const users = await User.find({ ...roleQuery, ...searchQuery })
            .select('-password -resetPasswordToken -resetPasswordExpires')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const totalUsers = await User.countDocuments({ ...roleQuery, ...searchQuery });

        return successResponse(res, {
            users,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(totalUsers / limit),
                totalUsers,
                hasNext: page < Math.ceil(totalUsers / limit),
                hasPrev: page > 1
            }
        }, 'Users retrieved successfully');

    } catch (err) {
        console.error('Get users error:', err);
        return errorResponse(res, err, 'Server Error');
    }
});

/**
 * @swagger
 * /admin/users/{userId}/block:
 *   patch:
 *     summary: Block or unblock a user
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         schema:
 *           type: string
 *         required: true
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               blocked:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: User status updated successfully
 *       404:
 *         description: User not found
 *       403:
 *         description: SuperAdmin access required
 */
router.patch('/users/:userId/block', auth, superadmin, async (req, res) => {
    try {
        const { userId } = req.params;
        const { blocked } = req.body;

        if (typeof blocked !== 'boolean') {
            return validationErrorResponse(res, 'Blocked status must be a boolean');
        }

        // Get the target user to check their role
        const targetUser = await User.findById(userId);
        if (!targetUser) {
            return notFoundResponse(res, 'User');
        }

        // If trying to block a super_admin, check if current user is owner
        if (targetUser.role === 'super_admin' && !req.user.owner) {
            return errorResponse(res, null, 'Only owner superadmins can block other superadmins', 403);
        }

        // Prevent owner from blocking themselves
        if (targetUser._id.toString() === req.user.id) {
            return errorResponse(res, null, 'Cannot block yourself', 400);
        }

        const user = await User.findByIdAndUpdate(
            userId,
            { blocked },
            { new: true }
        ).select('-password -resetPasswordToken -resetPasswordExpires');

        return successResponse(res, user, `User ${blocked ? 'blocked' : 'unblocked'} successfully`);

    } catch (err) {
        console.error('Block user error:', err);
        return errorResponse(res, err, 'Server Error');
    }
});

/**
 * @swagger
 * /admin/users/{userId}/entries:
 *   patch:
 *     summary: Update user's wheel entries
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         schema:
 *           type: string
 *         required: true
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               totalEntries:
 *                 type: number
 *     responses:
 *       200:
 *         description: User entries updated successfully
 *       404:
 *         description: User not found
 *       403:
 *         description: SuperAdmin access required
 */
router.patch('/users/:userId/entries', auth, superadmin, async (req, res) => {
    try {
        const { userId } = req.params;
        const { totalEntries } = req.body;

        if (typeof totalEntries !== 'number' || totalEntries < 0) {
            return validationErrorResponse(res, 'Total entries must be a non-negative number');
        }

        const user = await User.findByIdAndUpdate(
            userId,
            { totalEntries },
            { new: true }
        ).select('-password -resetPasswordToken -resetPasswordExpires');

        if (!user) {
            return notFoundResponse(res, 'User');
        }

        return successResponse(res, user, 'User entries updated successfully');

    } catch (err) {
        console.error('Update user entries error:', err);
        return errorResponse(res, err, 'Server Error');
    }
});

/**
 * @swagger
 * /admin/declare-winner:
 *   post:
 *     summary: Manually declare a winner
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userId:
 *                 type: string
 *               prize:
 *                 type: string
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Winner declared successfully
 *       400:
 *         description: Bad request
 *       403:
 *         description: SuperAdmin access required
 */
router.post('/declare-winner', auth, superadmin, async (req, res) => {
    try {
        const { userId, prize = 'Mystery Prize', notes } = req.body;

        if (!userId) {
            return validationErrorResponse(res, 'User ID is required');
        }

        const user = await User.findById(userId);
        if (!user) {
            return notFoundResponse(res, 'User');
        }

        // Create a manual spin record
        const Spin = require('../models/Spin');
        const { v4: uuidv4 } = require('uuid');
        
        const spin = new Spin({
            spinId: uuidv4(),
            triggeredBy: req.user.id,
            spinType: 'manual',
            totalEntries: 1,
            participants: [{
                userId: user._id,
                userName: user.name,
                entryCount: 1
            }],
            winner: {
                userId: user._id,
                userName: user.name,
                entryCount: 1
            },
            status: 'completed',
            completedAt: new Date(),
            notes: notes || 'Manually declared winner'
        });

        await spin.save();

        // Create winner record
        const winner = new Winner({
            userId: user._id,
            userName: user.name,
            spinId: spin._id,
            prize,
            notes
        });

        await winner.save();

        // Update user as winner
        user.isWinner = true;
        user.lastWinDate = new Date();
        await user.save();

        // Emit real-time update
        const io = req.app.get('io');
        io.to('wheel').emit('winner-declared', {
            winner: {
                userId: user._id,
                userName: user.name,
                instagramHandle: user.instagramHandle,
                prize
            },
            spinId: spin.spinId
        });

        return successResponse(res, {
            winner: {
                userId: user._id,
                userName: user.name,
                instagramHandle: user.instagramHandle,
                prize
            },
            spinId: spin.spinId
        }, 'Winner declared successfully');

    } catch (err) {
        console.error('Declare winner error:', err);
        return errorResponse(res, err, 'Server Error');
    }
});

/**
 * @swagger
 * /admin/reset-game:
 *   post:
 *     summary: Reset the game (clear all data)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Game reset successfully
 *       403:
 *         description: SuperAdmin access required
 */
router.post('/reset-game', auth, superadmin, async (req, res) => {
    try {
        // Reset all user entries and winner status
        await User.updateMany(
            { role: 'user' },
            { 
                totalEntries: 1, // Keep 1 entry for registration
                totalShirtsPurchased: 0,
                isWinner: false,
                lastWinDate: null
            }
        );

        // Clear all wheel entries except registration ones
        const WheelEntry = require('../models/WheelEntry');
        await WheelEntry.deleteMany({ entryType: 'shirt_purchase' });

        // Clear all spins
        await Spin.deleteMany({});

        // Clear all winners
        await Winner.deleteMany({});

        // Reset game settings
        await GameSettings.deleteMany({});

        return successResponse(res, null, 'Game reset successfully');

    } catch (err) {
        console.error('Reset game error:', err);
        return errorResponse(res, err, 'Server Error');
    }
});

/**
 * @swagger
 * /admin/game-settings:
 *   get:
 *     summary: Get game settings
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Game settings retrieved successfully
 *       403:
 *         description: SuperAdmin access required
 */
router.get('/game-settings', auth, superadmin, async (req, res) => {
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
            shopifyEnabled: gameSettings.shopifyEnabled || false
        }, 'Game settings retrieved successfully');

    } catch (err) {
        console.error('Get game settings error:', err);
        return errorResponse(res, err, 'Server Error');
    }
});

/**
 * @swagger
 * /admin/game-settings:
 *   put:
 *     summary: Update game settings
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               currentPrize:
 *                 type: string
 *               prizeDescription:
 *                 type: string
 *               spinCountdownDays:
 *                 type: number
 *               spinCountdownHours:
 *                 type: number
 *               spinCountdownMinutes:
 *                 type: number
 *               isGameActive:
 *                 type: boolean
 *               autoSpinEnabled:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Game settings updated successfully
 *       400:
 *         description: Bad request
 *       403:
 *         description: SuperAdmin access required
 */
router.put('/game-settings', auth, superadmin, async (req, res) => {
    try {
        const {
            currentPrize,
            prizeDescription,
            spinCountdownDays,
            spinCountdownHours,
            spinCountdownMinutes,
            isGameActive,
            autoSpinEnabled,
            shopifyStoreUrl,
            shopifyEnabled,
            startCountdown
        } = req.body;

        let gameSettings = await GameSettings.findOne();
        if (!gameSettings) {
            gameSettings = new GameSettings();
        }

        // Update fields
        if (currentPrize !== undefined) gameSettings.currentPrize = currentPrize;
        if (prizeDescription !== undefined) gameSettings.prizeDescription = prizeDescription;
        if (spinCountdownDays !== undefined) gameSettings.spinCountdownDays = spinCountdownDays;
        if (spinCountdownHours !== undefined) gameSettings.spinCountdownHours = spinCountdownHours;
        if (spinCountdownMinutes !== undefined) gameSettings.spinCountdownMinutes = spinCountdownMinutes;
        if (isGameActive !== undefined) gameSettings.gameActive = isGameActive;
        if (autoSpinEnabled !== undefined) gameSettings.autoSpin = autoSpinEnabled;
        if (shopifyStoreUrl !== undefined) gameSettings.shopifyStoreUrl = shopifyStoreUrl;
        if (shopifyEnabled !== undefined) gameSettings.shopifyEnabled = shopifyEnabled;

        // Handle countdown timer logic
        if (startCountdown && (spinCountdownDays > 0 || spinCountdownHours > 0 || spinCountdownMinutes > 0)) {
            const now = new Date();
            const totalMinutes = (spinCountdownDays * 24 * 60) + (spinCountdownHours * 60) + spinCountdownMinutes;
            const endTime = new Date(now.getTime() + (totalMinutes * 60 * 1000));
            
            gameSettings.gameStartTime = now;
            gameSettings.gameEndTime = endTime;
            gameSettings.countdownActive = true;
        }

        gameSettings.updatedBy = req.user.id;
        await gameSettings.save();

        // Emit real-time update
        const io = req.app.get('io');
        if (io) {
            io.to('wheel').emit('game-settings-updated', gameSettings);
            io.to('admin').emit('game-settings-updated', gameSettings);
        }

        return successResponse(res, gameSettings, 'Game settings updated successfully');

    } catch (err) {
        console.error('Update game settings error:', err);
        return errorResponse(res, err, 'Server Error');
    }
});

/**
 * @swagger
 * /admin/check-countdown:
 *   get:
 *     summary: Check if countdown has expired and notify admin
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Countdown status checked
 *       403:
 *         description: SuperAdmin access required
 */
router.get('/check-countdown', auth, superadmin, async (req, res) => {
    try {
        const gameSettings = await GameSettings.findOne();
        if (!gameSettings) {
            return successResponse(res, { countdownExpired: false }, 'No countdown active');
        }

        const now = new Date();
        const countdownExpired = gameSettings.countdownActive && 
                                gameSettings.gameEndTime && 
                                now >= gameSettings.gameEndTime;

        if (countdownExpired) {
            // Emit notification to admin
            const io = req.app.get('io');
            if (io) {
                io.to('admin').emit('countdown-expired', {
                    message: 'Game countdown has expired! Time to spin the wheel.',
                    gameEndTime: gameSettings.gameEndTime
                });
            }
        }

        return successResponse(res, {
            countdownExpired,
            gameEndTime: gameSettings.gameEndTime,
            timeRemaining: gameSettings.gameEndTime ? Math.max(0, gameSettings.gameEndTime - now) : 0
        }, 'Countdown status checked');

    } catch (err) {
        console.error('Check countdown error:', err);
        return errorResponse(res, err, 'Server Error');
    }
});

// Admin Password Change with Email Verification
router.post('/request-password-change', auth, superadmin, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return notFoundResponse(res, 'User not found');
        }

        // Generate verification token
        const verificationToken = crypto.randomBytes(32).toString('hex');
        const tokenExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

        // Store token in user document
        user.passwordChangeToken = verificationToken;
        user.passwordChangeTokenExpiry = tokenExpiry;
        await user.save();

        // Send verification email
        try {
            const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: process.env.EMAIL_USER,
                    pass: process.env.EMAIL_PASS
                }
            });

            const verificationLink = `${process.env.FRONT_END_URL}/admin/verify-password-change?token=${verificationToken}`;
            
            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: user.email,
                subject: 'Password Change Verification - TheWheelDecides Admin',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #333;">Password Change Verification</h2>
                        <p>Hello ${user.name},</p>
                        <p>You have requested to change your SuperAdmin password. Please click the link below to verify this request:</p>
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${verificationLink}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">Verify Password Change</a>
                        </div>
                        <p style="color: #666; font-size: 14px;">This link will expire in 15 minutes for security reasons.</p>
                        <p style="color: #666; font-size: 14px;">If you did not request this password change, please ignore this email and contact support immediately.</p>
                        <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
                        <p style="color: #999; font-size: 12px;">TheWheelDecides Admin Panel</p>
                    </div>
                `
            };

            await transporter.sendMail(mailOptions);
            console.log('Password change verification email sent to:', user.email);
        } catch (emailError) {
            console.error('Email sending error:', emailError);
            // Don't fail the request if email fails, just log it
        }

        return successResponse(res, {
            message: 'Verification email sent successfully',
            email: user.email
        }, 'Password change verification email sent');

    } catch (err) {
        console.error('Request password change error:', err);
        return errorResponse(res, err, 'Server Error');
    }
});

router.post('/verify-password-change', async (req, res) => {
    try {
        const { token, newPassword } = req.body;

        if (!token || !newPassword) {
            return validationErrorResponse(res, 'Token and new password are required');
        }

        if (newPassword.length < 8) {
            return validationErrorResponse(res, 'Password must be at least 8 characters long');
        }

        // Find user with valid token
        const user = await User.findOne({
            passwordChangeToken: token,
            passwordChangeTokenExpiry: { $gt: new Date() }
        });

        if (!user) {
            return errorResponse(res, 'Invalid or expired token', 'Invalid Token');
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update password and clear token
        user.password = hashedPassword;
        user.passwordChangeToken = undefined;
        user.passwordChangeTokenExpiry = undefined;
        
        // Add password change timestamp for session invalidation
        user.passwordChangedAt = new Date();
        
        await user.save();

        // Broadcast global logout to all connected sessions
        const io = req.app.get('io');
        if (io) {
            // Emit to all connected clients
            io.emit('password-changed-logout', {
                userId: user._id,
                message: 'Password has been changed. Please login again.',
                timestamp: new Date()
            });
            
            // Also emit to admin room specifically
            io.to('admin').emit('password-changed-logout', {
                userId: user._id,
                message: 'Password has been changed. Please login again.',
                timestamp: new Date()
            });
            
            console.log(`Password changed for user ${user.email} - broadcasting logout to all sessions`);
        }

        return successResponse(res, {
            message: 'Password changed successfully. Please login again.',
            logoutRequired: true
        }, 'Password changed successfully');

    } catch (err) {
        console.error('Verify password change error:', err);
        return errorResponse(res, err, 'Server Error');
    }
});

module.exports = router;
