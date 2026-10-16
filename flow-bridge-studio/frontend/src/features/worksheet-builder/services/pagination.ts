// Chia bài tập vào các trang A4 dựa trên CHIỀU CAO THỰC ĐO được (không còn ước lượng theo "điểm").
// Hàm thuần, không import gì để test được.

export interface PackOptions {
  /** Chiều cao còn dùng được ở trang 1 (đã trừ header + footer) */
  firstAvail: number;
  /** Chiều cao còn dùng được ở các trang sau (đã trừ footer, và header nếu in ở mọi trang) */
  restAvail: number;
  /** breaks[i] = true: bài i bắt buộc bắt đầu ở trang mới */
  breaks?: boolean[];
  /** joins[i] = true: bài i phải ở CÙNG TRANG với bài ngay trước nó (ngắt trang bắt buộc thắng) */
  joins?: boolean[];
}

export interface PackResult {
  /** Chỉ số bài theo từng trang */
  pages: number[][];
  /** overflow[p] = true: các bài bị buộc chung trang p cộng lại cao hơn chỗ trống của trang */
  overflow: boolean[];
}

/**
 * Gom các bài liên tiếp có joins=true thành một khối không tách được, rồi xếp lần lượt từng khối vào
 * trang hiện tại nếu còn vừa, không vừa thì sang trang mới. Khối cao hơn cả trang vẫn được đặt riêng
 * một trang (đánh dấu overflow) chứ không bị bỏ sót.
 */
export const packWithInfo = (heights: number[], opts: PackOptions): PackResult => {
  const units: { idx: number[]; h: number; forced: boolean; joined: boolean }[] = [];
  heights.forEach((h, i) => {
    const forced = !!opts.breaks?.[i];
    const join = !!opts.joins?.[i] && i > 0 && !forced;
    if (join && units.length) {
      const u = units[units.length - 1];
      u.idx.push(i);
      u.h += h;
      u.joined = true;
    } else {
      units.push({ idx: [i], h, forced, joined: false });
    }
  });

  const pages: number[][] = [[]];
  const overflow: boolean[] = [false];
  let used = 0;
  units.forEach((u) => {
    const avail = (n: number) => (n === 1 ? opts.firstAvail : opts.restAvail);
    const curN = pages.length;
    if (pages[curN - 1].length > 0 && (u.forced || used + u.h > avail(curN))) {
      pages.push([...u.idx]);
      overflow.push(u.joined && u.h > avail(curN + 1));
      used = u.h;
    } else {
      pages[curN - 1].push(...u.idx);
      if (u.joined && used + u.h > avail(curN)) overflow[curN - 1] = true;
      used += u.h;
    }
  });
  return { pages, overflow };
};

/** Giữ lại tên cũ: chỉ lấy phần danh sách trang */
export const packExercises = (heights: number[], opts: PackOptions): number[][] => packWithInfo(heights, opts).pages;
