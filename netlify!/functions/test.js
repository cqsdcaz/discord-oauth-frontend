exports.handler = async (event) => {
    return {
        statusCode: 200,
        body: JSON.stringify({ 
            message: 'Function is working!',
            path: event.path,
            method: event.httpMethod
        })
    };
};
