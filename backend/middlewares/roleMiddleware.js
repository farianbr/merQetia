/**
 * Restricts route access to specific roles
 * Usage: authorize('admin') or authorize('admin', 'employee')
 * Must be used AFTER the protect middleware
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role: ${roles.join(' or ')}`,
      });
    }
    next();
  };
};

module.exports = { authorize };
