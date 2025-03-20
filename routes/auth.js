const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const SALT_ROUNDS = 10;

// Admin Authentication
router.get('/admin/login', (req, res) => {
    res.render('admin/login', { error: null });
});

router.post('/admin/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const { data: admin, error } = await supabase
            .from('admins')
            .select('*')
            .eq('email', email)
            .single();

        if (error || !admin || admin.password !== password) {
            return res.render('admin/login', { 
                error: 'Invalid email or password' 
            });
        }

        // Set session
        req.session.adminId = admin.id;
        req.session.adminEmail = admin.email;

        // Redirect to survey dashboard
        res.redirect('/admin/survey-dashboard');

    } catch (error) {
        console.error('Login error:', error);
        res.render('admin/login', { 
            error: 'An error occurred during login' 
        });
    }
});

router.get('/admin/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// Surveyor Authentication
router.get('/login', (req, res) => {
    res.render('login', { error: null });
});

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const { data: surveyor, error: surveyorError } = await supabase
            .from('surveyors')
            .select('*')
            .eq('email', email)
            .single();

        if (surveyorError || !surveyor) {
            return res.render('login', { 
                error: 'User not found' 
            });
        }

        // Compare password using bcrypt
        const isValidPassword = await bcrypt.compare(password, surveyor.password);

        if (!isValidPassword) {
            return res.render('login', { 
                error: 'Invalid password' 
            });
        }

        // Set session for surveyor
        req.session.userId = surveyor.id;
        req.session.userEmail = surveyor.email;

        return res.redirect('/survey');

    } catch (error) {
        res.render('login', { 
            error: 'An error occurred during login' 
        });
    }
});

router.get('/register', (req, res) => {
    res.redirect('/evaluation');
});

router.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

// Password Reset
router.get('/set-password/:token', async (req, res) => {
    try {
        const { token } = req.params;
        
        // Verify token
        const decoded = jwt.verify(token, JWT_SECRET);
        
        // Check if surveyor exists
        const { data: surveyor, error } = await supabase
            .from('surveyors')
            .select('email')
            .eq('email', decoded.email)
            .single();

        if (error || !surveyor) {
            return res.render('error', {
                message: 'Invalid or expired link'
            });
        }

        res.render('setpass', {
            token: token,
            email: surveyor.email,
            error: null
        });

    } catch (error) {
        if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
            return res.render('error', {
                message: 'Password reset link has expired'
            });
        }
        res.render('error', {
            message: 'Failed to process request'
        });
    }
});

router.post('/set-password/:token', async (req, res) => {
    try {
        const { token } = req.params;
        const { password, confirmPassword } = req.body;

        // Verify token
        const decoded = jwt.verify(token, JWT_SECRET);

        if (password !== confirmPassword) {
            return res.render('setpass', {
                token: token,
                error: 'Passwords do not match'
            });
        }

        // Hash the new password
        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

        // Update password in database
        const { error: updateError } = await supabase
            .from('surveyors')
            .update({ 
                password: hashedPassword
            })
            .eq('email', decoded.email);

        if (updateError) throw updateError;

        res.redirect('/login?message=Password set successfully. Please login.');

    } catch (error) {
        if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
            return res.render('error', {
                message: 'Password reset link has expired'
            });
        }
        res.render('setpass', {
            token: token,
            error: 'Failed to update password'
        });
    }
});

module.exports = router; 