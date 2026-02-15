import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Easing,
  BackHandler,
  Platform,
  StatusBar,
  Vibration,
  Alert,
  TextInput,
  ScrollView,
} from 'react-native';
import { Audio } from 'expo-av';
import Svg, { Defs, Mask, Rect, Text as SvgText, Path, G } from 'react-native-svg';

const { width: W, height: H } = Dimensions.get('window');

/* ============================
   CONFIGURACIÓN DEL AUDIO
============================ */

// Ajusta los nombres a tus archivos reales en assets/
const PLAYLIST = [
  require('./assets/song1.mp3'),
  require('./assets/song2.mp3'),
  require('./assets/song3.mp3'),
];

const LOOP_PLAYLIST = true; // vuelve al inicio cuando termine
const SHUFFLE = false;     // modo aleatorio opcional

const pickNextIndex = (current, total, shuffle) => {
  if (total <= 1) return 0;
  if (!shuffle) return (current + 1) % total;
  let next = current;
  while (next === current) next = Math.floor(Math.random() * total);
  return next;
};

/* ============================
   UTILIDADES
============================ */

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

/* ============================
   FONDO: CORAZONES
============================ */

function HeartsBackground({ count = 40 }) {
  const hearts = useMemo(() => {
    return new Array(count).fill(0).map((_, i) => {
      const size = Math.round(16 + Math.random() * 26); // 16–42
      const left = Math.round(Math.random() * (W - size));
      const delay = Math.round(Math.random() * 3500);
      const duration = Math.round(6000 + Math.random() * 7000);
      const drift = Math.random() * 60 - 30;
      return {
        key: `h-${i}`,
        size,
        left,
        delay,
        duration,
        drift,
        anim: new Animated.Value(0),
      };
    });
  }, [count]);

  useEffect(() => {
    hearts.forEach((h) => {
      const loop = () => {
        h.anim.setValue(0);
        Animated.timing(h.anim, {
          toValue: 1,
          duration: h.duration,
          delay: h.delay,
          easing: Easing.linear,
          useNativeDriver: true,
        }).start(() => loop());
      };
      loop();
    });
  }, [hearts]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {hearts.map((h) => {
        const translateY = h.anim.interpolate({
          inputRange: [0, 1],
          outputRange: [H + h.size, -h.size],
        });
        const translateX = h.anim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, h.drift],
        });
        const opacity = h.anim.interpolate({
          inputRange: [0, 0.1, 0.9, 1],
          outputRange: [0, 0.95, 0.95, 0],
        });
        const scale = h.anim.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: [0.8, 1.15, 0.95],
        });
        return (
          <Animated.Text
            key={h.key}
            style={[
              styles.floatingHeart,
              {
                left: h.left,
                fontSize: h.size,
                opacity,
                transform: [{ translateY }, { translateX }, { scale }],
              },
            ]}
          >
            💖
          </Animated.Text>
        );
      })}
    </View>
  );
}

/* ============================
   FONDO: DEDO MEDIO (RECHAZO)
============================ */

function MiddleFingerBackground({ count = 28 }) {
  const items = useMemo(() => {
    return new Array(count).fill(0).map((_, i) => {
      const size = Math.round(18 + Math.random() * 16); // 18–34
      const left = Math.round(Math.random() * (W - size));
      const delay = Math.round(Math.random() * 2500);
      const duration = Math.round(4200 + Math.random() * 4800);
      const drift = Math.random() * 40 - 20;
      return {
        key: `mf-${i}`,
        size,
        left,
        delay,
        duration,
        drift,
        anim: new Animated.Value(0),
      };
    });
  }, [count]);

  useEffect(() => {
    items.forEach((h) => {
      const loop = () => {
        h.anim.setValue(0);
        Animated.timing(h.anim, {
          toValue: 1,
          duration: h.duration,
          delay: h.delay,
          easing: Easing.linear,
          useNativeDriver: true,
        }).start(() => loop());
      };
      loop();
    });
  }, [items]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {items.map((h) => {
        const translateY = h.anim.interpolate({
          inputRange: [0, 1],
          outputRange: [H + h.size, -h.size],
        });
        const translateX = h.anim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, h.drift],
        });
        const opacity = h.anim.interpolate({
          inputRange: [0, 0.1, 0.9, 1],
          outputRange: [0, 0.95, 0.95, 0],
        });
        const scale = h.anim.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: [0.85, 1.05, 0.95],
        });
        return (
          <Animated.Text
            key={h.key}
            style={[
              styles.mfEmoji,
              {
                left: h.left,
                fontSize: h.size,
                opacity,
                transform: [{ translateY }, { translateX }, { scale }],
              },
            ]}
          >
            🖕
          </Animated.Text>
        );
      })}
    </View>
  );
}

