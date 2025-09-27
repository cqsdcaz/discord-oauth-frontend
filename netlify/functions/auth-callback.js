exports.handler = async (event) => {
    console.log('Auth callback called');
    
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
        // Use environment variables
        const clientId = process.env.DISCORD_CLIENT_ID;
        const clientSecret = process.env.DISCORD_CLIENT_SECRET;
        
        if (!clientId || !clientSecret) {
            throw new Error('Discord credentials not configured');
        }

        // Exchange code for access token using fetch (no axios needed)
        const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                client_id: clientId,
                client_secret: clientSecret,
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: 'https://spontaneous-fenglisu-09c8c8.netlify.app/.netlify/functions/auth-callback'
            })
        });

        if (!tokenResponse.ok) {
            const errorText = await tokenResponse.text();
            throw new Error(`Token exchange failed: ${tokenResponse.status} - ${errorText}`);
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

        // Redirect to Netlify frontend
        return redirectToFrontend({ 
            success: true, 
            user: userData
        });

    } catch (error) {
        console.error('OAuth error:', error);
        return redirectToFrontend({ 
            success: false, 
            error: error.message 
        });
    }
};

function redirectToFrontend(data) {
    // FIXED: Use your actual Netlify domain
    const frontendUrl = 'https://spontaneous-fenglisu-09c8c8.netlify.app/callback.html';
    
    return {
        statusCode: 302,
        headers: {
            'Location': `${frontendUrl}?result=${encodeURIComponent(JSON.stringify(data))}`,
        },
        body: ''
    };
}
