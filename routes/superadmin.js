const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const User = require('../models/User');
const { successResponse, errorResponse, validationErrorResponse, notFoundResponse } = require('../utils/responseHelper');
const { sendPasswordResetEmail } = require('../utils/emailHelper');

/**
 * @swagger
 * /superadmin/request-password-reset:
 *   post:
 *     summary: Request password reset for SuperAdmin
 *     tags: [SuperAdmin]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: SuperAdmin email address
 *     responses:
 *       200:
 *         description: Password reset email sent successfully
 *       400:
 *         description: Bad request
 *       404:
 *         description: SuperAdmin not found
 */
router.post('/request-password-reset', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return validationErrorResponse(res, 'Email is required');
        }

        // Find SuperAdmin by email
        const superAdmin = await User.findOne({ 
            email: email.toLowerCase(), 
            role: 'super_admin' 
        });

        if (!superAdmin) {
            return notFoundResponse(res, 'SuperAdmin not found');
        }

        // Generate reset token
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetTokenExpires = new Date(Date.now() + 3600000); // 1 hour

        // Save reset token to user
        superAdmin.resetPasswordToken = resetToken;
        superAdmin.resetPasswordExpires = resetTokenExpires;
        await superAdmin.save();

        // Send password reset email
        try {
            await sendPasswordResetEmail(superAdmin, resetToken);
            console.log(`Password reset email sent to SuperAdmin: ${email}`);
        } catch (emailError) {
            console.error('Error sending password reset email:', emailError);
            // Don't fail the request if email fails, just log it
        }

        return successResponse(res, null, 'Password reset email sent successfully');

    } catch (err) {
        console.error('Request password reset error:', err);
        return errorResponse(res, err, 'Server Error');
    }
});

/**
 * @swagger
 * /superadmin/verify-reset-token:
 *   post:
 *     summary: Verify password reset token
 *     tags: [SuperAdmin]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *             properties:
 *               token:
 *                 type: string
 *                 description: Password reset token
 *     responses:
 *       200:
 *         description: Token is valid
 *       400:
 *         description: Invalid or expired token
 */
router.post('/verify-reset-token', async (req, res) => {
    try {
        const { token } = req.body;

        if (!token) {
            return validationErrorResponse(res, 'Token is required');
        }

        // Find SuperAdmin with valid token
        const superAdmin = await User.findOne({
            resetPasswordToken: token,
            resetPasswordExpires: { $gt: Date.now() },
            role: 'super_admin'
        });

        if (!superAdmin) {
            return errorResponse(res, 'Invalid or expired token', 'Token verification failed', 400);
        }

        return successResponse(res, { 
            email: superAdmin.email,
            name: superAdmin.name 
        }, 'Token is valid');

    } catch (err) {
        console.error('Verify reset token error:', err);
        return errorResponse(res, err, 'Server Error');
    }
});

/**
 * @swagger
 * /superadmin/reset-password:
 *   post:
 *     summary: Reset SuperAdmin password
 *     tags: [SuperAdmin]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *               - newPassword
 *             properties:
 *               token:
 *                 type: string
 *                 description: Password reset token
 *               newPassword:
 *                 type: string
 *                 minLength: 8
 *                 description: New password
 *     responses:
 *       200:
 *         description: Password reset successfully
 *       400:
 *         description: Invalid token or weak password
 */
router.post('/reset-password', async (req, res) => {
    try {
        const { token, newPassword } = req.body;

        if (!token || !newPassword) {
            return validationErrorResponse(res, 'Token and new password are required');
        }

        if (newPassword.length < 8) {
            return validationErrorResponse(res, 'Password must be at least 8 characters long');
        }

        // Find SuperAdmin with valid token
        const superAdmin = await User.findOne({
            resetPasswordToken: token,
            resetPasswordExpires: { $gt: Date.now() },
            role: 'super_admin'
        });

        if (!superAdmin) {
            return errorResponse(res, 'Invalid or expired token', 'Token verification failed', 400);
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update password and clear reset token
        superAdmin.password = hashedPassword;
        superAdmin.resetPasswordToken = undefined;
        superAdmin.resetPasswordExpires = undefined;
        await superAdmin.save();

        console.log(`SuperAdmin password reset successfully for: ${superAdmin.email}`);

        return successResponse(res, null, 'Password reset successfully');

    } catch (err) {
        console.error('Reset password error:', err);
        return errorResponse(res, err, 'Server Error');
    }
});

/**
 * @swagger
 * /superadmin/change-password:
 *   post:
 *     summary: Change SuperAdmin password (requires authentication)
 *     tags: [SuperAdmin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 description: Current password
 *               newPassword:
 *                 type: string
 *                 minLength: 8
 *                 description: New password
 *     responses:
 *       200:
 *         description: Password changed successfully
 *       400:
 *         description: Invalid current password or weak new password
 *       401:
 *         description: Unauthorized
 */
router.post('/change-password', async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const userId = req.user?.id;

        if (!userId) {
            return errorResponse(res, 'User not authenticated', 'Authentication required', 401);
        }

        if (!currentPassword || !newPassword) {
            return validationErrorResponse(res, 'Current password and new password are required');
        }

        if (newPassword.length < 8) {
            return validationErrorResponse(res, 'New password must be at least 8 characters long');
        }

        // Find SuperAdmin
        const superAdmin = await User.findById(userId);
        if (!superAdmin || superAdmin.role !== 'super_admin') {
            return errorResponse(res, 'SuperAdmin not found', 'Access denied', 403);
        }

        // Verify current password
        const isCurrentPasswordValid = await bcrypt.compare(currentPassword, superAdmin.password);
        if (!isCurrentPasswordValid) {
            return errorResponse(res, 'Current password is incorrect', 'Invalid password', 400);
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update password
        superAdmin.password = hashedPassword;
        await superAdmin.save();

        console.log(`SuperAdmin password changed successfully for: ${superAdmin.email}`);

        return successResponse(res, null, 'Password changed successfully');

    } catch (err) {
        console.error('Change password error:', err);
        return errorResponse(res, err, 'Server Error');
    }
});

module.exports = router;
