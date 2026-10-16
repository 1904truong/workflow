import test from 'node:test';
import assert from 'node:assert/strict';
import { packExercises, packWithInfo } from '../pagination.ts';

test('hai bài vừa một trang thì dồn chung một trang', () => {
  const p = packExercises([400, 500], { firstAvail: 950, restAvail: 1000 });
  assert.deepEqual(p, [[0, 1]]);
});

test('bài thứ hai không vừa -> sang trang mới', () => {
  const p = packExercises([600, 500], { firstAvail: 950, restAvail: 1000 });
  assert.deepEqual(p, [[0], [1]]);
});

test('trang 1 có header nên chứa ít hơn các trang sau', () => {
  // 3 bài x 400: trang 1 (950) chứa 2, trang 2 (1000) chứa 1
  assert.deepEqual(packExercises([400, 400, 400], { firstAvail: 950, restAvail: 1000 }), [[0, 1], [2]]);
  // 4 bài x 330: trang 1 chứa 2 (thêm bài 3 = 990 > 950), trang 2 chứa 2 (660 ≤ 1000)
  assert.deepEqual(packExercises([330, 330, 330, 330], { firstAvail: 950, restAvail: 1000 }), [[0, 1], [2, 3]]);
  // 3 bài x 320 = 960: vừa trang sau (1000) nhưng không vừa trang 1 (950)
  assert.deepEqual(packExercises([320, 320, 320], { firstAvail: 950, restAvail: 1000 }), [[0, 1], [2]]);
});

test('ngắt trang bắt buộc được tôn trọng dù còn chỗ', () => {
  const p = packExercises([100, 100, 100], { firstAvail: 950, restAvail: 1000, breaks: [false, true, false] });
  assert.deepEqual(p, [[0], [1, 2]]);
});

test('bài cao hơn cả trang vẫn nằm riêng một trang, không mất bài nào', () => {
  const p = packExercises([200, 1500, 200], { firstAvail: 950, restAvail: 1000 });
  assert.deepEqual(p, [[0], [1], [2]]);
  assert.equal(p.flat().length, 3);
});

test('không có bài nào -> vẫn có một trang rỗng', () => {
  assert.deepEqual(packExercises([], { firstAvail: 950, restAvail: 1000 }), [[]]);
});

test('bài đầu tiên bắt buộc ngắt trang không tạo trang trắng', () => {
  assert.deepEqual(packExercises([100, 100], { firstAvail: 950, restAvail: 1000, breaks: [true, false] }), [[0, 1]]);
});

test('dồn bài: hai bài buộc chung trang dù thường sẽ bị tách', () => {
  // 600 + 500 > 950 nên bình thường tách; có joins thì ở chung (và báo tràn)
  const r = packWithInfo([600, 500], { firstAvail: 950, restAvail: 1000, joins: [false, true] });
  assert.deepEqual(r.pages, [[0, 1]]);
  assert.deepEqual(r.overflow, [true]);
});

test('dồn bài vừa trang: không báo tràn', () => {
  const r = packWithInfo([400, 400, 300], { firstAvail: 950, restAvail: 1000, joins: [false, true, false] });
  assert.deepEqual(r.pages, [[0, 1], [2]]);
  assert.deepEqual(r.overflow, [false, false]);
});

test('chuỗi dồn 3 bài và khối không bị tách giữa chừng sang trang mới', () => {
  // bài 0 chiếm 500; khối [1,2] = 300+300 = 600 không vừa chỗ còn lại (450) -> cả khối sang trang 2
  const r = packWithInfo([500, 300, 300], { firstAvail: 950, restAvail: 1000, joins: [false, false, true] });
  assert.deepEqual(r.pages, [[0], [1, 2]]);
  // không dồn thì bài 1 ở lại trang 1 (500+300 <= 950), bài 2 sang trang sau
  assert.deepEqual(packExercises([500, 300, 300], { firstAvail: 950, restAvail: 1000 }), [[0, 1], [2]]);
  // [false,true,true]: cả ba bài buộc chung một khối (700+300+300 = 1300 > 950) -> một trang, báo tràn
  const r2 = packWithInfo([700, 300, 300], { firstAvail: 950, restAvail: 1000, joins: [false, true, true] });
  assert.deepEqual(r2.pages, [[0, 1, 2]]);
  assert.deepEqual(r2.overflow, [true]);
  // [false,false,true]: chỉ bài 1 và 2 chung khối (600), bài 0 (700) đã đầy -> khối sang trang 2, không tràn
  const r3 = packWithInfo([700, 300, 300], { firstAvail: 950, restAvail: 1000, joins: [false, false, true] });
  assert.deepEqual(r3.pages, [[0], [1, 2]]);
  assert.deepEqual(r3.overflow, [false, false]);
});

test('ngắt trang bắt buộc thắng dồn bài', () => {
  const r = packWithInfo([100, 100], { firstAvail: 950, restAvail: 1000, joins: [false, true], breaks: [false, true] });
  assert.deepEqual(r.pages, [[0], [1]]);
});

test('bài đầu tiên có joins=true bị bỏ qua (không có bài trước)', () => {
  assert.deepEqual(packExercises([100, 100], { firstAvail: 950, restAvail: 1000, joins: [true, false] }), [[0, 1]]);
});
