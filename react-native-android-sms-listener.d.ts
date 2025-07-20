declare module 'react-native-android-sms-listener' {
  import { NativeEventEmitter } from 'react-native';

  type SmsListenerSubscription = {
    remove: () => void;
  };

  export default class SmsListener extends NativeEventEmitter {
    addListener(
      eventType: string,
      listener: (message: { originatingAddress: string; body: string }) => void
    ): SmsListenerSubscription;
  }
}
