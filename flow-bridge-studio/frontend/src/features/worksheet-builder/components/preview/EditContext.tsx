import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';

/** Các thao tác sửa trực tiếp trên trang xem trước. Mặc định: không sửa (editing = false). */
export interface EditApi {
  editing: boolean;
  setExerciseField: (exerciseId: string, field: 'title' | 'instructions' | 'passage', value: string) => void;
  setQuestionText: (questionId: string, value: string) => void;
  deleteQuestion: (questionId: string) => void;
  deleteExercise: (exerciseId: string) => void;
  moveExercise: (exerciseId: string, dir: -1 | 1) => void;
  togglePageBreak: (exerciseId: string) => void;
  replaceImage: (slotId: string, file: File) => void;
  clearImage: (slotId: string) => void;
}

const noop = () => {};
export const NO_EDIT: EditApi = {
  editing: false,
  setExerciseField: noop,
  setQuestionText: noop,
  deleteQuestion: noop,
  deleteExercise: noop,
  moveExercise: noop,
  togglePageBreak: noop,
  replaceImage: noop,
  clearImage: noop,
};

const Ctx = createContext<EditApi>(NO_EDIT);
export const EditProvider = Ctx.Provider;
export const useEdit = () => useContext(Ctx);

interface EditableProps {
  value: string;
  onCommit: (value: string) => void;
  as?: 'span' | 'div' | 'p' | 'h2';
  className?: string;
  /** true: cho xuống dòng (đoạn văn). false: Enter = xong */
  multiline?: boolean;
  placeholder?: string;
}

/** Hiện chữ bình thường; khi bật chế độ sửa thì bấm vào là gõ được, rời khỏi ô (blur) là lưu. Esc = hủy. */
export const Editable = ({ value, onCommit, as = 'span', className = '', multiline = false, placeholder }: EditableProps): ReactNode => {
  const { editing } = useEdit();
  const Tag = as as 'span';
  if (!editing) return <Tag className={className || undefined}>{value}</Tag>;
  return (
    <Tag
      className={`${className} edit-field`}
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      data-placeholder={placeholder}
      onBlur={(e) => {
        let v = e.currentTarget.innerText.replace(/ /g, ' ');
        v = multiline ? v.replace(/\n+$/, '') : v.replace(/\s*\n+\s*/g, ' ').trim();
        if (v !== value) onCommit(v);
        else e.currentTarget.innerText = value;
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.currentTarget.innerText = value;
          e.currentTarget.blur();
        } else if (e.key === 'Enter' && !multiline) {
          e.preventDefault();
          e.currentTarget.blur();
        }
      }}
    >
      {value}
    </Tag>
  );
};
