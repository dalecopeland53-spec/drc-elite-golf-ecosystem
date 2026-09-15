import React, { useEffect, useMemo, useState } from 'react';
import { Alert, PermissionsAndroid, Platform, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View, useWindowDimensions, Switch, Vibration } from 'react-native';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient'; 
import * as Location from 'expo-location'; // High-accuracy GPS layer integrated
import Voice from '@react-native-voice/voice';
import Tts from 'react-native-tts';
import AsyncStorage from '@react-native-async-storage/async-storage'; 

// Modern Luxury Palette Integration
const C = {
  bg: '#0F2038',
  bgGradient: ['#142B4B', '#0A1626'],
  metallicFrame: ['#E3E8F0', '#B0BCD2', '#E3E8F0'],
  innerPanel: ['#F8FAFC', '#E2E8F0'],
  navy: '#0A2540',
  blue: '#1D599A',
  darkBlue: '#0C356A',
  gold: '#D5AE52',
  text: '#0F2038',
  muted: '#5C6E84',
  white: '#FFFFFF',
  green: '#27AE60',
  red: '#E12D2D'
}; 

const NAV = ['HOME', 'CADDIE', 'BAG', 'COURSE', 'MORE'];
const PARS =; // Complete 18-hole mapping
const LIES = ['Tee', 'Fairway', 'Light Rough', 'Rough', 'Deep Rough', 'Fairway Bunker', 'Greenside Bunker'];
const TEES = ['Black', 'Blue', 'White', 'Red', 'Yellow'];
const WIND = ['HEAD', 'TAIL', 'L→R', 'R→L'];
const CLUB_LIBRARY = ['Driver', '3 Wood', '5 Wood', '7 Wood', '4 Hybrid', '5 Hybrid', '3 Iron', '4 Iron', '5 Iron', '6 Iron', '7 Iron', '8 Iron', '9 Iron', 'Pitching Wedge', 'Gap Wedge', 'Sand Wedge', 'Lob Wedge', 'Putter'];
const DEFAULT_BAG = [['Driver', 230], ['3 Wood', 210], ['5 Wood', 195], ['4 Iron', 180], ['5 Iron', 170], ['6 Iron', 160], ['7 Iron', 150], ['8 Iron', 140], ['9 Iron', 130], ['Pitching Wedge', 115], ['Gap Wedge', 100], ['Sand Wedge', 85], ['Lob Wedge', 70], ['Putter', 0]]; 

// Sample Green GPS Coordinates mapped for Yeppoon Golf Club Holes (Front, Center, Back)
const YEPPOON_GPS_MAP = Array.from({ length: 18 }, (_, i) => ({
  front: { lat: -23.1250 + (i * 0.0001), lon: 150.7340 + (i * 0.0001) },
  center: { lat: -23.1251 + (i * 0.0001), lon: 150.7341 + (i * 0.0001) },
  back: { lat: -23.1252 + (i * 0.0001), lon: 150.7342 + (i * 0.0001) }
}));

const WARM = [
  ['Phase 1: Stretch & Mobility', '10 squats & 60s torso twists with club across shoulders.'],
  ['Phase 2: Swing Tempo Build', '5 half-wedge shots moving up to 3 full iron swings.'],
  ['Phase 3: Green Speed Calibration', '2 long putts to the fringe & 3 short three-foot circle putts.']
]; 

const ROUTINE_DEFAULT = ['Target Line Alignment', 'Lie Assessment Profile', 'Club Trajectory Option', 'Picture Ball Flight Path', 'Commit and Clear Mind', 'Breathe Deep and Settle', 'Reset Visual Anchors', 'Execute Next Shot'];
const STORAGE = 'CADDIEOS_WORLDCLASS_V1'; 

const n = v => Number(String(v ?? '').replace(/[^0-9.-]/g, '')) || 0;
const yd = (m, u) => u === 'METRES' ? Math.round(m) : Math.round(m * 1.09361);
const blankTargets = () => Array.from({ length: 18 }, () => ({ front: null, center: null, back: null }));
const blankResults = () => Array.from({ length: 18 }, () => ({ situation: '', advice: '', club: '', result: '' })); 

function windAdj(w, u) { w = Math.abs(n(w)); return u === 'METRES' ? (w / 1.609344) * .75 * .9144 : w * .75; }
function playsLike(d, w, e, lie, dir, u) {
  let x = Math.max(0, n(d));
  x *= 1 + ({ 'Light Rough': .015, Rough: .04, 'Deep Rough': .07, 'Fairway Bunker': .045 }[lie] || 0);
  const a = windAdj(w, u);
  if (dir === 'HEAD') x += a;
  if (dir === 'TAIL') x -= a;
  x *= 1 + n(e) / 100;
  return Math.max(0, Math.round(x));
}
function nearestClub(target, bag, u) {
  const a = bag.filter(x => x[1] > 0).map(x => [x[0], yd(x[1], u)]);
  if (!a.length) return ['—', 0];
  return a.reduce((p, c) => Math.abs(c[1] - target) < Math.abs(p[1] - target) ? c : p);
}
function advice(target, club, lie, w, dir, e, u) {
  const unit = u === 'METRES' ? 'metres' : 'yards';
  let t = `Playing ${target} ${unit}. ${club}.`; 
  if (lie !== 'Tee' && lie !== 'Fairway') t += ` Allow for ${lie.toLowerCase()}.`;
  if (n(w)) {
    if (dir === 'HEAD') t += ` Headwind ${w}mph; flight it lower.`; 
    else if (dir === 'TAIL') t += ` Tailwind ${w}mph; expect extra carry.`;
    else t += ` Crosswind ${w}mph; adjust aim point into the wind.`; 
  } 
  if (n(e) > 0) t += ` Uphill ${Math.abs(n(e))}%.`;
  if (n(e) < 0) t += ` Downhill ${Math.abs(n(e))}%.`;
  return t + ' Picture the path and commit.';
}
function haversine(a, b, u) {
  if (!a || !b) return null;
  const r = x => x * Math.PI / 180, R = 6371000, dLat = r(b.lat - a.lat), dLon = r(b.lon - a.lon), la1 = r(a.lat), la2 = r(b.lat),
  h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2, m = 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  return Math.round(u === 'METRES' ? m : m * 1.09361);
} 

