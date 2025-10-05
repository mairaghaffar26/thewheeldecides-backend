const jwt = require('jsonwebtoken');

const generateAccessToken = (user) => {
    const payload = {
        user: {
            id: user._id,
            role: user.role,
            owner: user.owner || false,
            name: user.name,
            email: user.email,
            instagramHandle: user.instagramHandle
        }
    };
    
    return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '24h' });
};

const verifyAccessToken = (token) => {
    return jwt.verify(token, process.env.JWT_SECRET);
};

module.exports = {
    generateAccessToken,
    verifyAccessToken
};
