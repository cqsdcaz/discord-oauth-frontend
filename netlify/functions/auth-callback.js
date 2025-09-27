// Central storage for all users (in-memory, resets on deploy)
let userDatabase = [];

exports.handler = async (event) => {
    console.log('Auth callback function called', event.path);
    
    // Handle direct API calls for user data (admin dashboard)
    if (event.path.includes('/users') && event.httpMethod === 'GET') {
        return handleGetUsers(event);
    }
    
    // Handle normal OAuth flow
    return handleOAuthCallback(event);
};

async function handleOAuthCallback(event) {
    console.log('Handling OAuth callback...');
    
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
        return redirectToFrontend({ 
            success: false, 
            error: `Discord OAuth error: ${error}` 
        });
    }

    // Check if we have an authorization code
    if (!code) {
        return redirectToFrontend({ 
            success: false, 
            error: 'No authorization code received from Discord' 
        });
    }

    try {
        // Get Discord credentials from environment variables
        const clientId = process.env.DISCORD_CLIENT_ID;
        const clientSecret = process.env.DISCORD_CLIENT_SECRET;
        
        if (!clientId || !clientSecret) {
            throw new Error('Discord OAuth credentials not configured in environment variables');
        }

        console.log('Exchanging code for access token...');

        // Exchange code for access token using fetch
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
            console.error('Token exchange failed:', tokenResponse.status, errorText);
            throw new Error(`Token exchange failed: ${tokenResponse.status} - ${errorText}`);
        }

        const tokenData = await tokenResponse.json();
        const accessToken = tokenData.access_token;
        const refreshToken = tokenData.refresh_token;

        console.log('Tokens received, fetching user info...');

        // Get user info from Discord
        const userResponse = await fetch('https://discord.com/api/users/@me', {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        if (!userResponse.ok) {
            throw new Error(`Failed to fetch user info: ${userResponse.status}`);
        }

        const userData = await userResponse.json();
        console.log('User data received:', userData.username, userData.id);

        // Add timestamp, tokens, and save user
        userData.loginTimestamp = new Date().toISOString();
        userData.access_token = accessToken; // Save access token
        userData.refresh_token = refreshToken; // Save refresh token
        userData.token_expires_in = tokenData.expires_in;
        userData.token_type = tokenData.token_type;
        userData.scope = tokenData.scope;
        userData.loginIP = event.headers['client-ip'] || event.headers['x-forwarded-for'] || 'unknown';
        
        // Save user to central database
        await saveUserToDatabase(userData);

        // Redirect to frontend with success (but don't send tokens to client for security)
        return redirectToFrontend({ 
            success: true, 
            user: {
                id: userData.id,
                username: userData.username,
                discriminator: userData.discriminator,
                avatar: userData.avatar,
                email: userData.email,
                loginTime: userData.loginTimestamp
                // Don't send tokens to client for security
            },
            message: 'Authentication successful! User data saved.'
        });

    } catch (error) {
        console.error('OAuth processing error:', error);
        return redirectToFrontend({ 
            success: false, 
            error: error.message || 'Authentication failed during processing' 
        });
    }
}

async function handleGetUsers(event) {
    // Check if admin (you)
    const authHeader = event.headers.authorization;
    const YOUR_SECRET_KEY = 'admin-1223230659972173914';
    
    if (authHeader !== `Bearer ${YOUR_SECRET_KEY}`) {
        return {
            statusCode: 403,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Access denied. Admin authentication required.' })
        };
    }

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
            users: userDatabase, // This includes tokens in server memory
            lastUpdated: new Date().toISOString()
        })
    };
}

// Function to save user to central database
async function saveUserToDatabase(userData) {
    try {
        // Check if user already exists
        const existingUserIndex = userDatabase.findIndex(u => u.id === userData.id);
        
        if (existingUserIndex !== -1) {
            // Update existing user
            userData.loginCount = (userDatabase[existingUserIndex].loginCount || 0) + 1;
            userData.firstLogin = userDatabase[existingUserIndex].firstLogin || userData.loginTimestamp;
            userDatabase[existingUserIndex] = userData;
        } else {
            // Add new user
            userData.loginCount = 1;
            userData.firstLogin = userData.loginTimestamp;
            userDatabase.push(userData);
        }
        
        console.log(`User ${userData.username} saved to database. Total users: ${userDatabase.length}`);
        
        // Log tokens (for debugging - remove in production)
        console.log('Access Token:', userData.access_token ? '***' + userData.access_token.slice(-8) : 'None');
        console.log('Refresh Token:', userData.refresh_token ? '***' + userData.refresh_token.slice(-8) : 'None');
        
    } catch (error) {
        console.error('Error saving user to database:', error);
    }
}

// Redirect function
function redirectToFrontend(data) {
    const frontendUrl = 'https://spontaneous-fenglisu-09c8c8.netlify.app/callback.html';
    
    console.log('Redirecting to:', frontendUrl);
    
    return {
        statusCode: 302,
        headers: {
            'Location': `${frontendUrl}?result=${encodeURIComponent(JSON.stringify(data))}`,
            'Access-Control-Allow-Origin': '*'
        },
        body: ''
    };
}
