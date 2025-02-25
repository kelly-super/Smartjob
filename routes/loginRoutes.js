const express = require('express');
const db = require('../database');
const bcrypt = require('bcryptjs');
const router = express.Router();

// Show login page
router.get('/login', (req, res) => {
    // If already logged in, redirect to dashboard
    if (req.session.user) {
        return res.redirect('/dashboard');
    }
    res.render('login', {
        messages: {
            error_msg: req.flash('error_msg'),
            success_msg: req.flash('success_msg')
        }
    });
});


// Handle login
router.post('/login', async (req, res) => {
    console.log('Login attempt:', req.body);
    const { user_code, password } = req.body;

    if (!user_code || !password) {
        req.flash('error_msg', 'Please enter both user code and password');
        return res.redirect('/login');
    }

    try {
        const user = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM users WHERE user_code = ?', [user_code], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        console.log('Found user:', user ? 'yes' : 'no');

        if (!user) {
            req.flash('error_msg', 'Invalid user code or password');
            return res.redirect('/login');
        }

        // For development testing (remove in production)
        console.log('Comparing passwords...');
        const isMatch = password === user.user_password;
        // For production with hashed passwords:
        // const isMatch = await bcrypt.compare(password, user.user_password);

        console.log('Password match:', isMatch ? 'yes' : 'no');

        if (!isMatch) {
            req.flash('error_msg', 'Invalid user code or password');
            return res.redirect('/login');
        }

        // Set user session
        req.session.user = {
            user_id: user.user_id,
            user_name: user.user_name,
            user_role: user.user_role
        };

        console.log('Session set:', req.session.user);
        res.redirect('/dashboard');

    } catch (err) {
        console.error('Login error:', err);
        req.flash('error_msg', 'An error occurred during login');
        res.redirect('/login');
    }
});

// Handle logout
router.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Logout error:', err);
            req.flash('error_msg', 'Error during logout');
        }
        res.clearCookie('connect.sid'); // Clear session cookie
        res.redirect('/login');
    });
});
module.exports = router;
