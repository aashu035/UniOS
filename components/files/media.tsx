import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Image, ScrollView, TextInput, View, useWindowDimensions } from 'react-native';
import { useEvent } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { Icon } from '../uni/Icon';
import { T, Tap } from '../uni/primitives';
import { mono, sans, useUni } from '../uni/theme';
import { formatDuration } from '../../core/utils/format';
import { addBookmark, clampSeek, fitBox, resumeOffer, SPEEDS, type Bookmark } from '../../domains/resource/viewer';
import { useViewState } from './viewState';

// ─── Photo ───────────────────────────────────────────────────────────────────

export type Photo = { id: number; uri: string; title: string };
const MAX_ZOOM = 5;
const DOUBLE_TAP_ZOOM = 2.5;

/** One photo: pinch, double-tap 1× ↔ 2.5×, and drag when zoomed. `quarter` turns it 90° steps. */
function ZoomPhoto({ uri, w, h, turns, onZoom, onTap, onFail }: { uri: string; w: number; h: number; turns: number; onZoom: (z: boolean) => void; onTap: () => void; onFail: () => void }) {
  const s = useSharedValue(1), s0 = useSharedValue(1);
  const x = useSharedValue(0), y = useSharedValue(0), x0 = useSharedValue(0), y0 = useSharedValue(0);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => { Image.getSize(uri, (iw, ih) => setSize({ w: iw, h: ih }), onFail); }, [uri, onFail]);
  useEffect(() => { s.value = 1; x.value = 0; y.value = 0; onZoom(false); }, [turns]); // turning resets the view

  const sideways = turns % 2 === 1;
  const box = size ? fitBox(sideways ? size.h / size.w : size.w / size.h, w, h) : { w, h };
  // The turned photo fits the stage; its on-screen box is box.w × box.h.
  const clampPan = (v: number, scale: number, dim: number) => { 'worklet'; const max = Math.max(0, (dim * scale - dim) / 2); return Math.max(-max, Math.min(max, v)); };

  const pinch = Gesture.Pinch()
    .onStart(() => { s0.value = s.value; })
    .onUpdate((e) => { s.value = Math.max(0.7, Math.min(MAX_ZOOM, s0.value * e.scale)); })
    .onEnd(() => {
      if (s.value < 1) { s.value = withTiming(1); x.value = withTiming(0); y.value = withTiming(0); }
      scheduleOnRN(onZoom, s.value > 1.02);
    });
  const pan = Gesture.Pan().minPointers(1).maxPointers(2)
    .onStart(() => { x0.value = x.value; y0.value = y.value; })
    .onUpdate((e) => { if (s.value > 1.02) { x.value = clampPan(x0.value + e.translationX, s.value, box.w); y.value = clampPan(y0.value + e.translationY, s.value, box.h); } });
  const double = Gesture.Tap().numberOfTaps(2).onEnd(() => {
    const zoomIn = s.value < 1.5;
    s.value = withTiming(zoomIn ? DOUBLE_TAP_ZOOM : 1);
    if (!zoomIn) { x.value = withTiming(0); y.value = withTiming(0); }
    scheduleOnRN(onZoom, zoomIn);
  });
  const single = Gesture.Tap().numberOfTaps(1).requireExternalGestureToFail(double).onEnd(() => { scheduleOnRN(onTap); });
  const gesture = Gesture.Exclusive(double, single);
  const all = Gesture.Simultaneous(pinch, pan, gesture);

  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }, { translateY: y.value }, { scale: s.value }] }));
  return (
    <GestureDetector gesture={all}>
      <View style={{ width: w, height: h, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }} collapsable={false}>
        <Animated.View style={[{ width: box.w, height: box.h }, style]}>
          <Image source={{ uri }} resizeMode="contain" accessibilityIgnoresInvertColors
            style={sideways ? { position: 'absolute', width: box.h, height: box.w, left: (box.w - box.h) / 2, top: (box.h - box.w) / 2, transform: [{ rotate: `${turns * 90}deg` }] } : { width: box.w, height: box.h, transform: [{ rotate: `${turns * 90}deg` }] }} />
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

/** Swipe through the course's photos; counter and a proportional filmstrip; rotate resets per photo. */
export function PhotoPager({ photos, start, onIndex, onTap, onFail, rotateRef }: {
  photos: Photo[]; start: number; onIndex: (i: number) => void; onTap: () => void; onFail: () => void;
  rotateRef: React.MutableRefObject<(() => void) | null>;
}) {
  const { width, height } = useWindowDimensions();
  const [index, setIndex] = useState(start);
  const [zoomed, setZoomed] = useState(false);
  const [turns, setTurns] = useState<Record<number, number>>({});
  const list = useRef<FlatList<Photo>>(null);
  rotateRef.current = () => setTurns((t) => ({ ...t, [photos[index].id]: ((t[photos[index].id] ?? 0) + 1) % 4 }));
  const jump = (i: number) => { setIndex(i); onIndex(i); setZoomed(false); list.current?.scrollToIndex({ index: i, animated: false }); };

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <FlatList ref={list} data={photos} horizontal pagingEnabled scrollEnabled={!zoomed} showsHorizontalScrollIndicator={false}
        keyExtractor={(p) => String(p.id)} initialScrollIndex={start} windowSize={3} maxToRenderPerBatch={2}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        onMomentumScrollEnd={(e) => { const i = Math.round(e.nativeEvent.contentOffset.x / width); if (i !== index) { setIndex(i); onIndex(i); setZoomed(false); } }}
        renderItem={({ item }) => <ZoomPhoto uri={item.uri} w={width} h={height} turns={turns[item.id] ?? 0} onZoom={setZoomed} onTap={onTap} onFail={onFail} />} />
      {photos.length > 1 ? <Filmstrip count={photos.length} index={index} onJump={jump} /> : null}
    </View>
  );
}

