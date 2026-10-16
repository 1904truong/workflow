import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Worksheet } from '../../types';
import { WorksheetPage } from './WorksheetPage';
import { WorksheetHeader } from './WorksheetHeader';
import { WorksheetFooter } from './WorksheetFooter';
import { ExerciseBlock } from './ExerciseBlock';
import { BrandHeader } from './BrandHeader';
import { BrandFooter } from './BrandFooter';
import { resolveBranding } from '../../types/branding';
import { packWithInfo } from '../../services/pagination';

// 267mm vùng in của trang A4 (đã trừ lề 15mm trên/dưới) và 5mm khoảng cách sau mỗi bài, quy ra px ở 96dpi
const MM = 96 / 25.4;
const PAGE_CONTENT_PX = 267 * MM;
const EX_GAP_PX = 5 * MM;
const SAFETY_PX = 6;

interface Measured { exercises: number[]; header: number; footer: number }

interface WorksheetRendererProps {
  worksheet: Worksheet;
  /** Có giá trị: bấm vào header/footer sẽ gọi hàm này (mở bảng chỉnh sửa) */
  onEditBranding?: () => void;
  /** Ép hiển thị ít nhất N trang (trang thêm là trang demo để kiểm tra footer) */
  minPages?: number;
  /** Báo kết quả chia trang (bài nào ở trang nào, trang nào bị tràn do buộc dồn quá nhiều) */
  onPaginate?: (info: { pages: number[][]; overflow: boolean[] } | null) => void;
}

