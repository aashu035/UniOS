import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import Pdf from 'react-native-pdf';
import { colors, spacing } from '../../tokens';

export default function PdfStrategy({ uri }: { uri: string }) {
  return (
    <View style={styles.container}>
      <Pdf
        source={{ uri, cache: true }}
        onError={(error) => console.error('PDF failed to render', error)}
        style={styles.pdf}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  pdf: {
    flex: 1,
    width: '100%',
    height: '100%',
  }
});
