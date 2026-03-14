import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  TextInput,
  ScrollView,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '../src/theme/colors';
import { useCourseStore } from '../src/store/courseStore';
import {
  searchByLocation,
  searchByName,
  getCourseDetail,
  getLastCourseId,
  setLastCourseId,
  type CourseListItem,
  ASPETUCK_API_ID,
} from '../src/services/golfApi';
import type { Course } from '../src/types/course';
import { hasMissingStrokeIndex, applyStrokeIndexFallback } from '../src/types/course';
import { ASPETUCK_COURSE } from '../src/data/aspetuckCourse';

const DISCLAIMER_KEY = 'hasSeenDisclaimer';

const DEBOUNCE_MS = 400;
const SEARCH_MIN_LEN = 3;

export default function SplashScreen() {
  const router = useRouter();
  const { selectedCourse, setSelectedCourse } = useCourseStore();
  const [showDisclaimer, setShowDisclaimer] = useState<boolean | null>(null);
  const [nearbyCourses, setNearbyCourses] = useState<CourseListItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CourseListItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [loadingCourse, setLoadingCourse] = useState<string | null>(null);
  const [loadingLastCourse, setLoadingLastCourse] = useState(true);
  const [locationStatus, setLocationStatus] = useState<'idle' | 'loading' | 'denied' | 'ok'>('idle');
  const [showSiWarning, setShowSiWarning] = useState<Course | null>(null);
  const [showCourseSearch, setShowCourseSearch] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(DISCLAIMER_KEY).then((v) => {
      setShowDisclaimer(v !== 'true');
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const lastId = await getLastCourseId();
      if (cancelled) {
        setLoadingLastCourse(false);
        return;
      }
      const isAspetuck = lastId === 'aspetuck' || lastId === ASPETUCK_API_ID;
      if (lastId) {
        const course = await getCourseDetail(lastId, isAspetuck);
        if (!cancelled && course) {
          setSelectedCourse(course);
          setLoadingLastCourse(false);
          return;
        }
      }
      if (!cancelled) {
        const course = await getCourseDetail(ASPETUCK_API_ID, true);
        if (!cancelled && course) {
          setSelectedCourse(course);
          await setLastCourseId(course.id);
        } else if (!cancelled) {
          setSelectedCourse(ASPETUCK_COURSE);
        }
      }
      setLoadingLastCourse(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [setSelectedCourse]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (cancelled) return;
      if (status !== 'granted') {
        setLocationStatus('denied');
        return;
      }
      setLocationStatus('loading');
      try {
        const loc = await Location.getCurrentPositionAsync({});
        if (cancelled) return;
        const list = await searchByLocation(loc.coords.latitude, loc.coords.longitude);
        if (!cancelled) {
          setNearbyCourses(list.slice(0, 5));
          setLocationStatus('ok');
        }
      } catch {
        if (!cancelled) setLocationStatus('denied');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (searchQuery.length < SEARCH_MIN_LEN) {
      setSearchResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      const list = await searchByName(searchQuery);
      setSearchResults(list);
      setSearching(false);
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const selectCourse = useCallback(
    async (item: CourseListItem) => {
      setLoadingCourse(item.id);
      try {
        const course = await getCourseDetail(item.id);
        if (!course) {
          Alert.alert("Couldn't load this course", 'Please try another.');
          return;
        }
        if (hasMissingStrokeIndex(course)) {
          setShowSiWarning(course);
          return;
        }
        setSelectedCourse(course);
        await setLastCourseId(course.id);
      } catch {
        Alert.alert("Couldn't load this course", 'Please try another.');
      } finally {
        setLoadingCourse(null);
      }
    },
    [setSelectedCourse]
  );

  const confirmSiFallback = useCallback(() => {
    if (!showSiWarning) return;
    const fixed = applyStrokeIndexFallback(showSiWarning);
    setSelectedCourse(fixed);
    setLastCourseId(fixed.id);
    setShowSiWarning(null);
  }, [showSiWarning, setSelectedCourse]);

  const handleSelectCourse = useCallback(
    async (item: CourseListItem) => {
      await selectCourse(item);
      setShowCourseSearch(false);
    },
    [selectCourse]
  );

  const acceptDisclaimer = () => {
    AsyncStorage.setItem(DISCLAIMER_KEY, 'true');
    setShowDisclaimer(false);
  };

  const displayList = searchQuery.length >= SEARCH_MIN_LEN ? searchResults : nearbyCourses;
  const listLabel = searchQuery.length >= SEARCH_MIN_LEN ? 'Search results' : 'Courses Near You';
  const canStart = !!selectedCourse && !loadingLastCourse;

  if (showDisclaimer === null) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={Colors.gold} />
      </View>
    );
  }

  if (showDisclaimer) {
    return (
      <View style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.emoji}>⛳</Text>
          <Text style={styles.disclaimerTitle}>Before You Play</Text>
          <Text style={styles.disclaimerBody}>
            square18 is a score tracking and settlement calculation tool. All payments are made
            directly between players via third-party services. square18 does not process, hold, or
            transfer funds.
          </Text>
          <Text style={styles.disclaimerBody}>
            By continuing, you agree to use this app for personal, non-commercial use only.
          </Text>
        </View>
        <View style={styles.footer}>
          <Pressable style={styles.button} onPress={acceptDisclaimer}>
            <Text style={styles.buttonText}>Got it — let's play ⛳</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Image source={require('../assets/square18logo.png')} style={styles.logo} resizeMode="contain" />
        <Text style={styles.tagline}>set it · play it · square it</Text>
      </View>

      {showCourseSearch ? (
        <KeyboardAvoidingView
          style={styles.middleSection}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <View style={styles.card}>
            <View style={styles.chipRow}>
              <Text style={styles.cardTitle}>Select Course</Text>
              <Pressable onPress={() => setShowCourseSearch(false)} hitSlop={8}>
                <Text style={styles.changeLink}>Done</Text>
              </Pressable>
            </View>
            <TextInput
              style={styles.searchInput}
              placeholder="Search by course name..."
              placeholderTextColor={Colors.gray}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {(displayList.length > 0 || searching) && (
              <View style={styles.listBlock}>
                <Text style={styles.listLabel}>{listLabel}</Text>
                {searching ? (
                  <ActivityIndicator size="small" color={Colors.forest} style={styles.listLoader} />
                ) : displayList.length === 0 && searchQuery.length >= SEARCH_MIN_LEN ? (
                  <Text style={styles.noResults}>No courses found — try a different spelling</Text>
                ) : (
                  <ScrollView
                    style={styles.listScroll}
                    nestedScrollEnabled
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="on-drag"
                  >
                    {displayList.map((item) => (
                      <Pressable
                        key={item.id}
                        style={styles.listItem}
                        onPress={() => handleSelectCourse(item)}
                        disabled={loadingCourse !== null}
                      >
                        <View style={styles.listItemMain}>
                          <Text style={styles.listItemName} numberOfLines={1}>{item.name}</Text>
                          <Text style={styles.listItemLoc}>{item.location}</Text>
                          {item.distanceMiles != null && (
                            <Text style={styles.listItemDist}>{item.distanceMiles.toFixed(1)} mi</Text>
                          )}
                        </View>
                        {loadingCourse === item.id && (
                          <ActivityIndicator size="small" color={Colors.gold} />
                        )}
                      </Pressable>
                    ))}
                  </ScrollView>
                )}
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      ) : (
        <View style={styles.middleSection}>
          <View style={styles.courseCard}>
            {selectedCourse && (
              <>
                <Text style={styles.courseCardName} numberOfLines={2}>
                  {selectedCourse.name}
                </Text>
                <Text style={styles.courseCardLocation}>{selectedCourse.location}</Text>
                <Pressable onPress={() => setShowCourseSearch(true)} hitSlop={12} style={styles.changeCourseLinkWrap}>
                  <Text style={styles.changeCourseLink}>Change Course</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      )}

      <View style={styles.footer}>
        <Pressable
          style={[styles.button, !canStart && styles.buttonDisabled]}
          onPress={() => {
            if (!canStart) return;
            try {
              router.push('/setup/players');
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              const stack = err instanceof Error ? err.stack : '';
              Alert.alert(
                'Navigation Error',
                `Could not start round:\n\n${msg}${stack ? `\n\n${stack.slice(0, 200)}...` : ''}`,
                [{ text: 'OK' }]
              );
            }
          }}
          disabled={!canStart}
        >
          <Text style={[styles.buttonText, !canStart && styles.buttonTextDisabled]}>
            Start a Round ⛳
          </Text>
        </Pressable>
      </View>

      <Modal visible={!!loadingCourse && !showSiWarning} transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.loadingCard}>
            <Text style={styles.loadingText}>Loading scorecard...</Text>
            <ActivityIndicator size="large" color={Colors.gold} />
          </View>
        </View>
      </Modal>

      <Modal visible={!!showSiWarning} transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.siWarningCard}>
            <Text style={styles.siWarningTitle}>Stroke index notice</Text>
            <Text style={styles.siWarningBody}>
              Stroke indexes aren't available for this course. Handicap strokes will be distributed
              evenly. You can continue or choose a different course.
            </Text>
            <Pressable style={styles.siBtnPrimary} onPress={confirmSiFallback}>
              <Text style={styles.siBtnPrimaryText}>Continue Anyway</Text>
            </Pressable>
            <Pressable
              style={styles.siBtnSecondary}
              onPress={() => { setShowSiWarning(null); setLoadingCourse(null); }}
            >
              <Text style={styles.siBtnSecondaryText}>Choose Different Course</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.forest,
    paddingHorizontal: 32,
    paddingVertical: 56,
    justifyContent: 'space-between',
  },
  centered: { justifyContent: 'center', alignItems: 'center' },
  content: {
    alignItems: 'center',
    marginTop: 48,
  },
  middleSection: {
    flex: 1,
    justifyContent: 'center',
  },
  logo: { width: 480, height: 192, marginBottom: 24 },
  tagline: { color: Colors.gold, fontSize: 20, letterSpacing: 4 },
  card: {
    backgroundColor: Colors.cream,
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 0,
  },
  courseCard: {
    backgroundColor: Colors.cream,
    borderRadius: 12,
    padding: 24,
    marginHorizontal: 0,
    alignItems: 'center',
  },
  courseCardName: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.ink,
    textAlign: 'center',
  },
  courseCardLocation: {
    fontSize: 14,
    color: Colors.gray,
    marginTop: 8,
    textAlign: 'center',
  },
  changeCourseLinkWrap: { marginTop: 14 },
  changeCourseLink: {
    fontSize: 13,
    color: Colors.gray,
    textDecorationLine: 'underline',
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: Colors.ink, marginBottom: 12 },
  searchInput: {
    borderWidth: 2,
    borderColor: Colors.grayLight,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: Colors.ink,
    marginBottom: 10,
  },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  chipText: { fontSize: 13, color: Colors.ink, flex: 1 },
  changeLink: { fontSize: 13, color: Colors.blue, fontWeight: '600' },
  changeCourseWrap: { marginTop: 8, alignSelf: 'flex-start' },
  listBlock: { marginTop: 8 },
  listLabel: { fontSize: 11, color: Colors.gray, marginBottom: 6, textTransform: 'uppercase' },
  listScroll: { maxHeight: 200 },
  listLoader: { marginVertical: 12 },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.grayLight,
  },
  listItemMain: { flex: 1 },
  listItemName: { fontSize: 14, fontWeight: '600', color: Colors.ink },
  listItemLoc: { fontSize: 12, color: Colors.gray, marginTop: 2 },
  listItemDist: { fontSize: 11, color: Colors.forest, marginTop: 2 },
  noResults: { fontSize: 13, color: Colors.gray, fontStyle: 'italic', marginVertical: 12 },
  footer: { alignItems: 'center' },
  button: {
    width: '100%',
    paddingVertical: 16,
    backgroundColor: Colors.gold,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: Colors.grayLight,
    borderWidth: 2,
    borderColor: Colors.gray,
  },
  buttonText: { fontSize: 16, fontWeight: '700', color: Colors.ink },
  buttonTextDisabled: { color: Colors.gray },
  disclaimerTitle: { fontSize: 28, fontWeight: '700', color: Colors.cream, marginBottom: 24, textAlign: 'center' },
  disclaimerBody: { color: Colors.cream, fontSize: 15, lineHeight: 22, textAlign: 'center', marginBottom: 16, opacity: 0.95 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingCard: { backgroundColor: Colors.cream, padding: 24, borderRadius: 12, alignItems: 'center', minWidth: 200 },
  loadingText: { fontSize: 16, color: Colors.ink, marginBottom: 12 },
  siWarningCard: { backgroundColor: Colors.cream, padding: 24, borderRadius: 12, minWidth: 280 },
  siWarningTitle: { fontSize: 18, fontWeight: '700', color: Colors.ink, marginBottom: 12 },
  siWarningBody: { fontSize: 14, color: Colors.ink, lineHeight: 22, marginBottom: 20 },
  siBtnPrimary: {
    backgroundColor: Colors.forest,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 10,
  },
  siBtnPrimaryText: { fontSize: 16, fontWeight: '700', color: Colors.cream },
  siBtnSecondary: { paddingVertical: 14, alignItems: 'center' },
  siBtnSecondaryText: { fontSize: 15, color: Colors.blue },
});
