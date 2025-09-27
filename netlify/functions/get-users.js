let userDatabase = []; // This should be the same array as in auth-callback.js

exports.handler = async (event) => {
    // Simple authentication check
    const authToken = event.headers.authorization;
    const YOUR_SECRET_KEY = '1223230659972173914'; // Your Discord ID as part of key
    
    if (authToken !== `Bearer ${YOUR_SECRET_KEY}`) {
        return {
            statusCode: 403,
            body: JSON.stringify({ 
                error: 'Access denied. Admin authentication required.' 
            })
        };
    }

    if (event.httpMethod === 'GET') {
        return {
            statusCode: 200,
            headers: { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Authorization'
            },
            body: JSON.stringify({
                success: true,
                totalUsers: userDatabase.length,
                users: userDatabase,
                lastUpdated: new Date().toISOString()
            })
        };
    }

    return {
        statusCode: 405,
        body: JSON.stringify({ error: 'Method not allowed' })
    };
};
