const fs = require('fs');

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const userData = JSON.parse(event.body);
        const timestamp = new Date().toISOString();
        
        // Create a simple log entry
        const logEntry = {
            timestamp: timestamp,
            user: userData
        };
        
        // This would save to a file (note: Netlify functions are read-only)
        // Instead, we'll return the data and you can handle it client-side
        // or use a proper database
        
        return {
            statusCode: 200,
            body: JSON.stringify({ 
                success: true, 
                message: 'User data processed',
                data: logEntry 
            })
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};
