const express = require('express');
const publicRouter = express.Router();
const adminRouter = express.Router();
const supabase = require('../config/supabase');
const auth = require('../middleware/auth');
const userAuth = require('../middleware/userAuth');
require('dotenv').config();

// User dashboard
publicRouter.get('/my-surveys', userAuth, async (req, res) => {
    try {
        // Get surveyor details with evaluator info
        const { data: surveyor, error: surveyorError } = await supabase
            .from('surveyors')
            .select(`
                id,
                evaluator_responses!surveyors_surveyor_id_fkey (
                    full_name,
                    institution_type,
                    institution_name
                )
            `)
            .eq('email', req.session.userEmail)
            .single();

        if (surveyorError) throw surveyorError;

        // Get all surveys by this surveyor
        const { data: surveys, error: surveysError } = await supabase
            .from('surveys')
            .select('*')
            .eq('surveyor_id', surveyor.id)
            .order('created_at', { ascending: false });

        if (surveysError) throw surveysError;

        res.render('my-surveys', {
            surveys,
            evaluator: surveyor.evaluator_responses,
            userEmail: req.session.userEmail
        });

    } catch (error) {
        console.error('Error fetching user surveys:', error);
        res.status(500).render('error', {
            message: 'Failed to load surveys'
        });
    }
});

// Public routes for survey
publicRouter.post('/submit-survey', userAuth, async (req, res) => {
    try {
        const {
            roadType,
            trafficVolume,
            distressType,
            distressArea,
            distressSeverity,
            repairUrgency,
            drainageCondition,
            accidentHistory,
            surroundingArea,
            usageIssues,
            imageUrl,
            latitude,
            longitude,
            accuracy
        } = req.body;

        // Get the surveyor's details
        const { data: surveyor, error: surveyorError } = await supabase
            .from('surveyors')
            .select('id, surveyor_id')  // id is bigint, surveyor_id is uuid
            .eq('email', req.session.userEmail)
            .single();

        if (surveyorError) {
            throw new Error('Failed to verify surveyor');
        }

        // Insert into surveys table
        const { data: survey, error: surveyError } = await supabase
            .from('surveys')
            .insert([{
                surveyor_id: surveyor.id,  // bigint from surveyors.id
                evaluator_response_id: surveyor.surveyor_id,  // uuid from evaluator_responses.id
                road_type: roadType,
                traffic_volume: trafficVolume,
                distress_type: distressType,
                distress_area: distressArea,
                distress_severity: distressSeverity,
                repair_urgency: repairUrgency,
                drainage_condition: drainageCondition,
                accident_history: accidentHistory,
                surrounding_area: surroundingArea,
                usage_issues: usageIssues,
                image_url: imageUrl,
                latitude: latitude,
                longitude: longitude,
                accuracy: accuracy
            }])
            .select()
            .single();

        if (surveyError) {
            throw surveyError;
        }

        res.json({
            success: true,
            message: 'Survey submitted successfully',
            data: survey
        });

    } catch (error) {
        console.error('Survey submission error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to submit survey'
        });
    }
});

// Delete survey
publicRouter.delete('/surveys/delete/:id', userAuth, async (req, res) => {
    try {
        const { id } = req.params;

        // Get the surveyor's ID
        const { data: surveyor, error: surveyorError } = await supabase
            .from('surveyors')
            .select('id')
            .eq('email', req.session.userEmail)
            .single();

        if (surveyorError) throw surveyorError;

        // Delete the survey
        const { error } = await supabase
            .from('surveys')
            .delete()
            .eq('id', id)
            .eq('surveyor_id', surveyor.id);  // Ensure user owns this survey

        if (error) throw error;

        res.json({
            success: true,
            message: 'Survey deleted successfully'
        });

    } catch (error) {
        console.error('Delete error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to delete survey'
        });
    }
});

// Public endpoint to submit a report
publicRouter.post('/report-distress', async (req, res) => {
    try {
        const { pointId, reason, message } = req.body;
        if (!pointId || !reason) {
            return res.status(400).json({ success: false, message: 'Missing required fields.' });
        }
        const { error } = await supabase
            .from('reports')
            .insert([{ point_id: pointId, reason, message, status: 'open' }]);
        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Admin routes for survey management
adminRouter.get('/survey-dashboard', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const offset = (page - 1) * limit;

        // Get total count first
        const { count } = await supabase
            .from('surveyors')
            .select('*', { count: 'exact', head: true });

        // Get paginated surveyors with their latest activity
        const { data: surveyors, error: surveyorsError } = await supabase
            .from('surveyors')
            .select(`
                id,
                email,
                evaluator_responses!surveyors_surveyor_id_fkey (
                    full_name,
                    institution_type,
                    institution_name
                ),
                surveys (
                    id,
                    road_type,
                    distress_type,
                    distress_severity,
                    traffic_volume,
                    distress_area,
                    repair_urgency,
                    drainage_condition,
                    accident_history,
                    image_url,
                    latitude,
                    longitude,
                    accuracy,
                    created_at
                )
            `)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (surveyorsError) throw surveyorsError;

        res.render('admin/survey-dashboard', {
            surveyors,
            adminEmail: req.session.adminEmail,
            pagination: {
                current: page,
                total: Math.ceil(count / limit),
                hasNext: page < Math.ceil(count / limit),
                hasPrev: page > 1
            },
            totalSurveyors: count
        });

    } catch (error) {
        console.error('Error fetching surveyors:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to fetch surveyors'
        });
    }
});

// Admin delete route
adminRouter.delete('/surveys/delete/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Delete the survey (no need to check ownership since admin can delete any)
        const { error } = await supabase
            .from('surveys')
            .delete()
            .eq('id', id);

        if (error) throw error;

        res.json({
            success: true,
            message: 'Survey deleted successfully'
        });

    } catch (error) {
        console.error('Admin delete error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to delete survey'
        });
    }
});

// Admin: view all reports
adminRouter.get('/reports', async (req, res) => {
    try {
        const { data: reports, error } = await supabase
            .from('reports')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) throw error;
        res.render('admin/reports', { reports, adminEmail: req.session.adminEmail });
    } catch (error) {
        res.status(500).render('error', { message: error.message });
    }
});

// Admin: resolve a report
adminRouter.patch('/reports/:id/resolve', async (req, res) => {
    try {
        const { id } = req.params;
        const { resolution_note } = req.body;
        const resolved_by = req.session.adminEmail;
        const { error } = await supabase
            .from('reports')
            .update({
                status: 'resolved',
                resolved_at: new Date().toISOString(),
                resolved_by,
                resolution_note
            })
            .eq('id', id);
        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = {
    publicRoutes: publicRouter,
    adminRoutes: adminRouter
}; 