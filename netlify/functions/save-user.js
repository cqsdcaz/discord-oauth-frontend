const { MongoClient } = require('mongodb');

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const userData = JSON.parse(event.body);
        
        // Connect to MongoDB (you'll need to set up a free MongoDB Atlas account)
        const client = new MongoClient(process.env.MONGODB_URI);
        await client.connect();
        
        const db = client.db('discord-auth');
        const collection = db.collection('users');
        
        // Upsert user data
        await collection.updateOne(
            { id: userData.id },
            { $set: { ...userData, lastLogin: new Date() } },
            { upsert: true }
        );
        
        await client.close();
        
        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, message: 'User data saved' })
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};
