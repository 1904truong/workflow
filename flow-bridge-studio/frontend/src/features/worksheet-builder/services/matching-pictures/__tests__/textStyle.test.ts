import test from 'node:test';
import assert from 'node:assert/strict';
import { setTextStyle, toggleTextFlag, bumpTextSize, textStyleToCss } from '../matchingPicturesCore.ts';

test('bật in đậm / nghiêng / gạch chân rồi tắt lại thì gỡ sạch kiểu', () => {
  let st = toggleTextFlag(undefined, 'title', 'italic', false);
  assert.equal(st.title?.italic, true);
  st = toggleTextFlag(st, 'title', 'underline', false);
  assert.deepEqual(st.title, { italic: true, underline: true });
  st = setTextStyle(st, 'title', { italic: undefined, underline: undefined });
  assert.equal(st.title, undefined);
});

test('thành phần mặc định đã đậm: bấm B phải TẮT đậm (không bật thêm lần nữa)', () => {
  const st = toggleTextFlag(undefined, 'title', 'bold', true);
  assert.equal(st.title?.bold, false);
  assert.equal(textStyleToCss(st.title).fontWeight, 400);
});

test('đổi một thành phần không đụng thành phần khác, không sửa bản cũ', () => {
  const a = setTextStyle(undefined, 'instruction', { color: '#c81e1e' });
  const b = setTextStyle(a, 'notes', { bold: true });
  assert.deepEqual(a, { instruction: { color: '#c81e1e' } });
  assert.deepEqual(b, { instruction: { color: '#c81e1e' }, notes: { bold: true } });
});

test('cỡ chữ tăng giảm 0.5pt và bị chặn trong 7–30pt', () => {
  let st = bumpTextSize(undefined, 'title', 14, 0.5);
  assert.equal(st.title?.sizePt, 14.5);
  st = bumpTextSize(st, 'title', 14, -1);
  assert.equal(st.title?.sizePt, 13.5);
  for (let i = 0; i < 60; i++) st = bumpTextSize(st, 'title', 14, -1);
  assert.equal(st.title?.sizePt, 7);
  for (let i = 0; i < 80; i++) st = bumpTextSize(st, 'title', 14, 1);
  assert.equal(st.title?.sizePt, 30);
});

test('CSS: gạch chân + gạch ngang cùng lúc, căn lề kéo theo display block', () => {
  const css = textStyleToCss({ underline: true, strike: true, align: 'center', color: '#16295f', sizePt: 12 });
  assert.equal(css.textDecoration, 'underline line-through');
  assert.equal(css.textAlign, 'center');
  assert.equal(css.display, 'block');
  assert.equal(css.fontSize, '12pt');
  assert.deepEqual(textStyleToCss(undefined), {});
});
