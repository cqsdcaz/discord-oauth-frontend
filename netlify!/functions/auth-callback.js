const axios = require('axios');

exports.handler = async (event) => {
    if (event.httpMethod !== 'GET') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const { code, state, error } = event.queryStringParameters;

    // Handle OAuth errors
    if (error) {
        return redirectWithError(error);
    }

    if (!code) {
        return redirectWithError('No authorization code received');
    }

    try {
        // Use environment variables
        const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
        const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
        const REDIRECT_URI = 'https://spontaneous-fenglisu-09c8c8.netlify.app/.netlify/functions/auth-callback';

        const tokenResponse = await axios.post('https://discord.com/api/oauth2/token', 
            new URLSearchParams({
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: REDIRECT_URI
            }), {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );

        const accessToken = tokenResponse.data.access_token;

        // Get user info
        const userResponse = await axios.get('https://discord.com/api/users/@me', {
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        });

        // Redirect to your GitHub Pages frontend
        return {
            statusCode: 302,
            headers: {
                Location: `https://your-github-username.github.io/discord-oauth-frontend/callback.html?result=${encodeURIComponent(JSON.stringify({
                    success: true,
                    user: userResponse.data
                }))}`
            }
        };

    } catch (error) {
        console.error('OAuth error:', error.response?.data || error.message);
        return redirectWithError('Authentication failed: ' + (error.response?.data?.error || error.message));
    }
};

function redirectWithError(error) {
    return {
        statusCode: 302,
        headers: {
            Location: `https://your-github-username.github.io/discord-oauth-frontend/callback.html?result=${encodeURIComponent(JSON.stringify({
                success: false,
                error: error
            }))}`
        }
    };
}
