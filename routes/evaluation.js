const express = require('express');
const publicRouter = express.Router();
const adminRouter = express.Router();
const supabase = require('../config/supabase');
const axios = require('axios');
const Papa = require('papaparse');
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const SALT_ROUNDS = 10;

// Configure Gmail transporter
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Email sending function
async function sendEmail(to, subject, htmlContent) {
    try {
        const mailOptions = {
            from: {
                name: "Road Lens",
                address: process.env.EMAIL_USER
            },
            to: to,
            subject: subject,
            html: htmlContent
        };

        const info = await transporter.sendMail(mailOptions);
        // console.log('Email sent successfully:', info.messageId);
        return info;
    } catch (error) {
        console.error('Email sending error:', error);
        throw error;
    }
}

// Public routes
publicRouter.post('/submit-evaluation', async (req, res) => {
    try {
        const {
            personalInfo,
            knowledgeResponses,
            imageAssessments,
            fieldTest
        } = req.body;

        // Validate personal info
        if (!personalInfo || typeof personalInfo !== 'object') {
            throw new Error('Invalid personal information format');
        }

        const { data: evaluatorResponse, error: evaluatorError } = await supabase
            .from('evaluator_responses')
            .insert([{
                full_name: personalInfo.fullName || '',
                age: parseInt(personalInfo.age) || 0,
                institution_type: personalInfo.institutionType || '',
                institution_name: personalInfo.institutionName || '',
                email: personalInfo.email || '',
                phone: personalInfo.phone || '',
            }])
            .select()
            .single();

        if (evaluatorError) {
            console.error('Evaluator response error:', evaluatorError);
            throw new Error(`Failed to insert evaluator response: ${evaluatorError.message}`);
        }

        // Validate and clean knowledge responses
        const validKnowledgeResponses = knowledgeResponses
            .filter(response => response && response.questionId && response.answer)
            .map(response => ({
                response_id: evaluatorResponse.id,
                question_id: response.questionId.replace('question', ''), // Remove 'question' prefix if present
                selected_option: response.answer
            }));

        if (validKnowledgeResponses.length > 0) {
            const { error: knowledgeError } = await supabase
                .from('knowledge_responses')
                .insert(validKnowledgeResponses);

            if (knowledgeError) {
                console.error('Knowledge response error:', knowledgeError);
                throw new Error(`Failed to insert knowledge responses: ${knowledgeError.message}`);
            }
        }

        // Validate and clean image assessments
        const validImageAssessments = imageAssessments
            .filter(assessment => assessment && assessment.imageId && assessment.distressType)
            .map(assessment => ({
                response_id: evaluatorResponse.id,
                image_id: assessment.imageId,
                distress_type: assessment.distressType,
                distress_level: parseInt(assessment.distressLevel) || 0
            }));

        if (validImageAssessments.length > 0) {
            const { error: imageError } = await supabase
                .from('image_assessment_responses')
                .insert(validImageAssessments);

            if (imageError) {
                console.error('Image assessment error:', imageError);
                throw new Error(`Failed to insert image assessments: ${imageError.message}`);
            }
        }

        // Handle field test with potential missing GPS data
        if (fieldTest && fieldTest.imageUrl) {
            const fieldTestData = {
                response_id: evaluatorResponse.id,
                image_url: fieldTest.imageUrl,
                distress_type: fieldTest.distressType || '',
                distress_level: parseInt(fieldTest.distressLevel) || 0
            };

            // Only add GPS data if it's valid
            if (!isNaN(fieldTest.latitude) && !isNaN(fieldTest.longitude)) {
                fieldTestData.latitude = fieldTest.latitude;
                fieldTestData.longitude = fieldTest.longitude;
                fieldTestData.accuracy = fieldTest.accuracy || null;
            }

            const { error: fieldError } = await supabase
                .from('field_test_responses')
                .insert([fieldTestData]);

            if (fieldError) {
                console.error('Field test error:', fieldError);
                throw new Error(`Failed to insert field test response: ${fieldError.message}`);
            }
        }

        res.json({
            success: true,
            message: 'Evaluation submitted successfully',
            responseId: evaluatorResponse.id
        });

    } catch (error) {
        console.error('Detailed submission error:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to submit evaluation',
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// Admin routes
adminRouter.get('/evaluation-dashboard', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const offset = (page - 1) * limit;

        // Get total count first
        const { count } = await supabase
            .from('evaluator_responses')
            .select('*', { count: 'exact', head: true });

        // Get paginated evaluations
        const { data: evaluations, error: evalError } = await supabase
            .from('evaluator_responses')
            .select('*')
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (evalError) throw evalError;

        res.render('admin/evaluation-dashboard', { 
            evaluations,
            adminEmail: req.session.adminEmail,
            pagination: {
                current: page,
                total: Math.ceil(count / limit),
                hasNext: page < Math.ceil(count / limit),
                hasPrev: page > 1
            },
            totalEvaluations: count
        });
    } catch (error) {
        console.error('Error fetching evaluations:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to fetch evaluations'
        });
    }
});

adminRouter.get('/evaluation-form/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Fetch evaluator response
        const { data: evaluator, error: evalError } = await supabase
            .from('evaluator_responses')
            .select('*')
            .eq('id', id)
            .single();

        if (evalError) throw evalError;

        // Fetch knowledge responses
        const { data: knowledgeResponses, error: knowledgeError } = await supabase
            .from('knowledge_responses')
            .select('*')
            .eq('response_id', id);

        if (knowledgeError) throw knowledgeError;

        // Fetch image assessments
        const { data: imageAssessments, error: imageError } = await supabase
            .from('image_assessment_responses')
            .select('*')
            .eq('response_id', id);

        if (imageError) throw imageError;

        // Fetch field test
        const { data: fieldTest, error: fieldError } = await supabase
            .from('field_test_responses')
            .select('*')
            .eq('response_id', id)
            .single();

        if (fieldError && fieldError.code !== 'PGRST116') throw fieldError;

        // Fetch questions for scoring and images
        const ques_csv_url = "https://docs.google.com/spreadsheets/d/e/2PACX-1vS8fFNkG24M2faL6mRCd2jptGwzxzL71hdxr2B19bFewrXQJ8PDoHRC99bNX9mCSKoXiXcI29DH0_Ne/pub?gid=0&single=true&output=csv";
        const quesResponse = await axios.get(ques_csv_url);
        const questions = Papa.parse(quesResponse.data, {
            header: true,
            skipEmptyLines: true
        }).data;

        // Enhance image assessments with image URLs from questions
        const enhancedImageAssessments = imageAssessments.map(assessment => {
            const questionImage = questions.find(q => q.ImgId === assessment.image_id);
            return {
                ...assessment,
                image_url: questionImage ? questionImage.ImgQues : null
            };
        });

        res.render('admin/evaluation-form', {
            evaluator,
            knowledgeResponses,
            imageAssessments: enhancedImageAssessments,
            fieldTest,
            questions,
            adminEmail: req.session.adminEmail
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Update the approve endpoint to use Gmail
adminRouter.post('/approve/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Get the evaluator response
        const { data: evaluator, error: evalError } = await supabase
            .from('evaluator_responses')
            .select('*')
            .eq('id', id)
            .single();

        if (evalError) throw evalError;

        // Check if email already exists
        const { data: existingSurveyor, error: checkError } = await supabase
            .from('surveyors')
            .select('id')
            .eq('email', evaluator.email)
            .single();

        if (existingSurveyor) {
            return res.status(400).json({
                success: false,
                message: 'This email is already registered as a surveyor'
            });
        }

        const tempPassword = Math.random().toString(36).slice(-8);
        const hashedPassword = await bcrypt.hash(tempPassword, SALT_ROUNDS);

        const resetToken = jwt.sign(
            { email: evaluator.email },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        // Update evaluator status
        const { error: updateError } = await supabase
            .from('evaluator_responses')
            .update({ status: 'approved' })
            .eq('id', id);

        if (updateError) throw updateError;

        // Create surveyor record
        const { data: surveyor, error: surveyorError } = await supabase
            .from('surveyors')
            .insert([{
                surveyor_id: id,
                email: evaluator.email,
                password: hashedPassword,
                status: 'approved'
            }])
            .select()
            .single();

        if (surveyorError) throw surveyorError;

        // Send welcome email
        const setPasswordUrl = `${process.env.APP_URL}/set-password/${resetToken}`;
        await sendEmail(
            evaluator.email,
            'Welcome to Road Lens - Set Your Password',
            `<!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Welcome to Road Lens</title>
                <style>
                    body {
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                        line-height: 1.6;
                        color: #333;
                        max-width: 600px;
                        margin: 0 auto;
                        padding: 20px;
                    }
                    .email-container {
                        border: 1px solid #e0e0e0;
                        border-radius: 8px;
                        overflow: hidden;
                        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.05);
                    }
                    .header {
                        background: linear-gradient(135deg, #3498db, #30be46);
                        color: white;
                        padding: 20px;
                        text-align: center;
                        padding-top: 2.5rem;
                    }
                    .logo {
                        font-size: 28px;
                        font-weight: bold;
                        margin-bottom: 5px;
                    }
                    .content {
                        padding: 30px;
                        background-color: #ffffff;
                    }
                    .footer {
                        background-color: #f5f5f5;
                        padding: 15px;
                        text-align: center;
                        font-size: 12px;
                        color: #666;
                    }
                    .btn-container {
                        text-align: center;
                        margin: 30px 0;
                    }
                    .btn {
                        display: inline-block;
                        background: linear-gradient(135deg, #3498db, #30be46);
                        color: white;
                        text-decoration: none;
                        padding: 14px 32px;
                        border-radius: 50px;
                        font-weight: bold;
                        font-size: 16px;
                        text-transform: uppercase;
                        letter-spacing: 1px;
                        box-shadow: 0 4px 10px rgba(41, 128, 185, 0.3);
                        transition: all 0.3s ease;
                        border: 2px solid transparent;
                    }
                    .btn:hover {
                        background: linear-gradient(190deg, #3498db, #30be46);
                        transform: translateY(-2px);
                        box-shadow: 0 6px 15px rgba(41, 128, 185, 0.4);
                    }
                    .password-container {
                        background-color: #f8f9fa;
                        border: 1px dashed #ccc;
                        border-radius: 4px;
                        padding: 10px;
                        margin: 15px 0;
                        text-align: center;
                    }
                    .password {
                        font-family: monospace;
                        font-size: 18px;
                        letter-spacing: 1px;
                    }
                    .note {
                        font-size: 13px;
                        color: #777;
                        margin-top: 25px;
                        border-top: 1px solid #eee;
                        padding-top: 15px;
                    }
                </style>
            </head>
            <body>
                <div class="email-container">
                    <div class="header">
                        <div class="logo"><img src="https://pixeldrain.com/api/file/VmZsBvXN" alt="Road Lens Logo" style="width: 10rem; margin-bottom: 0.5rem;"></div>
                        <div>Road Survey Management Platform</div>
                    </div>
                    
                    <div class="content">
                        <h2>Welcome to the Road Lens Team!</h2>
                        
                        <p>Congratulations! Your evaluator application has been approved, and you are now officially registered as a Road Lens Surveyor.</p>
                        
                        <p>We're excited to have you join our network of professionals dedicated to improving road infrastructure through accurate data collection and analysis.</p>
                        
                        <div class="password-container">
                            <p>Your temporary password is:</p>
                            <p class="password"><strong>${tempPassword}</strong></p>
                        </div>
                        
                        <p>To get started with your surveyor account, please set a new password by clicking the button below:</p>
                        
                        <div class="btn-container">
                            <a href="${setPasswordUrl}" class="btn">Set Your New Password</a>
                        </div>
                        
                        <p class="note">This link will expire in 24 hours. If you need assistance, please contact our support team.</p>
                    </div>
                    
                    <div class="footer">
                        <p>&copy; 2025 Road Lens, Inc. All rights reserved.</p>
                        <p>This email was sent to you because you registered as an evaluator on our platform.</p>
                    </div>
                </div>
            </body>
            </html>`
        );

        res.json({
            success: true,
            message: 'Evaluator approved as surveyor successfully'
        });

    } catch (error) {
        console.error('Approval error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to approve evaluator'
        });
    }
});

// Add this route after the approve route
adminRouter.post('/add-manual-surveyor', async (req, res) => {
    try {
        const { email, fullName, age, institutionType, institutionName } = req.body;
        
        // Check if email already exists
        const { data: existingSurveyor, error: checkError } = await supabase
            .from('surveyors')
            .select('id')
            .eq('email', email)
            .single();

        if (existingSurveyor) {
            return res.status(400).json({
                success: false,
                message: 'This email is already registered as a surveyor'
            });
        }

        // Generate temporary password and UUID
        const tempPassword = Math.random().toString(36).slice(-8);
        const hashedPassword = await bcrypt.hash(tempPassword, SALT_ROUNDS);
        const surveyorId = uuidv4();

        // Create evaluator response first
        const { data: evaluator, error: evalError } = await supabase
            .from('evaluator_responses')
            .insert([{
                id: surveyorId,
                full_name: fullName,
                age: age ? parseInt(age) : null,
                institution_type: institutionType,
                institution_name: institutionName,
                email: email,
                status: 'approved'
            }])
            .select()
            .single();

        if (evalError) throw evalError;

        // Create surveyor record
        const { data: surveyor, error: surveyorError } = await supabase
            .from('surveyors')
            .insert([{
                surveyor_id: surveyorId,
                email: email,
                password: hashedPassword,
                status: 'approved'
            }])
            .select()
            .single();

        if (surveyorError) throw surveyorError;

        // Generate reset token
        const resetToken = jwt.sign(
            { email: email },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        // Reuse the same email sending code from the approve route
        const setPasswordUrl = `${process.env.APP_URL}/set-password/${resetToken}`;
        await sendEmail(
            email,
            'Welcome to Road Lens - Set Your Password',
            `<!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Welcome to Road Lens</title>
                <style>
                    body {
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                        line-height: 1.6;
                        color: #333;
                        max-width: 600px;
                        margin: 0 auto;
                        padding: 20px;
                    }
                    .email-container {
                        border: 1px solid #e0e0e0;
                        border-radius: 8px;
                        overflow: hidden;
                        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.05);
                    }
                    .header {
                        background: linear-gradient(135deg, #3498db, #30be46);
                        color: white;
                        padding: 20px;
                        text-align: center;
                        padding-top: 2.5rem;
                    }
                    .logo {
                        font-size: 28px;
                        font-weight: bold;
                        margin-bottom: 5px;
                    }
                    .content {
                        padding: 30px;
                        background-color: #ffffff;
                    }
                    .footer {
                        background-color: #f5f5f5;
                        padding: 15px;
                        text-align: center;
                        font-size: 12px;
                        color: #666;
                    }
                    .btn-container {
                        text-align: center;
                        margin: 30px 0;
                    }
                    .btn {
                        display: inline-block;
                        background: linear-gradient(135deg, #3498db, #30be46);
                        color: white;
                        text-decoration: none;
                        padding: 14px 32px;
                        border-radius: 50px;
                        font-weight: bold;
                        font-size: 16px;
                        text-transform: uppercase;
                        letter-spacing: 1px;
                        box-shadow: 0 4px 10px rgba(41, 128, 185, 0.3);
                        transition: all 0.3s ease;
                        border: 2px solid transparent;
                    }
                    .btn:hover {
                        background: linear-gradient(190deg, #3498db, #30be46);
                        transform: translateY(-2px);
                        box-shadow: 0 6px 15px rgba(41, 128, 185, 0.4);
                    }
                    .password-container {
                        background-color: #f8f9fa;
                        border: 1px dashed #ccc;
                        border-radius: 4px;
                        padding: 10px;
                        margin: 15px 0;
                        text-align: center;
                    }
                    .password {
                        font-family: monospace;
                        font-size: 18px;
                        letter-spacing: 1px;
                    }
                    .note {
                        font-size: 13px;
                        color: #777;
                        margin-top: 25px;
                        border-top: 1px solid #eee;
                        padding-top: 15px;
                    }
                </style>
            </head>
            <body>
                <div class="email-container">
                    <div class="header">
                        <div class="logo"><img src="https://pixeldrain.com/api/file/VmZsBvXN" alt="Road Lens Logo" style="width: 10rem; margin-bottom: 0.5rem;"></div>
                        <div>Road Survey Management Platform</div>
                    </div>
                    
                    <div class="content">
                        <h2>Welcome to the Road Lens Team!</h2>
                        
                        <p>Congratulations! Your evaluator application has been approved, and you are now officially registered as a Road Lens Surveyor.</p>
                        
                        <p>We're excited to have you join our network of professionals dedicated to improving road infrastructure through accurate data collection and analysis.</p>
                        
                        <div class="password-container">
                            <p>Your temporary password is:</p>
                            <p class="password"><strong>${tempPassword}</strong></p>
                        </div>
                        
                        <p>To get started with your surveyor account, please set a new password by clicking the button below:</p>
                        
                        <div class="btn-container">
                            <a href="${setPasswordUrl}" class="btn">Set Your New Password</a>
                        </div>
                        
                        <p class="note">This link will expire in 24 hours. If you need assistance, please contact our support team.</p>
                    </div>
                    
                    <div class="footer">
                        <p>&copy; 2025 Road Lens, Inc. All rights reserved.</p>
                        <p>This email was sent to you because you registered as an evaluator on our platform.</p>
                    </div>
                </div>
            </body>
            </html>`
        );

        res.json({
            success: true,
            message: 'Surveyor added successfully'
        });

    } catch (error) {
        console.error('Add surveyor error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to add surveyor'
        });
    }
});

adminRouter.post('/reject/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Update evaluator response status to rejected
        const { error: updateError } = await supabase
            .from('evaluator_responses')
            .update({ status: 'rejected' })
            .eq('id', id);

        if (updateError) throw updateError;

        res.json({
            success: true,
            message: 'Evaluation rejected successfully'
        });

    } catch (error) {
        console.error('Rejection error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to reject evaluation'
        });
    }
});

module.exports = {
    publicRoutes: publicRouter,
    adminRoutes: adminRouter
};
