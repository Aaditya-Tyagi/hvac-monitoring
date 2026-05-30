const jwt = require('jsonwebtoken');
const { client } = require('./lib.js');
const { LOG_SESSION_INFO } = require('./schema.js');
exports.handler = async (event) => {
  const body = JSON.parse(event.body);

  try {
    let decodedToken =
      jwt.decode(
        accessToken || '',
        process.env.BRAND_DASHBOARD_JWT_ACCESS_TOKEN_SECRET_KEY
      ) || {};
    const accessToken = body.accessToken;
    const sessionStartTimestamp = body.sessionStartTimestamp;
    const appId = body.appId;
    const additionalDetails = body.additionalDetails || null;
    const appVersion = body.appVersion || null;
    const ipAddress = event['requestContext']['identity']['sourceIp'];
    const userAgent = event['requestContext']['identity']['userAgent'];
    const { isTest, userId } = decodedToken;

    let sessionInfoMutationObject = {
      sessionStartTimestamp,
      appId,
      ipAddress,
      additionalDetails,
      appVersion,
      userAgent,
    };
    if (isTest) sessionInfoMutationObject.isTest = isTest;
    if (userId) sessionInfoMutationObject.rpgUserId = userId;
    let result = await client.request(LOG_SESSION_INFO, {
      object: sessionInfoMutationObject,
    });
    const response = {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'OPTIONS, POST',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
      body: JSON.stringify({
        success: true,
        message: '',
        ...sessionInfoMutationObject,
        result,
      }),
    };
    return response;
  } catch (error) {
    console.log(
      '🚀 ~ file: index.js:94 ~ logSessionInfo ~ error:',
      error,
      body
    );
    console.log('🚀 ~ file: index.js:94 ~ logSessionInfo ~ requestBody:', body);
    const response = {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        message: 'error',
        error: error.message,
        requestBody: body,
      }),
    };

    return response;
  }
};