function Filmstrip({ count, index, onJump }: { count: number; index: number; onJump: (i: number) => void }) {
  const { width } = useWindowDimensions();
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: 28, alignItems: 'center', gap: 8 }}>
      <View style={{ paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.55)' }}>
        <T w={700} size={12} c="#fff" style={mono(700)}>{`${index + 1} / ${count}`}</T>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxWidth: width - 32 }} contentContainerStyle={{ gap: 3, alignItems: 'center' }}>
        {Array.from({ length: count }, (_, i) => (
          <Tap key={i} onPress={() => onJump(i)} accessibilityRole="button" accessibilityLabel={`Photo ${i + 1} of ${count}`} hitSlop={{ top: 12, bottom: 12, left: 2, right: 2 }}
            style={{ width: 16, height: 26, borderRadius: 4, borderWidth: 1.5, borderColor: i === index ? '#fff' : 'transparent', backgroundColor: 'rgba(255,255,255,0.28)' }} />
        ))}
      </ScrollView>
    </View>
  );
}

// ─── Video and audio ─────────────────────────────────────────────────────────

const stamp = (s: number) => formatDuration(Math.max(0, s)) || '0:00';

/** Scrubber: a bar with the playhead; tap or drag anywhere on it to seek. */
function Scrubber({ pos, dur, onSeek, light }: { pos: number; dur: number; onSeek: (t: number) => void; light?: boolean }) {
  const p = useUni();
  const [w, setW] = useState(1);
  const frac = dur > 0 ? Math.min(1, pos / dur) : 0;
  const seek = (px: number) => onSeek(clampSeek((px / w) * dur, dur));
  const g = Gesture.Pan().minDistance(0).onBegin((e) => { scheduleOnRN(seek, e.x); }).onUpdate((e) => { scheduleOnRN(seek, e.x); });
  return (
    <View>
      <GestureDetector gesture={g}>
        <View onLayout={(e) => setW(Math.max(1, e.nativeEvent.layout.width))} style={{ height: 44, justifyContent: 'center' }} accessible accessibilityRole="adjustable"
          accessibilityLabel="Seek" accessibilityValue={{ min: 0, max: Math.round(dur), now: Math.round(pos), text: `${stamp(pos)} of ${stamp(dur)}` }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]} onAccessibilityAction={(e) => onSeek(clampSeek(pos + (e.nativeEvent.actionName === 'increment' ? 10 : -10), dur))}>
          <View style={{ height: 5, borderRadius: 3, backgroundColor: light ? 'rgba(255,255,255,0.25)' : p.surface }}>
            <View style={{ width: `${frac * 100}%`, height: '100%', borderRadius: 3, backgroundColor: p.primary }} />
          </View>
          <View style={{ position: 'absolute', left: `${frac * 100}%`, marginLeft: -7, width: 14, height: 14, borderRadius: 7, backgroundColor: light ? '#fff' : p.primary }} />
        </View>
      </GestureDetector>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <T w={700} size={12} c={light ? 'rgba(255,255,255,0.75)' : p.muted} style={mono(700)}>{stamp(pos)}</T>
        <T w={700} size={12} c={light ? 'rgba(255,255,255,0.75)' : p.muted} style={mono(700)}>{stamp(dur)}</T>
      </View>
    </View>
  );
}

