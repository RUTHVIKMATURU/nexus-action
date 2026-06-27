const { getApps, initializeApp, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');

const initializeFirebaseAdmin = () => {
  if (getApps().length > 0) return; // Already initialized
  
  const configStr = process.env.FIREBASE_ADMIN_CONFIG;
  if (!configStr) {
    throw new Error("FIREBASE_ADMIN_CONFIG environment variable is missing.");
  }
  
  let serviceAccount;
  try {
    serviceAccount = JSON.parse(configStr);
  } catch (e) {
    throw new Error("FIREBASE_ADMIN_CONFIG is not valid JSON. Parse error: " + e.message);
  }

  try {
    initializeApp({
      credential: cert(serviceAccount)
    });
    console.log("Firebase Admin SDK successfully initialized!");
  } catch (e) {
    throw new Error("Firebase Admin SDK failed to initialize: " + e.message);
  }
};

/**
 * Middleware function to verify the incoming Firebase ID Token.
 * Expects header format: Authorization: Bearer <token>
 */
const verifyFirebaseToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized: Missing or malformed Authorization token'
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    // Ensure Firebase Admin is initialized before verifying
    try {
      initializeFirebaseAdmin();
    } catch (initErr) {
      console.error("Firebase Init Error:", initErr.message);
      return res.status(500).json({
        success: false,
        message: 'Internal Server Error: Authentication service failed to start. ' + initErr.message
      });
    }

    const decodedToken = await getAuth().verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized: Invalid or expired token',
      error: error.message
    });
  }
};

module.exports = {
  verifyFirebaseToken
};
