import { useState, useEffect, useRef, useMemo } from 'react';
import type { LessonFolder, Exercise, ExerciseType } from './features/worksheet-builder/types';
import { folderStorage } from './features/worksheet-builder/services/folderStorageService';
import { AppSidebar, type MainNavId } from './features/worksheet-builder/components/layout/AppSidebar';
import { AppHeader, type BreadcrumbItem } from './features/worksheet-builder/components/layout/AppHeader';

// Primary Screens
import { LessonFoldersScreen } from './features/worksheet-builder/components/folders/LessonFoldersScreen';
import { CreateFolderScreen } from './features/worksheet-builder/components/folders/CreateFolderScreen';
import { FolderDetailScreen } from './features/worksheet-builder/components/folders/FolderDetailScreen';
import { SmartPasteScreen } from './features/worksheet-builder/components/smart-paste/SmartPasteScreen';
import { setJobAssignHandler, startImageJobs } from './features/worksheet-builder/services/ai/imageJobService';
import { ManualExerciseBuilderScreen } from './features/worksheet-builder/components/exercises/ManualExerciseBuilderScreen';
import { ImageStudioScreen } from './features/worksheet-builder/components/images/ImageStudioScreen';
import { PreviewExportScreen } from './features/worksheet-builder/components/export/PreviewExportScreen';

// Secondary Screens
import { ExportHistoryScreen } from './features/worksheet-builder/components/secondary/ExportHistoryScreen';
import { GalleryScreen } from './features/worksheet-builder/components/secondary/GalleryScreen';
import { SettingsScreen } from './features/worksheet-builder/components/secondary/SettingsScreen';
import { HelpGuideScreen } from './features/worksheet-builder/components/secondary/HelpGuideScreen';

// Print styles
import './features/worksheet-builder/components/toolbar/PrintStyles.css';

export type ScreenState =
  | { type: 'folders' }
  | { type: 'create_folder'; editingFolder?: LessonFolder | null }
  | { type: 'folder_detail'; folderId: string }
  | { type: 'smart_paste'; folderId: string }
  | { type: 'add_exercise'; folderId: string; editingExercise?: Exercise | null; initialType?: ExerciseType }
  | { type: 'images'; folderId?: string }
  | { type: 'export'; folderId: string }
  | { type: 'history' }
  | { type: 'gallery' }
  | { type: 'settings' }
  | { type: 'guide' };

