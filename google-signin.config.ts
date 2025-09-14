import { GoogleSignin } from '@react-native-google-signin/google-signin';

export const configureGoogleSignIn = () => {
  GoogleSignin.configure({
    webClientId: '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.googleusercontent.com',
    offlineAccess: false,
  });
};