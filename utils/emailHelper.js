const nodemailer = require('nodemailer');

// Create transporter
const createTransporter = () => {
    return nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT,
        secure: false,
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });
};

// Send email function
const sendEmail = async (to, subject, text, html = null) => {
    try {
        const transporter = createTransporter();
        
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to,
            subject,
            text,
            html
        };

        const result = await transporter.sendMail(mailOptions);
        console.log('Email sent successfully:', result.messageId);
        return result;
    } catch (error) {
        console.error('Error sending email:', error);
        throw error;
    }
};

// Send welcome email
const sendWelcomeEmail = async (user) => {
    const subject = 'Welcome to The Wheel Decides!';
    const text = `Welcome ${user.name}! You're now part of the ultimate gamified giveaway experience.`;
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px;">
            <h2 style="color: #333;">Welcome to The Wheel Decides!</h2>
            <p>Hello <strong>${user.name}</strong>,</p>
            <p>Welcome to the ultimate gamified giveaway experience! You're now registered and ready to spin the wheel.</p>
            <p>Your Instagram handle: <strong>${user.instagramHandle}</strong></p>
            <p>Good luck and may the wheel be in your favor!</p>
            <hr style="margin: 20px 0;">
            <p style="color: #666; font-size: 12px;">© ${new Date().getFullYear()} The Wheel Decides. All rights reserved.</p>
        </div>
    `;
    
    return sendEmail(user.email, subject, text, html);
};

// Send winner notification
const sendWinnerEmail = async (user, spinDetails) => {
    const subject = '🎉 Congratulations! You Won!';
    const text = `Congratulations ${user.name}! You won the latest spin!`;
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; text-align: center;">
            <h1 style="color: #ff6b6b;">🎉 Congratulations!</h1>
            <h2 style="color: #333;">You Won The Wheel Decides!</h2>
            <p>Hello <strong>${user.name}</strong>,</p>
            <p>Congratulations! You are the winner of the latest spin!</p>
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p><strong>Spin Details:</strong></p>
                <p>Spin ID: ${spinDetails.spinId}</p>
                <p>Win Date: ${new Date(spinDetails.winDate).toLocaleString()}</p>
                <p>Prize: ${spinDetails.prize || 'Mystery Prize'}</p>
            </div>
            <p>Please check your dashboard for more details and claim your prize!</p>
            <hr style="margin: 20px 0;">
            <p style="color: #666; font-size: 12px;">© ${new Date().getFullYear()} The Wheel Decides. All rights reserved.</p>
        </div>
    `;
    
    return sendEmail(user.email, subject, text, html);
};

// Send password reset email
const sendPasswordResetEmail = async (user, resetToken) => {
    const resetUrl = `${process.env.FRONT_END_URL}/admin/reset-password?token=${resetToken}`;
    const subject = '🔐 SuperAdmin Password Reset Request';
    const text = `Hello ${user.name}, you requested a password reset. Click the link to reset your password: ${resetUrl}`;
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px;">
            <h2 style="color: #333;">🔐 SuperAdmin Password Reset</h2>
            <p>Hello <strong>${user.name}</strong>,</p>
            <p>You have requested to reset your SuperAdmin password for The Wheel Decides platform.</p>
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
                <p><strong>Click the button below to reset your password:</strong></p>
                <a href="${resetUrl}" style="background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 10px 0;">
                    Reset Password
                </a>
                <p style="font-size: 12px; color: #666; margin-top: 15px;">
                    This link will expire in 1 hour for security reasons.
                </p>
            </div>
            <p><strong>If you didn't request this password reset, please ignore this email.</strong></p>
            <p>For security reasons, this link will expire in 1 hour.</p>
            <hr style="margin: 20px 0;">
            <p style="color: #666; font-size: 12px;">© ${new Date().getFullYear()} The Wheel Decides. All rights reserved.</p>
        </div>
    `;
    
    return sendEmail(user.email, subject, text, html);
};

// Export sendEmail as default for compatibility with reference backend
module.exports = sendEmail;

// Named exports for specific email functions
module.exports.sendEmail = sendEmail;
module.exports.sendWelcomeEmail = sendWelcomeEmail;
module.exports.sendWinnerEmail = sendWinnerEmail;
module.exports.sendPasswordResetEmail = sendPasswordResetEmail;
