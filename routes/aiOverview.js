const express = require('express');
const router = express.Router();
require('dotenv').config();

const API_KEYS = [
    process.env.OPENROUTER_KEY_1,
    process.env.OPENROUTER_KEY_2,
    process.env.OPENROUTER_KEY_3,
    process.env.OPENROUTER_KEY_4
];

router.post("/recommendations", async (req, res) => {
    try {
        const { analysisData, weatherData } = req.body;
        
        // Get random API key
        const apiKey = API_KEYS[Math.floor(Math.random() * API_KEYS.length)];
        
        // Format critical areas details
        const criticalAreasDetails = analysisData.criticalAreas
            .map(area => `
                ${area.type}:
                - Severity Score: ${area.severity_score.toFixed(2)}
                - High Severity Cases: ${area.high_percentage}%
                - Total Issues: ${area.total}`
            ).join('\n');
        
        const context = `
            Detailed Road Section Analysis:
            
            Overview Statistics:
            - Total Distress Points: ${analysisData.stats.total}
            - Point Density: ${analysisData.density} points/km²
            
            Severity Distribution:
            - High Severity Issues: ${analysisData.stats.high} points (${analysisData.stats.highPercent}%)
            - Medium Severity Issues: ${analysisData.stats.medium} points (${analysisData.stats.mediumPercent}%)
            - Low Severity Issues: ${analysisData.stats.low} points (${analysisData.stats.lowPercent}%)
            
            Critical Areas Breakdown:
            ${criticalAreasDetails}
            
            Environmental Conditions:
            - Current Temperature: ${weatherData?.temperature || 'N/A'}°C
            - Precipitation: ${weatherData?.precipitation || 'N/A'}mm
            - Rainfall: ${weatherData?.rain || 'N/A'}mm
            - Snowfall: ${weatherData?.snowfall || 'N/A'}cm
            
            Additional Context:
            - Most Critical Type: ${analysisData.criticalAreas[0]?.type} (Highest severity score: ${analysisData.criticalAreas[0]?.severity_score.toFixed(2)})
            - Overall High Severity Concentration: ${((analysisData.stats.high / analysisData.stats.total) * 100).toFixed(1)}%
            - Area Coverage: ${(1/analysisData.density * 1000).toFixed(2)} meters between points on average
        `;

        const prompt = `${context}\n\n
        Based on this detailed analysis of the road section in Bangladesh, please provide 5 specific, practical maintenance recommendations suitable for Bangladesh's road infrastructure, climate, and available resources.
        Each recommendation should be a single line with no numbering or bullet points.
        
        Consider these aspects in your recommendations:
        1. Immediate safety concerns for local drivers, pedestrians and rickshaws, especially regarding ${analysisData.criticalAreas[0]?.type} with ${analysisData.criticalAreas[0]?.high_percentage}% high severity cases
        2. Cost-effective repair methods commonly available in Bangladesh, considering limited budgets and the ${analysisData.density} points/km² density of issues
        3. Solutions that work in Bangladesh's monsoon climate and will withstand heavy seasonal rains
        4. Specific local techniques for repairing ${analysisData.criticalAreas.map(a => a.type).join(', ')} using materials and equipment readily available in Bangladesh
        5. Practical timeframes for implementation based on severity and local conditions, don't state any fixed timeframes like in how many days or months
        
        Format your response as plain text with each recommendation on its own line, without any additional explanation or text. Use simple, clear language that both officials and community members can understand.`;

        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'google/gemma-3-27b-it:free',
                messages: [{ role: 'user', content: prompt }],
                stream: true,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('OpenRouter error response:', errorText);
        }

        // Set headers for SSE
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data === '[DONE]') {
                            res.write('data: [DONE]\n\n');
                            break;
                        }

                        res.write(`data: ${data}\n\n`);
                    }
                }
            }
        } finally {
            reader.cancel();
            res.end();
        }
    } catch (error) {
        console.error('AI API error:', error);
        res.status(500).json({ error: 'Failed to get AI recommendations' });
    }
});

module.exports = router; 