export const WorksheetRenderer: React.FC<WorksheetRendererProps> = ({ worksheet, onEditBranding, minPages = 0, onPaginate }) => {
  const brand = resolveBranding(worksheet.printSettings.branding);
  // Simple sensible pagination algorithm:
  // If exercises are many or long, group them into pages.
  const heuristicPages = useMemo(() => {
    const list = worksheet.exercises;
    if (list.length === 0) {
      return [[]];
    }

    // Grouping strategy:
    // Page 1 has the large Header + Student Box (~40mm), so fits fewer exercises (e.g., 1-2).
    // Subsequent pages have more printable space (fits ~2-3 exercises).
    const result: typeof list[] = [];
    let currentPage: typeof list = [];
    let currentScore = 0; // heuristic unit based on passage length + questions count + images

    list.forEach((ex, idx) => {
      let weight = 1;
      if (ex.passage && ex.passage.length > 300) weight += 2;
      if (ex.questions.length > 4) weight += 1;
      if (ex.imageSlots.length > 2) weight += 1.5;
      if (ex.layoutType === 'template_e' || ex.tableData) weight += 1.5;
      if (ex.matching) weight += Math.ceil((ex.matching.problems.length + ex.matching.solutions.length) / 6);

      const maxWeightForCurrentPage = result.length === 0 ? 3.5 : 4.5;

      if (currentPage.length > 0 && (ex.pageBreakBefore || currentScore + weight > maxWeightForCurrentPage)) {
        result.push(currentPage);
        currentPage = [ex];
        currentScore = weight;
      } else {
        currentPage.push(ex);
        currentScore += weight;
      }

      if (idx === list.length - 1 && currentPage.length > 0) {
        result.push(currentPage);
      }
    });

    return result.length > 0 ? result : [[]];
  }, [worksheet.exercises]);

  // ── Đo chiều cao thật của từng bài + header + footer rồi xếp vào trang (bài nào vừa thì dồn chung một trang) ──
  const measurerRef = useRef<HTMLDivElement>(null);
  const [measured, setMeasured] = useState<Measured | null>(null);
  const exKey = worksheet.exercises.length;

  useLayoutEffect(() => {
    const root = measurerRef.current;
    if (!root) return;
    const measure = () => {
      const exs = Array.from(root.querySelectorAll<HTMLElement>('[data-m-ex]')).map((el) => Math.round(el.offsetHeight + EX_GAP_PX));
      const header = root.querySelector<HTMLElement>('[data-m-header]')?.offsetHeight ?? 0;
      const footer = root.querySelector<HTMLElement>('[data-m-footer]')?.offsetHeight ?? 0;
      setMeasured((prev) => {
        if (prev && prev.header === header && prev.footer === footer && prev.exercises.length === exs.length && prev.exercises.every((h, i) => h === exs[i])) return prev;
        return { exercises: exs, header, footer };
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    root.querySelectorAll('img').forEach((img) => img.addEventListener('load', measure));
    if (document.fonts?.ready) void document.fonts.ready.then(measure);
    return () => ro.disconnect();
  }, [worksheet, exKey]);

  const packInfo = useMemo(() => {
    const list = worksheet.exercises;
    if (!measured || measured.exercises.length !== list.length || list.length === 0) return null;
    const headerOnAll = brand.enabled && brand.headerPages === 'all';
    const runningHeader = brand.enabled ? 0 : 46; // tiêu đề chạy nhỏ ở trang 2+ khi dùng header cũ
    const firstAvail = PAGE_CONTENT_PX - measured.header - measured.footer - SAFETY_PX;
    const restAvail = PAGE_CONTENT_PX - measured.footer - (headerOnAll ? measured.header : runningHeader) - SAFETY_PX;
    return packWithInfo(measured.exercises, {
      firstAvail,
      restAvail,
      breaks: list.map((ex) => !!ex.pageBreakBefore),
      joins: list.map((ex) => !!ex.mergeWithPrevious),
    });
  }, [measured, worksheet.exercises, brand.enabled, brand.headerPages]);

  const pages = useMemo(
    () => (packInfo ? packInfo.pages.map((idxs) => idxs.map((i) => worksheet.exercises[i])) : heuristicPages),
    [packInfo, worksheet.exercises, heuristicPages],
  );

  const onPaginateRef = useRef(onPaginate);
  onPaginateRef.current = onPaginate;
  useLayoutEffect(() => { onPaginateRef.current?.(packInfo); }, [packInfo]);
  const realPages = pages.length;
  const shownPages = Array.from({ length: Math.max(realPages, minPages) }, (_, i) => pages[i] ?? []);

  return (
    <div className="worksheet-document flex flex-col gap-8 print:gap-0">
      {/* Bản đo ẩn (không hiện, không in): cùng độ rộng vùng in 180mm */}
      <div
        ref={measurerRef}
        aria-hidden="true"
        {...({ inert: true } as object)}
        className="no-print"
        style={{ position: 'absolute', left: -99999, top: 0, width: '180mm', visibility: 'hidden', pointerEvents: 'none' }}
      >
        <div data-m-header>
          {brand.enabled ? <BrandHeader b={brand} /> : <WorksheetHeader worksheet={worksheet} />}
        </div>
        {worksheet.exercises.map((exercise, i) => (
          <div key={exercise.id} data-m-ex>
            <ExerciseBlock exercise={exercise} printSettings={worksheet.printSettings} exerciseIndex={i} />
          </div>
        ))}
        <div data-m-footer>
          {brand.enabled ? <BrandFooter b={brand} pageNumber={1} totalPages={1} /> : <WorksheetFooter pageNumber={1} totalPages={1} schoolName={worksheet.schoolName} />}
        </div>
      </div>

      {shownPages.map((pageExercises, pIdx) => (
        <div key={pIdx} className={pIdx >= realPages ? 'demo-page' : 'contents'}>
        <WorksheetPage
          pageNumber={pIdx + 1}
          totalPages={shownPages.length}
        >
          <div className="flex-1 flex flex-col">
            {/* Header on first page only */}
            {brand.enabled
              ? (pIdx === 0 || brand.headerPages === 'all') && <BrandHeader b={brand} onEdit={onEditBranding} />
              : pIdx === 0 && <WorksheetHeader worksheet={worksheet} />}

            {/* Small Running Header on page 2+ */}
            {pIdx > 0 && !brand.enabled && (
              <div className="w-full flex justify-between text-[8.5pt] text-[#555555] pb-[2mm] mb-[4mm] border-b border-[#cccccc]">
                <span className="font-semibold">{worksheet.title}</span>
                <span>{worksheet.unit || 'English Worksheet'}</span>
              </div>
            )}

            {/* Exercises assigned to this page */}
            <div className="flex-1">
              {pIdx >= realPages ? (
                <div className="p-8 text-center text-[#b0b6c8] italic text-[10pt]">Trang demo để kiểm tra footer (không in ra)</div>
              ) : pageExercises.length === 0 ? (
                <div className="p-8 text-center text-[#888888] italic">
                  No exercises added yet. Use the Left Sidebar to add an exercise.
                </div>
              ) : (
                pageExercises.map((exercise, eIdx) => (
                  <ExerciseBlock
                    key={exercise.id}
                    exercise={exercise}
                    printSettings={worksheet.printSettings}
                    exerciseIndex={shownPages.slice(0, pIdx).reduce((n, pg) => n + pg.length, 0) + eIdx}
                  />
                ))
              )}
            </div>

            {/* Footer with Page Numbers */}
            {brand.enabled ? (
              <BrandFooter b={brand} pageNumber={pIdx + 1} totalPages={shownPages.length} onEdit={onEditBranding} />
            ) : (
              <WorksheetFooter
                pageNumber={pIdx + 1}
                totalPages={shownPages.length}
                schoolName={worksheet.schoolName}
              />
            )}
          </div>
        </WorksheetPage>
        </div>
      ))}
    </div>
  );
};
