// Dữ liệu mẫu cho bản demo. Toàn bộ tên khách là tên giả.
// Dữ liệu được sinh theo "hôm nay" để luôn có khách đến / khách đi / khách đang ở.
import { addDays, stayNights, VAT_RATE } from "./format";
import type {
  ActivityLog, Branch, Folio, FolioTransaction, Guest, ISODate, PmsState, Reservation, Room, RoomType, ShiftReport, ShiftTask,
} from "./types";

export const STATE_VERSION = 3;

function prng(seed: number) {
  let a = seed;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const BRANCHES: Branch[] = [
  { id: "br-avanti", code: "AVANTI", name: "Avanti Hotel", address: "Quận 1, TP.HCM", stars: 4 },
  { id: "br-boutique", code: "BOUTIQUE", name: "Avanti Boutique", address: "Quận 3, TP.HCM", stars: 3 },
];

const AVANTI_TYPES: Array<[string, string, number, number]> = [
  ["SUPDN", "Superior Double", 760000, 2], ["SUPTN", "Superior Twin", 800000, 2],
  ["DLXTC", "Deluxe Twin City", 1080000, 2], ["DLXDDC", "Deluxe Double City", 1080000, 2],
  ["PREDM", "Premier Double", 1500000, 2], ["PREPM", "Premier Triple", 1500000, 3],
  ["PRETM", "Premier Twin", 1400000, 2], ["PREKM", "Premier King", 1600000, 2],
  ["AVTFM", "Avanti Family", 1900000, 4], ["AVTDM", "Avanti Terrace", 2200000, 2],
];
// Bố trí 105 phòng / 9 tầng của Avanti Hotel (giữ theo sơ đồ cũ)
const AVANTI_LAYOUT: Record<number, string[]> = {
  1: ["PRETM", "PREPM", "AVTFM", "SUPTN", "SUPDN", "SUPDN", "SUPDN", "SUPDN", "SUPTN"],
  2: ["PREDM", "PREPM", "AVTFM", "SUPTN", "SUPDN", "SUPDN", "SUPDN", "SUPDN", "SUPTN", "SUPTN", "SUPDN", "SUPDN"],
  3: ["PREDM", "PREPM", "AVTFM", "SUPDN", "SUPDN", "DLXTC", "DLXDDC", "PRETM", "PREKM", "SUPTN", "SUPDN", "SUPDN"],
  4: ["PREDM", "PREPM", "AVTFM", "SUPTN", "SUPDN", "DLXTC", "DLXDDC", "PRETM", "PREKM", "PREDM", "AVTDM", "AVTFM"],
  5: ["PRETM", "PREPM", "AVTFM", "SUPTN", "SUPDN", "DLXTC", "DLXDDC", "PRETM", "PREKM", "PREDM", "AVTDM", "SUPDN"],
  6: ["PREDM", "PREPM", "AVTFM", "SUPTN", "SUPDN", "DLXTC", "DLXDDC", "PRETM", "PREKM", "SUPDN", "SUPDN", "SUPTN"],
  7: ["PRETM", "AVTDM", "AVTDM", "DLXTC", "DLXDDC", "DLXDDC", "DLXDDC", "DLXTC", "DLXTC", "DLXTC", "DLXDDC", "SUPDN"],
  8: ["PRETM", "PREDM", "PREKM", "DLXDDC", "DLXDDC", "DLXDDC", "DLXDDC", "DLXDDC", "DLXTC", "DLXTC", "DLXDDC", "SUPDN"],
  9: ["PRETM", "PREDM", "PREKM", "DLXTC", "DLXDDC", "DLXDDC", "DLXDDC", "DLXDDC", "DLXTC", "DLXTC", "DLXDDC", "SUPDN"],
};
const BOUTIQUE_TYPES: Array<[string, string, number, number]> = [
  ["STD", "Standard Double", 650000, 2], ["STT", "Standard Twin", 650000, 2], ["DLX", "Deluxe Balcony", 900000, 2], ["STE", "Junior Suite", 1400000, 3],
];
const BOUTIQUE_LAYOUT: Record<number, string[]> = {
  1: ["STD", "STD", "STT", "STT", "STD", "STD", "STT", "STD", "STD", "STT", "STD", "STD", "STT", "STD"],
  2: ["STD", "STT", "DLX", "DLX", "STD", "STT", "DLX", "DLX", "STD", "STT", "DLX", "DLX", "STD", "STE"],
  3: ["DLX", "DLX", "DLX", "DLX", "STT", "STD", "DLX", "DLX", "DLX", "STD", "STT", "DLX", "STE", "STE"],
};

const VN_SURNAMES = ["NGUYỄN", "TRẦN", "LÊ", "PHẠM", "HOÀNG", "VÕ", "ĐẶNG", "BÙI", "ĐỖ", "HỒ", "NGÔ", "DƯƠNG", "LÝ", "PHAN", "HUỲNH", "MAI", "TRỊNH", "CAO"];
const VN_MIDDLE = ["VĂN", "THỊ", "MINH", "THANH", "NGỌC", "QUỐC", "GIA", "HOÀNG", "THU", "ĐỨC", "BẢO", "ANH"];
const VN_GIVEN = ["KHÔI", "HÀ", "NAM", "LAN", "BẢO", "ÁNH", "TÙNG", "LINH", "THẮNG", "TÂM", "MINH", "NGỌC", "HẬU", "HỒNG", "PHÁT", "THƯ", "TRÍ", "YẾN", "VINH", "KIỀU", "QUÂN", "VY", "SƠN", "TRANG", "PHÚC", "HIỀN", "DŨNG", "NHI"];
const FOREIGN_NAMES: Array<[string[], string[], string]> = [
  [["TANAKA", "SATO", "SUZUKI", "WATANABE", "ITO"], ["HIROSHI", "YUKI", "KENJI", "AYAKA", "HARUTO"], "JP"],
  [["KIM", "PARK", "LEE", "CHOI", "JUNG"], ["MINJI", "JIHOON", "SEOYEON", "DOYUN", "HANA"], "KR"],
  [["SMITH", "JOHNSON", "BROWN", "MILLER", "DAVIS"], ["JOHN", "EMMA", "OLIVER", "SOPHIA", "LIAM"], "US"],
  [["MÜLLER", "SCHMIDT", "WEBER"], ["ANNA", "LUKAS", "MIA"], "DE"],
  [["DUPONT", "MARTIN", "BERNARD"], ["CLAIRE", "LUCAS", "CHLOÉ"], "FR"],
  [["WONG", "TAN", "LIM"], ["MEI LIN", "WEI JIE", "XIN YI"], "SG"],
  [["WILSON", "TAYLOR", "NGUYEN"], ["LISA", "JACK", "CHLOE"], "AU"],
];
const COMPANIES = ["", "", "", "CTY TNHH SAO MAI", "DU LỊCH BIỂN XANH", "AGODA", "BOOKING.COM", "TRAVELOKA", ""];
const SOURCES = ["Direct", "Walk-in", "Booking.com", "Agoda", "Traveloka", "Travel Agent", "Expedia"] as const;

export function createSeedState(today: ISODate): PmsState {
  const now = new Date().toISOString();
  const rand = prng(20260509);
  const pick = <T,>(arr: readonly T[]) => arr[Math.floor(rand() * arr.length)];
  const int = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));

  const roomTypes: RoomType[] = [];
  const rooms: Room[] = [];
  const build = (branch: Branch, types: Array<[string, string, number, number]>, layout: Record<number, string[]>) => {
    types.forEach(([code, name, baseRate, maxPax]) => roomTypes.push({ id: `rt-${branch.code}-${code}`.toLowerCase(), branchId: branch.id, code, name, baseRate, maxPax }));
    Object.entries(layout).forEach(([floor, codes]) => codes.forEach((code, i) => {
      const number = `${floor}${String(i + 1).padStart(2, "0")}`;
      rooms.push({ id: `rm-${branch.code}-${number}`.toLowerCase(), branchId: branch.id, roomTypeId: `rt-${branch.code}-${code}`.toLowerCase(), number, floor: Number(floor), hkStatus: "clean" });
    }));
  };
  build(BRANCHES[0], AVANTI_TYPES, AVANTI_LAYOUT);
  build(BRANCHES[1], BOUTIQUE_TYPES, BOUTIQUE_LAYOUT);
  const typeOf = (roomTypeId: string) => roomTypes.find(t => t.id === roomTypeId)!;

  const guests: Guest[] = [];
  const reservations: Reservation[] = [];
  const folios: Folio[] = [];
  const transactions: FolioTransaction[] = [];
  let conf = 1090000, folioNo = 250000, gid = 0, rid = 0, tid = 0;

  const usedNames = new Set<string>();
  const makeName = (foreign: boolean): [string, string] => {
    for (let i = 0; i < 50; i++) {
      let name: string, nat = "VN";
      if (foreign) { const [last, first, n] = pick(FOREIGN_NAMES); name = `${pick(last)} ${pick(first)}`; nat = n; }
      else name = `${pick(VN_SURNAMES)} ${pick(VN_MIDDLE)} ${pick(VN_GIVEN)}`;
      if (!usedNames.has(name)) { usedNames.add(name); return [name, nat]; }
    }
    return foreign ? makeName(false) : [`KHÁCH ${usedNames.size + 1}`, "VN"];
  };
  const newGuest = (branchId: string): Guest => {
    const foreign = rand() < 0.3;
    const [fullName, nationality] = makeName(foreign);
    const g: Guest = {
      id: `g-${++gid}`, branchId, guestType: foreign ? "foreign" : "vietnamese", fullName, nationality,
      idType: foreign ? "passport" : "cccd", idNumber: foreign ? `P${int(1000000, 9999999)}` : `0792${int(10000000, 99999999)}`,
      idIssuedDate: null, idIssuedPlace: foreign ? "" : "Cục CS QLHC về TTXH", idExpiryDate: null, dob: null, gender: null,
      phone: foreign ? "" : `09${int(10000000, 99999999)}`, email: "", address: "", company: pick(COMPANIES),
      visaType: foreign ? "E-visa (30 ngày)" : "", visaNumber: "", visaExpiry: null, entryDate: foreign ? addDays(today, -int(1, 5)) : null, portOfEntry: foreign ? "Tân Sơn Nhất (SGN)" : "",
      createdAt: now,
    };
    guests.push(g);
    return g;
  };

  // Mốc thời gian 07:30 giờ Việt Nam của một ngày (để giao dịch mẫu nằm đúng ngày phát sinh)
  const at = (d: ISODate) => `${d}T00:30:00.000Z`;
  const post = (folio: Folio, t: Omit<FolioTransaction, "id" | "folioId" | "postedAt" | "voided" | "voidedAt" | "postedBy">, postedOn: ISODate = t.businessDate) =>
    transactions.push({ ...t, id: `t-${++tid}`, folioId: folio.id, postedAt: postedOn > today ? now : at(postedOn), voided: false, voidedAt: null, postedBy: "HỆ THỐNG" });

  const addReservation = (branchId: string, room: Room | null, roomTypeId: string, arrival: ISODate, departure: ISODate, status: Reservation["status"]) => {
    const g = newGuest(branchId);
    const rt = typeOf(roomTypeId);
    const r: Reservation = {
      id: `r-${++rid}`, branchId, confirmationNo: String(++conf), guestId: g.id, roomTypeId, roomId: room?.id ?? null,
      arrivalDate: arrival, departureDate: departure, adults: Math.min(rt.maxPax, int(1, 2)), children: 0, rate: rt.baseRate,
      mealPlan: pick(["RO", "BB", "BB", "HB"] as const), source: pick(SOURCES), status, note: "",
      checkedInAt: status === "checked_in" || status === "checked_out" ? at(arrival) : null, checkedOutAt: status === "checked_out" ? at(departure) : null,
      createdBy: "HỆ THỐNG", createdAt: now,
    };
    reservations.push(r);
    const f: Folio = { id: `f-${r.id}`, branchId, reservationId: r.id, folioNo: String(++folioNo), status: status === "checked_out" ? "closed" : "open", openedAt: now, closedAt: status === "checked_out" ? now : null };
    folios.push(f);
    if (status === "checked_in" || status === "checked_out") {
      stayNights(arrival, departure).forEach(night => {
        post(f, { businessDate: night, code: "ROOM", kind: "debit", description: `Tiền phòng ${rt.code} đêm ${night.slice(8)}/${night.slice(5, 7)}`, amount: r.rate, paymentMethod: null, ref: rt.code }, arrival);
        post(f, { businessDate: night, code: "TAX", kind: "debit", description: "VAT 8%", amount: Math.round(r.rate * VAT_RATE), paymentMethod: null, ref: "AUTO" }, arrival);
      });
      if (rand() < 0.3) post(f, { businessDate: addDays(arrival, 1) < today ? addDays(arrival, 1) : arrival, code: "MINIBAR", kind: "debit", description: "Minibar", amount: int(2, 9) * 25000, paymentMethod: null, ref: "MB" });
    }
    if (status === "checked_out") {
      const due = transactions.filter(t => t.folioId === f.id).reduce((s, t) => s + (t.kind === "debit" ? t.amount : -t.amount), 0);
      post(f, { businessDate: departure, code: "PAYMENT", kind: "credit", description: "Thanh toán khi trả phòng", amount: due, paymentMethod: pick(["cash_vnd", "card", "bank_transfer"] as const), ref: "CO" });
    } else if (status === "checked_in" && rand() < 0.6) {
      post(f, { businessDate: arrival, code: "DEPOSIT", kind: "credit", description: "Đặt cọc khi nhận phòng", amount: r.rate, paymentMethod: pick(["cash_vnd", "card", "bank_transfer"] as const), ref: "CI" });
    } else if (status === "confirmed" && rand() < 0.3) {
      post(f, { businessDate: addDays(today, -int(1, 7)), code: "DEPOSIT", kind: "credit", description: "Đặt cọc giữ phòng", amount: r.rate, paymentMethod: "bank_transfer", ref: "BK" });
    }
    return r;
  };

  for (const branch of BRANCHES) {
    const branchRooms = rooms.filter(r => r.branchId === branch.id);
    branchRooms.forEach(room => {
      const roll = rand();
      let cursor: ISODate = today;
      if (roll < 0.42) {
        // Khách đang ở (một phần sẽ trả phòng hôm nay)
        const arrival = addDays(today, -int(0, 3));
        const departure = addDays(today, rand() < 0.22 ? 0 : int(1, 4));
        addReservation(branch.id, room, room.roomTypeId, arrival, departure > arrival ? departure : addDays(arrival, 1), "checked_in");
        cursor = departure > today ? departure : today;
        if (departure <= today) cursor = addDays(today, 1);
      } else if (roll < 0.5) {
        // Khách đã trả phòng sáng nay -> phòng chờ dọn
        addReservation(branch.id, room, room.roomTypeId, addDays(today, -int(1, 3)), today, "checked_out");
        room.hkStatus = "dirty";
      } else if (roll < 0.6) {
        // Khách sẽ đến hôm nay
        addReservation(branch.id, room, room.roomTypeId, today, addDays(today, int(1, 3)), "confirmed");
        cursor = addDays(today, 4);
        if (rand() < 0.3) room.hkStatus = "dirty";
      } else {
        room.hkStatus = rand() < 0.2 ? "dirty" : "clean";
      }
      // Đặt phòng tương lai trên cùng phòng (không chồng ngày)
      let next = addDays(cursor, int(1, 4));
      for (let k = 0; k < 2 && next < addDays(today, 28); k++) {
        const nights = int(1, 4);
        addReservation(branch.id, room, room.roomTypeId, next, addDays(next, nights), rand() < 0.75 ? "confirmed" : "tentative");
        next = addDays(next, nights + int(1, 6));
      }
    });
    // Phòng hỏng
    const vacant = branchRooms.filter(r => !reservations.some(res => res.roomId === r.id && res.status === "checked_in"));
    vacant.slice(-1).forEach(r => { r.hkStatus = "out_of_order"; });
    // Đặt phòng chưa gán phòng (waiting list)
    const types = roomTypes.filter(t => t.branchId === branch.id);
    for (let k = 0; k < 3; k++) addReservation(branch.id, null, types[k % types.length].id, addDays(today, k === 0 ? 0 : k), addDays(today, k + 2), "confirmed");
  }
  // Phòng hỏng không được dính đặt phòng tương lai
  rooms.filter(r => r.hkStatus === "out_of_order").forEach(room =>
    reservations.filter(r => r.roomId === room.id && (r.status === "confirmed" || r.status === "tentative")).forEach(r => { r.roomId = null; }));

  const shiftReports: ShiftReport[] = [
    { id: "sr-1", branchId: BRANCHES[0].id, businessDate: addDays(today, -1), shift: "afternoon", reporterName: "NGUYỄN THỊ HOA", handoverToName: "TRẦN VĂN MINH", cashBalance: 12500000, generalNote: "Ca chiều suôn sẻ, đoàn khách Nhật đã trả phòng.", incidentNote: "", status: "confirmed", confirmedByName: "TRẦN VĂN MINH", confirmedAt: now, createdAt: now },
    { id: "sr-2", branchId: BRANCHES[0].id, businessDate: addDays(today, -1), shift: "night", reporterName: "TRẦN VĂN MINH", handoverToName: "LÊ HOÀNG ANH", cashBalance: 8200000, generalNote: "Ca tối yên tĩnh.", incidentNote: "Khách phòng 511 phàn nàn tiếng ồn — đã đổi phòng.", status: "submitted", confirmedByName: null, confirmedAt: null, createdAt: now },
  ];
  const shiftTasks: ShiftTask[] = [
    { id: "st-1", shiftReportId: "sr-1", content: "Phòng 305 vòi sen yếu — đã báo kỹ thuật", priority: "urgent", done: false },
    { id: "st-2", shiftReportId: "sr-1", content: "Khách phòng 208 gửi hành lý, lấy lúc 18:00", priority: "normal", done: true },
    { id: "st-3", shiftReportId: "sr-2", content: "Bổ sung minibar phòng 412", priority: "info", done: false },
  ];
  const activities: ActivityLog[] = BRANCHES.map((b, i) => ({
    id: `a-${i}`, branchId: b.id, actorName: "HỆ THỐNG", action: "seed", message: `Khởi tạo dữ liệu mẫu cho ${b.name}`, entityType: "room", entityId: "-", createdAt: now,
  }));

  return {
    version: STATE_VERSION, seededFor: today, seq: { confirmation: conf, folio: folioNo },
    branches: BRANCHES, roomTypes, rooms, guests, reservations, folios, transactions, hkLogs: [], shiftReports, shiftTasks, activities,
  };
}
