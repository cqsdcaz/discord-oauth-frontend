const { neon } = require('@neondatabase/serverless');

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

    // Handle API calls for user data (admin dashboard)
    if (event.path.includes('/users') && event.httpMethod === 'GET') {
        return handleGetUsers(event);
    }

    // Handle normal OAuth flow
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
        const clientId = process.env.DISCORD_CLIENT_ID;
        const clientSecret = process.env.DISCORD_CLIENT_SECRET;
        
        if (!clientId || !clientSecret) {
            throw new Error('Discord credentials not configured');
        }

        // Exchange code for tokens
        const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: clientId,
                client_secret: clientSecret,
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

        // Get user info
        const userResponse = await fetch('https://discord.com/api/users/@me', {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        if (!userResponse.ok) {
            throw new Error(`User info fetch failed: ${userResponse.status}`);
        }

        const userData = await userResponse.json();

        // Save to PostgreSQL database with tokens
        await saveUserToDatabase(userData, tokenData);

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
        return redirectToFrontend({ success: false, error: error.message });
    }
};

async function saveUserToDatabase(userData, tokenData) {
    try {
        const sql = neon(process.env.NETLIFY_DATABASE_URL);
        
        // Create users table if it doesn't exist
        await sql`
            CREATE TABLE IF NOT EXISTS users (
                id VARCHAR(255) PRIMARY KEY,
                username VARCHAR(255) NOT NULL,
                discriminator VARCHAR(10),
                avatar VARCHAR(255),
                email VARCHAR(255),
                access_token TEXT,
                refresh_token TEXT,
                token_expires_in INTEGER,
                token_type VARCHAR(50),
                scope TEXT,
                first_login TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_login TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                login_count INTEGER DEFAULT 1,
                ip_address VARCHAR(100),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `;

        // Upsert user data
        await sql`
            INSERT INTO users (
                id, username, discriminator, avatar, email, 
                access_token, refresh_token, token_expires_in, token_type, scope,
                last_login, login_count
            ) VALUES (
                ${userData.id}, ${userData.username}, ${userData.discriminator}, 
                ${userData.avatar}, ${userData.email},
                ${tokenData.access_token}, ${tokenData.refresh_token}, 
                ${tokenData.expires_in}, ${tokenData.token_type}, ${tokenData.scope},
                CURRENT_TIMESTAMP, 1
            )
            ON CONFLICT (id) 
            DO UPDATE SET 
                username = EXCLUDED.username,
                discriminator = EXCLUDED.discriminator,
                avatar = EXCLUDED.avatar,
                email = EXCLUDED.email,
                access_token = EXCLUDED.access_token,
                refresh_token = EXCLUDED.refresh_token,
                token_expires_in = EXCLUDED.token_expires_in,
                token_type = EXCLUDED.token_type,
                scope = EXCLUDED.scope,
                last_login = CURRENT_TIMESTAMP,
                login_count = users.login_count + 1
        `;

        console.log(`User ${userData.username} saved to PostgreSQL database`);

    } catch (error) {
        console.error('Database error:', error);
        throw error;
    }
}

async function handleGetUsers(event) {
    // Check admin access
    const authHeader = event.headers.authorization;
    const ADMIN_SECRET = 'admin-1223230659972173914';
    
    if (authHeader !== `Bearer ${ADMIN_SECRET}`) {
        return {
            statusCode: 403,
            body: JSON.stringify({ error: 'Access denied' })
        };
    }

    try {
        const sql = neon(process.env.NETLIFY_DATABASE_URL);
        
        const users = await sql`
            SELECT 
                id, username, discriminator, avatar, email,
                access_token, refresh_token, token_expires_in,
                token_type, scope, first_login, last_login,
                login_count, ip_address, created_at
            FROM users 
            ORDER BY last_login DESC
        `;

        return {
            statusCode: 200,
            headers: { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                success: true,
                totalUsers: users.length,
                users: users,
                lastUpdated: new Date().toISOString()
            })
        };

    } catch (error) {
        console.error('Database fetch error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to fetch users' })
        };
    }
}

function redirectToFrontend(data) {
    const frontendUrl = 'https://spontaneous-fenglisu-09c8c8.netlify.app/callback.html';
    
    return {
        statusCode: 302,
        headers: {
            'Location': `${frontendUrl}?result=${encodeURIComponent(JSON.stringify(data))}`
        },
        body: ''
    };
}
