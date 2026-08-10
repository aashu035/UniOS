import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';

export default function VideoStrategy({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, player => {
    player.loop = false;
    player.play();
  });

  return (
    <View style={styles.container}>
      <VideoView style={styles.video} player={player} allowsPictureInPicture />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000'
  },
  video: {
    width: '100%',
    height: '100%',
  }
});
