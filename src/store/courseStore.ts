import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Course } from '../types/course';

interface CourseState {
  selectedCourse: Course | null;
  setSelectedCourse: (course: Course | null) => void;
}

export const useCourseStore = create<CourseState>()(
  persist(
    (set) => ({
      selectedCourse: null,
      setSelectedCourse: (selectedCourse) => set({ selectedCourse }),
    }),
    {
      name: 'square18-course',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ selectedCourse: s.selectedCourse }),
    }
  )
);
