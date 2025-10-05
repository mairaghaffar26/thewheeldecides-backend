const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const superadmin = require('../middleware/superadmin');
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const { generateAccessToken } = require('../utils/jwtHelper');
const { successResponse, errorResponse, validationErrorResponse, notFoundResponse, unauthorizedResponse } = require('../utils/responseHelper');
const { sendWelcomeEmail, sendEmail } = require('../utils/emailHelper');
const crypto = require('crypto');
require('dotenv').config();

/**
 * @swagger
 * /auth/signup:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               instagramHandle:
 *                 type: string
 *               country:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: User registered successfully
 *       400:
 *         description: Bad request
 */
router.post('/signup', async (req, res) => {
    const { name, email, instagramHandle, country, password } = req.body;
    
    try {
        // Validation
        if (!name || !email || !instagramHandle || !country || !password) {
            return validationErrorResponse(res, 'All fields are required');
        }

        if (password.length < 6) {
            return validationErrorResponse(res, 'Password must be at least 6 characters long');
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email.match(emailRegex)) {
            return validationErrorResponse(res, 'Invalid email format');
        }

        // Check if user already exists
        let existingUser = await User.findOne({ $or: [{ email }, { instagramHandle }] });
        if (existingUser) {
            return validationErrorResponse(res, 'Email or Instagram handle is already in use');
        }

        // Create new user
        const user = new User({
            name,
            email,
            instagramHandle,
            country,
            password,
            role: "user"
        });

        // Hash password
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(password, salt);

        // Save user
        await user.save();

        // Create initial wheel entry for registration
        const WheelEntry = require('../models/WheelEntry');
        await WheelEntry.create({
            userId: user._id,
            userName: user.name,
            entryType: 'registration'
        });

        // Generate token
        const accessToken = generateAccessToken(user);

        // Send welcome email
        try {
            await sendWelcomeEmail(user);
        } catch (emailError) {
            console.error('Error sending welcome email:', emailError);
        }

        // Return user data (excluding password)
        const userObj = user.toObject();
        delete userObj.password;
        delete userObj.resetPasswordToken;
        delete userObj.resetPasswordExpires;

        return successResponse(res, {
            user: userObj,
            accessToken
        }, 'User registered successfully');

    } catch (err) {
        console.error('Signup error:', err);
        return errorResponse(res, err, 'Server Error');
    }
});

/**
 * @swagger
 * /auth/signin:
 *   post:
 *     summary: Login a user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *       400:
 *         description: Invalid credentials
 */
router.post('/signin', async (req, res) => {
    const { email, password } = req.body;

    try {
        if (!email || !password) {
            return validationErrorResponse(res, 'Email and password are required');
        }

        // Find user
        const user = await User.findOne({ email });
        if (!user) {
            return unauthorizedResponse(res, 'Invalid credentials');
        }

        if (user.blocked) {
            return unauthorizedResponse(res, 'Account is blocked');
        }

        // Check password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return unauthorizedResponse(res, 'Invalid credentials');
        }

        // Generate token
        const accessToken = generateAccessToken(user);

        // Return user data (excluding password)
        const userObj = user.toObject();
        delete userObj.password;
        delete userObj.resetPasswordToken;
        delete userObj.resetPasswordExpires;

        return successResponse(res, {
            user: userObj,
            accessToken
        }, 'Login successful');

    } catch (err) {
        console.error('Signin error:', err);
        return errorResponse(res, err, 'Server Error');
    }
});



/**
 * @swagger
 * /auth/me:
 *   get:
 *     summary: Get current user profile
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile
 *       401:
 *         description: Unauthorized
 */
router.get('/me', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password -resetPasswordToken -resetPasswordExpires');
        if (!user) {
            return notFoundResponse(res, 'User');
        }

        return successResponse(res, user, 'User profile retrieved successfully');

    } catch (err) {
        console.error('Get profile error:', err);
        return errorResponse(res, err, 'Server Error');
    }
});

/**
 * @swagger
 * /auth/change-password:
 *   patch:
 *     summary: Change user password
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               currentPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password updated successfully
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 */
router.patch('/change-password', auth, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return validationErrorResponse(res, 'Both current password and new password are required');
        }

        if (newPassword.length < 6) {
            return validationErrorResponse(res, 'New password must be at least 6 characters long');
        }

        // Get user
        const user = await User.findById(req.user.id);
        if (!user) {
            return notFoundResponse(res, 'User');
        }

        // Verify current password
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return unauthorizedResponse(res, 'Current password is incorrect');
        }

        // Check if new password is different
        if (currentPassword === newPassword) {
            return validationErrorResponse(res, 'New password must be different from current password');
        }

        // Hash new password
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        await user.save();

        return successResponse(res, null, 'Password updated successfully');

    } catch (err) {
        console.error('Change password error:', err);
        return errorResponse(res, err, 'Server Error');
    }
});

/**
 * @swagger
 * /auth/forgot-password:
 *   post:
 *     summary: Request password reset
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password reset email sent
 *       404:
 *         description: User not found
 */
