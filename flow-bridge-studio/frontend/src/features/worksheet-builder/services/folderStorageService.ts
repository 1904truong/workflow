import type { LessonFolder, ExportHistoryItem } from '../types';
import { DEFAULT_SAMPLE_WORKSHEET } from './sampleWorksheets';
import { createListeningGapFill } from './listening/listeningGapFillCore';
import { createMatchingPictures } from './matching-pictures/matchingPicturesCore';

const FOLDERS_STORAGE_KEY = 'flow_bridge_folders_v2';
const ACTIVE_FOLDER_ID_KEY = 'flow_bridge_active_folder_id';
const EXPORT_HISTORY_KEY = 'flow_bridge_export_history_v1';

/**
 * Initial sample lesson folders for teacher demonstration
 */
const INITIAL_SAMPLE_FOLDERS: LessonFolder[] = [
  {
    id: 'folder_unit_2_london',
    name: 'Unit 2: London',
    gradeLevel: 'Level 2',
    subject: 'English',
    unitTopic: 'Things to See and Do in London',
    lessonTitle: 'London Sightseeing & Landmarks',
    description: 'Listening comprehension and picture matching activities covering famous London attractions, audio QR code, and 6 printable layouts.',
    estimatedDuration: 45,
    targetSkills: ['Listening', 'Vocabulary', 'Matching', 'Reading'],
    schoolName: 'PINTA ENGLISH ACADEMY',
    teacherName: 'MAI LINH',
    totalPoints: 17,
    status: 'ready',
    printSettings: {
      ...DEFAULT_SAMPLE_WORKSHEET.printSettings,
      paperSize: 'A4',
      branding: {
        ...DEFAULT_SAMPLE_WORKSHEET.printSettings.branding,
        enabled: true,
        docTitle: 'DAILY WORKSHEET',
        level: '2',
        worksheetNo: 'WS-Imp-4-1-1',
        teacherName: 'MAI LINH',
        teacherPhone: '086 6866 003',
        showScoreBox: true,
        showStickers: true,
      },
    },
    exercises: [
      {
        id: 'ex_u2_listen_gap_fill',
        type: 'listening_gap_fill',
        layoutType: 'template_a',
        title: 'Exercise 3: LISTEN AND FILL IN THE GAP',
        instructions: 'Listen to the audio recording and fill in the missing words.',
        pointsTotal: 12,
        order: 3,
        imageSlots: [],
        questions: [],
        listeningGapFill: createListeningGapFill(),
      },
      {
        id: 'ex_u2_matching_pictures',
        type: 'matching_pictures',
        layoutType: 'template_a',
        title: 'Exercise 4: MATCH EACH PARAGRAPH OF EXERCISE 3 AND THE APPROPRIATE PICTURE',
        instructions: 'Match each paragraph of Exercise 3 and the appropriate picture.',
        pointsTotal: 5,
        order: 4,
        imageSlots: [],
        questions: [],
        matchingPictures: createMatchingPictures(),
      },
    ],
    createdAt: Date.now() - 3600000,
    updatedAt: Date.now(),
  },
  {
    id: 'folder_unit_5_nature',
    name: 'Unit 5: Nature & Environment',
    gradeLevel: 'Grade 7',
    subject: 'English',
    unitTopic: 'Biodiversity & Habitats',
    lessonTitle: 'Endangered Species & Tropical Rainforests',
    description: 'Comprehensive mid-term unit test assessing reading comprehension, picture matching, ecological vocabulary, and short-answer writing.',
    estimatedDuration: 45,
    targetSkills: ['Reading', 'Vocabulary', 'Matching', 'Writing'],
    schoolName: 'Cambridge International Academy',
    teacherName: 'Sarah Jenkins',
    totalPoints: 20,
    status: 'ready',
    printSettings: DEFAULT_SAMPLE_WORKSHEET.printSettings,
    exercises: DEFAULT_SAMPLE_WORKSHEET.exercises,
    createdAt: Date.now() - 86400000 * 2,
    updatedAt: Date.now() - 3600000 * 3,
  },
  {
    id: 'folder_unit_3_supermarket',
    name: 'Unit 3: Daily Life & Shopping',
    gradeLevel: 'Grade 6',
    subject: 'English',
    unitTopic: 'Food & Quantifiers',
    lessonTitle: 'At the Supermarket',
    description: 'Interactive grammar and listening practice focused on countable/uncountable nouns, some/any, and polite shopping expressions.',
    estimatedDuration: 40,
    targetSkills: ['Listening', 'Grammar', 'Speaking'],
    schoolName: 'Oxford Primary Academy',
    teacherName: 'Sarah Jenkins',
    totalPoints: 15,
    status: 'draft',
    printSettings: DEFAULT_SAMPLE_WORKSHEET.printSettings,
    exercises: [
      {
        id: 'ex_u3_1',
        type: 'grammar_vocab_multiple_choice',
        layoutType: 'template_a',
        title: 'Exercise 1: Quantifiers (Some / Any / Much / Many)',
        instructions: 'Choose the correct answer (A, B, C or D) to complete each sentence.',
        pointsTotal: 5,
        order: 1,
        imageSlots: [],
        questions: [
          {
            id: 'q_u3_1_1',
            number: 1,
            text: 'Would you like ________ orange juice with your breakfast?',
            options: [
              { id: 'opt_1', label: 'A', text: 'some' },
              { id: 'opt_2', label: 'B', text: 'any' },
              { id: 'opt_3', label: 'C', text: 'many' },
              { id: 'opt_4', label: 'D', text: 'a few' },
            ],
            correctAnswer: 'A',
            points: 1,
          },
          {
            id: 'q_u3_1_2',
            number: 2,
            text: 'There isn\'t ________ fresh milk left in the refrigerator.',
            options: [
              { id: 'opt_1', label: 'A', text: 'some' },
              { id: 'opt_2', label: 'B', text: 'any' },
              { id: 'opt_3', label: 'C', text: 'no' },
              { id: 'opt_4', label: 'D', text: 'many' },
            ],
            correctAnswer: 'B',
            points: 1,
          },
        ],
      },
      {
        id: 'ex_u3_2',
        type: 'sentence_construction',
        layoutType: 'template_a',
        title: 'Exercise 2: Sentence Construction',
        instructions: 'Write complete sentences using the suggested cues below.',
        pointsTotal: 5,
        order: 2,
        imageSlots: [],
        questions: [
          {
            id: 'q_u3_2_1',
            number: 3,
            text: 'How much / a kilo of apples / cost / at the market?',
            linesCount: 2,
            correctAnswer: 'How much does a kilo of apples cost at the market?',
            points: 2,
          },
        ],
      },
    ],
    createdAt: Date.now() - 86400000 * 5,
    updatedAt: Date.now() - 86400000,
  },
];

