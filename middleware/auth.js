const jwt = require("jsonwebtoken");
const User = require("../models/User");

const auth = async (req, res, next) => {
  let token = req.header("Authorization");

  if (!token) {
    return res
      .status(401)
      .json({ 
        success: false,
        error: "Authorization denied. Token not found." 
      });
  }

  token = token.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if password was changed after token was issued
    const user = await User.findById(decoded.user.id);
    if (!user) {
      return res.status(401).json({ 
        success: false,
        error: 'User not found.' 
      });
    }

    // If password was changed after token was issued, invalidate the token
    if (user.passwordChangedAt && decoded.iat && user.passwordChangedAt > new Date(decoded.iat * 1000)) {
      return res.status(401).json({ 
        success: false,
        error: 'Password has been changed. Please login again.',
        logoutRequired: true
      });
    }

    req.user = decoded.user;
    next();
  } catch (err) {
    res.status(401).json({ 
      success: false,
      error: 'Token is not valid.' 
    });
  }
}

module.exports = auth;