router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;
    
    try {
        if (!email) {
            return validationErrorResponse(res, 'Email is required');
        }

        const user = await User.findOne({ email });
        if (!user) {
            return notFoundResponse(res, 'User');
        }

        // Generate reset token
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetTokenExpiry = Date.now() + 1000 * 60 * 60; // 1 hour

        user.resetPasswordToken = resetToken;
        user.resetPasswordExpires = resetTokenExpiry;
        await user.save();

        // Send reset email
        const resetLink = `${process.env.FRONT_END_URL}/reset-password?token=${resetToken}`;
        
        // Create HTML email content
        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 480px; margin: auto; border: 1px solid #eee; border-radius: 8px; padding: 32px 24px; background: #fafbfc;">
                <h2 style="color: #2d3748;">Password Reset Request</h2>
                <p style="color: #4a5568;">Hello <b>${user.name || user.email}</b>,</p>
                <p style="color: #4a5568;">We received a request to reset your password. Click the button below to set a new password. This link will expire in 1 hour.</p>
                <a href="${resetLink}" style="display: inline-block; margin: 24px 0; padding: 12px 28px; background: #3182ce; color: #fff; text-decoration: none; border-radius: 4px; font-weight: bold;">Reset Password</a>
                <p style="color: #718096; font-size: 13px;">If you did not request a password reset, you can safely ignore this email.</p>
                <hr style="margin: 24px 0; border: none; border-top: 1px solid #e2e8f0;">
                <p style="color: #a0aec0; font-size: 12px;">&copy; ${new Date().getFullYear()} The Wheel Decides. All rights reserved.</p>
            </div>
        `;
        
        // Send email with HTML content
        await sendEmail(user.email, 'Password Reset Request', `Click the link to reset your password: ${resetLink}`, html);

        return successResponse(res, { resetLink }, 'Password reset email sent');

    } catch (err) {
        console.error('Forgot password error:', err);
        return errorResponse(res, err, 'Server Error');
    }
});

/**
 * @swagger
 * /auth/reset-password:
 *   post:
 *     summary: Reset user password using token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               token:
 *                 type: string
 *               newPassword:
 *                 type: string
 *               confirmPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password reset successful
 *       400:
 *         description: Bad request
 *       404:
 *         description: Invalid or expired token
 */
router.post('/reset-password', async (req, res) => {
    const { token, newPassword, confirmPassword } = req.body;
    
    if (!token || !newPassword || !confirmPassword) {
        return validationErrorResponse(res, 'Token, newPassword, and confirmPassword are required');
    }
    
    if (newPassword !== confirmPassword) {
        return validationErrorResponse(res, 'Passwords do not match');
    }
    
    if (newPassword.length < 6) {
        return validationErrorResponse(res, 'Password must be at least 6 characters long');
    }
    
    try {
        const user = await User.findOne({ 
            resetPasswordToken: token, 
            resetPasswordExpires: { $gt: Date.now() } 
        });
        
        if (!user) {
            return notFoundResponse(res, 'Invalid or expired token');
        }
        
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();
        
        return successResponse(res, null, 'Password reset successful');
        
    } catch (err) {
        console.error('Reset password error:', err);
        return errorResponse(res, err, 'Server Error');
    }
});

/**
 * @swagger
 * /auth/change-password:
 *   patch:
 *     summary: Change user password
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               currentPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password updated
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 */
router.patch('/change-password', auth, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        // Validate request body
        if (!currentPassword || !newPassword) {
            return validationErrorResponse(res, 'Both current password and new password are required');
        }

        // Password validation
        if (newPassword.length < 6) {
            return validationErrorResponse(res, 'New password must be at least 6 characters long');
        }

        // Get user from database
        const user = await User.findById(req.user.id);
        if (!user) {
            return notFoundResponse(res, 'User not found');
        }

        // Verify current password
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return unauthorizedResponse(res, 'Current password is incorrect');
        }

        // Check if new password is different from current
        if (currentPassword === newPassword) {
            return validationErrorResponse(res, 'New password must be different from current password');
        }

        // Hash new password
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);

        // Save updated user
        await user.save();

        return successResponse(res, {
            message: 'Password updated successfully',
            timestamp: new Date(),
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        }, 'Password updated successfully');

    } catch (error) {
        console.error('Error changing password:', error);
        return errorResponse(res, error, 'Server error');
    }
});

/**
 * @swagger
 * /auth/check-token:
 *   post:
 *     summary: Check if a JWT token is valid
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               token:
 *                 type: string
 *     responses:
 *       200:
 *         description: Token is valid
 *       401:
 *         description: Invalid or expired token
 */
router.post('/check-token', async (req, res) => {
    let token = req.header('Authorization');
    if (!token && req.body.token) {
        token = req.body.token;
    }
    if (!token) {
        return validationErrorResponse(res, 'Token is required');
    }
    
    // Remove 'Bearer ' prefix if present
    if (token.startsWith('Bearer ')) {
        token = token.slice(7, token.length);
    }
    
    try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        return successResponse(res, { valid: true, payload: decoded }, 'Token is valid');
    } catch (err) {
        return unauthorizedResponse(res, 'Invalid or expired token');
    }
});

module.exports = router;