/* ============================
   PANTALLA 1: INTRO
============================ */

function IntroScreen({ onYes, onNo, onTapOutside }) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 500, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 500, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ])
    ).start();
  }, [pulse]);
  const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });

  // Rastro de besos
  const lastKissTsRef = useRef(0);
  const lastPointRef = useRef({ x: 0, y: 0 });
  const MIN_INTERVAL_MS = 60;
  const MIN_DIST = 12;
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  const onGrant = (e) => {
    const p = { x: e.nativeEvent.locationX, y: e.nativeEvent.locationY };
    lastPointRef.current = p;
    lastKissTsRef.current = Date.now();
    onTapOutside(p);
  };
  const onMove = (e) => {
    const now = Date.now();
    if (now - lastKissTsRef.current < MIN_INTERVAL_MS) return;
    const p = { x: e.nativeEvent.locationX, y: e.nativeEvent.locationY };
    if (dist(p, lastPointRef.current) < MIN_DIST) return;
    lastPointRef.current = p;
    lastKissTsRef.current = now;
    onTapOutside(p);
  };
  const onRelease = (e) => {
    const p = { x: e.nativeEvent.locationX, y: e.nativeEvent.locationY };
    onTapOutside(p);
  };

  return (
    <View style={styles.screen}>
      {/* Corazones al fondo */}
      <View style={styles.layerBack} pointerEvents="none">
        <HeartsBackground count={40} />
      </View>

      {/* Lienzo táctil */}
      <View
        style={styles.touchCanvas}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={onGrant}
        onResponderMove={onMove}
        onResponderRelease={onRelease}
      />

      {/* Título */}
      <View style={[styles.headerWrap, styles.layerTop]} pointerEvents="box-none">
        <Text style={styles.subtitle}>QUIERES SER MI</Text>
        <Text style={styles.title}>VALENTIN?</Text>
      </View>

      {/* Botón "SI" */}
      <View style={[styles.centerWrap, styles.layerTop]} pointerEvents="box-none">
        <Animated.View style={{ transform: [{ scale: pulseScale }] }}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Sí"
            onPress={onYes}
            activeOpacity={0.9}
            style={styles.bigHeartBtn}
          >
            <Text style={styles.bigHeartIcon}>❤</Text>
            <Text style={styles.bigHeartLabel}>SI</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>

      {/* Botón "NO" */}
      <View style={[styles.bottomWrap, styles.layerTop]} pointerEvents="box-none">
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="No"
          onPress={onNo}
          style={styles.noBtn}
        >
          <Text style={styles.noFace}>😢</Text>
          <Text style={styles.noLabel}>NO</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* ============================
   PANTALLA 2: CARTA
============================ */

function LetterScreen({ value, onChange, onRequestOpen, openKey }) {
  // Entrada de la carta
  const intro = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(intro, { toValue: 1, duration: 650, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [intro]);
  const introTranslateY = intro.interpolate({ inputRange: [0, 1], outputRange: [30, 0] });
  const introScale = intro.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] });
  const introOpacity = intro;

  // Apertura del sobre
  const flap = useRef(new Animated.Value(0)).current;    // 0 → 1
  const exit = useRef(new Animated.Value(0)).current;    // 0 → 1

  // Animación del lacre (pulso continuo + squish + ripple)
  const sealPulse = useRef(new Animated.Value(0)).current;
  const sealPress = useRef(new Animated.Value(0)).current;
  const ring = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(sealPulse, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(sealPulse, { toValue: 0, duration: 800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    ).start();
  }, [sealPulse]);

  useEffect(() => {
    if (!openKey) return;
    ring.setValue(0);
    Animated.timing(ring, { toValue: 1, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();

    Animated.sequence([
      Animated.timing(flap, { toValue: 1, duration: 520, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(exit, { toValue: 1, duration: 420, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]).start(() => {
      onRequestOpen?.('done');
    });
  }, [openKey, flap, exit, ring, onRequestOpen]);

  const flapRotateX = flap.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-135deg'] });
  const envelopeExitOpacity = exit.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  const envelopeExitTranslateY = exit.interpolate({ inputRange: [0, 1], outputRange: [0, -40] });
  const envelopeExitScale = exit.interpolate({ inputRange: [0, 1], outputRange: [1, 0.96] });

  // Lacre transform
  const pulseScale = sealPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });
  const pressScaleX = sealPress.interpolate({ inputRange: [0, 1], outputRange: [1, 0.92] });
  const pressScaleY = sealPress.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
  const pressRotate = sealPress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-6deg'] });

  // Anillo del lacre
  const ringScale = ring.interpolate({ inputRange: [0, 1], outputRange: [0.6, 2.2] });
  const ringOpacity = ring.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] });

  const handleSealPressIn = () => {
    Animated.timing(sealPress, { toValue: 1, duration: 110, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  };
  const handleSealPressOut = () => {
    Animated.timing(sealPress, { toValue: 0, duration: 140, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  };

  return (
    <View style={styles.screen}>
      {/* Corazones también en la carta */}
      <View style={styles.layerBack} pointerEvents="none">
        <HeartsBackground count={36} />
      </View>

      {/* Contenedor centrado */}
      <View style={styles.letterScreenWrap}>
        <Animated.View
          style={[
            styles.envelope,
            {
              opacity: Animated.multiply(introOpacity, envelopeExitOpacity),
              transform: [
                { translateY: introTranslateY },
                { scale: introScale },
                { translateY: envelopeExitTranslateY },
                { scale: envelopeExitScale },
              ],
            },
          ]}
        >
          {/* FLAP animado */}
          <Animated.View
            style={[
              styles.envelopeFlap,
              {
                transform: [{ perspective: 800 }, { rotateX: flapRotateX }],
              },
            ]}
          />

          {/* CARA DEL SOBRE */}
          <View style={styles.envelopeFace} />

          {/* Textos e input IMPRESOS en la carta */}
          <View style={styles.letterOverlay} pointerEvents="box-none">
            <Text style={styles.letterFrom}>DE: TU AMORCITO</Text>
            <View style={styles.toRow}>
              <Text style={styles.letterToLabel}>PARA:</Text>
              <TextInput
                value={value}
                onChangeText={onChange}
                placeholder="INGRESA TU PRIMER NOMBRE COMPLETO"
                placeholderTextColor="rgba(0,0,0,0.35)"
                style={styles.toInput}
                autoCapitalize="words"
                autoCorrect={false}
                selectionColor="#e91e63"
              />
            </View>
          </View>

          {/* Anillo del lacre (ripple) */}
          <Animated.View
            pointerEvents="none"
            style={[
              styles.sealRing,
              {
                opacity: ringOpacity,
                transform: [{ scale: ringScale }],
              },
            ]}
          />

          {/* Lacre centrado y siempre clickeable */}
          <View style={styles.sealCenter} pointerEvents="box-none">
            <Animated.View
              style={{
                transform: [{ scale: pulseScale }, { scaleX: pressScaleX }, { scaleY: pressScaleY }, { rotate: pressRotate }],
              }}
              pointerEvents="box-none"
            >
              <TouchableOpacity
                accessibilityLabel="Abrir carta"
                onPressIn={handleSealPressIn}
                onPressOut={handleSealPressOut}
                onPress={() => {
                  Vibration.vibrate(30);
                  onRequestOpen?.('try');
                }}
                style={styles.sealBtn}
                activeOpacity={0.9}
              >
                <Text style={styles.sealEmoji}>😉</Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

/* ============================
   PANTALLA 3: CARTA ABIERTA (papel con líneas + texto exacto + firma animada + "SIGUIENTE")
============================ */

// 👇 Reemplaza TODO el componente AcceptScreen por este
const AnimatedRect = Animated.createAnimatedComponent(Rect);
const AnimatedPath = Animated.createAnimatedComponent(Path);

function AcceptScreen({ onNext }) {
  // Animaciones: pop de entrada + flap de carta abierta + aparición del texto
  const flap = useRef(new Animated.Value(0)).current;   // 0 → 1
  const pop = useRef(new Animated.Value(0)).current;    // 0 → 1
  const content = useRef(new Animated.Value(0)).current;

  // Firma (máscara para “escribir” CRISTHIAN) + corazón con trazo animado
  const sig = useRef(new Animated.Value(0)).current;    // 0 → 1 (ancho de máscara)
  const heart = useRef(new Animated.Value(0)).current;  // 0 → 1 (dash offset)

  useEffect(() => {
    Animated.sequence([
      Animated.timing(pop, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(flap, { toValue: 1, duration: 560, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(content, { toValue: 1, duration: 420, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start(() => {
      // cuando el texto apareció, animamos la firma
      Animated.parallel([
        Animated.timing(sig,   { toValue: 1, duration: 1600, delay: 200, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
        Animated.timing(heart, { toValue: 1, duration: 1200, delay: 600, easing: Easing.out(Easing.quad),   useNativeDriver: false }),
      ]).start();
    });
  }, [flap, pop, content, sig, heart]);

  const popScale = pop.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] });
  const flapRotateX = flap.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-150deg'] });
  const textOpacity = content;

  // Fondo de líneas (visual)
  const LINES = new Array(28).fill(0);

  // Texto EXACTO con saltos de línea
  const letterText = `Para mi amada Kathe

Se que este día para mi no es especial pero se también que para ti lo es, por eso me he tomado el tiempo de escribirte esta carta de la mejor manera que se, haciéndote una aplicación.

Quería decirte que te amo con todo mi corazón, a pesar de todo lo que pase siempre te amo y te amaré, se que este semestre ha estado duro sentimentalmente hablando y sumamente cansado, ya falta poco y verás todo tu esfuerzo reflejado en el final de todo y aparte siendo la mejor que muchos con todas las comodidades encima no son capaces de lograr.

Eres la mejor en lo que sea que te propongas, podrán darte colapsos de tristeza y ansiedad pero a pesar de eso logras y lograras todo lo que te propones y te propondrías, quiero pasar el resto de esta vida celebrando todos tus logros, y estando para ti también en los peores momentos, siempre estaré para ti no lo olvides, no importa que pase yo estaré contigo siempre 

Sin mas que añadir simplemente decirte que te amo, te extraño y que sepas que ya mismo acaba esta cansada etapa de tu vida, en la que espero hayas aprendido quien se merece de ti y quien no, porque eres muy especial, cariñosa, inteligente y sentimental en el buen sentido.

Te amo no lo olvides lo he dicho mucho pero no es suficiente las veces que lo diré nunca dudes de ello.

Con amor, cariño y mucho sueño tu amado Cristhian`;

  // ⚙️ Ajustes de la firma (SVG)
  const SVG_W = 560;          // <- más ancho para que quepa la “N” con margen
  const SVG_H = 120;
  const TEXT_X = 20;          // margen izquierdo
  const HEART_G_X = 460;      // corazón más a la derecha (no tapa la N)
  const HEART_G_Y = 25;
  const HEART_LENGTH = 500;   // largo aproximado del corazón

  // La máscara ahora “barre” TODO el ancho del viewBox → asegura revelar la N
  const maskWidth = sig.interpolate({ inputRange: [0, 1], outputRange: [0, SVG_W] });
  const heartDashOffset = heart.interpolate({ inputRange: [0, 1], outputRange: [HEART_LENGTH, 0] });

  return (
    <View style={[styles.screen, { backgroundColor: '#ffeef2' }]}>
      <View style={styles.acceptWrap}>
        {/* Carta abierta con flap */}
        <Animated.View style={[styles.paperWrap, { transform: [{ scale: popScale }] }]}>
          <Animated.View
            style={[
              styles.paperFlap,
              { transform: [{ perspective: 900 }, { rotateX: flapRotateX }] },
            ]}
          />
          <View style={styles.paperBody}>
            {/* Líneas */}
            <View style={styles.paperLines} pointerEvents="none">
              {LINES.map((_, i) => (
                <View key={`ln-${i}`} style={styles.paperLine} />
              ))}
            </View>

            {/* Texto de la carta */}
            <Animated.View style={{ flex: 1, opacity: textOpacity }}>
              <ScrollView contentContainerStyle={styles.paperTextContainer} showsVerticalScrollIndicator={false}>
                <Text style={styles.paperText}>{letterText}</Text>
              </ScrollView>
            </Animated.View>

            {/* Firma animada */}
            <View style={{ height: 110, marginTop: 6, alignItems: 'center', justifyContent: 'center' }}>
              <Svg width="100%" height="100%" viewBox={`0 0 ${SVG_W} ${SVG_H}`}>
                <Defs>
                  <Mask id="sigMask">
                    <AnimatedRect x="0" y="0" height={SVG_H} fill="#fff" width={maskWidth} />
                  </Mask>
                </Defs>

                {/* “CRISTHIAN” con máscara (baja un poco el letterSpacing para que quepa) */}
                <SvgText
                  x={TEXT_X}
                  y={70}
                  fill="#bf134b"
                  fontSize="48"
                  fontWeight="700"
                  letterSpacing="1"   // <- antes 2; ahora 1 para que no se coma la N
                  mask="url(#sigMask)"
                >
                  CRISTHIAN
                </SvgText>

                {/* Corazón dibujado */}
                <G transform={`translate(${HEART_G_X},${HEART_G_Y})`}>
                  <AnimatedPath
                    d="
                      M 30 40
                      C 15 25,  0 25,  0 40
                      C 0 60,   30 70, 30 90
                      C 30 70,  60 60, 60 40
                      C 60 25,  45 25, 30 40
                    "
                    fill="none"
                    stroke="#e91e63"
                    strokeWidth="5"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    strokeDasharray={HEART_LENGTH}
                    strokeDashoffset={heartDashOffset}
                  />
                </G>
              </Svg>
            </View>
          </View>
        </Animated.View>

        //{/* Botón SIGUIENTE */}
        //<TouchableOpacity onPress={onNext} style={styles.nextPrimaryBtn} activeOpacity={0.9}>
        //  <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>SIGUIENTE</Text>
       // </TouchableOpacity>
     // </View>
    //</View>
  );
}

/* ============================
   PANTALLA RECHAZO (con 🖕 continuos)
============================ */

function RejectScreen({ onRetry, onExit }) {
  return (
    <View style={[styles.screen, { backgroundColor: '#2b001e' }]}>
      <MiddleFingerBackground count={28} />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
        <Text style={{ fontSize: 26, fontWeight: '800', color: '#ff91b6', textAlign: 'center' }}>
          Tu no eres mi amorcito SALTE
        </Text>

        <View style={{ height: 24 }} />

        <TouchableOpacity onPress={onExit} style={styles.upsiBtn} activeOpacity={0.9}>
          <Text style={{ color: '#fff', fontWeight: '800' }}>SALIR UPSI</Text>
        </TouchableOpacity>

        <View style={{ height: 10 }} />

        <TouchableOpacity onPress={onRetry} style={styles.retryBtn} activeOpacity={0.9}>
          <Text style={{ color: '#fff', fontWeight: '800' }}>ME EQUIVOQUE ESCRIBIENDO JEJE</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* ============================
   APP PRINCIPAL (playlist + preload + FIX no-doble)
============================ */

export default function App() {
  const [screen, setScreen] = useState('intro'); // 'intro' | 'letter' | 'accept' | 'reject' | 'next'
  const [kisses, setKisses] = useState([]);

  // AUDIO refs
  const currentSoundRef = useRef(null);
  const preloadedSoundRef = useRef(null);
  const preloadedIndexRef = useRef(null);  // índice de la pista pre‑cargada
  const skipEffectOnceRef = useRef(false); // para saltar recarga tras "promoción"
  const triedAutoPlayRef = useRef(false);

  const [currentIndex, setCurrentIndex] = useState(0);

  // Nombre ingresado en la carta
  const [toName, setToName] = useState('');
  // Token para disparar la animación de apertura en LetterScreen
  const [letterOpenKey, setLetterOpenKey] = useState(0);

  // Autoplay al abrir
  useEffect(() => {
    (async () => {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
          allowsRecordingIOS: false,
          interruptionModeIOS: 0,
          interruptionModeAndroid: 1,
        });

        triedAutoPlayRef.current = true;
        await loadTrack(currentIndex, /*autoPlay*/ true);
        await preloadNextAround(currentIndex);
      } catch (e) {
        // No reintentar por interacción (pedido anterior)
      }
    })();

    return () => {
      (async () => {
        try { if (currentSoundRef.current) await currentSoundRef.current.unloadAsync(); } catch {}
        try { if (preloadedSoundRef.current) await preloadedSoundRef.current.unloadAsync(); } catch {}
        currentSoundRef.current = null;
        preloadedSoundRef.current = null;
        preloadedIndexRef.current = null;
      })();
    };
  }, []);

  // Cuando cambia el índice, cargar y pre‑cargar
  useEffect(() => {
    if (!triedAutoPlayRef.current) return;
    if (skipEffectOnceRef.current) {
      skipEffectOnceRef.current = false;
      return;
    }
    (async () => {
      await loadTrack(currentIndex, true);
      await preloadNextAround(currentIndex);
    })();
  }, [currentIndex]);

  // Helpers audio
  const stopAndUnloadCurrent = async () => {
    if (!currentSoundRef.current) return;
    try { await currentSoundRef.current.stopAsync(); } catch {}
    try { await currentSoundRef.current.unloadAsync(); } catch {}
    currentSoundRef.current = null;
  };

  const attachDidFinishHandler = (sound, indexBase) => {
    sound.setOnPlaybackStatusUpdate(async (status) => {
      if (!status.isLoaded) return;
      if (status.didJustFinish) {
        const nextIndex = computeNextIndex(indexBase);

        if (preloadedSoundRef.current && preloadedIndexRef.current === nextIndex) {
          try { await stopAndUnloadCurrent(); } catch {}
          currentSoundRef.current = preloadedSoundRef.current;
          preloadedSoundRef.current = null;
          preloadedIndexRef.current = null;

          attachDidFinishHandler(currentSoundRef.current, nextIndex);
          try { await currentSoundRef.current.playAsync(); } catch {}
          await preloadNextAround(nextIndex);

          skipEffectOnceRef.current = true;
          setCurrentIndex(nextIndex);
        } else {
          setCurrentIndex(nextIndex);
        }
      }
    });
  };

  const loadTrack = async (index, autoPlay = true) => {
    const total = PLAYLIST.length;
    if (total === 0) return;

    await stopAndUnloadCurrent();

    try {
      const { sound } = await Audio.Sound.createAsync(
        PLAYLIST[index],
        { volume: 0.7, shouldPlay: autoPlay, isLooping: false }
      );
      currentSoundRef.current = sound;
      attachDidFinishHandler(sound, index);
    } catch (e) {
      // No reintento en Web
    }
  };

  const computeNextIndex = (idx) => {
    const total = PLAYLIST.length;
    if (total <= 1) return 0;
    if (SHUFFLE) return pickNextIndex(idx, total, true);
    const next = idx + 1;
    if (next < total) return next;
    return LOOP_PLAYLIST ? 0 : idx;
  };

  const preloadNextAround = async (currentIdx) => {
    const total = PLAYLIST.length;
    if (total <= 1) return;

    const nextIdx = computeNextIndex(currentIdx);

    if (preloadedSoundRef.current) {
      try { await preloadedSoundRef.current.unloadAsync(); } catch {}
      preloadedSoundRef.current = null;
      preloadedIndexRef.current = null;
    }

    try {
      const { sound: pre } = await Audio.Sound.createAsync(
        PLAYLIST[nextIdx],
        { shouldPlay: false, volume: 0.7, isLooping: false }
      );
      preloadedSoundRef.current = pre;
      preloadedIndexRef.current = nextIdx;
    } catch (e) {
      preloadedIndexRef.current = null;
    }
  };

  const nextTrack = async () => {
    const nextIdx = computeNextIndex(currentIndex);
    await stopAndUnloadCurrent();

    if (preloadedSoundRef.current && preloadedIndexRef.current === nextIdx) {
      const s = preloadedSoundRef.current;
      preloadedSoundRef.current = null;
      preloadedIndexRef.current = null;

      currentSoundRef.current = s;
      attachDidFinishHandler(s, nextIdx);
      try { await s.playAsync(); } catch {}

      skipEffectOnceRef.current = true;
      setCurrentIndex(nextIdx);

      await preloadNextAround(nextIdx);
    } else {
      setCurrentIndex(nextIdx);
    }

    Vibration.vibrate(20);
  };

  /* -----------------
     LÓGICA DE BESOS (Pantalla 1)
  ------------------ */
  const spawnKiss = ({ x, y }) => {
    const anim = new Animated.Value(0);
    const id = uid();
    const emoji = Math.random() < 0.5 ? '😘' : '💋';
    setKisses((prev) => [...prev, { id, x, y, anim, emoji }]);

    Animated.timing(anim, {
      toValue: 1,
      duration: 1200,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start(() => {
      setKisses((prev) => prev.filter((k) => k.id !== id));
    });
  };

  /* -----------------
     NAVEGACIÓN / HANDLERS DE PANTALLAS
  ------------------ */

  const goLetter = () => setScreen('letter');
  const goAccept = () => setScreen('accept');
  const goReject = () => setScreen('reject');
  const goNext = () => setScreen('next'); // placeholder de siguiente etapa

  // Pantalla 1
  const handlePressYes = () => {
    Vibration.vibrate(60);
    goLetter();
  };
  const handlePressNo = () => {
    if (Platform.OS === 'android') {
      BackHandler.exitApp();
    } else {
      Alert.alert('😢', 'En iOS/Web no se puede cerrar la app automáticamente.');
    }
  };

  // Pantalla 2: Validación y animación
  const [] = useState(0);
  const handleLetterSeal = (phase) => {
    if (phase === 'try') {
      const normalized = (toName || '').trim().toLowerCase();
      if (normalized === 'katherine') {
        setLetterOpenKey((k) => k + 1); // dispara apertura
      } else {
        goReject();
      }
    }
    if (phase === 'done') {
      goAccept();
    }
  };

  // Pantalla rechazo
  const handleRejectExit = () => {
    if (Platform.OS === 'android') {
      BackHandler.exitApp();
    } else {
      Alert.alert('😢', 'En iOS no se puede cerrar automáticamente.');
    }
  };
  const handleRejectRetry = () => {
    setToName('');
    goLetter();
  };

  /* -----------------
     RENDER
  ------------------ */

  return (
    <View style={{ flex: 1, backgroundColor: '#130014' }}>
      {/* Pantalla completa */}
      <StatusBar hidden translucent backgroundColor="transparent" />

      {screen === 'intro' && (
        <>
          <IntroScreen onYes={handlePressYes} onNo={handlePressNo} onTapOutside={spawnKiss} />

          {/* Capa de besos (solo dibuja, no bloquea) */}
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            {kisses.map((k) => {
              const translateY = k.anim.interpolate({ inputRange: [0, 1], outputRange: [0, -60] });
              const opacity = k.anim.interpolate({ inputRange: [0, 0.8, 1], outputRange: [1, 0.9, 0] });
              const scale = k.anim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.2] });
              const rotate = k.anim.interpolate({ inputRange: [0, 1], outputRange: ['-8deg', '8deg'] });
              return (
                <Animated.Text
                  key={k.id}
                  style={[
                    styles.kiss,
                    {
                      left: k.x - 16,
                      top: k.y - 16,
                      opacity,
                      transform: [{ translateY }, { scale }, { rotate }],
                    },
                  ]}
                >
                  {k.emoji}
                </Animated.Text>
              );
            })}
          </View>

          {/* HUD: Botón ⏭ */}
          <View style={styles.hudWrap} pointerEvents="box-none">
            <TouchableOpacity
              accessibilityLabel="Siguiente canción"
              onPress={nextTrack}
              style={styles.nextBtn}
              activeOpacity={0.8}
            >
              <Text style={styles.nextIcon}>⏭</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {screen === 'letter' && (
        <>
          <LetterScreen
            value={toName}
            onChange={setToName}
            onRequestOpen={handleLetterSeal}
            openKey={letterOpenKey}
          />
          {/* HUD también visible aquí si quieres */}
          <View style={styles.hudWrap} pointerEvents="box-none">
            <TouchableOpacity
              accessibilityLabel="Siguiente canción"
              onPress={nextTrack}
              style={styles.nextBtn}
              activeOpacity={0.8}
            >
              <Text style={styles.nextIcon}>⏭</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {screen === 'accept' && <AcceptScreen onNext={goNext} />}

      {screen === 'reject' && (
        <RejectScreen onRetry={handleRejectRetry} onExit={handleRejectExit} />
      )}

      {screen === 'next' && (
        <View style={[styles.screen, { alignItems: 'center', justifyContent: 'center' }]}>
          <HeartsBackground count={28} />
          <Text style={{ color: '#fff', fontSize: 20, fontWeight: '800' }}>Próxima sorpresa… 💘</Text>
        </View>
      )}
    </View>
  );
}

/* ============================
   ESTILOS
============================ */

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0f0014',
    position: 'relative',
  },
  layerBack: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  touchCanvas: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1, // lienzo táctil (debajo de botones)
  },
  layerTop: {
    zIndex: 2, // botones/título por encima del canvas
  },

  floatingHeart: {
    position: 'absolute',
    color: '#ff6f91',
    textShadowColor: 'rgba(0,0,0,0.25)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },

  mfEmoji: {
    position: 'absolute',
    color: '#ffd1dc',
    textShadowColor: 'rgba(0,0,0,0.25)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },

  headerWrap: {
    position: 'absolute',
    top: H * 0.10,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  subtitle: {
    color: '#ffd1dc',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 1.5,
    textAlign: 'center',
    textShadowColor: 'rgba(255, 105, 180, 0.35)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 8,
  },
  title: {
    color: '#ffffff',
    fontSize: 52,
    fontWeight: '900',
    letterSpacing: 2,
    textAlign: 'center',
    textShadowColor: 'rgba(255, 105, 180, 0.35)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 12,
    marginTop: 4,
  },

  centerWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  bigHeartBtn: {
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: '#ff4d6d',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 5,
    borderColor: '#ffd1dc',
    shadowColor: '#ff4d6d',
    shadowOpacity: 0.55,
    shadowOffset: { width: 0, height: 20 },
    shadowRadius: 26,
    elevation: 12,
  },
  bigHeartIcon: { fontSize: 78, color: '#fff', marginBottom: 8 },
  bigHeartLabel: { fontSize: 38, color: '#fff', fontWeight: '900', letterSpacing: 2 },

  bottomWrap: { alignItems: 'center', paddingBottom: 24 },
  noBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#2a0030',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#5a2a66',
  },
  noFace: { fontSize: 28, marginBottom: 4 },
  noLabel: { fontSize: 18, color: '#ffd1dc', fontWeight: '800' },

  kiss: {
    position: 'absolute',
    fontSize: 28,
    textShadowColor: 'rgba(0,0,0,0.25)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },

  /* HUD: botón ⏭ */
  hudWrap: {
    position: 'absolute',
    left: 12,
    bottom: 16,
    zIndex: 3,
  },
  nextBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextIcon: {
    fontSize: 20,
    color: '#fff',
    fontWeight: '800',
  },

  /* ======= PANTALLA 2: CARTA ======= */
  letterScreenWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center', // centrado vertical
    paddingHorizontal: 16,
  },
  // Carta contenedora
  envelope: {
    width: Math.min(W * 0.86, 360),
    height: Math.min(H * 0.42, 300),
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#ffd1dc',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  // Flap (tapa superior) animable
  envelopeFlap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '46%',
    backgroundColor: '#ffe6ee',
    borderBottomLeftRadius: 120,
    borderBottomRightRadius: 120,
    zIndex: 2,
  },
  // Cara del sobre (debajo del flap)
  envelopeFace: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#fff',
    zIndex: 1,
  },
  // Overlay impreso sobre la carta
  letterOverlay: {
    position: 'absolute',
    top: 18,
    left: 16,
    right: 16,
    zIndex: 3,
  },
  letterFrom: {
    color: '#c2185b',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 10,
  },
  toRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: '100%',
  },
  letterToLabel: {
    color: '#880e4f',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1,
  },
  toInput: {
    flex: 1,
    marginLeft: 8,
    paddingVertical: 6,
    color: '#3d002c',
    fontSize: 16,
    backgroundColor: 'transparent',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.25)',
  },
  // Centro absoluto del lacre (asegura clic)
  sealCenter: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 5,
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'box-none',
  },
  // Lacre
  sealBtn: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: '#ffb3c7',
    borderWidth: 5,
    borderColor: '#ff6f91',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 10,
    shadowColor: '#ff6f91',
    shadowOpacity: 0.45,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 16,
  },
  sealEmoji: {
    fontSize: 44,
  },
  // Anillo del lacre
  sealRing: {
    position: 'absolute',
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: '#ff6f91',
    opacity: 0.4,
    zIndex: 2,
  },

  /* ======= PANTALLA 3: CARTA ABIERTA ======= */
  acceptWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  paperWrap: {
    width: Math.min(W * 0.9, 380),
    height: Math.min(H * 0.7, 560),
    borderRadius: 14,
    backgroundColor: '#fffbea',
    borderWidth: 1.5,
    borderColor: '#e3d19c',
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#c2b17a',
    shadowOpacity: 0.35,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 22,
  },
  paperFlap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 54,
    backgroundColor: '#ffe3a3',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    zIndex: 3,
  },
  paperBody: {
    flex: 1,
    paddingTop: 64,    // deja espacio "bajo el flap"
    paddingHorizontal: 18,
    paddingBottom: 14,
  },
  paperLines: {
    ...StyleSheet.absoluteFillObject,
    top: 54,
    paddingHorizontal: 0,
    zIndex: 0,
  },
  paperLine: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.09)',
    marginTop: 22,
  },
  paperTextContainer: {
    paddingTop: 4,
    paddingBottom: 16,
  },
  paperText: {
    color: '#2b2b2b',
    fontSize: 16,
    lineHeight: 24,
  },

  nextPrimaryBtn: {
    marginTop: 14,
    backgroundColor: '#e91e63',
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 14,
    elevation: 6,
  },

  /* ======= PANTALLA RECHAZO ======= */
  upsiBtn: {
    backgroundColor: '#d32f2f',
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 14,
  },
  retryBtn: {
    backgroundColor: '#7b1fa2',
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 14,
  },
});