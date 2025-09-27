const axios = require('axios');

exports.handler = async (event) => {
    // Only allow GET requests
    if (event.httpMethod !== 'GET') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const { code, state, error } = event.queryStringParameters;

    // Handle OAuth errors
    if (error) {
        return redirectWithError(error);
    }

    // Verify we have an authorization code
    if (!code) {
        return redirectWithError('No authorization code received');
    }

    try {
        // Exchange code for access token
        const tokenResponse = await axios.post('https://discord.com/api/oauth2/token', 
            new URLSearchParams({
                client_id: process.env.DISCORD_CLIENT_ID,
                client_secret: process.env.DISCORD_CLIENT_SECRET,
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: `${process.env.URL}/.netlify/functions/auth-callback`
            }), {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );

        const accessToken = tokenResponse.data.access_token;

        // Get user info from Discord
        const userResponse = await axios.get('https://discord.com/api/users/@me', {
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        });

        // Redirect back to frontend with user data
        return {
            statusCode: 302,
            headers: {
                Location: `https://YOUR_GITHUB_USERNAME.github.io/discord-oauth-frontend/callback.html?result=${encodeURIComponent(JSON.stringify({
                    success: true,
                    user: userResponse.data
                }))}`
            }
        };

    } catch (error) {
        console.error('OAuth error:', error.response?.data || error.message);
        return redirectWithError('Authentication failed');
    }
};

function redirectWithError(error) {
    return {
        statusCode: 302,
        headers: {
            Location: `https://YOUR_GITHUB_USERNAME.github.io/discord-oauth-frontend/callback.html?result=${encodeURIComponent(JSON.stringify({
                success: false,
                error: error
            }))}`
        }
    };
}
