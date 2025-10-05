module.exports = function (req, res, next) {
  if (!req.user || req.user.role !== 'user') {
    return res.status(403).json({ 
      success: false,
      error: 'Access denied. User access required.' 
    });
  }
  next();
};
