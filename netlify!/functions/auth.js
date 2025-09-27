exports.handler = async (event) => {
    // Simple function to test your setup
    return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Netlify function is working!' })
    };
};