function Transport({ playing, onPlay, onBack, onFwd, big, back = 10, light }: { playing: boolean; onPlay: () => void; onBack: () => void; onFwd: () => void; big?: boolean; back?: number; light?: boolean }) {
  const p = useUni();
  const side = (label: string, icon: 'rewind' | 'fast-forward', on: () => void) => (
    <Tap onPress={on} accessibilityRole="button" accessibilityLabel={label} style={{ width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={icon} size={22} color={light ? '#fff' : p.text} />
      <T w={800} size={10} c={light ? '#fff' : p.text}>{back}</T>
    </Tap>
  );
  const d = big ? 80 : 64;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: big ? 22 : 16 }}>
      {side(`Back ${back} seconds`, 'rewind', onBack)}
      <Tap onPress={onPlay} accessibilityRole="button" accessibilityLabel={playing ? 'Pause' : 'Play'} style={{ width: d, height: d, borderRadius: d / 2, backgroundColor: p.primary, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={playing ? 'pause' : 'play'} size={big ? 34 : 28} color="#fff" />
      </Tap>
      {side(`Forward ${back} seconds`, 'fast-forward', onFwd)}
    </View>
  );
}

function SpeedChips({ speed, onSpeed, light }: { speed: number; onSpeed: (s: number) => void; light?: boolean }) {
  const p = useUni();
  return (
    <View style={{ flexDirection: 'row', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }} accessibilityRole="radiogroup">
      {SPEEDS.map((s) => {
        const on = s === speed;
        return (
          <Tap key={s} onPress={() => onSpeed(s)} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={`Speed ${s}×`}
            style={{ minWidth: 52, height: 44, paddingHorizontal: 10, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? (light ? '#fff' : p.text) : (light ? 'rgba(255,255,255,0.14)' : p.surface) }}>
            <T w={800} size={12.5} c={on ? (light ? '#000' : p.bg) : light ? '#fff' : p.text} style={mono(700)}>{`${s}×`}</T>
          </Tap>
        );
      })}
    </View>
  );
}

/** Shared by video and audio: position, play state, resume offer, speed and bookmarks, saved per file. */
function usePlayback(uri: string, id: number, audio: boolean, onError: (m: string) => void) {
  const store = useViewState(id);
  const player = useVideoPlayer(uri, (pl) => {
    pl.timeUpdateEventInterval = 0.5;
    pl.playbackRate = store.get().speed ?? 1;
    pl.preservesPitch = true;
    if (audio) { pl.staysActiveInBackground = true; pl.showNowPlayingNotification = true; }
  });
  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });
  const time = useEvent(player, 'timeUpdate', { currentTime: player.currentTime, currentLiveTimestamp: null, currentOffsetFromLive: null, bufferedPosition: player.bufferedPosition });
  const { status, error } = useEvent(player, 'statusChange', { status: player.status, oldStatus: player.status, error: undefined });
  const [saved] = useState(() => store.get().pos ?? 0);
  const [offer, setOffer] = useState(false);
  const [speed, setSpeedState] = useState(store.get().speed ?? 1);
  const [marks, setMarks] = useState<Bookmark[]>(store.get().bookmarks ?? []);
  useEffect(() => { if (status === 'error') onError(error?.message ?? 'The player could not open this file.'); }, [status, error, onError]);
  useEffect(() => { if (status === 'readyToPlay') setOffer(resumeOffer(saved, player.duration)); }, [status, saved, player]);
  // Remember the position every few seconds, and when leaving.
  const last = useRef(0);
  useEffect(() => { last.current = time.currentTime; if (Math.abs(time.currentTime - (store.get().pos ?? 0)) > 5) store.set({ pos: Math.floor(time.currentTime) }); }, [time.currentTime, store]);
  useEffect(() => () => { store.set({ pos: Math.floor(last.current) }); }, [store]);
  const seek = useCallback((t: number) => { player.currentTime = clampSeek(t, player.duration); }, [player]);
  const setSpeed = (s: number) => { player.playbackRate = s; setSpeedState(s); store.set({ speed: s }); };
  const mark = (label: string) => { const next = addBookmark(marks, player.currentTime, label); setMarks(next); store.set({ bookmarks: next }); };
  const unmark = (t: number) => { const next = marks.filter((b) => b.t !== t); setMarks(next); store.set({ bookmarks: next }); };
  return { player, playing: isPlaying, pos: time.currentTime, dur: player.duration, offer, saved, dismissOffer: () => setOffer(false), seek, speed, setSpeed, marks, mark, unmark };
}

