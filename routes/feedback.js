const express = require('express');
const publicRouter = express.Router();
const userAuth = require('../middleware/userAuth');
const supabase = require('../config/supabase');
const adminRouter = express.Router();

// GET feedback form
publicRouter.get('/feedback', userAuth, async (req, res) => {
    // Check if user has already submitted feedback
    const { data } = await supabase
        .from('feedback')
        .select('id')
        .eq('user_email', req.session.userEmail)
        .maybeSingle();
    const hasFeedback = !!data;
    res.render('feedback', { userEmail: req.session.userEmail, hasFeedback });
});

// POST feedback form
publicRouter.post('/feedback', userAuth, async (req, res) => {
    // Check if user has already submitted feedback
    const { data } = await supabase
        .from('feedback')
        .select('id')
        .eq('user_email', req.session.userEmail)
        .maybeSingle();
    if (data) {
        // Already submitted
        return res.render('feedback', {
            userEmail: req.session.userEmail,
            hasFeedback: true,
            showToast: true,
            toastType: 'info',
            toastMsg: 'You have already submitted feedback!'
        });
    }
    try {
        const feedback = {
            user_email: req.session.userEmail,
            q1: req.body.q1,
            q2_0: req.body.q2_0,
            q2_1: req.body.q2_1,
            q2_2: req.body.q2_2,
            q2_3: req.body.q2_3,
            q2_4: req.body.q2_4,
            q3: req.body.q3,
            q3_explain: req.body.q3_explain,
            q4: req.body.q4,
            q5: req.body.q5,
            q5_other: req.body.q5_other,
            q6: req.body.q6,
            q7: req.body.q7,
            q8: req.body.q8,
            q8_other: req.body.q8_other,
            q9: req.body.q9,
            q10: req.body.q10,
            submitted_at: new Date().toISOString()
        };
        // Save to supabase
        const { error } = await supabase.from('feedback').insert([feedback]);
        if (error) throw error;
        res.render('feedback', {
            userEmail: req.session.userEmail,
            hasFeedback: true,
            showToast: true,
            toastType: 'success',
            toastMsg: 'Thank you for your feedback!'
        });
    } catch (err) {
        console.error('Feedback submission error:', err);
        res.status(500).render('feedback', { submitted: false, userEmail: req.session.userEmail, hasFeedback: false, error: 'Failed to submit feedback.' });
    }
});

// ADMIN: View all feedbacks
adminRouter.get('/feedbacks', async (req, res) => {
    if (!req.session.adminEmail) {
        return res.redirect('/admin/login');
    }
    const { data: feedbacks, error } = await supabase
        .from('feedback')
        .select('*')
        .order('submitted_at', { ascending: false });
    if (error) {
        return res.status(500).render('error', { message: 'Failed to load feedbacks' });
    }
    res.render('admin/feedbacks', { feedbacks, adminEmail: req.session.adminEmail });
});

// ADMIN: View single feedback by id
adminRouter.get('/feedbacks/:id', async (req, res) => {
    if (!req.session.adminEmail) {
        return res.redirect('/admin/login');
    }
    const { data: feedback, error } = await supabase
        .from('feedback')
        .select('*')
        .eq('id', req.params.id)
        .maybeSingle();
    if (error || !feedback) {
        return res.status(404).render('error', { message: 'Feedback not found' });
    }
    res.render('admin/feedback-view', { feedback, adminEmail: req.session.adminEmail });
});

module.exports = { publicRoutes: publicRouter, adminRoutes: adminRouter }; 