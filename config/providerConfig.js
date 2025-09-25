const providerConfig = {
  firebase: {
    enabled: process.env.FIREBASE_ENABLED === 'true',
    priority: 1,
    config: {
      type: "service_account",
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
      private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      client_id: process.env.FIREBASE_CLIENT_ID,
      auth_uri: process.env.FIREBASE_AUTH_URI,
      token_uri: process.env.FIREBASE_TOKEN_URI
    }
  },
  onesignal: {
    enabled: process.env.ONESIGNAL_ENABLED === 'true',
    priority: 2,
    config: {
      appId: process.env.ONESIGNAL_APP_ID,
      restApiKey: process.env.ONESIGNAL_REST_API_KEY
    }
  },
  pusher: {
    enabled: process.env.PUSHER_ENABLED === 'true',
    priority: 3,
    config: {
      appId: process.env.PUSHER_APP_ID,
      key: process.env.PUSHER_KEY,
      secret: process.env.PUSHER_SECRET,
      cluster: process.env.PUSHER_CLUSTER
    }
  }
};

module.exports = providerConfig;