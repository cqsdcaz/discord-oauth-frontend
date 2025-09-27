exports.handler = async (event) => {
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
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ error: 'Method Not Allowed' })
        };
    }

    const { code, error } = event.queryStringParameters;

    if (error) {
        return redirectToFrontend({ success: false, error: error });
    }

    if (!code) {
        return redirectToFrontend({ success: false, error: 'No authorization code received' });
    }

    try {
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
            throw new Error(`Token exchange failed: ${tokenResponse.status}`);
        }

        const tokenData = await tokenResponse.json();
        const accessToken = tokenData.access_token;

        const userResponse = await fetch('https://discord.com/api/users/@me', {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        if (!userResponse.ok) {
            throw new Error(`User info fetch failed: ${userResponse.status}`);
        }

        const userData = await userResponse.json();

        return redirectToFrontend({ 
            success: true, 
            user: userData
        });

    } catch (error) {
        return redirectToFrontend({ 
            success: false, 
            error: error.message 
        });
    }
};

// FIXED: Use your actual Netlify domain
function redirectToFrontend(data) {
    const frontendUrl = 'https://spontaneous-fenglisu-09c8c8.netlify.app/callback.html';
    
    return {
        statusCode: 302,
        headers: {
            'Location': `${frontendUrl}?result=${encodeURIComponent(JSON.stringify(data))}`,
        },
        body: ''
    };
}
