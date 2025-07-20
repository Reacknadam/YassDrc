import { Text, View } from 'react-native';
import { StyleSheet } from 'react-native';
export default function CartScreen() {
  return <View><Text style={styles.texto}>Panier</Text></View>;
}

const styles = StyleSheet.create({

  texto: {
    color: 'blue'
  }
})