export class FolderStorageService {
  /**
   * Retrieves all lesson folders
   */
  async listFolders(): Promise<LessonFolder[]> {
    try {
      const data = localStorage.getItem(FOLDERS_STORAGE_KEY);
      if (!data) {
        // Initialize with realistic sample folders
        localStorage.setItem(FOLDERS_STORAGE_KEY, JSON.stringify(INITIAL_SAMPLE_FOLDERS));
        return INITIAL_SAMPLE_FOLDERS;
      }
      const folders: LessonFolder[] = JSON.parse(data);
      const londonSample = INITIAL_SAMPLE_FOLDERS.find((f) => f.id === 'folder_unit_2_london');
      if (londonSample) {
        const existingLondon = folders.find((f) => f.id === 'folder_unit_2_london');
        if (!existingLondon) {
          folders.unshift(londonSample);
          localStorage.setItem(FOLDERS_STORAGE_KEY, JSON.stringify(folders));
        } else if (!existingLondon.exercises.some((e) => e.type === 'matching_pictures')) {
          existingLondon.exercises = londonSample.exercises;
          existingLondon.printSettings = londonSample.printSettings;
          localStorage.setItem(FOLDERS_STORAGE_KEY, JSON.stringify(folders));
        }
      }
      return folders;
    } catch (e) {
      console.error('Failed to load lesson folders from storage', e);
      return INITIAL_SAMPLE_FOLDERS;
    }
  }

  /**
   * Retrieves a single folder by ID
   */
  async getFolder(id: string): Promise<LessonFolder | null> {
    const folders = await this.listFolders();
    return folders.find((f) => f.id === id) || null;
  }

  /**
   * Saves or updates a lesson folder
   */
  async saveFolder(folder: LessonFolder): Promise<void> {
    const folders = await this.listFolders();
    const existingIndex = folders.findIndex((f) => f.id === folder.id);

    const updated: LessonFolder = {
      ...folder,
      updatedAt: Date.now(),
    };

    if (existingIndex >= 0) {
      folders[existingIndex] = updated;
    } else {
      folders.unshift(updated);
    }

    localStorage.setItem(FOLDERS_STORAGE_KEY, JSON.stringify(folders));
    localStorage.setItem(ACTIVE_FOLDER_ID_KEY, folder.id);
  }

  /**
   * Deletes a folder by ID
   */
  async deleteFolder(id: string): Promise<void> {
    const folders = await this.listFolders();
    const filtered = folders.filter((f) => f.id !== id);
    localStorage.setItem(FOLDERS_STORAGE_KEY, JSON.stringify(filtered));
  }

  /**
   * Duplicates an existing folder
   */
  async duplicateFolder(id: string): Promise<LessonFolder | null> {
    const target = await this.getFolder(id);
    if (!target) return null;

    const newId = `folder_${Date.now()}`;
    const duplicated: LessonFolder = {
      ...target,
      id: newId,
      name: `${target.name} (Copy)`,
      status: 'draft',
      exercises: target.exercises.map((ex, exIdx) => ({
        ...ex,
        id: `ex_${Date.now()}_${exIdx}`,
        questions: ex.questions.map((q, qIdx) => ({
          ...q,
          id: `q_${Date.now()}_${exIdx}_${qIdx}`,
        })),
        imageSlots: ex.imageSlots.map((s, sIdx) => ({
          ...s,
          slotId: `slot_${Date.now()}_${sIdx}`,
        })),
      })),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await this.saveFolder(duplicated);
    return duplicated;
  }

  /**
   * Active Folder management
   */
  getActiveFolderId(): string | null {
    return localStorage.getItem(ACTIVE_FOLDER_ID_KEY);
  }

  setActiveFolderId(id: string): void {
    localStorage.setItem(ACTIVE_FOLDER_ID_KEY, id);
  }

  /**
   * Export History management
   */
  async listExportHistory(): Promise<ExportHistoryItem[]> {
    try {
      const data = localStorage.getItem(EXPORT_HISTORY_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  async addExportHistory(item: Omit<ExportHistoryItem, 'id' | 'exportedAt'>): Promise<void> {
    const history = await this.listExportHistory();
    const newItem: ExportHistoryItem = {
      ...item,
      id: `exp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      exportedAt: Date.now(),
    };
    history.unshift(newItem);
    // Keep last 30 exports
    localStorage.setItem(EXPORT_HISTORY_KEY, JSON.stringify(history.slice(0, 30)));
  }
}

export const folderStorage = new FolderStorageService();
