import { ConfigContext, ExpoConfig } from 'expo/config';
const IS_DEV = process.env.APP_VARIANT === "development"
const IS_PREVIEW = process.env.APP_VARIANT === "preview"

//Function to get the bundler Identifier
const getBundlerIdentifier = () => {
  if (IS_DEV){
    return "com.wicky.wickyapp.dev"
  }

  if (IS_PREVIEW){
    return "com.wicky.wickyapp.preview"
  }

  return "com.wicky.wickyapp"
}

const getAppName = () => {
  if (IS_DEV){
    return "Wicky(Dev)"
  }

  if (IS_PREVIEW){
    return "Wicky(Preview)"
  }

  return "Wicky"
}

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: getAppName(),
  slug: "Wicky-App-V2",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  userInterfaceStyle: "light",
  splash: {
    image: "./assets/images/splash.png",
    resizeMode: "contain",
    backgroundColor: "#ffffff"
  },
  assetBundlePatterns: [
    "**/*"
  ],
  ios: {
    supportsTablet: true,
    bundleIdentifier: getBundlerIdentifier(),
    buildNumber: "4.0.0"
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/images/adaptive-icon.png",
      backgroundColor: "#ffffff"
    },
    package: getBundlerIdentifier(),
    versionCode: 4
  },
  web: {
    favicon: "./assets/images/favicon.png"
  },
  extra: {
    openAiApiKey: process.env.EXPO_PUBLIC_OPENAI_API_KEY,
    twitterApiKey: process.env.EXPO_PUBLIC_TWITTER_API_KEY,
    eas: {
      projectId: "ba365dab-0c60-4b97-8464-ebed70be1632"
    }
  }
}); 