export default function App() {
  const [folders, setFolders] = useState<LessonFolder[]>([]);
  const [activeScreen, setActiveScreen] = useState<ScreenState>({ type: 'folders' });
  // Sau Smart Paste: các bài vừa tách lần lượt mở trong đúng trình soạn của từng dạng
  const [editQueue, setEditQueue] = useState<string[]>([]);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const autosaveTimerRef = useRef<any>(null);

  // Flow Bridge Chrome Extension state
  const [extensionConnected, setExtensionConnected] = useState<boolean>(false);
  const [flowStatus, setFlowStatus] = useState<string>('UNKNOWN');

  // Load folders on mount and default to Listening Gap Fill worksheet
  useEffect(() => {
    const load = async () => {
      const list = await folderStorage.listFolders();
      setFolders(list);

      const london = list.find((f) => f.id === 'folder_unit_2_london');
      if (london && london.exercises.length > 0) {
        const matchingPicturesEx =
          london.exercises.find((e) => e.type === 'matching_pictures') ||
          london.exercises[0];
        setActiveScreen({
          type: 'add_exercise',
          folderId: london.id,
          editingExercise: matchingPicturesEx,
        });
      }
    };
    load();
  }, []);

  // Web-to-Extension Communication Protocol
  useEffect(() => {
    const queryFlowStatus = () => {
      const pingId = `status_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      window.postMessage(
        {
          id: pingId,
          type: 'GET_FLOW_STATUS',
          source: 'web',
          timestamp: Date.now(),
          payload: null,
        },
        window.location.origin
      );
    };

    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data;
      if (!data || typeof data !== 'object') return;

      if (data.type === 'EXTENSION_DETECTED') {
        setExtensionConnected(true);
        queryFlowStatus();
      }
      if (data.source === 'extension' && data.type === 'GET_FLOW_STATUS') {
        setExtensionConnected(true);
        const status = data.payload?.status || 'UNKNOWN';
        setFlowStatus(status);
      }
    };

    window.addEventListener('message', handleMessage);
    // Initial ping
    queryFlowStatus();
    // Periodic status refresh every 4 seconds
    const interval = setInterval(queryFlowStatus, 4000);

    return () => {
      window.removeEventListener('message', handleMessage);
      clearInterval(interval);
    };
  }, []);

  // Autosave a folder to storage with debouncing
  const persistFolder = (updatedFolder: LessonFolder) => {
    setSaveStatus('saving');
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);

    autosaveTimerRef.current = setTimeout(async () => {
      await folderStorage.saveFolder(updatedFolder);
      setSaveStatus('saved');
    }, 600);
  };

  // Helper to find a folder by ID
  const getFolder = (folderId?: string): LessonFolder | null => {
    if (!folderId) return folders[0] || null;
    return folders.find((f) => f.id === folderId) || null;
  };

  // Map active screen to primary navigation sidebar ID
  const activeNavId: MainNavId = useMemo(() => {
    switch (activeScreen.type) {
      case 'folders':
      case 'folder_detail':
      case 'smart_paste':
      case 'add_exercise':
      case 'export':
        return 'lessons';
      case 'create_folder':
        return 'create_new';
      case 'images':
        return 'images';
      case 'gallery':
        return 'gallery';
      case 'history':
        return 'history';
      case 'settings':
        return 'settings';
      case 'guide':
        return 'guide';
      default:
        return 'lessons';
    }
  }, [activeScreen.type]);

  // Sidebar navigation handler
  const handleNavClick = (navId: MainNavId) => {
    switch (navId) {
      case 'lessons':
        setActiveScreen({ type: 'folders' });
        break;
      case 'create_new':
        setActiveScreen({ type: 'create_folder' });
        break;
      case 'images': {
        const targetFolder = folders[0];
        setActiveScreen({ type: 'images', folderId: targetFolder?.id });
        break;
      }
      case 'gallery':
        setActiveScreen({ type: 'gallery' });
        break;
      case 'history':
        setActiveScreen({ type: 'history' });
        break;
      case 'settings':
        setActiveScreen({ type: 'settings' });
        break;
      case 'guide':
        setActiveScreen({ type: 'guide' });
        break;
    }
  };

  // Dynamic breadcrumbs
  const breadcrumbs: BreadcrumbItem[] = useMemo(() => {
    const list: BreadcrumbItem[] = [];

    switch (activeScreen.type) {
      case 'folders':
        list.push({ label: 'Lesson Folders' });
        break;
      case 'create_folder':
        list.push({ label: 'Lesson Folders', onClick: () => setActiveScreen({ type: 'folders' }) });
        list.push({ label: activeScreen.editingFolder ? 'Edit Folder Details' : 'Create New Folder' });
        break;
      case 'folder_detail': {
        const folder = getFolder(activeScreen.folderId);
        list.push({ label: 'Lesson Folders', onClick: () => setActiveScreen({ type: 'folders' }) });
        list.push({ label: folder?.name || 'Lesson Folder' });
        break;
      }
      case 'smart_paste': {
        const folder = getFolder(activeScreen.folderId);
        list.push({ label: 'Lesson Folders', onClick: () => setActiveScreen({ type: 'folders' }) });
        list.push({
          label: folder?.name || 'Folder',
          onClick: () => setActiveScreen({ type: 'folder_detail', folderId: activeScreen.folderId }),
        });
        list.push({ label: 'Smart Paste' });
        break;
      }
      case 'add_exercise': {
        const folder = getFolder(activeScreen.folderId);
        list.push({ label: 'Lesson Folders', onClick: () => setActiveScreen({ type: 'folders' }) });
        list.push({
          label: folder?.name || 'Folder',
          onClick: () => setActiveScreen({ type: 'folder_detail', folderId: activeScreen.folderId }),
        });
        list.push({ label: activeScreen.editingExercise ? 'Edit Exercise' : 'Add Exercise' });
        break;
      }
      case 'images': {
        const folder = getFolder(activeScreen.folderId);
        if (folder) {
          list.push({ label: 'Lesson Folders', onClick: () => setActiveScreen({ type: 'folders' }) });
          list.push({
            label: folder.name,
            onClick: () => setActiveScreen({ type: 'folder_detail', folderId: folder.id }),
          });
        }
        list.push({ label: 'AI Image Studio' });
        break;
      }
      case 'export': {
        const folder = getFolder(activeScreen.folderId);
        list.push({ label: 'Lesson Folders', onClick: () => setActiveScreen({ type: 'folders' }) });
        list.push({
          label: folder?.name || 'Folder',
          onClick: () => setActiveScreen({ type: 'folder_detail', folderId: activeScreen.folderId }),
        });
        list.push({ label: 'Preview & Export' });
        break;
      }
      case 'gallery':
        list.push({ label: 'My Gallery' });
        break;
      case 'history':
        list.push({ label: 'Export History' });
        break;
      case 'settings':
        list.push({ label: 'Settings' });
        break;
      case 'guide':
        list.push({ label: 'Help & Guide' });
        break;
    }

    return list;
  }, [activeScreen, folders]);

  // Folder Actions
  const handleCreateOrUpdateFolder = async (folderData: Partial<LessonFolder>) => {
    if (activeScreen.type === 'create_folder' && activeScreen.editingFolder) {
      // Update existing folder
      const updated: LessonFolder = {
        ...activeScreen.editingFolder,
        ...folderData,
        updatedAt: Date.now(),
      } as LessonFolder;
      await folderStorage.saveFolder(updated);
      setFolders((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
      setActiveScreen({ type: 'folder_detail', folderId: updated.id });
    } else {
      // Create new folder
      const newFolder: LessonFolder = {
        id: `folder_${Date.now()}`,
        name: folderData.name || 'New English Worksheet',
        gradeLevel: folderData.gradeLevel || 'Grade 7',
        subject: folderData.subject || 'English',
        unitTopic: folderData.unitTopic,
        lessonTitle: folderData.lessonTitle,
        description: folderData.description,
        estimatedDuration: folderData.estimatedDuration || 45,
        targetSkills: folderData.targetSkills || ['Reading', 'Vocabulary'],
        schoolName: folderData.schoolName || 'Cambridge International Academy',
        teacherName: folderData.teacherName || 'Sarah Jenkins',
        totalPoints: 20,
        status: 'draft',
        printSettings: folderData.printSettings || {
          paperSize: 'A4',
          orientation: 'portrait',
          widthMm: 210,
          heightMm: 297,
          marginMm: 15,
          printableWidthMm: 180,
          printableHeightMm: 267,
          showStudentInfo: true,
          showEmptyImagePlaceholders: true,
          mode: 'student',
          fontSizeBasePt: 11,
          lineHeight: 1.35,
        },
        exercises: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await folderStorage.saveFolder(newFolder);
      setFolders((prev) => [newFolder, ...prev]);
      setActiveScreen({ type: 'folder_detail', folderId: newFolder.id });
    }
  };

  const handleDuplicateFolder = async (folderId: string) => {
    const duplicated = await folderStorage.duplicateFolder(folderId);
    if (duplicated) {
      setFolders((prev) => [duplicated, ...prev]);
    }
  };

  const handleDeleteFolder = async (folderId: string) => {
    if (confirm('Are you sure you want to delete this lesson folder? All its exercises will be deleted.')) {
      await folderStorage.deleteFolder(folderId);
      setFolders((prev) => prev.filter((f) => f.id !== folderId));
      if (
        (activeScreen.type === 'folder_detail' && activeScreen.folderId === folderId) ||
        (activeScreen.type === 'smart_paste' && activeScreen.folderId === folderId) ||
        (activeScreen.type === 'add_exercise' && activeScreen.folderId === folderId) ||
        (activeScreen.type === 'export' && activeScreen.folderId === folderId)
      ) {
        setActiveScreen({ type: 'folders' });
      }
    }
  };

  // Update exercises of a folder
  const handleUpdateFolderExercises = (folderId: string, updatedExercises: Exercise[]) => {
    const target = folders.find((f) => f.id === folderId);
    if (!target) return;

    const updated: LessonFolder = {
      ...target,
      exercises: updatedExercises,
      updatedAt: Date.now(),
    };

    setFolders((prev) => prev.map((f) => (f.id === folderId ? updated : f)));
    persistFolder(updated);
  };

  // Hàng đợi tạo ảnh AI: khi một job xong, gắn ảnh vào ĐÚNG ô (theo slotId) của đề đang lưu.
  // Đăng ký lại mỗi lần danh sách đề đổi để hàm luôn thấy dữ liệu mới nhất.
  useEffect(() => {
    setJobAssignHandler((job, result) => {
      const target = folders.find((f) => f.id === job.worksheetId);
      if (!target) return false;
      let found = false;
      const exercises = target.exercises.map((ex) => ({
        ...ex,
        imageSlots: ex.imageSlots.map((s) => {
          if (s.slotId !== job.slotId) return s;
          found = true;
          return {
            ...s,
            assetUrl: result.imageUrl,
            assetStoragePath: result.storagePath,
            aiPrompt: job.prompt,
            status: 'assigned' as const,
            needsReview: true, // giáo viên phải duyệt trước khi xuất
          };
        }),
      }));
      if (!found) return false;
      handleUpdateFolderExercises(target.id, exercises);
      return true;
    });
    return () => setJobAssignHandler(null);
  });

  // Mở lại trang: job đang dở được xếp lại hàng đợi (xem createJobStore) -> chạy tiếp
  useEffect(() => {
    void startImageJobs();
  }, []);

  // Smart Paste confirmed import
  const handleSmartPasteConfirm = (folderId: string, newExercises: Exercise[]) => {
    const target = folders.find((f) => f.id === folderId);
    if (!target) return;

    const merged = [...target.exercises, ...newExercises];
    handleUpdateFolderExercises(folderId, merged);
    if (newExercises.length === 0) {
      setActiveScreen({ type: 'folder_detail', folderId });
      return;
    }
    setEditQueue(newExercises.slice(1).map((e) => e.id));
    setActiveScreen({ type: 'add_exercise', folderId, editingExercise: newExercises[0] });
  };

  // Manual Exercise save
  const handleSaveExercise = (
    folderId: string,
    exercise: Exercise,
    nextAction: 'return' | 'add_another' | 'stay'
  ) => {
    const target = folders.find((f) => f.id === folderId);
    if (!target) return;

    const existingIdx = target.exercises.findIndex((e) => e.id === exercise.id);
    let updatedExercises = [...target.exercises];

    if (existingIdx >= 0) {
      updatedExercises[existingIdx] = exercise;
    } else {
      updatedExercises.push(exercise);
    }

    handleUpdateFolderExercises(folderId, updatedExercises);

    if (nextAction === 'return') {
      const [nextId, ...rest] = editQueue;
      const nextEx = nextId ? updatedExercises.find((e) => e.id === nextId) : undefined;
      if (nextEx) {
        setEditQueue(rest);
        setActiveScreen({ type: 'add_exercise', folderId, editingExercise: nextEx });
      } else {
        setEditQueue([]);
        setActiveScreen({ type: 'folder_detail', folderId });
      }
    }
  };

  const handleDuplicateExercise = (folderId: string, exerciseId: string) => {
    const target = folders.find((f) => f.id === folderId);
    if (!target) return;

    const ex = target.exercises.find((e) => e.id === exerciseId);
    if (!ex) return;

    const duplicated: Exercise = {
      ...ex,
      id: `ex_${Date.now()}`,
      title: `${ex.title} (Copy)`,
      order: target.exercises.length + 1,
      questions: ex.questions.map((q, i) => ({
        ...q,
        id: `q_${Date.now()}_${i}`,
      })),
      imageSlots: ex.imageSlots.map((s, i) => ({
        ...s,
        slotId: `slot_${Date.now()}_${i}`,
      })),
    };

    handleUpdateFolderExercises(folderId, [...target.exercises, duplicated]);
  };

  const handleDeleteExercise = (folderId: string, exerciseId: string) => {
    const target = folders.find((f) => f.id === folderId);
    if (!target) return;

    if (confirm('Delete this exercise from the folder?')) {
      const remaining = target.exercises
        .filter((e) => e.id !== exerciseId)
        .map((e, idx) => ({ ...e, order: idx + 1 }));
      handleUpdateFolderExercises(folderId, remaining);
    }
  };

  // Update print settings of a folder
  const handleUpdatePrintSettings = (folderId: string, key: string, value: any) => {
    const target = folders.find((f) => f.id === folderId);
    if (!target) return;

    const updated: LessonFolder = {
      ...target,
      printSettings: {
        ...target.printSettings,
        [key]: value,
      },
      updatedAt: Date.now(),
    };

    setFolders((prev) => prev.map((f) => (f.id === folderId ? updated : f)));
    persistFolder(updated);
  };

  // Reset to default sample lesson folders
  const handleResetToSamples = async () => {
    if (confirm('Reset to initial sample lesson folders? Current changes will be replaced.')) {
      localStorage.removeItem('flow_bridge_folders_v2');
      const fresh = await folderStorage.listFolders();
      setFolders(fresh);
      setActiveScreen({ type: 'folders' });
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 text-slate-800 font-sans">
      {/* 1. Global Navigation Sidebar (248px desktop) */}
      <AppSidebar
        activeNav={activeNavId}
        onNavigate={handleNavClick}
        foldersCount={folders.length}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
        {/* 2. Top Header with Breadcrumbs & Autosave Status */}
        <AppHeader
          breadcrumbs={breadcrumbs}
          saveStatus={saveStatus}
          hideSaveStatus={activeScreen.type === 'add_exercise'}
        />

        {/* 3. Screen View Container: ONLY render the currently active screen */}
        <main className="flex-1 flex overflow-hidden">
          
          {/* SCREEN 1: Lesson Folders List */}
          {activeScreen.type === 'folders' && (
            <LessonFoldersScreen
              folders={folders}
              onOpenFolder={(folderId) => setActiveScreen({ type: 'folder_detail', folderId })}
              onCreateNewFolder={() => setActiveScreen({ type: 'create_folder' })}
              onDuplicateFolder={handleDuplicateFolder}
              onDeleteFolder={handleDeleteFolder}
              onEditFolderInfo={(folder) =>
                setActiveScreen({ type: 'create_folder', editingFolder: folder })
              }
            />
          )}

          {/* SCREEN 2: Create / Edit Lesson Folder */}
          {activeScreen.type === 'create_folder' && (
            <CreateFolderScreen
              initialFolder={activeScreen.editingFolder}
              onSave={handleCreateOrUpdateFolder}
              onCancel={() => setActiveScreen({ type: 'folders' })}
            />
          )}

          {/* SCREEN 5: Lesson Folder Contents & Exercises */}
          {activeScreen.type === 'folder_detail' && (() => {
            const currentFolder = getFolder(activeScreen.folderId);
            if (!currentFolder) {
              return (
                <div className="p-8 text-center text-xs text-slate-400">
                  Folder not found. <button onClick={() => setActiveScreen({ type: 'folders' })} className="text-blue-600 font-bold">Return to Folders</button>
                </div>
              );
            }

            return (
              <FolderDetailScreen
                folder={currentFolder}
                onBackToFolders={() => setActiveScreen({ type: 'folders' })}
                onOpenSmartPaste={() =>
                  setActiveScreen({ type: 'smart_paste', folderId: currentFolder.id })
                }
                onOpenAddExercise={(initialType) =>
                  setActiveScreen({ type: 'add_exercise', folderId: currentFolder.id, initialType })
                }
                onEditExercise={(exerciseId) => {
                  const ex = currentFolder.exercises.find((e) => e.id === exerciseId);
                  setActiveScreen({
                    type: 'add_exercise',
                    folderId: currentFolder.id,
                    editingExercise: ex,
                  });
                }}
                onOpenImages={() =>
                  setActiveScreen({ type: 'images', folderId: currentFolder.id })
                }
                onOpenPreviewExport={() =>
                  setActiveScreen({ type: 'export', folderId: currentFolder.id })
                }
                onEditFolderInfo={() =>
                  setActiveScreen({ type: 'create_folder', editingFolder: currentFolder })
                }
                onUpdateExercises={(updated) =>
                  handleUpdateFolderExercises(currentFolder.id, updated)
                }
                onDuplicateExercise={(exId) =>
                  handleDuplicateExercise(currentFolder.id, exId)
                }
                onDeleteExercise={(exId) =>
                  handleDeleteExercise(currentFolder.id, exId)
                }
                onInsertSampleExercises={() => {
                  // If sample is requested inside an empty folder
                  handleUpdateFolderExercises(currentFolder.id, [
                    {
                      id: `ex_${Date.now()}_1`,
                      type: 'grammar_vocab_multiple_choice',
                      layoutType: 'template_a',
                      title: 'Exercise 1: Vocabulary & Grammar',
                      instructions: 'Choose the best option (A, B, C or D) to complete each sentence.',
                      pointsTotal: 5,
                      order: 1,
                      imageSlots: [],
                      questions: [
                        {
                          id: `q_1`,
                          number: 1,
                          text: 'Endangered animals face serious threats from habitat ________.',
                          options: [
                            { id: 'opt_1', label: 'A', text: 'loss' },
                            { id: 'opt_2', label: 'B', text: 'lose' },
                            { id: 'opt_3', label: 'C', text: 'lost' },
                            { id: 'opt_4', label: 'D', text: 'losing' },
                          ],
                          correctAnswer: 'A',
                          points: 1,
                        },
                      ],
                    },
                  ]);
                }}
              />
            );
          })()}

          {/* SCREEN 3: Smart Paste Import */}
          {activeScreen.type === 'smart_paste' && (() => {
            const currentFolder = getFolder(activeScreen.folderId);
            if (!currentFolder) return null;

            return (
              <SmartPasteScreen
                folder={currentFolder}
                onCancel={() =>
                  setActiveScreen({ type: 'folder_detail', folderId: currentFolder.id })
                }
                onConfirmImport={(newExs) =>
                  handleSmartPasteConfirm(currentFolder.id, newExs)
                }
              />
            );
          })()}

          {/* SCREEN 4: Manual Exercise Builder */}
          {activeScreen.type === 'add_exercise' && (() => {
            const currentFolder = getFolder(activeScreen.folderId);
            if (!currentFolder) return null;

            return (
              <ManualExerciseBuilderScreen
                key={activeScreen.editingExercise?.id ?? 'new'}
                folder={currentFolder}
                editingExercise={activeScreen.editingExercise}
                initialType={activeScreen.initialType}
                onSaveExercise={(ex, nextAction) =>
                  handleSaveExercise(currentFolder.id, ex, nextAction)
                }
                onDeleteExercise={(exId) => handleDeleteExercise(currentFolder.id, exId)}
                onCancel={() => {
                  setEditQueue([]);
                  setActiveScreen({ type: 'folder_detail', folderId: currentFolder.id });
                }}
              />
            );
          })()}

          {/* SCREEN 6: AI Image Studio */}
          {activeScreen.type === 'images' && (() => {
            const currentFolder = getFolder(activeScreen.folderId);
            if (!currentFolder) {
              return (
                <div className="p-8 text-center text-xs text-slate-400">
                  Please select a lesson folder first.
                </div>
              );
            }

            return (
              <ImageStudioScreen
                folder={currentFolder}
                onBackToFolder={() =>
                  setActiveScreen({ type: 'folder_detail', folderId: currentFolder.id })
                }
                onUpdateFolderExercises={(updated) =>
                  handleUpdateFolderExercises(currentFolder.id, updated)
                }
                onNavigateToPreview={() =>
                  setActiveScreen({ type: 'export', folderId: currentFolder.id })
                }
                extensionConnected={extensionConnected}
                flowStatus={flowStatus}
                extensionDetected={extensionConnected}
              />
            );
          })()}

          {/* SCREEN 7: Preview & Export */}
          {activeScreen.type === 'export' && (() => {
            const currentFolder = getFolder(activeScreen.folderId);
            if (!currentFolder) return null;

            return (
              <PreviewExportScreen
                folder={currentFolder}
                onBackToFolder={() =>
                  setActiveScreen({ type: 'folder_detail', folderId: currentFolder.id })
                }
                onUpdatePrintSettings={(key, value) =>
                  handleUpdatePrintSettings(currentFolder.id, key, value)
                }
                onUpdateExercises={(exercises) => handleUpdateFolderExercises(currentFolder.id, exercises)}
              />
            );
          })()}

          {/* SECONDARY SCREEN: Export History */}
          {activeScreen.type === 'history' && (
            <ExportHistoryScreen
              onOpenFolder={(folderId) =>
                setActiveScreen({ type: 'folder_detail', folderId })
              }
            />
          )}

          {/* SECONDARY SCREEN: My Gallery */}
          {activeScreen.type === 'gallery' && (
            <GalleryScreen
              folders={folders}
              onOpenFolder={(folderId) =>
                setActiveScreen({ type: 'folder_detail', folderId })
              }
            />
          )}

          {/* SECONDARY SCREEN: Settings */}
          {activeScreen.type === 'settings' && (
            <SettingsScreen onResetSamples={handleResetToSamples} />
          )}

          {/* SECONDARY SCREEN: Help & Guide */}
          {activeScreen.type === 'guide' && <HelpGuideScreen />}
        </main>
      </div>
    </div>
  );
}
