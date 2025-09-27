// Simple in-memory storage for users (resets on deploy)
let userDatabase = [];

exports.handler = async (event) => {
    console.log('Auth callback function called');
    
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

        console.log('Access token received, fetching user info...');

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

        // Add timestamp and save user
        userData.loginTimestamp = new Date().toISOString();
        userData.loginIP = event.headers['client-ip'] || event.headers['x-forwarded-for'] || 'unknown';
        
        // Save user to database
        await saveUserToDatabase(userData);

        // Redirect to frontend with success
        return redirectToFrontend({ 
            success: true, 
            user: {
                id: userData.id,
                username: userData.username,
                discriminator: userData.discriminator,
                avatar: userData.avatar,
                email: userData.email,
                loginTime: userData.loginTimestamp
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
};

// Function to save user to database
async function saveUserToDatabase(userData) {
    try {
        // Add to in-memory array
        userDatabase.push(userData);
        
        // Also save to a more persistent method (local storage via function call)
        await saveToBackupStorage(userData);
        
        console.log(`User ${userData.username} saved to database. Total users: ${userDatabase.length}`);
    } catch (error) {
        console.error('Error saving user to database:', error);
    }
}

// Backup storage using another Netlify function
async function saveToBackupStorage(userData) {
    try {
        // This would call another function for persistent storage
        // For now, we'll just log it
        console.log('Backup storage:', {
            userId: userData.id,
            username: userData.username,
            timestamp: userData.loginTimestamp
        });
    } catch (error) {
        console.error('Backup storage error:', error);
    }
}

// Function to get all users (for admin dashboard)
async function getAllUsers() {
    return userDatabase;
}

// Redirect function with your actual Netlify domain
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

// Additional function to handle direct API calls for user data
exports.handler = async (event, context) => {
    // If this is a call to get user data (for admin dashboard)
    if (event.path === '/.netlify/functions/auth-callback/users' && event.httpMethod === 'GET') {
        // Check if admin (you)
        const authHeader = event.headers.authorization;
        if (authHeader === 'Bearer admin-secret-key') { // Simple auth check
            return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    success: true,
                    totalUsers: userDatabase.length,
                    users: userDatabase
                })
            };
        } else {
            return {
                statusCode: 403,
                body: JSON.stringify({ error: 'Access denied' })
            };
        }
    }
    
    // Otherwise, handle normal OAuth flow
    return await exports.handler(event);
};
