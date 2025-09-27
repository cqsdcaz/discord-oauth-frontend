exports.handler = async (event) => {
    // Handle CORS preflight
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

    // Only allow GET requests
    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ error: 'Method Not Allowed' })
        };
    }

    const { code, error, state } = event.queryStringParameters;

    // Handle OAuth errors from Discord
    if (error) {
        return redirectToFrontend({ success: false, error: error });
    }

    // Check if we have an authorization code
    if (!code) {
        return redirectToFrontend({ success: false, error: 'No authorization code received' });
    }

    try {
        // Exchange code for access token
        const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                client_id: process.env.DISCORD_CLIENT_ID,
                client_secret: process.env.DISCORD_CLIENT_SECRET,
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: 'https://spontaneous-fenglisu-09c8c8.netlify.app/.netlify/functions/auth-callback'
            })
        });

        if (!tokenResponse.ok) {
            const errorData = await tokenResponse.text();
            throw new Error(`Token exchange failed: ${tokenResponse.status} ${errorData}`);
        }

        const tokenData = await tokenResponse.json();
        const accessToken = tokenData.access_token;

        // Get user info from Discord
        const userResponse = await fetch('https://discord.com/api/users/@me', {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        if (!userResponse.ok) {
            throw new Error(`User info fetch failed: ${userResponse.status}`);
        }

        const userData = await userResponse.json();

        // Redirect to frontend with success
        return redirectToFrontend({ 
            success: true, 
            user: {
                id: userData.id,
                username: userData.username,
                discriminator: userData.discriminator,
                avatar: userData.avatar,
                email: userData.email
            }
        });

    } catch (error) {
        console.error('OAuth error:', error);
        return redirectToFrontend({ 
            success: false, 
            error: error.message || 'Authentication failed' 
        });
    }
};

function redirectToFrontend(data) {
    // Replace with your actual GitHub Pages URL
    const frontendUrl = 'https://your-github-username.github.io/discord-oauth-frontend/callback.html';
    
    return {
        statusCode: 302,
        headers: {
            'Location': `${frontendUrl}?result=${encodeURIComponent(JSON.stringify(data))}`,
            'Access-Control-Allow-Origin': '*'
        },
        body: ''
    };
}
