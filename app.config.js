// GOLFAPI_KEY: from .env (local) or EAS Secret (build). For EAS/TestFlight, create the secret:
//   npx eas-cli@latest secret:create --name GOLFAPI_KEY --value "your-api-key" --scope project
require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });

const appJson = require('./app.json');
module.exports = () => ({
  expo: {
    ...appJson.expo,
    extra: {
      ...appJson.expo.extra,
      GOLFAPI_KEY: process.env.GOLFAPI_KEY ?? '',
    },
  },
});
