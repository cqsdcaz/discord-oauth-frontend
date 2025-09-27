exports.handler = async (event, context) => {
  return {
    statusCode: 200,
    body: JSON.stringify({ 
      message: "Function is working!",
      timestamp: new Date().toISOString()
    })
  };
};
