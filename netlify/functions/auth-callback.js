const axios = require('axios');

exports.handler = async (event) => {
    console.log('Function called with:', event.queryStringParameters);
    
    // Handle preflight OPTIONS request
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
            },
            body: ''
        };
    }

    if (event.httpMethod !== 'GET') {
        return { 
            statusCode: 405, 
            body: 'Method Not Allowed',
            headers: { 'Access-Control-Allow-Origin': '*' }
        };
    }

    const { code, error } = event.queryStringParameters;

    if (error) {
        return redirectWithError(error);
    }

    if (!code) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'No code provided' }),
            headers: { 'Access-Control-Allow-Origin': '*' }
        };
    }

    try {
        const tokenResponse = await axios.post('https://discord.com/api/oauth2/token', 
            new URLSearchParams({
                client_id: process.env.DISCORD_CLIENT_ID,
                client_secret: process.env.DISCORD_CLIENT_SECRET,
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: 'https://spontaneous-fenglisu-09c8c8.netlify.app/.netlify/functions/auth-callback'
            }), {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );

        const accessToken = tokenResponse.data.access_token;
        const userResponse = await axios.get('https://discord.com/api/users/@me', {
            headers: { Authorization: `Bearer ${accessToken}` }
        });

        return {
            statusCode: 200,
            body: JSON.stringify({ 
                success: true, 
                user: userResponse.data 
            }),
            headers: { 
                'Content-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            }
        };

    } catch (error) {
        console.error('OAuth error:', error.response?.data || error.message);
        return {
            statusCode: 400,
            body: JSON.stringify({ 
                success: false, 
                error: error.response?.data?.error || error.message 
            }),
            headers: { 'Access-Control-Allow-Origin': '*' }
        };
    }
};
