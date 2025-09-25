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
      auth_uri: process.env.FIREBASE_AUTH_URI || "https://accounts.google.com/o/oauth2/auth",
      token_uri: process.env.FIREBASE_TOKEN_URI || "https://oauth2.googleapis.com/token"
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

// Log configuration status for debugging
console.log('Provider Configuration Status:', {
  firebase: {
    enabled: providerConfig.firebase.enabled,
    hasProjectId: !!providerConfig.firebase.config.project_id,
    hasPrivateKey: !!providerConfig.firebase.config.private_key,
    hasClientEmail: !!providerConfig.firebase.config.client_email
  },
  onesignal: {
    enabled: providerConfig.onesignal.enabled,
    hasAppId: !!providerConfig.onesignal.config.appId,
    hasRestApiKey: !!providerConfig.onesignal.config.restApiKey
  },
  pusher: {
    enabled: providerConfig.pusher.enabled,
    hasAppId: !!providerConfig.pusher.config.appId,
    hasKey: !!providerConfig.pusher.config.key,
    hasSecret: !!providerConfig.pusher.config.secret,
    hasCluster: !!providerConfig.pusher.config.cluster
  }
});

module.exports = providerConfig;