function CoreContainer({ children }) {
  return (
    <LinearGradient colors={C.metallicFrame} style={styles.outerBorder}>
      <LinearGradient colors={C.innerPanel} style={styles.innerContainer}>
        {children}
      </LinearGradient>
    </LinearGradient>
  );
} 

export default function App() { return <SafeAreaProvider><Shell /></SafeAreaProvider>; } 

function Shell() {
  const insets = useSafeAreaInsets();
  const [entered, setEntered] = useState(true);
  const [tab, setTab] = useState('HOME');
  const [units, setUnits] = useState('METRES');
  const [player, setPlayer] = useState('Tour Player');
  const [bag, setBag] = useState(DEFAULT_BAG);
  const [course, setCourse] = useState('Yeppoon Golf Club');
  const [hole, setHole] = useState('1');
  
  // GPS Vector Telemetry States
  const [userCoords, setUserCoords] = useState(null);
  const [gpsError, setGpsError] = useState(null);
  const [isTrackingGps, setIsTrackingGps] = useState(false);

  // Scorecard States
  const [scores, setScores] = useState(Array(18).fill(''));
  const [putts, setPutts] = useState(Array(18).fill(''));
  const [gir, setGir] = useState(Array(18).fill(false));
  const [fw, setFw] = useState(Array(18).fill(false));

  // Caddie Computation States
  const [distance, setDistance] = useState('150');
  const [wind, setWind] = useState('12');
  const [windDir, setWindDir] = useState('HEAD');
  const [elev, setElev] = useState('3');
  const [lie, setLie] = useState('Fairway');

  // Sync Live GPS Watch Subscription
  useEffect(() => {
    let watchSubscription = null;
    async function startTracking() {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setGpsError('GPS Tracking Permission Denied.');
        return;
      }
      setIsTrackingGps(true);
      watchSubscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 2 },
        (loc) => {
          const currentPos = { lat: loc.coords.latitude, lon: loc.coords.longitude };
          setUserCoords(currentPos);
          
          // Compute Distance to Current Hole Map
          const holeIndex = n(hole) - 1;
          const currentTargetCenter = YEPPOON_GPS_MAP[holeIndex]?.center;
          if (currentTargetCenter) {
            const calculatedDist = haversine(currentPos, currentTargetCenter, units);
            if (calculatedDist) setDistance(String(calculatedDist));
          }
        }
      );
    }

    startTracking();
    return () => { if (watchSubscription) watchSubscription.remove(); };
  }, [hole, units]);

  const gpsDistances = useMemo(() => {
    if (!userCoords) return { front: '—', center: '—', back: '—' };
    const targetMap = YEPPOON_GPS_MAP[n(hole) - 1];
    return {
      front: haversine(userCoords, targetMap.front, units) || '—',
      center: haversine(userCoords, targetMap.center, units) || '—',
      back: haversine(userCoords, targetMap.back, units) || '—'
    };
  }, [userCoords, hole, units]);

  const result = useMemo(() => {
    const y = playsLike(distance, wind, elev, lie, windDir, units), c = nearestClub(y, bag, units);
    return { y, club: c[0] };
  }, [distance, wind, elev, lie, windDir, units, bag]); 

  const caddieText = useMemo(() => advice(result.y, result.club, lie, wind, windDir, elev, units), [result, lie, wind, windDir, elev, units]); 

  const updateBagDistance = (index, value) => {
    const updated = [...bag];
    updated[index] = [updated[index][0], n(value)];
    setBag(updated);
  };

  const updateScoreCard = (index, field, value) => {
    if (field === 'score') {
      const updated = [...scores]; updated[index] = value; setScores(updated);
    } else if (field === 'putt') {
      const updated = [...putts]; updated[index] = value; setPutts(updated);
    } else if (field === 'gir') {
      const updated = [...gir]; updated[index] = !gir[index]; setGir(updated);
    } else if (field === 'fw') {
      const updated = [...fw]; updated[index] = !fw[index]; setFw(updated);
    }
  };

  return (
    <LinearGradient colors={C.bgGradient} style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.scrollBody}>
        
        {tab === 'HOME' && (
          <CoreContainer>
            <Text style={styles.titleText}>{course}</Text>
            <Text style={styles.bodyText}>Welcome, {player}. Active Hole: #{hole}</Text>
            
            <View style={styles.card}>
              <Text style={styles.cardTitle}>🛰️ Real-Time GPS Tracking Status</Text>
              {isTrackingGps ? (
                <Text style={[styles.adviceBody, {color: C.green, fontWeight: 'bold'}]}>● Active Satellite Core Tracking Connection Ready</Text>
              ) : (
                <Text style={[styles.adviceBody, {color: C.red}]}>{gpsError || 'Initializing Location Matrix Engine...'}</Text>
              )}
            </View>

