const authMiddleware = (req, res, next) => {
    // Skip authentication for login routes
    
    if (req.path.startsWith('/login')) {
        
        return next();
    }

    // Check if user is authenticated
    if (!req.session.user) {
      
        req.flash('error_msg', 'Please log in to access this page');
        return res.redirect('/login');
    }

    // Make user data available to all views
    res.locals.user = req.session.user;
    res.locals.success_msg = req.flash('success_msg');
    res.locals.error_msg = req.flash('error_msg');
    
    next();
};

module.exports = authMiddleware;