function ResumeBar({ at, onResume, onStart, light }: { at: number; onResume: () => void; onStart: () => void; light?: boolean }) {
  const p = useUni();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8, paddingLeft: 14, borderRadius: 16, backgroundColor: light ? 'rgba(255,255,255,0.12)' : p.primarySoft }}>
      <T w={700} size={13} c={light ? '#fff' : p.text} style={{ flex: 1 }}>{`Resume from ${stamp(at)}?`}</T>
      <Tap onPress={onStart} accessibilityRole="button" style={{ height: 44, paddingHorizontal: 12, justifyContent: 'center' }}><T w={800} size={13} c={light ? '#fff' : p.muted}>Start over</T></Tap>
      <Tap onPress={onResume} accessibilityRole="button" style={{ height: 44, paddingHorizontal: 16, borderRadius: 12, backgroundColor: p.primary, justifyContent: 'center' }}><T w={800} size={13} c="#fff">Resume</T></Tap>
    </View>
  );
}

function Bookmarks({ pb, light }: { pb: ReturnType<typeof usePlayback>; light?: boolean }) {
  const p = useUni();
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState('');
  const ink = light ? '#fff' : p.text;
  return (
    <View style={{ gap: 8 }}>
      <T w={800} size={11.5} c={light ? 'rgba(255,255,255,0.7)' : p.muted} style={{ letterSpacing: 0.8 }}>BOOKMARKS</T>
      {pb.marks.map((b) => (
        <View key={b.t} style={{ flexDirection: 'row', alignItems: 'center', minHeight: 44 }}>
          <Tap onPress={() => pb.seek(b.t)} accessibilityRole="button" accessibilityLabel={`Go to ${stamp(b.t)}, ${b.label || 'bookmark'}`} style={{ flex: 1, minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <T w={800} size={13} c={p.primary} style={mono(700)}>{stamp(b.t)}</T>
            <T w={700} size={14} c={ink} numberOfLines={1} style={{ flex: 1 }}>{b.label || 'Bookmark'}</T>
          </Tap>
          <Tap onPress={() => pb.unmark(b.t)} accessibilityRole="button" accessibilityLabel={`Delete bookmark at ${stamp(b.t)}`} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="x" size={16} color={light ? 'rgba(255,255,255,0.7)' : p.muted} />
          </Tap>
        </View>
      ))}
      {adding ? (
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <TextInput value={label} onChangeText={(v) => setLabel(v.slice(0, 60))} autoFocus placeholder={`Label for ${stamp(pb.pos)}`} placeholderTextColor={p.muted} accessibilityLabel="Bookmark label"
            onSubmitEditing={() => { pb.mark(label); setLabel(''); setAdding(false); }}
            style={[sans(600), { flex: 1, height: 46, borderRadius: 12, borderWidth: 1.5, borderColor: p.border, backgroundColor: p.elev, paddingHorizontal: 12, fontSize: 14, color: p.text }]} />
          <Tap onPress={() => { pb.mark(label); setLabel(''); setAdding(false); }} accessibilityRole="button" style={{ height: 46, paddingHorizontal: 16, borderRadius: 12, backgroundColor: p.primary, justifyContent: 'center' }}><T w={800} size={13} c="#fff">Save</T></Tap>
        </View>
      ) : (
        <Tap onPress={() => setAdding(true)} accessibilityRole="button" style={{ alignSelf: 'flex-start', height: 44, paddingHorizontal: 14, borderRadius: 12, backgroundColor: light ? 'rgba(255,255,255,0.14)' : p.surface, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Icon name="bookmark" size={15} color={ink} />
          <T w={800} size={13} c={ink}>{`Add at ${stamp(pb.pos)}`}</T>
        </Tap>
      )}
    </View>
  );
}

export function VideoBody({ uri, id, chrome, onTap, onError }: { uri: string; id: number; chrome: boolean; onTap: () => void; onError: (m: string) => void }) {
  const { width, height } = useWindowDimensions();
  const pb = usePlayback(uri, id, false, onError);
  const view = useRef<VideoView>(null);
  const [aspect, setAspect] = useState(16 / 9);
  const track = useEvent(pb.player, 'sourceChange', { source: null, oldSource: null });
  useEffect(() => { const s = pb.player.videoTrack?.size; if (s?.width && s?.height) setAspect(s.width / s.height); }, [track, pb.player, pb.dur]);
  const box = fitBox(aspect, width, height * 0.56);
  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#000' }} contentContainerStyle={{ paddingTop: 96, paddingBottom: 40, gap: 16 }}>
      <Tap onPress={onTap} accessibilityLabel="Video. Tap to show or hide controls" style={{ alignSelf: 'center' }}>
        <VideoView ref={view} player={pb.player} nativeControls={false} contentFit="contain" allowsPictureInPicture
          fullscreenOptions={{ enable: true, orientation: 'landscape' }} style={{ width: box.w, height: box.h, backgroundColor: '#000' }} />
      </Tap>
      <View style={{ paddingHorizontal: 20, gap: 14, opacity: chrome ? 1 : 0.0 }} pointerEvents={chrome ? 'auto' : 'none'}>
        {pb.offer ? <ResumeBar light at={pb.saved} onResume={() => { pb.seek(pb.saved); pb.player.play(); pb.dismissOffer(); }} onStart={() => { pb.seek(0); pb.player.play(); pb.dismissOffer(); }} /> : null}
        <Scrubber light pos={pb.pos} dur={pb.dur} onSeek={pb.seek} />
        <Transport light playing={pb.playing} onPlay={() => (pb.playing ? pb.player.pause() : pb.player.play())} onBack={() => pb.seek(pb.pos - 10)} onFwd={() => pb.seek(pb.pos + 10)} />
        <SpeedChips light speed={pb.speed} onSpeed={pb.setSpeed} />
        <Tap onPress={() => view.current?.enterFullscreen()} accessibilityRole="button" style={{ alignSelf: 'center', height: 44, paddingHorizontal: 16, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.14)', flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Icon name="maximize" size={16} color="#fff" />
          <T w={800} size={13} c="#fff">Full screen</T>
        </Tap>
        <Bookmarks pb={pb} light />
      </View>
    </ScrollView>
  );
}

export function AudioBody({ uri, id, title, onError }: { uri: string; id: number; title: string; onError: (m: string) => void }) {
  const p = useUni();
  const pb = usePlayback(uri, id, true, onError);
  // The player needs a view or a source to load; audio has no picture, so a 1 px view keeps it attached.
  const memo = useMemo(() => <VideoView player={pb.player} nativeControls={false} style={{ width: 1, height: 1, opacity: 0 }} />, [pb.player]);
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 24, gap: 22, alignItems: 'stretch' }}>
      {memo}
      <View style={{ alignItems: 'center', gap: 12, paddingTop: 16 }}>
        <View style={{ width: 120, height: 120, borderRadius: 36, backgroundColor: p.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="audio-lines" size={52} color={p.primary} />
        </View>
        <T w={800} size={17} numberOfLines={2} style={{ textAlign: 'center' }}>{title}</T>
      </View>
      {pb.offer ? <ResumeBar at={pb.saved} onResume={() => { pb.seek(pb.saved); pb.player.play(); pb.dismissOffer(); }} onStart={() => { pb.seek(0); pb.player.play(); pb.dismissOffer(); }} /> : null}
      <Scrubber pos={pb.pos} dur={pb.dur} onSeek={pb.seek} />
      <Transport big back={15} playing={pb.playing} onPlay={() => (pb.playing ? pb.player.pause() : pb.player.play())} onBack={() => pb.seek(pb.pos - 15)} onFwd={() => pb.seek(pb.pos + 15)} />
      <SpeedChips speed={pb.speed} onSpeed={pb.setSpeed} />
      <Bookmarks pb={pb} />
      <T w={600} c={p.muted} size={12} style={{ lineHeight: 17 }}>Keeps playing with the screen off. The notification shows the controls.</T>
    </ScrollView>
  );
}
