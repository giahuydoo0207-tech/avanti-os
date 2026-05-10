"use client";

import React, { useMemo, useState, useRef, useCallback, useEffect } from "react";
import {
  ArrowDownCircle, ArrowUpCircle, BedDouble, CalendarDays, ClipboardList,
  Home, LayoutGrid, LogOut, User, Search, DollarSign, ChevronLeft,
  Download, RefreshCw, ChevronRight, Settings, Bell, X, MapIcon,
} from "lucide-react";

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────
type TabName = "Tổng quan"|"Sơ đồ phòng"|"Room Plan"|"Đặt phòng"|"Khách hàng"|"Báo cáo"|"Thu ngân"|"Room Availability";
type RoomStatus = "clean"|"occupied"|"dirty";
type MapViewMode = "hotelmap"|"block";
type BookingStatus = "definite"|"tentative"|"group"|"checkedIn"|"waitlist";

type Guest = { name:string; folio:string; arrival:string; departure:string; rate:number; balance:number; pax:number; plan:string };
type HotelRoom = { id:number; status:RoomStatus; roomType:string; pax:number; guest?:Guest };
type Floor = { name:string; rooms:HotelRoom[] };
type WaitingCustomer = { id:number; folio:string; name:string; roomType:string; checkIn:string; checkOut:string };

type Booking = {
  id: string;
  guestName: string;
  folio: string;
  roomId: number;
  startDay: number;   // offset from view start date (0-based)
  nights: number;
  status: BookingStatus;
  pax: number;
  note?: string;
};

type PlanRoom = { id:number; type:string; floor:number };

// ─────────────────────────────────────────────
// STATUS CONFIGS
// ─────────────────────────────────────────────
const ROOM_STATUS: Record<RoomStatus,{label:string;labelVi:string;cell:string;text:string;mapBg:string;mapBorder:string;mapText:string;mapSubText:string;mapPaxColor:string;dotColor:string}> = {
  clean:    { label:"CLEAN",    labelVi:"Đã dọn",  cell:"bg-[#2d6a4f] border-[#1b4332]", text:"text-white",        mapBg:"#f0fdf4", mapBorder:"#86efac", mapText:"#14532d", mapSubText:"#15803d", mapPaxColor:"#166534", dotColor:"#22c55e" },
  occupied: { label:"OCCUPIED", labelVi:"Đang ở",  cell:"bg-[#d4a017] border-[#a37c00]", text:"text-white",        mapBg:"#fffbeb", mapBorder:"#fcd34d", mapText:"#78350f", mapSubText:"#92400e", mapPaxColor:"#92400e", dotColor:"#f59e0b" },
  dirty:    { label:"DIRTY",    labelVi:"Chờ dọn", cell:"bg-[#c1121f] border-[#8b0000]", text:"text-white",        mapBg:"#fff1f2", mapBorder:"#fca5a5", mapText:"#7f1d1d", mapSubText:"#991b1b", mapPaxColor:"#991b1b", dotColor:"#ef4444" },
};

const BOOKING_COLOR: Record<BookingStatus,{bg:string;border:string;text:string;label:string}> = {
  definite:  { bg:"#3b82f6", border:"#1d4ed8", text:"#fff", label:"Definite"  },
  tentative: { bg:"#f97316", border:"#c2410c", text:"#fff", label:"Tentative" },
  group:     { bg:"#22c55e", border:"#15803d", text:"#fff", label:"Group"     },
  checkedIn: { bg:"#8b5cf6", border:"#6d28d9", text:"#fff", label:"Checked In"},
  waitlist:  { bg:"#94a3b8", border:"#64748b", text:"#fff", label:"Waitlist"  },
};

// ─────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────
const COL_W = 48;   // px per day column
const ROW_H = 32;   // px per room row
const LABEL_W = 120; // px for room label column

const ALL_ROOM_TYPES = ["ALL","PRETM","PREPM","AVTFM","SUPTN","SUPDN","DLXTC","DLXDDC","PREKM","PREMDM","AVTDM"];

const MENU_ITEMS: Array<{name:TabName;icon:React.ElementType}> = [
  {name:"Tổng quan",       icon:Home},
  {name:"Sơ đồ phòng",     icon:LayoutGrid},
  {name:"Room Plan",       icon:CalendarDays},
  {name:"Đặt phòng",       icon:BedDouble},
  {name:"Khách hàng",      icon:User},
  {name:"Báo cáo",         icon:ClipboardList},
  {name:"Thu ngân",        icon:DollarSign},
  {name:"Room Availability",icon:CalendarDays},
];

const WAITING_CUSTOMERS: WaitingCustomer[] = [
  {id:1,folio:"10254",name:"NGUYỄN HUY",    roomType:"VIP",    checkIn:"01/05/2026",checkOut:"05/05/2026"},
  {id:2,folio:"10255",name:"TRẦN THỊ QUYÊN",roomType:"DELUXE", checkIn:"02/05/2026",checkOut:"04/05/2026"},
];

const TODAY_STATS = { checkInToday:15, checkOutToday:8, totalRooms:105, available:45, occupied:30, dirty:10 };

const HOTEL_ROOM_TYPES = ["PIRETM","PREPM","AVITFM","SUPTN","SUPDN","DLXTC","DLXDDC","PRETM","PREKM","PREMDM","AVTDM","AVTFM"];

const CASHIER_FUNCTIONS = [
  "Post Transaction","Cancel Check Out","Group Check Out","Exchange",
  "List Bills Printed","View Transaction","Money Card","Cancel/Noshow Charge",
  "A Currency Conversion","C Group Transactions","D Reports","F Post To Guest Dummy","X Back",
];

const ROOM_TYPES_AVAILABILITY = [
  {description:"Avanti Terrace",    type:"AVTDM", total:2,  available:[1,1,2,0,1,1,2,2,2,1],       definite:[1,1,0,2,1,1,0,0,0,1]},
  {description:"Avanti Family Mark",type:"AVTFM", total:5,  available:[3,4,4,4,3,3,4,4,5,3],       definite:[2,1,1,1,2,2,1,1,0,2]},
  {description:"Premier King Mark", type:"PREKM", total:2,  available:[2,1,0,0,0,0,0,1,1,1],       definite:[0,1,2,2,2,2,2,1,1,1]},
  {description:"Premier Double M",  type:"PREDM", total:6,  available:[0,3,1,0,0,0,1,1,1,4],       definite:[6,3,5,6,6,6,5,5,5,2]},
  {description:"Premier Tripple M", type:"PREPM", total:5,  available:[2,0,2,2,2,2,1,1,2,3],       definite:[3,5,3,3,3,3,4,4,3,2]},
  {description:"Premier Twin Mark", type:"PRETM", total:4,  available:[0,3,3,3,2,0,2,3,4,4],       definite:[4,1,1,1,2,4,2,1,0,0]},
  {description:"Deluxe Twin City",  type:"DLXTC", total:12, available:[1,1,1,1,1,0,0,0,8,2],       definite:[11,11,11,11,11,12,12,12,4,10]},
  {description:"Deluxe Double City",type:"DLXDDC",total:32, available:[0,0,3,12,12,12,13,18,21,15], definite:[32,32,29,20,20,20,19,14,11,17]},
  {description:"Superior Double N", type:"SUPDN", total:20, available:[6,5,11,3,0,3,0,8,13,11],    definite:[14,15,9,17,21,17,21,12,7,9]},
  {description:"Superior Twin No",  type:"SUPTN", total:5,  available:[3,1,0,3,1,5,1,0,0,0],       definite:[2,4,5,2,4,0,4,5,5,6]},
  {description:"ALLOTMENT",         type:"ALM",   total:0,  available:[0,0,0,0,1,1,1,1,0,0],       definite:[0,0,0,0,0,0,0,0,0,0]},
];

const NOTES_STATIC = {
  ooi:Array(10).fill(0), phu:Array(10).fill(0), availableRms:Array(10).fill(93),
  ooo:[3,2,1,2,1,1,1,1,1,1], saleableRms:[90,91,92,91,92,92,92,92,92,92],
  fitArrival:[36,25,17,32,19,7,10,10,2,15], gitArrival:[2,4,14,0,4,0,5,8,9,0],
};

const SAMPLE_GUESTS: Guest[] = [
  {name:"XUAN THANH",    folio:"247417",arrival:"01/05/2026",departure:"02/05/2026",rate:985000, balance:0,     pax:2,plan:"POA ALL/NO BF."},
  {name:"NGUYEN HUY",    folio:"247418",arrival:"01/05/2026",departure:"05/05/2026",rate:1200000,balance:500000,pax:1,plan:"BB"},
  {name:"TRAN THI QUYEN",folio:"247419",arrival:"02/05/2026",departure:"04/05/2026",rate:850000, balance:0,     pax:2,plan:"RO"},
  {name:"LE VAN ANH",    folio:"247420",arrival:"01/05/2026",departure:"03/05/2026",rate:1500000,balance:0,     pax:3,plan:"HB"},
  {name:"PHAM MINH TU",  folio:"247421",arrival:"01/05/2026",departure:"06/05/2026",rate:750000, balance:200000,pax:1,plan:"BB"},
  {name:"HOANG THI LAN", folio:"247422",arrival:"02/05/2026",departure:"03/05/2026",rate:900000, balance:0,     pax:2,plan:"RO"},
  {name:"VU QUOC HUNG",  folio:"247423",arrival:"01/05/2026",departure:"07/05/2026",rate:1100000,balance:0,     pax:2,plan:"BB"},
  {name:"DO THI HIEN",   folio:"247424",arrival:"03/05/2026",departure:"05/05/2026",rate:680000, balance:0,     pax:1,plan:"RO"},
];

// ─────────────────────────────────────────────
// ROOM PLAN MOCK DATA
// ─────────────────────────────────────────────
const PLAN_ROOMS: PlanRoom[] = [
  {id:101,type:"PRETM", floor:1},{id:102,type:"PREPM", floor:1},{id:103,type:"AVTFM", floor:1},
  {id:104,type:"SUPTN", floor:1},{id:105,type:"SUPDN", floor:1},{id:106,type:"SUPDN", floor:1},
  {id:107,type:"SUPDN", floor:1},{id:108,type:"SUPDN", floor:1},{id:109,type:"SUPTN", floor:1},
  {id:201,type:"PREDM", floor:2},{id:202,type:"PREPM", floor:2},{id:203,type:"AVTFM", floor:2},
  {id:204,type:"SUPTN", floor:2},{id:205,type:"SUPDN", floor:2},{id:206,type:"SUPDN", floor:2},
  {id:207,type:"SUPDN", floor:2},{id:208,type:"SUPDN", floor:2},{id:209,type:"SUPTN", floor:2},
  {id:210,type:"SUPTN", floor:2},{id:211,type:"SUPDN", floor:2},{id:212,type:"SUPDN", floor:2},
  {id:301,type:"PREDM", floor:3},{id:302,type:"PREPM", floor:3},{id:303,type:"AVTFM", floor:3},
  {id:304,type:"SUPDN", floor:3},{id:305,type:"SUPDN", floor:3},{id:306,type:"DLXTC", floor:3},
  {id:307,type:"DLXDDC",floor:3},{id:308,type:"PRETM", floor:3},{id:309,type:"PREKM", floor:3},
  {id:401,type:"PREDM", floor:4},{id:402,type:"PREPM", floor:4},{id:403,type:"AVTFM", floor:4},
  {id:404,type:"SUPTN", floor:4},{id:405,type:"SUPDN", floor:4},{id:406,type:"DLXTC", floor:4},
  {id:407,type:"DLXDDC",floor:4},{id:408,type:"PRETM", floor:4},{id:409,type:"PREKM", floor:4},
  {id:410,type:"PREMDM",floor:4},{id:411,type:"AVTDM", floor:4},{id:412,type:"AVTFM", floor:4},
];

function makeSeedBookings(): Booking[] {
  const statuses: BookingStatus[] = ["definite","tentative","group","checkedIn","waitlist"];
  const names = ["Soprapol,","Phattranan N.","Maximillian ANG,","YOKOTA/K,","Tetsuya Tokuoka,",
    "CO MYLAM","Bui Thi Minh","FT-050126-HCM,","XUAN THANH","CHE LAL","HAN DUL",
    "Dilhani Rupika","Che Yee Khoo,","Brenda,","Ms. Iqbal Riyadi,","Samantha Quek,",
    "VU DINH DUC,","Fadhl Muhammad","MR.TAN/CH","HCM_ONG0526,","HANG VO,","Mindy Nguyen,"];
  const bookings: Booking[] = [];
  let bid = 1;
  PLAN_ROOMS.forEach((room, ri) => {
    // 0-3 bookings per room spread across 30 days
    const count = (ri * 3 + 7) % 3 + 1;
    let cursor = (ri * 5) % 8;
    for (let b = 0; b < count; b++) {
      const nights = ((ri + b) * 4 + 2) % 8 + 1;
      if (cursor + nights > 30) break;
      bookings.push({
        id: `B${bid++}`,
        guestName: names[(ri + b * 3) % names.length],
        folio: `${240000 + bid}`,
        roomId: room.id,
        startDay: cursor,
        nights,
        status: statuses[(ri + b) % statuses.length],
        pax: (b % 3) + 1,
      });
      cursor += nights + ((ri + b) % 3);
    }
  });
  return bookings;
}

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
function buildDates(start: Date, count: number): Date[] {
  return Array.from({length:count},(_,i)=>{const d=new Date(start);d.setDate(d.getDate()+i);return d;});
}
function isWeekend(d:Date){return d.getDay()===0||d.getDay()===6;}
function availBg(val:number){
  if(val<0)return "bg-[#fde8e8] text-[#c1121f]";
  if(val===0)return "bg-[#fff8e1] text-[#7a5800]";
  return "text-[#1a1a1a]";
}
function getRoomStatus(id:number):RoomStatus{const s=(id*7+13)%10;if(s<4)return "occupied";if(s<7)return "clean";return "dirty";}
function buildFloors(){
  return Array.from({length:9},(_,fi)=>{
    const fn=fi+1,count=fn===1?9:12;
    return {name:`Tầng ${fn}`,rooms:Array.from({length:count},(_,ri)=>{
      const id=fn*100+ri+1,status=getRoomStatus(id),pax=status==="occupied"?((id*3+1)%3)+1:0;
      return {id,status,roomType:HOTEL_ROOM_TYPES[ri%HOTEL_ROOM_TYPES.length],pax,
        guest:status==="occupied"?{...SAMPLE_GUESTS[id%SAMPLE_GUESTS.length],pax}:undefined};
    })};
  });
}

// ─────────────────────────────────────────────
// HOTEL MAP MICRO-COMPONENTS
// ─────────────────────────────────────────────
function StatusDot({status}:{status:RoomStatus}){
  return <span className="inline-block rounded-full shrink-0"
    style={{width:8,height:8,backgroundColor:ROOM_STATUS[status].dotColor,boxShadow:"0 0 0 1.5px rgba(0,0,0,0.12)"}}/>;
}
function WalkIcon({color}:{color:string}){
  return <svg width={10} height={10} viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="4" r="2.5" fill={color}/>
    <path d="M12 7 L10 14 L8 20" stroke={color} strokeWidth="2.2" strokeLinecap="round"/>
    <path d="M12 7 L14 14 L16 20" stroke={color} strokeWidth="2.2" strokeLinecap="round"/>
    <path d="M10 10 L7 13" stroke={color} strokeWidth="2.2" strokeLinecap="round"/>
    <path d="M14 10 L17 13" stroke={color} strokeWidth="2.2" strokeLinecap="round"/>
  </svg>;
}
function GuestTooltip({guest,roomType}:{guest:Guest;roomType:string}){
  return <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 pointer-events-none" style={{minWidth:270}}>
    <div className="text-[11px] text-[#1a1a1a] p-3 rounded-[2px] shadow-2xl" style={{background:"#fffef0",border:"1px solid #d4c87a"}}>
      <div className="space-y-0.5 pb-2 mb-2" style={{borderBottom:"1px solid #e8dfa0"}}>
        <div className="flex flex-wrap gap-x-3">
          <span><span className="text-[#9ca3af]">Folio: </span><span className="mono font-semibold">{guest.folio}</span></span>
          <span><span className="text-[#9ca3af]">RmType: </span><span className="mono font-semibold">{roomType}</span></span>
        </div>
        <div className="flex flex-wrap gap-x-3">
          <span><span className="text-[#9ca3af]">Rate: </span><span className="mono font-semibold">{guest.rate.toLocaleString()}NETT</span></span>
          <span><span className="text-[#9ca3af]">Balance: </span><span className={`mono font-semibold ${guest.balance>0?"text-[#c1121f]":""}`}>{guest.balance}</span></span>
        </div>
        <div className="flex flex-wrap gap-x-3 text-[#9ca3af]">
          <span>Arrival: <span className="mono text-[#374151]">{guest.arrival}</span></span>
          <span>Departure: <span className="mono text-[#374151]">{guest.departure}</span></span>
        </div>
      </div>
      <div className="font-semibold text-[12px]">+ {guest.name}</div>
      <div className="text-[#9ca3af] mt-1" style={{borderTop:"1px dashed #d4c87a",paddingTop:4}}>{guest.plan}</div>
    </div>
    <div className="absolute left-1/2 -translate-x-1/2 -bottom-1.5 w-3 h-3 rotate-45"
      style={{background:"#fffef0",borderRight:"1px solid #d4c87a",borderBottom:"1px solid #d4c87a"}}/>
  </div>;
}
function HotelCell({room,selected,onClick}:{room:HotelRoom;selected:boolean;onClick:()=>void}){
  const [hover,setHover]=useState(false);
  const cfg=ROOM_STATUS[room.status];
  return <div className="relative" onMouseEnter={()=>setHover(true)} onMouseLeave={()=>setHover(false)}>
    <div onClick={onClick} className={`cursor-pointer select-none transition-shadow ${selected?"ring-2 ring-[#0f0f0e] ring-offset-1 z-20 relative":"hover:shadow-md hover:z-10 relative"}`}
      style={{width:96,minHeight:68,background:cfg.mapBg,border:`1.5px solid ${hover||selected?"#374151":cfg.mapBorder}`,borderRadius:2}}>
      <div className="flex items-center justify-between px-1.5 pt-1.5 pb-0.5">
        <StatusDot status={room.status}/>
        {room.pax>0&&<div className="flex items-center gap-0.5">
          {Array.from({length:Math.min(room.pax,3)}).map((_,i)=><WalkIcon key={i} color={cfg.mapPaxColor}/>)}
          <span className="mono text-[10px] font-semibold ml-0.5" style={{color:cfg.mapPaxColor}}>{room.pax}</span>
        </div>}
      </div>
      <div className="px-1.5 pb-1.5">
        <div className="mono font-semibold text-[13px] leading-tight" style={{color:cfg.mapText}}>{room.id}</div>
        <div className="text-[9px] font-medium tracking-wide uppercase leading-tight" style={{color:cfg.mapSubText}}>{room.roomType}</div>
      </div>
    </div>
    {hover&&room.guest&&<GuestTooltip guest={room.guest} roomType={room.roomType}/>}
  </div>;
}
function BlockCell({room,selected,onClick}:{room:HotelRoom;selected:boolean;onClick:()=>void}){
  const [hover,setHover]=useState(false);
  const cfg=ROOM_STATUS[room.status];
  return <div className="relative" onMouseEnter={()=>setHover(true)} onMouseLeave={()=>setHover(false)}>
    <div onClick={onClick} className={`cursor-pointer border rounded-[2px] flex flex-col items-center justify-center transition-transform text-white hover:scale-[1.07] hover:shadow-md hover:z-10 relative ${cfg.cell} ${selected?"ring-2 ring-[#0f0f0e] ring-offset-1 z-20":""}`}
      style={{width:52,height:44}} title={`${room.id} · ${room.roomType} · ${cfg.labelVi}`}>
      {room.pax>0&&<div className="absolute top-0.5 right-0.5 flex items-center gap-0.5">
        <WalkIcon color="rgba(255,255,255,0.75)"/><span className="mono text-[8px] opacity-75">{room.pax}</span>
      </div>}
      <span className="mono text-[10px] font-semibold leading-tight">{room.id}</span>
      <span className="text-[7px] opacity-70 uppercase tracking-wide leading-tight">{room.roomType}</span>
    </div>
    {hover&&room.guest&&<GuestTooltip guest={room.guest} roomType={room.roomType}/>}
  </div>;
}

// ─────────────────────────────────────────────
// SHARED UI
// ─────────────────────────────────────────────
function SectionTitle({children}:{children:React.ReactNode}){
  return <h3 className="text-[10px] font-semibold tracking-[0.14em] uppercase text-[#9ca3af] mb-4 flex items-center gap-2">
    <span className="w-4 h-px bg-[#d1d5db] inline-block"/>{children}
  </h3>;
}
function Card({children,className=""}:{children:React.ReactNode;className?:string}){
  return <div className={`bg-white border border-[#e5e7eb] rounded-[2px] shadow-[0_1px_3px_rgba(0,0,0,0.05)] ${className}`}>{children}</div>;
}
function FieldRow({label,children}:{label:string;children:React.ReactNode}){
  return <div className="grid grid-cols-5 items-center gap-3">
    <label className="col-span-2 text-[11px] text-[#9ca3af] font-medium">{label}</label>
    <div className="col-span-3">{children}</div>
  </div>;
}
const inputCls="w-full border border-[#e5e7eb] rounded-[2px] px-3 py-1.5 text-[13px] outline-none focus:border-[#6b7280] transition-colors bg-[#fafafa]";

// ─────────────────────────────────────────────
// ROOM PLAN COMPONENT
// ─────────────────────────────────────────────
function RoomPlanTab(){
  const NUM_DAYS=30;
  const [startDate,setStartDate]=useState(new Date(2026,4,1));
  const [filterType,setFilterType]=useState("ALL");
  const [filterFloor,setFilterFloor]=useState("ALL");
  const [searchName,setSearchName]=useState("");
  const [bookings,setBookings]=useState<Booking[]>(()=>makeSeedBookings());
  const [dragging,setDragging]=useState<{bookingId:string;offsetDay:number}|null>(null);
  const [dragOver,setDragOver]=useState<{roomId:number;day:number}|null>(null);
  const [selected,setSelected]=useState<string|null>(null);
  const [tooltip,setTooltip]=useState<{booking:Booking;x:number;y:number}|null>(null);
  const gridRef=useRef<HTMLDivElement>(null);

  const dates=useMemo(()=>buildDates(startDate,NUM_DAYS),[startDate]);

  // Filtered rooms
  const filteredRooms=useMemo(()=>{
    let rooms=PLAN_ROOMS;
    if(filterType!=="ALL") rooms=rooms.filter(r=>r.type===filterType);
    if(filterFloor!=="ALL") rooms=rooms.filter(r=>r.floor===Number(filterFloor));
    if(searchName.trim()){
      const q=searchName.toLowerCase();
      const matchIds=new Set(bookings.filter(b=>b.guestName.toLowerCase().includes(q)).map(b=>b.roomId));
      rooms=rooms.filter(r=>matchIds.has(r.id));
    }
    return rooms;
  },[filterType,filterFloor,searchName,bookings]);

  // Bookings map by room
  const bookingsByRoom=useMemo(()=>{
    // @ts-ignore — 'Map' here refers to the global JS Map, not the lucide icon
    const roomMap=new Map<number,Booking[]>();
    bookings.forEach(b=>{
      if(!roomMap.has(b.roomId)) roomMap.set(b.roomId,[]);
      roomMap.get(b.roomId)!.push(b);
    });
    return roomMap;
  },[bookings]);

  // Check collision
  const hasCollision=useCallback((roomId:number,startDay:number,nights:number,excludeId:string)=>{
    const roomBookings=(bookingsByRoom.get(roomId)||[]).filter(b=>b.id!==excludeId);
    return roomBookings.some(b=>startDay<b.startDay+b.nights && startDay+nights>b.startDay);
  },[bookingsByRoom]);

  // Drag handlers
  const onDragStart=(e:React.DragEvent,booking:Booking,clickedDay:number)=>{
    const offsetDay=clickedDay-booking.startDay;
    setDragging({bookingId:booking.id,offsetDay});
    setSelected(booking.id);
    e.dataTransfer.effectAllowed="move";
  };

  const onCellDragOver=(e:React.DragEvent,roomId:number,day:number)=>{
    e.preventDefault();
    e.dataTransfer.dropEffect="move";
    setDragOver({roomId,day});
  };

  const onDrop=(e:React.DragEvent,targetRoomId:number,day:number)=>{
    e.preventDefault();
    if(!dragging) return;
    const bk=bookings.find(b=>b.id===dragging.bookingId);
    if(!bk) return;
    const newStart=day-dragging.offsetDay;
    if(newStart<0||newStart+bk.nights>NUM_DAYS) return;
    if(hasCollision(targetRoomId,newStart,bk.nights,bk.id)) return;
    setBookings(prev=>prev.map(b=>b.id===dragging.bookingId?{...b,roomId:targetRoomId,startDay:newStart}:b));
    setDragging(null);
    setDragOver(null);
  };

  const onDragEnd=()=>{setDragging(null);setDragOver(null);};

  const goBack=()=>{const d=new Date(startDate);d.setDate(d.getDate()-7);setStartDate(d);};
  const goFwd=()=>{const d=new Date(startDate);d.setDate(d.getDate()+7);setStartDate(d);};
  const goToday=()=>setStartDate(new Date(2026,4,1));

  const floors=[...new Set(PLAN_ROOMS.map(r=>r.floor))].sort();

  return (
    <div className="flex flex-col bg-[#f2f2ef]" style={{height:"calc(100vh - 52px)"}}>

      {/* ── FILTER BAR ── */}
      <div className="bg-white border-b border-[#e5e7eb] px-5 py-2.5 flex items-center gap-4 shrink-0 flex-wrap">
        {/* Start date */}
        <div className="flex items-center gap-1.5 text-[12px] text-[#6b7280]">
          <span className="font-medium text-[#374151]">Start Date</span>
          <input type="date" value={startDate.toISOString().split("T")[0]}
            onChange={e=>{const d=new Date(e.target.value);if(!isNaN(d.getTime()))setStartDate(d);}}
            className="mono text-[12px] border border-[#e5e7eb] rounded-[2px] px-2 py-1 outline-none focus:border-[#6b7280] bg-[#fafafa]"/>
        </div>
        <div className="w-px h-4 bg-[#e5e7eb]"/>

        {/* Room type filter */}
        <div className="flex items-center gap-1.5 text-[12px] text-[#6b7280]">
          <span className="font-medium text-[#374151]">Rm Type</span>
          <select value={filterType} onChange={e=>setFilterType(e.target.value)}
            className="border border-[#e5e7eb] rounded-[2px] px-2 py-1 text-[12px] outline-none focus:border-[#6b7280] bg-[#fafafa] mono">
            {ALL_ROOM_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        {/* Floor filter */}
        <div className="flex items-center gap-1.5 text-[12px] text-[#6b7280]">
          <span className="font-medium text-[#374151]">Floor</span>
          <select value={filterFloor} onChange={e=>setFilterFloor(e.target.value)}
            className="border border-[#e5e7eb] rounded-[2px] px-2 py-1 text-[12px] outline-none focus:border-[#6b7280] bg-[#fafafa] mono">
            <option value="ALL">ALL</option>
            {floors.map(f=><option key={f} value={f}>Tầng {f}</option>)}
          </select>
        </div>

        <div className="w-px h-4 bg-[#e5e7eb]"/>

        {/* Search */}
        <div className="flex items-center gap-1.5 text-[12px] text-[#6b7280]">
          <span className="font-medium text-[#374151]">Name</span>
          <div className="flex items-center gap-1 border border-[#e5e7eb] rounded-[2px] px-2 py-1 bg-[#fafafa]">
            <Search size={11} strokeWidth={1.5} className="text-[#d1d5db]"/>
            <input value={searchName} onChange={e=>setSearchName(e.target.value)}
              className="outline-none bg-transparent text-[12px] w-28 mono" placeholder="Tìm tên khách..."/>
          </div>
        </div>

        <div className="flex-1"/>

        {/* Legend */}
        <div className="flex items-center gap-3">
          {(Object.entries(BOOKING_COLOR) as [BookingStatus,typeof BOOKING_COLOR[BookingStatus]][]).map(([k,c])=>(
            <div key={k} className="flex items-center gap-1 text-[10px] text-[#6b7280]">
              <span className="w-3 h-3 rounded-[2px] inline-block" style={{background:c.bg}}/>
              {c.label}
            </div>
          ))}
        </div>

        {/* Nav */}
        <div className="flex items-center gap-1 border border-[#e5e7eb] rounded-[2px] overflow-hidden">
          <button onClick={goBack} className="px-2 py-1.5 hover:bg-[#f3f4f6] transition-colors border-r border-[#e5e7eb]">
            <ChevronLeft size={13} strokeWidth={1.5}/>
          </button>
          <button onClick={goToday} className="px-3 py-1.5 text-[11px] font-medium hover:bg-[#f3f4f6] transition-colors border-r border-[#e5e7eb]">Today</button>
          <button onClick={goFwd} className="px-2 py-1.5 hover:bg-[#f3f4f6] transition-colors">
            <ChevronRight size={13} strokeWidth={1.5}/>
          </button>
        </div>
      </div>

      {/* ── GANTT GRID ── */}
      <div className="flex-1 overflow-auto" ref={gridRef}>
        <div style={{minWidth:LABEL_W+COL_W*NUM_DAYS}}>

          {/* Date header */}
          <div className="flex sticky top-0 z-30 bg-white border-b-2 border-[#e5e7eb]" style={{height:44}}>
            {/* Corner */}
            <div className="shrink-0 flex items-end px-3 pb-2 border-r border-[#e5e7eb]"
              style={{width:LABEL_W,background:"#fafafa"}}>
              <span className="mono text-[10px] text-[#9ca3af] font-medium tracking-widest uppercase">Room</span>
            </div>
            {/* Date columns */}
            {dates.map((d,i)=>{
              const weekend=isWeekend(d);
              const isToday=d.toDateString()===new Date(2026,4,1).toDateString();
              return <div key={i} style={{width:COL_W,minWidth:COL_W}}
                className={`shrink-0 flex flex-col items-center justify-end pb-1 border-r border-[#f0f0ed] ${weekend?"bg-[#fdf8f0]":""}`}>
                <div className={`mono text-[10px] font-semibold ${isToday?"text-[#c1121f]":weekend?"text-[#b45309]":"text-[#374151]"}`}>
                  {d.getDate()}/{d.getMonth()+1}
                </div>
                <div className={`text-[8px] uppercase tracking-wide ${weekend?"text-[#b45309]":"text-[#9ca3af]"}`}>
                  {d.toLocaleDateString("en-GB",{weekday:"short"})}
                </div>
                {isToday&&<div className="absolute bottom-0 w-full h-0.5 bg-[#c1121f]"/>}
              </div>;
            })}
          </div>

          {/* Rows */}
          {filteredRooms.map((room,ri)=>{
            const roomBookings=bookingsByRoom.get(room.id)||[];
            const isEven=ri%2===0;
            return (
              <div key={room.id} className="flex relative" style={{height:ROW_H}}
                onDragOver={e=>e.preventDefault()}>
                {/* Room label */}
                <div className={`shrink-0 flex items-center gap-2 px-3 border-r border-b border-[#e5e7eb] sticky left-0 z-20 ${isEven?"bg-white":"bg-[#fafafa]"}`}
                  style={{width:LABEL_W}}>
                  <span className="mono text-[11px] font-semibold text-[#374151]">{room.id}</span>
                  <span className="text-[9px] text-[#9ca3af] uppercase tracking-wide">{room.type}</span>
                </div>

                {/* Day cells (drop targets) */}
                <div className="relative flex flex-1 border-b border-[#f0f0ed]">
                  {dates.map((d,di)=>{
                    const weekend=isWeekend(d);
                    const isDropTarget=dragOver?.roomId===room.id&&dragOver?.day===di;
                    return <div key={di} style={{width:COL_W,minWidth:COL_W}}
                      className={`shrink-0 h-full border-r border-[#f0f0ed] ${isEven?"":""} ${weekend?"bg-[#fdf8f0]":isEven?"bg-white":"bg-[#fafafa]"} ${isDropTarget?"bg-blue-50 border-blue-300":""}`}
                      onDragOver={e=>onCellDragOver(e,room.id,di)}
                      onDrop={e=>onDrop(e,room.id,di)}/>;
                  })}

                  {/* Booking bars */}
                  {roomBookings.map(bk=>{
                    if(bk.startDay>=NUM_DAYS||bk.startDay+bk.nights<=0) return null;
                    const clampedStart=Math.max(0,bk.startDay);
                    const clampedEnd=Math.min(NUM_DAYS,bk.startDay+bk.nights);
                    const clampedNights=clampedEnd-clampedStart;
                    const c=BOOKING_COLOR[bk.status];
                    const isSelected=selected===bk.id;
                    const isDraggingThis=dragging?.bookingId===bk.id;
                    return (
                      <div key={bk.id}
                        draggable
                        onDragStart={e=>onDragStart(e,bk,clampedStart)}
                        onDragEnd={onDragEnd}
                        onClick={e=>{e.stopPropagation();setSelected(isSelected?null:bk.id);}}
                        onMouseEnter={e=>setTooltip({booking:bk,x:e.clientX,y:e.clientY})}
                        onMouseLeave={()=>setTooltip(null)}
                        className={`absolute top-[3px] rounded-[3px] cursor-grab active:cursor-grabbing flex items-center px-2 overflow-hidden select-none transition-opacity ${isDraggingThis?"opacity-40":""}`}
                        style={{
                          left:clampedStart*COL_W+1,
                          width:clampedNights*COL_W-2,
                          height:ROW_H-6,
                          background:c.bg,
                          border:`1.5px solid ${isSelected?"#1a1a1a":c.border}`,
                          boxShadow:isSelected?"0 0 0 2px #1a1a1a":"0 1px 3px rgba(0,0,0,0.2)",
                          zIndex:isSelected?25:15,
                        }}>
                        {/* Arrow tail left */}
                        <div className="absolute left-0 top-0 bottom-0 w-1.5 rounded-l-[3px]"
                          style={{background:c.border}}/>
                        <span className="mono text-[10px] font-semibold pl-2 truncate" style={{color:c.text}}>
                          {bk.guestName}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Empty state */}
          {filteredRooms.length===0&&(
            <div className="flex items-center justify-center py-16 text-[13px] text-[#9ca3af]">
              Không tìm thấy phòng phù hợp
            </div>
          )}
        </div>
      </div>

      {/* ── BOOKING TOOLTIP ── */}
      {tooltip&&(()=>{
        const bk=tooltip.booking;
        const c=BOOKING_COLOR[bk.status];
        const room=PLAN_ROOMS.find(r=>r.id===bk.roomId);
        return <div className="fixed z-50 pointer-events-none text-[11px] bg-white border border-[#e5e7eb] rounded-[2px] shadow-xl p-3"
          style={{left:tooltip.x+12,top:tooltip.y-8,minWidth:220}}>
          <div className="flex items-center gap-2 mb-2 pb-2 border-b border-[#f3f4f6]">
            <span className="w-2.5 h-2.5 rounded-[2px]" style={{background:c.bg}}/>
            <span className="font-semibold text-[12px]">{bk.guestName}</span>
            <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-[2px] font-medium text-white" style={{background:c.bg}}>{c.label}</span>
          </div>
          <div className="space-y-0.5 text-[#6b7280]">
            <div><span className="text-[#9ca3af]">Folio: </span><span className="mono font-medium text-[#374151]">{bk.folio}</span></div>
            <div><span className="text-[#9ca3af]">Phòng: </span><span className="mono font-medium text-[#374151]">{bk.roomId} · {room?.type}</span></div>
            <div><span className="text-[#9ca3af]">Check-in: </span><span className="mono text-[#374151]">{dates[Math.max(0,bk.startDay)]?.toLocaleDateString("en-GB")}</span></div>
            <div><span className="text-[#9ca3af]">Check-out: </span><span className="mono text-[#374151]">{dates[Math.min(NUM_DAYS-1,bk.startDay+bk.nights-1)]?.toLocaleDateString("en-GB")}</span></div>
            <div><span className="text-[#9ca3af]">Số đêm: </span><span className="mono font-medium text-[#374151]">{bk.nights}</span></div>
            <div><span className="text-[#9ca3af]">Khách: </span><span className="mono text-[#374151]">{bk.pax}</span></div>
          </div>
          <div className="mt-2 pt-2 border-t border-[#f3f4f6] text-[10px] text-[#9ca3af] italic">Kéo thả để đổi phòng</div>
        </div>;
      })()}

      {/* ── BOTTOM TOOLBAR ── */}
      <div className="bg-white border-t border-[#e5e7eb] px-5 py-2.5 flex items-center gap-2 shrink-0">
        <button className="toolbar-btn" onClick={()=>setSearchName("")}><RefreshCw size={11} strokeWidth={1.5} className="inline mr-1"/>Reset</button>
        <div className="w-px h-4 bg-[#e5e7eb] mx-1"/>
        <button className="toolbar-btn">Availability</button>
        <button className="toolbar-btn">Print</button>
        <button className="toolbar-btn">Notes</button>
        <div className="flex-1"/>
        {selected&&(()=>{
          const bk=bookings.find(b=>b.id===selected);
          if(!bk) return null;
          const c=BOOKING_COLOR[bk.status];
          return <div className="flex items-center gap-3 text-[12px]">
            <span className="w-2 h-2 rounded-[2px]" style={{background:c.bg}}/>
            <span className="font-medium">{bk.guestName}</span>
            <span className="text-[#9ca3af]">Phòng <span className="mono text-[#374151]">{bk.roomId}</span></span>
            <span className="text-[#9ca3af]">{bk.nights} đêm</span>
            <div className="w-px h-4 bg-[#e5e7eb]"/>
            <button className="px-3 py-1 border border-[#e5e7eb] rounded-[2px] text-[11px] hover:bg-[#0f0f0e] hover:text-white hover:border-[#0f0f0e] transition-colors font-medium">Xem folio</button>
            <button className="px-3 py-1 border border-[#e5e7eb] rounded-[2px] text-[11px] hover:bg-[#0f0f0e] hover:text-white hover:border-[#0f0f0e] transition-colors font-medium">Đổi phòng</button>
            <button onClick={()=>setSelected(null)} className="text-[#9ca3af] hover:text-[#1a1a1a] text-[13px]">✕</button>
          </div>;
        })()}
        <button className="toolbar-btn flex items-center gap-1 text-[#9ca3af] hover:text-[#c1121f]">
          <X size={11} strokeWidth={1.5}/> Close
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────
export default function AvantiPMS(){
  const [currentTab,setCurrentTab]=useState<TabName>("Tổng quan");
  const [mapViewMode,setMapViewMode]=useState<MapViewMode>("hotelmap");
  const [selectedRoom,setSelectedRoom]=useState<number|null>(null);
  const [cashierView,setCashierView]=useState<"menu"|"postTransaction">("menu");
  const [availNumDays,setAvailNumDays]=useState(10);
  const [availFilters,setAvailFilters]=useState({definite:true,tentative:true,seri:true,ooo:true,allotment:true,ooiPhu:true});
  const [availStartDate,setAvailStartDate]=useState(new Date(2026,4,1));

  useEffect(()=>{
    if(currentTab==="Sơ đồ phòng") setMapViewMode("hotelmap");
    if(currentTab==="Thu ngân") setCashierView("menu");
    setSelectedRoom(null);
  },[currentTab]);

  const floors=useMemo(()=>buildFloors(),[]);
  const allRooms=useMemo(()=>floors.flatMap(f=>f.rooms),[floors]);
  const mapStats=useMemo(()=>({
    clean:allRooms.filter(r=>r.status==="clean").length,
    occupied:allRooms.filter(r=>r.status==="occupied").length,
    dirty:allRooms.filter(r=>r.status==="dirty").length,
  }),[allRooms]);
  const simpleFloors=useMemo(()=>Array.from({length:9},(_,fi)=>{
    const fn=fi+1,count=fn===1?9:12;
    return {name:`Tầng ${fn}`,rooms:Array.from({length:count},(_,ri)=>{
      const id=fn*100+ri+1;
      return {id,status:getRoomStatus(id),roomType:HOTEL_ROOM_TYPES[ri%HOTEL_ROOM_TYPES.length]};
    })};
  }),[]);

  const availDates=useMemo(()=>buildDates(availStartDate,availNumDays),[availStartDate,availNumDays]);
  const dailyTotals=useMemo(()=>Array.from({length:availNumDays},(_,i)=>ROOM_TYPES_AVAILABILITY.reduce((s,rt)=>s+(rt.available[i]??0),0)),[availNumDays]);
  const dailyDefinite=useMemo(()=>Array.from({length:availNumDays},(_,i)=>ROOM_TYPES_AVAILABILITY.reduce((s,rt)=>s+(rt.definite[i]??0),0)),[availNumDays]);
  const totalAvailRooms=ROOM_TYPES_AVAILABILITY.reduce((s,rt)=>s+rt.total,0);
  const selectedRoomData=selectedRoom!==null?allRooms.find(r=>r.id===selectedRoom):null;

  const exportToCSV=()=>{
    const hdr=["Description","Type","Total",...availDates.map(d=>d.toLocaleDateString("en-GB",{day:"2-digit",month:"short"}))];
    const rows=ROOM_TYPES_AVAILABILITY.map(rt=>[rt.description,rt.type,rt.total,...availDates.map((_,i)=>rt.available[i]??0)]);
    const csv=[hdr,...rows].map(r=>r.join(",")).join("\n");
    const blob=new Blob([csv],{type:"text/csv;charset=utf-8;"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");a.href=url;a.download=`room_availability.csv`;
    document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);
  };

  const SimpleLegend=()=><div className="flex gap-5">
    {(Object.entries(ROOM_STATUS) as [RoomStatus,typeof ROOM_STATUS[RoomStatus]][]).map(([k,c])=>(
      <div key={k} className="flex items-center gap-1.5 text-[11px] text-[#6b7280]">
        <span className={`w-2.5 h-2.5 rounded-[2px] border inline-block ${c.cell}`}/>{c.labelVi}
      </div>
    ))}
  </div>;

  const MapLegend=()=><div className="flex gap-4">
    {(Object.entries(ROOM_STATUS) as [RoomStatus,typeof ROOM_STATUS[RoomStatus]][]).map(([k,c])=>(
      <div key={k} className="flex items-center gap-1.5 text-[11px] text-[#6b7280]">
        <span className="inline-block rounded-full" style={{width:8,height:8,backgroundColor:c.dotColor,boxShadow:"0 0 0 1.5px rgba(0,0,0,0.1)"}}/>{c.labelVi}
      </div>
    ))}
  </div>;

  return (
    <div className="flex min-h-screen bg-[#f2f2ef] text-[#1a1a1a]"
      style={{fontFamily:"'DM Sans','Helvetica Neue',Arial,sans-serif"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&family=DM+Mono:wght@400;500&display=swap');
        .mono{font-family:'DM Mono','Courier New',monospace;}
        .room-cell{transition:transform 0.08s ease,box-shadow 0.08s ease;}
        .room-cell:hover{transform:scale(1.08);box-shadow:0 3px 10px rgba(0,0,0,0.22);z-index:10;position:relative;}
        .room-cell.is-selected{outline:2px solid #111110;outline-offset:2px;z-index:20;position:relative;}
        .avail-table th,.avail-table td{border-right:1px solid #f0f0ed;}
        .avail-table th:last-child,.avail-table td:last-child{border-right:none;}
        .avail-table tbody tr:hover td{background-color:#f7f7f4!important;}
        .weekend-col{background-color:#fdf8f0;}
        .notes-divider{background-color:#1a1a1a;height:2px;}
        .toolbar-btn{padding:5px 14px;border:1px solid #d1d5db;border-radius:2px;font-size:12px;font-weight:500;background:white;cursor:pointer;transition:background 0.1s;}
        .toolbar-btn:hover{background:#f3f4f6;}
        .toolbar-btn.primary{background:#0f0f0e;color:white;border-color:#0f0f0e;}
        .toolbar-btn.primary:hover{background:#2a2a28;}
        ::-webkit-scrollbar{width:4px;height:4px;}
        ::-webkit-scrollbar-thumb{background:#d1d5db;border-radius:2px;}
        ::-webkit-scrollbar-track{background:transparent;}
      `}</style>

      {/* SIDEBAR */}
      <aside className="w-52 shrink-0 flex flex-col bg-[#0f0f0e] text-white">
        <div className="px-5 py-5 border-b border-[#252523]">
          <div className="text-[9px] tracking-[0.22em] text-[#5c5c58] uppercase mb-1">Property Management</div>
          <div className="text-[16px] font-semibold tracking-tight">Avanti OS</div>
        </div>
        <div className="px-5 py-2.5 border-b border-[#252523]">
          <div className="mono text-[10px] text-[#5c5c58]">
            {new Date().toLocaleDateString("en-GB",{weekday:"short",day:"2-digit",month:"short",year:"numeric"})}
          </div>
        </div>
        <nav className="flex-1 py-2">
          {MENU_ITEMS.map(({name,icon:Icon})=>(
            <button key={name} onClick={()=>setCurrentTab(name)}
              className={`flex w-full items-center gap-3 px-5 py-2.5 text-left transition-colors text-[12.5px]
                ${currentTab===name?"text-white bg-[#252523] border-l-2 border-white":"text-[#7a7a75] hover:text-white hover:bg-[#1c1c1a] border-l-2 border-transparent"}`}>
              <Icon size={14} strokeWidth={1.5}/><span className="font-medium">{name}</span>
            </button>
          ))}
        </nav>
        <div className="px-5 py-4 border-t border-[#252523] space-y-0.5">
          <button className="flex w-full items-center gap-2.5 py-2 text-[11px] text-[#5c5c58] hover:text-white transition-colors">
            <Settings size={13} strokeWidth={1.5}/> Cài đặt
          </button>
          <button onClick={()=>{window.location.href="/";}}
            className="flex w-full items-center gap-2.5 py-2 text-[11px] text-[#5c5c58] hover:text-[#ef4444] transition-colors">
            <LogOut size={13} strokeWidth={1.5}/> Đăng xuất
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Top bar */}
        <header className="bg-white border-b border-[#e5e7eb] flex items-center justify-between px-7 shrink-0" style={{height:52}}>
          <div className="flex items-center gap-2 text-[12px]">
            <span className="text-[#9ca3af]">Avanti OS</span>
            <ChevronRight size={11} className="text-[#d1d5db]" strokeWidth={1.5}/>
            <span className="font-medium text-[#1a1a1a]">{currentTab}</span>
          </div>
          <div className="flex items-center gap-5">
            <div className="flex items-center gap-3 text-[11px] text-[#6b7280]">
              <span className="flex items-center gap-1.5">
                <ArrowDownCircle size={12} strokeWidth={1.5} className="text-[#2d6a4f]"/>
                <span className="mono font-medium">{TODAY_STATS.checkInToday}</span> Arrivals
              </span>
              <span className="text-[#e5e7eb]">|</span>
              <span className="flex items-center gap-1.5">
                <ArrowUpCircle size={12} strokeWidth={1.5} className="text-[#c1121f]"/>
                <span className="mono font-medium">{TODAY_STATS.checkOutToday}</span> Departures
              </span>
            </div>
            <button className="w-7 h-7 flex items-center justify-center hover:bg-[#f2f2ef] rounded-[2px] transition-colors">
              <Bell size={14} strokeWidth={1.5} className="text-[#9ca3af]"/>
            </button>
            <div className="w-7 h-7 rounded-full bg-[#0f0f0e] text-white text-[10px] font-semibold flex items-center justify-center tracking-wide">GM</div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">

          {/* ══ TỔNG QUAN ══ */}
          {currentTab==="Tổng quan"&&(
            <div className="p-7 max-w-6xl mx-auto space-y-5">
              <div className="grid grid-cols-5 gap-3">
                {[
                  {label:"Tổng phòng",     value:TODAY_STATS.totalRooms,   sub:"Total rooms",    accent:"#374151"},
                  {label:"Đang có khách",  value:TODAY_STATS.occupied,     sub:"Occupied",       accent:"#7a5800",bar:"#e9c46a"},
                  {label:"Đã dọn sạch",    value:TODAY_STATS.available,    sub:"Clean & ready",  accent:"#1b4332",bar:"#2d6a4f"},
                  {label:"Chờ dọn phòng",  value:TODAY_STATS.dirty,        sub:"Needs cleaning", accent:"#8b0000",bar:"#c1121f"},
                  {label:"Check-in hôm nay",value:TODAY_STATS.checkInToday,sub:"Arrivals today", accent:"#374151"},
                ].map(({label,value,sub,accent,bar})=>(
                  <Card key={label} className="p-5">
                    <div className="text-[9px] tracking-[0.14em] uppercase text-[#9ca3af] mb-3 font-medium">{label}</div>
                    <div className="mono text-[28px] font-light leading-none mb-1" style={{color:accent}}>{value}</div>
                    <div className="text-[11px] text-[#9ca3af] mb-3">{sub}</div>
                    {bar&&<div className="h-0.5 bg-[#f3f4f6] rounded-full"><div className="h-full rounded-full w-2/3" style={{backgroundColor:bar}}/></div>}
                  </Card>
                ))}
              </div>
              <div className="flex gap-2 items-center">
                {[{label:"Walk In",icon:User},{label:"New Reservation",icon:BedDouble},{label:"Find Guest",icon:Search,action:()=>setCurrentTab("Khách hàng")}].map(({label,icon:Icon,action})=>(
                  <button key={label} onClick={action} className="flex items-center gap-1.5 px-4 py-2 bg-white border border-[#e5e7eb] rounded-[2px] text-[12px] font-medium text-[#374151] hover:border-[#9ca3af] hover:bg-[#f9f9f7] transition-colors">
                    <Icon size={12} strokeWidth={1.5}/> {label}
                  </button>
                ))}
                <div className="flex-1 flex items-center gap-2 bg-white border border-[#e5e7eb] rounded-[2px] px-3 hover:border-[#9ca3af] transition-colors">
                  <Search size={12} strokeWidth={1.5} className="text-[#d1d5db]"/>
                  <input className="flex-1 py-2 text-[13px] outline-none bg-transparent placeholder:text-[#d1d5db]" placeholder="Tên khách, số phòng, folio..."/>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-5">
                <Card className="col-span-2 p-5">
                  <div className="flex items-center justify-between mb-4">
                    <SectionTitle>Sơ đồ phòng — 3 tầng đầu</SectionTitle>
                    <button onClick={()=>setCurrentTab("Sơ đồ phòng")} className="text-[11px] text-[#9ca3af] hover:text-[#1a1a1a] transition-colors">Xem đầy đủ →</button>
                  </div>
                  <div className="space-y-3">
                    {simpleFloors.slice(0,3).map(floor=>(
                      <div key={floor.name}>
                        <div className="mono text-[9px] tracking-[0.1em] uppercase text-[#9ca3af] mb-1.5">{floor.name}</div>
                        <div className="flex gap-1 flex-wrap">
                          {floor.rooms.map(room=>(
                            <div key={room.id} className={`room-cell w-9 h-7 border rounded-[2px] flex items-center justify-center cursor-pointer ${ROOM_STATUS[room.status].cell} ${ROOM_STATUS[room.status].text}`}
                              title={`${room.id} — ${ROOM_STATUS[room.status].label}`}>
                              <span className="mono text-[9px] font-medium">{room.id}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 pt-4 border-t border-[#f3f4f6]"><SimpleLegend/></div>
                </Card>
                <div className="space-y-4">
                  <Card className="p-5">
                    <SectionTitle>Waiting List</SectionTitle>
                    <div className="space-y-3">
                      {WAITING_CUSTOMERS.map(cus=>(
                        <div key={cus.id} className="flex items-center justify-between py-2 border-b border-[#f3f4f6] last:border-0">
                          <div>
                            <div className="text-[12px] font-medium">{cus.name}</div>
                            <div className="mono text-[10px] text-[#9ca3af]">{cus.roomType} · {cus.checkIn}</div>
                          </div>
                          <button onClick={()=>setCurrentTab("Sơ đồ phòng")} className="text-[11px] px-3 py-1 border border-[#e5e7eb] rounded-[2px] hover:bg-[#0f0f0e] hover:text-white hover:border-[#0f0f0e] transition-colors font-medium">Gán phòng</button>
                        </div>
                      ))}
                    </div>
                  </Card>
                  <Card className="p-5">
                    <SectionTitle>Hoạt động gần đây</SectionTitle>
                    <div className="space-y-3">
                      {[{dot:"#2d6a4f",text:"Nguyen Huy — check-in phòng 102",time:"10 phút trước"},
                        {dot:"#2d6a4f",text:"Phòng 208 — đã dọn xong",time:"25 phút trước"},
                        {dot:"#c1121f",text:"Phòng 315 — chờ dọn",time:"1 giờ trước"}].map((act,i)=>(
                        <div key={i} className="flex gap-2.5 items-start">
                          <span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{backgroundColor:act.dot}}/>
                          <div>
                            <div className="text-[12px] text-[#374151]">{act.text}</div>
                            <div className="mono text-[10px] text-[#9ca3af]">{act.time}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>
              </div>
            </div>
          )}

          {/* ══ SƠ ĐỒ PHÒNG ══ */}
          {currentTab==="Sơ đồ phòng"&&(
            <div className="flex flex-col" style={{height:"calc(100vh - 52px)"}}>
              <div className="bg-white border-b border-[#e5e7eb] px-7 py-4 flex items-center justify-between shrink-0">
                <div>
                  <h1 className="text-[20px] font-light tracking-[0.16em] uppercase" style={{color:"#2d6a4f"}}>AVANTI HOTEL</h1>
                  <div className="flex items-center gap-4 mt-1">
                    <span className="mono text-[11px] text-[#9ca3af]">{allRooms.length} phòng · 9 tầng</span>
                    <span className="text-[#e5e7eb]">|</span>
                    {(["clean","occupied","dirty"] as RoomStatus[]).map(s=>(
                      <span key={s} className="flex items-center gap-1 text-[11px]" style={{color:ROOM_STATUS[s].mapSubText}}>
                        <StatusDot status={s}/> {mapStats[s]} {ROOM_STATUS[s].labelVi}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <MapLegend/>
                  <div className="w-px h-5 bg-[#e5e7eb]"/>
                  <div className="flex border border-[#e5e7eb] rounded-[2px] overflow-hidden">
                    <button onClick={()=>setMapViewMode("hotelmap")}
                      className={`flex items-center gap-1.5 px-4 py-2 text-[12px] font-medium transition-colors border-r border-[#e5e7eb] ${mapViewMode==="hotelmap"?"bg-[#0f0f0e] text-white":"bg-white text-[#6b7280] hover:bg-[#f9f9f7]"}`}>
                      <MapIcon size={13} strokeWidth={1.5}/> Hotel Map
                    </button>
                    <button onClick={()=>setMapViewMode("block")}
                      className={`flex items-center gap-1.5 px-4 py-2 text-[12px] font-medium transition-colors ${mapViewMode==="block"?"bg-[#0f0f0e] text-white":"bg-white text-[#6b7280] hover:bg-[#f9f9f7]"}`}>
                      <LayoutGrid size={13} strokeWidth={1.5}/> Block View
                    </button>
                  </div>
                </div>
              </div>
              <div className={`flex-1 overflow-auto p-6`}>
                <div className={mapViewMode==="block"?"bg-white border border-[#e5e7eb] rounded-[2px] shadow-sm p-6":""}>
                  <div className="space-y-5">
                    {floors.map(floor=>(
                      <div key={floor.name}>
                        <div className="mono text-[9px] tracking-[0.14em] uppercase text-[#9ca3af] font-medium mb-2">{floor.name}</div>
                        <div className="flex flex-wrap gap-1">
                          {floor.rooms.map(room=>mapViewMode==="hotelmap"
                            ?<HotelCell key={room.id} room={room} selected={selectedRoom===room.id} onClick={()=>setSelectedRoom(prev=>prev===room.id?null:room.id)}/>
                            :<BlockCell key={room.id} room={room} selected={selectedRoom===room.id} onClick={()=>setSelectedRoom(prev=>prev===room.id?null:room.id)}/>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              {selectedRoomData&&(
                <div className="bg-white border-t border-[#e5e7eb] px-7 py-3 flex items-center gap-5 shrink-0 text-[12px]">
                  <div className="flex items-center gap-2 font-semibold shrink-0">
                    <StatusDot status={selectedRoomData.status}/>
                    <span className="mono text-[14px]">Phòng {selectedRoomData.id}</span>
                    <span className="text-[#9ca3af] font-normal">· {selectedRoomData.roomType}</span>
                    <span className="px-2 py-0.5 rounded-[2px] text-[10px] font-medium text-white ml-1" style={{background:ROOM_STATUS[selectedRoomData.status].dotColor}}>
                      {ROOM_STATUS[selectedRoomData.status].labelVi.toUpperCase()}
                    </span>
                  </div>
                  <div className="w-px h-4 bg-[#e5e7eb] shrink-0"/>
                  {selectedRoomData.guest?(
                    <>
                      <span className="font-medium">{selectedRoomData.guest.name}</span>
                      <span className="text-[#9ca3af]">Folio <span className="mono text-[#374151]">{selectedRoomData.guest.folio}</span></span>
                      <span className="text-[#9ca3af]">{selectedRoomData.guest.arrival} → {selectedRoomData.guest.departure}</span>
                      <span className="text-[#9ca3af]">Balance: <span className={`mono font-semibold ${selectedRoomData.guest.balance>0?"text-[#c1121f]":"text-[#1a1a1a]"}`}>{selectedRoomData.guest.balance.toLocaleString()}</span></span>
                      <div className="flex-1"/>
                      <div className="flex gap-1.5">
                        {["Check Out","Post Charge","View Folio"].map(btn=>(
                          <button key={btn} className="px-3 py-1.5 border border-[#e5e7eb] rounded-[2px] text-[11px] font-medium hover:bg-[#0f0f0e] hover:text-white hover:border-[#0f0f0e] transition-colors">{btn}</button>
                        ))}
                      </div>
                    </>
                  ):(
                    <>
                      <span className="text-[#9ca3af]">Không có khách</span>
                      <div className="flex-1"/>
                      <button className="px-3 py-1.5 bg-[#0f0f0e] text-white border border-[#0f0f0e] rounded-[2px] text-[11px] font-medium hover:bg-[#252523] transition-colors">Walk In</button>
                    </>
                  )}
                  <button onClick={()=>setSelectedRoom(null)} className="text-[#9ca3af] hover:text-[#1a1a1a] text-[13px] ml-1">✕</button>
                </div>
              )}
            </div>
          )}

          {/* ══ ROOM PLAN ══ */}
          {currentTab==="Room Plan"&&<RoomPlanTab/>}

          {/* ══ KHÁCH HÀNG ══ */}
          {currentTab==="Khách hàng"&&(
            <div className="p-7 max-w-5xl mx-auto space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-[15px] font-semibold">Quản lý khách hàng</h2>
                <div className="flex gap-2">
                  <button className="px-4 py-2 border border-[#e5e7eb] rounded-[2px] text-[12px] font-medium hover:bg-[#f9f9f7] transition-colors">Walk In</button>
                  <button className="px-4 py-2 bg-[#0f0f0e] text-white rounded-[2px] text-[12px] font-medium hover:bg-[#252523] transition-colors">+ New Reservation</button>
                </div>
              </div>
              <Card className="p-6">
                <SectionTitle>Tìm kiếm khách hàng</SectionTitle>
                <div className="grid grid-cols-2 gap-x-8">
                  <div className="space-y-2.5">
                    {[{label:"Thông tin khách",ph:""},{label:"Số phòng / Loại",ph:"Số phòng hoặc loại phòng"},{label:"Mã đoàn",ph:""},{label:"Member ID",ph:""}].map(({label,ph})=>(
                      <FieldRow key={label} label={label}><input className={inputCls} placeholder={ph}/></FieldRow>
                    ))}
                  </div>
                  <div className="space-y-2.5">
                    {[1,2,3,4].map(i=><FieldRow key={i} label={`Thông tin ${i}`}><input className={inputCls}/></FieldRow>)}
                  </div>
                </div>
                <div className="flex items-center justify-between mt-5 pt-4 border-t border-[#f3f4f6]">
                  <label className="flex items-center gap-1.5 text-[12px] text-[#6b7280] cursor-pointer"><input type="checkbox" className="w-3 h-3 accent-[#0f0f0e]"/> In House</label>
                  <button className="flex items-center gap-2 px-5 py-2 bg-[#0f0f0e] text-white rounded-[2px] text-[12px] font-medium hover:bg-[#252523] transition-colors"><Search size={12} strokeWidth={1.5}/> Tìm kiếm</button>
                </div>
              </Card>
              <Card className="p-6">
                <SectionTitle>Tìm kiếm nâng cao</SectionTitle>
                <div className="grid grid-cols-2 gap-x-8 mb-5">
                  <div className="space-y-2.5">{["Họ","Tên","Mã ngoài"].map(lbl=><FieldRow key={lbl} label={lbl}><input className={inputCls}/></FieldRow>)}</div>
                  <div className="space-y-2.5">{["Công ty","Quốc gia","Market Segment"].map(lbl=><FieldRow key={lbl} label={lbl}><input className={inputCls}/></FieldRow>)}</div>
                </div>
                <div className="flex items-center justify-between border-t border-[#f3f4f6] pt-4">
                  <div className="flex flex-wrap gap-4">
                    {["Reserved","In House","Arrival Today","C/O Today","Definite","Waiting"].map(s=>(
                      <label key={s} className="flex items-center gap-1.5 text-[11px] text-[#6b7280] cursor-pointer hover:text-[#1a1a1a]"><input type="checkbox" defaultChecked className="w-3 h-3 accent-[#0f0f0e]"/> {s}</label>
                    ))}
                  </div>
                  <button className="px-5 py-2 bg-[#0f0f0e] text-white rounded-[2px] text-[12px] font-medium hover:bg-[#252523] transition-colors">Advanced Search</button>
                </div>
              </Card>
              <Card className="overflow-hidden">
                <div className="px-6 py-4 border-b border-[#f3f4f6]"><SectionTitle>Waiting List — Chưa gán phòng</SectionTitle></div>
                <table className="w-full text-left">
                  <thead><tr className="border-b border-[#f3f4f6] bg-[#fafafa]">
                    {["Folio","Tên khách","Loại phòng","Check-in","Check-out",""].map(h=>(
                      <th key={h} className="px-6 py-3 text-[9px] tracking-[0.12em] uppercase text-[#9ca3af] font-medium">{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {WAITING_CUSTOMERS.map(cus=>(
                      <tr key={cus.id} className="border-b border-[#f9f9f7] hover:bg-[#fafafa] transition-colors">
                        <td className="px-6 py-4 mono text-[12px] text-[#9ca3af]">{cus.folio}</td>
                        <td className="px-6 py-4 text-[13px] font-medium">{cus.name}</td>
                        <td className="px-6 py-4"><span className="text-[11px] px-2 py-0.5 bg-[#f3f4f6] rounded-[2px] text-[#374151] font-medium mono">{cus.roomType}</span></td>
                        <td className="px-6 py-4 mono text-[12px] text-[#9ca3af]">{cus.checkIn}</td>
                        <td className="px-6 py-4 mono text-[12px] text-[#9ca3af]">{cus.checkOut}</td>
                        <td className="px-6 py-4 text-right">
                          <button onClick={()=>setCurrentTab("Sơ đồ phòng")} className="text-[11px] px-3 py-1.5 border border-[#e5e7eb] rounded-[2px] hover:bg-[#0f0f0e] hover:text-white hover:border-[#0f0f0e] transition-colors font-medium">Gán phòng</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </div>
          )}

          {/* ══ THU NGÂN ══ */}
          {currentTab==="Thu ngân"&&(
            <div className="p-7 max-w-5xl mx-auto space-y-4">
              {cashierView==="menu"&&(
                <><h2 className="text-[15px] font-semibold">Cashier Functions</h2>
                <Card className="p-6"><div className="grid grid-cols-2 gap-2">
                  {CASHIER_FUNCTIONS.map(fn=>{
                    const isWide=/^[ACDFX] /.test(fn),isPrimary=fn==="Post Transaction";
                    return <button key={fn} onClick={()=>{if(isPrimary)setCashierView("postTransaction");}}
                      className={`text-left px-5 py-3 rounded-[2px] text-[13px] font-medium transition-colors border ${isWide?"col-span-2":""} ${isPrimary?"bg-[#0f0f0e] text-white border-[#0f0f0e] hover:bg-[#252523]":"bg-[#fafafa] border-[#e5e7eb] text-[#374151] hover:bg-[#f3f4f6] hover:border-[#d1d5db]"}`}>
                      {fn}
                    </button>;
                  })}
                </div></Card></>
              )}
              {cashierView==="postTransaction"&&(
                <div className="space-y-4">
                  <button onClick={()=>setCashierView("menu")} className="flex items-center gap-1.5 text-[12px] text-[#9ca3af] hover:text-[#1a1a1a] transition-colors font-medium">
                    <ChevronLeft size={13} strokeWidth={1.5}/> Quay lại
                  </button>
                  <div className="flex gap-4">
                    <Card className="w-64 shrink-0 p-5">
                      <SectionTitle>Thông tin khách</SectionTitle>
                      <div className="space-y-2">
                        {[{label:"Khách",type:"input",ph:"Tên khách"},{label:"Đoàn",type:"input",ph:""},{label:"TA / Cty",type:"input",ph:""},{label:"Trạng thái",type:"static",val:"IN HOUSE"},{label:"Phòng",type:"static",val:"101"},{label:"Giá phòng",type:"static",val:"23,500"},{label:"Số dư",type:"static",val:"0",red:true},{label:"TA / AR",type:"input",ph:""}].map(({label,type,ph,val,red})=>(
                          <div key={label} className="grid grid-cols-5 items-center gap-2">
                            <label className="col-span-2 text-[10px] text-[#9ca3af] font-medium uppercase tracking-wide">{label}</label>
                            {type==="input"?<input className="col-span-3 border border-[#e5e7eb] rounded-[2px] px-2.5 py-1.5 text-[12px] outline-none focus:border-[#6b7280] bg-[#fafafa]" placeholder={ph}/>
                              :<div className={`col-span-3 mono text-[12px] font-medium ${red?"text-[#c1121f]":"text-[#1a1a1a]"}`}>{val}</div>}
                          </div>
                        ))}
                        <div className="pt-1">
                          <div className="text-[10px] text-[#9ca3af] font-medium uppercase tracking-wide mb-1">Ghi chú</div>
                          <textarea className="w-full border border-[#e5e7eb] rounded-[2px] px-2.5 py-1.5 text-[12px] outline-none focus:border-[#6b7280] bg-[#fafafa] h-14 resize-none"/>
                        </div>
                      </div>
                    </Card>
                    <div className="flex-1 flex flex-col gap-3">
                      <Card className="p-3 flex items-center gap-3">
                        <label className="flex items-center gap-1.5 text-[11px] text-[#6b7280] font-medium cursor-pointer"><input type="checkbox" className="w-3 h-3 accent-[#0f0f0e]"/> In House</label>
                        <input className="flex-1 border border-[#e5e7eb] rounded-[2px] px-3 py-1.5 text-[13px] outline-none bg-[#fafafa]" placeholder="Tìm folio..."/>
                        <button className="px-4 py-1.5 bg-[#0f0f0e] text-white rounded-[2px] text-[12px] font-medium hover:bg-[#252523] transition-colors">Tìm</button>
                      </Card>
                      <Card className="overflow-hidden">
                        <table className="w-full text-left">
                          <thead><tr className="border-b border-[#f3f4f6] bg-[#fafafa]">
                            {["Sts","Folio#","Confirm#","Tên khách","Phòng","Số dư","Ngày đến","Ngày đi"].map(h=>(
                              <th key={h} className="px-3 py-2.5 text-[9px] tracking-[0.1em] uppercase text-[#9ca3af] font-medium">{h}</th>
                            ))}
                          </tr></thead>
                          <tbody><tr className="hover:bg-[#fafafa] cursor-pointer transition-colors">
                            <td className="px-3 py-3 text-[11px] text-[#2d6a4f] font-semibold mono">OK</td>
                            <td className="px-3 py-3 mono text-[11px]">10254</td>
                            <td className="px-3 py-3 mono text-[11px] text-[#9ca3af]">CNF123</td>
                            <td className="px-3 py-3 text-[12px] font-medium">NGUYEN HUY</td>
                            <td className="px-3 py-3 mono text-[11px]">101</td>
                            <td className="px-3 py-3 mono text-[11px]">0</td>
                            <td className="px-3 py-3 mono text-[11px] text-[#9ca3af]">01/05/2026</td>
                            <td className="px-3 py-3 mono text-[11px] text-[#9ca3af]">05/05/2026</td>
                          </tr></tbody>
                        </table>
                      </Card>
                    </div>
                  </div>
                  <Card className="overflow-hidden">
                    <table className="w-full text-left">
                      <thead><tr className="border-b border-[#f3f4f6] bg-[#fafafa]">
                        {["Ngày","Code","Mô tả","Ref #","Sub Amt","Số tiền","Phòng gốc","Thuế","Inv Date","User","Ghi chú"].map(h=>(
                          <th key={h} className="px-3 py-2.5 text-[9px] tracking-[0.1em] uppercase text-[#9ca3af] font-medium">{h}</th>
                        ))}
                      </tr></thead>
                      <tbody><tr><td colSpan={11} className="px-3 py-10 text-center text-[12px] text-[#d1d5db]">Chưa có giao dịch</td></tr></tbody>
                    </table>
                    <div className="px-5 py-3 border-t border-[#f3f4f6] flex justify-between items-center">
                      <span className="text-[11px] text-[#9ca3af] uppercase tracking-wide">Balance</span>
                      <span className="mono font-semibold text-[14px]">0</span>
                    </div>
                  </Card>
                  <div className="flex flex-wrap gap-1.5">
                    {["New","Paid","HSKP","Out","Post","Adv Rim","Chg-F4","Tn","Move","Tn-F5","Edit","Split","Out-F7","Print","P-Dut","Pnt-F9","Set Bill","Cxl Bill","Close"].map(btn=>(
                      <button key={btn} className="mono px-3.5 py-1.5 border border-[#e5e7eb] rounded-[2px] text-[11px] text-[#374151] hover:bg-[#0f0f0e] hover:text-white hover:border-[#0f0f0e] transition-colors font-medium">{btn}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══ ROOM AVAILABILITY ══ */}
          {currentTab==="Room Availability"&&(
            <div className="flex flex-col" style={{height:"calc(100vh - 52px)"}}>
              <div className="bg-white border-b border-[#e5e7eb] px-5 py-3 flex items-center gap-6 shrink-0">
                <div className="flex items-center gap-2">
                  <input type="date" value={availStartDate.toISOString().split("T")[0]}
                    onChange={e=>{const d=new Date(e.target.value);if(!isNaN(d.getTime()))setAvailStartDate(d);}}
                    className="mono text-[12px] border border-[#e5e7eb] rounded-[2px] px-2 py-1.5 outline-none focus:border-[#6b7280] bg-[#fafafa]"/>
                  <span className="text-[14px] font-semibold text-[#374151]">
                    {availStartDate.toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric"})}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-[12px] text-[#6b7280]">
                  {(Object.entries(availFilters) as [keyof typeof availFilters,boolean][]).map(([key,val])=>(
                    <label key={key} className="flex items-center gap-1.5 cursor-pointer hover:text-[#1a1a1a] capitalize">
                      <input type="checkbox" checked={val} onChange={e=>setAvailFilters(f=>({...f,[key]:e.target.checked}))} className="w-3 h-3 accent-[#0f0f0e]"/>
                      {key==="ooiPhu"?"OOI+PHU":key.charAt(0).toUpperCase()+key.slice(1)}
                    </label>
                  ))}
                </div>
                <div className="flex items-center gap-2 text-[12px] text-[#6b7280] ml-auto">
                  <span className="font-medium">Num Days</span>
                  <input type="number" value={availNumDays} min={1} max={30}
                    onChange={e=>setAvailNumDays(Math.max(1,Math.min(30,Number(e.target.value))))}
                    className="mono w-14 border border-[#e5e7eb] rounded-[2px] px-2 py-1 text-[12px] outline-none focus:border-[#6b7280] bg-[#fafafa] text-center"/>
                  <button className="toolbar-btn flex items-center gap-1.5"
                    onClick={()=>{setAvailStartDate(new Date(2026,4,1));setAvailNumDays(10);}}>
                    <RefreshCw size={11} strokeWidth={1.5}/> Refresh
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-auto px-5 py-4">
                <div className="bg-white border border-[#e5e7eb] rounded-[2px] shadow-[0_1px_3px_rgba(0,0,0,0.05)] overflow-hidden">
                  <table className="avail-table w-full text-left border-collapse text-[12px]" style={{minWidth:900}}>
                    <thead>
                      <tr className="border-b-2 border-[#e5e7eb] bg-[#fafafa]">
                        <th className="px-4 py-3 text-[10px] tracking-[0.12em] uppercase text-[#9ca3af] font-medium sticky left-0 bg-[#fafafa] z-10 min-w-[160px]">Description</th>
                        <th className="px-3 py-3 text-[10px] tracking-[0.12em] uppercase text-[#9ca3af] font-medium min-w-[56px]">Type</th>
                        <th className="px-3 py-3 text-[10px] tracking-[0.12em] uppercase text-[#9ca3af] font-medium min-w-[44px] text-center">Total</th>
                        {availDates.map((d,i)=>(
                          <th key={i} className={`px-2 py-0 text-center min-w-[52px] ${isWeekend(d)?"weekend-col":""}`}>
                            <div className="py-2">
                              <div className={`mono text-[11px] font-semibold ${isWeekend(d)?"text-[#b45309]":"text-[#374151]"}`}>{d.toLocaleDateString("en-GB",{day:"numeric",month:"numeric"})}</div>
                              <div className={`text-[9px] tracking-wide uppercase ${isWeekend(d)?"text-[#b45309]":"text-[#9ca3af]"}`}>{d.toLocaleDateString("en-GB",{weekday:"short"})}</div>
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f3f4f6]">
                      {ROOM_TYPES_AVAILABILITY.map((rt,idx)=>(
                        <tr key={idx} className="transition-colors">
                          <td className="px-4 py-2.5 font-medium text-[13px] sticky left-0 bg-white z-10">{rt.description}</td>
                          <td className="px-3 py-2.5 mono text-[11px] text-[#9ca3af]">{rt.type}</td>
                          <td className="px-3 py-2.5 mono text-[12px] font-semibold text-center">{rt.total}</td>
                          {availDates.map((d,i)=>{
                            const val=rt.available[i]??0;
                            return <td key={i} className={`px-2 py-2.5 text-center ${isWeekend(d)?"weekend-col":""}`}>
                              <span className={`mono text-[12px] font-medium inline-block w-8 py-0.5 rounded-[2px] ${availBg(val)}`}>{val}</span>
                            </td>;
                          })}
                        </tr>
                      ))}
                      <tr className="bg-[#fafafa] border-t-2 border-[#e5e7eb]">
                        <td className="px-4 py-2.5 font-semibold text-[13px] sticky left-0 bg-[#fafafa] z-10">Total</td>
                        <td className="px-3 py-2.5"/><td className="px-3 py-2.5 mono text-[12px] font-semibold text-center">{totalAvailRooms}</td>
                        {availDates.map((d,i)=>(
                          <td key={i} className={`px-2 py-2.5 text-center ${isWeekend(d)?"weekend-col":""}`}>
                            <span className="mono text-[12px] font-semibold">{dailyTotals[i]??0}</span>
                          </td>
                        ))}
                      </tr>
                      <tr><td colSpan={3+availNumDays} className="px-0 py-0"><div className="notes-divider"/></td></tr>
                      <tr className="bg-[#0f0f0e]"><td colSpan={3+availNumDays} className="px-4 py-1">
                        <span className="text-[10px] tracking-[0.14em] uppercase text-[#6b6b68] font-medium">*** NOTES ***</span>
                      </td></tr>
                      {([{label:"OOI",data:NOTES_STATIC.ooi},{label:"PHU",data:NOTES_STATIC.phu},{label:"Available Rms",data:NOTES_STATIC.availableRms,bold:true},{label:"OOO",data:NOTES_STATIC.ooo},{label:"Saleable Rms",data:NOTES_STATIC.saleableRms,bold:true}] as {label:string;data:number[];bold?:boolean}[]).map(({label,data,bold})=>(
                        <tr key={label} className="border-t border-[#f3f4f6] hover:bg-[#fafafa]">
                          <td className={`px-4 py-1.5 text-[12px] sticky left-0 bg-white z-10 ${bold?"font-semibold":"text-[#6b7280]"}`}>{label}</td>
                          <td className="px-3 py-1.5"/><td className="px-3 py-1.5 mono text-[11px] text-center text-[#9ca3af]">{data[0]??0}</td>
                          {availDates.map((d,i)=>(
                            <td key={i} className={`px-2 py-1.5 text-center ${isWeekend(d)?"weekend-col":""}`}>
                              <span className={`mono text-[11px] ${bold?"font-semibold text-[#1a1a1a]":"text-[#6b7280]"}`}>{data[i]??0}</span>
                            </td>
                          ))}
                        </tr>
                      ))}
                      <tr className="border-t border-[#f3f4f6] hover:bg-[#fafafa]">
                        <td className="px-4 py-1.5 text-[12px] text-[#6b7280] sticky left-0 bg-white z-10">Definite</td>
                        <td className="px-3 py-1.5"/><td className="px-3 py-1.5 mono text-[11px] text-center text-[#9ca3af]">{dailyDefinite[0]??0}</td>
                        {availDates.map((d,i)=>{
                          const val=dailyDefinite[i]??0,pct=Math.round((val/(NOTES_STATIC.saleableRms[i]||1))*100);
                          return <td key={i} className={`px-2 py-1.5 text-center ${isWeekend(d)?"weekend-col":""}`}>
                            <span className="mono text-[11px] text-[#1b4332]">{val}</span>
                            <span className="mono text-[9px] text-[#9ca3af] ml-0.5">({pct}%)</span>
                          </td>;
                        })}
                      </tr>
                      <tr className="border-t border-[#f3f4f6] bg-[#fafafa]">
                        <td className="px-4 py-1.5 text-[12px] font-semibold sticky left-0 bg-[#fafafa] z-10">Total Occ</td>
                        <td className="px-3 py-1.5"/><td className="px-3 py-1.5 mono text-[11px] text-center font-semibold">{totalAvailRooms-(NOTES_STATIC.availableRms[0]??93)}</td>
                        {availDates.map((d,i)=>{
                          const occ=totalAvailRooms-(NOTES_STATIC.availableRms[i]??93),pct=Math.round((occ/(NOTES_STATIC.saleableRms[i]||1))*100),hi=pct>=70;
                          return <td key={i} className={`px-2 py-1.5 text-center ${isWeekend(d)?"weekend-col":""}`}>
                            <span className={`mono text-[11px] font-semibold ${hi?"text-[#c1121f]":"text-[#1a1a1a]"}`}>{occ}</span>
                            <span className={`mono text-[9px] ml-0.5 ${hi?"text-[#c1121f]":"text-[#9ca3af]"}`}>({pct}%)</span>
                          </td>;
                        })}
                      </tr>
                      <tr><td colSpan={3+availNumDays} className="py-1"/></tr>
                      {([{label:"FIT Arrival",data:NOTES_STATIC.fitArrival},{label:"GIT Arrival",data:NOTES_STATIC.gitArrival},{label:"Waiting List",data:Array(10).fill(0)}]).map(({label,data})=>(
                        <tr key={label} className="border-t border-[#f3f4f6] hover:bg-[#fafafa]">
                          <td className="px-4 py-1.5 text-[12px] text-[#6b7280] sticky left-0 bg-white z-10">{label}</td>
                          <td className="px-3 py-1.5"/><td className="px-3 py-1.5 mono text-[11px] text-center text-[#9ca3af]">{data[0]??0}</td>
                          {availDates.map((d,i)=>(
                            <td key={i} className={`px-2 py-1.5 text-center mono text-[11px] text-[#374151] ${isWeekend(d)?"weekend-col":""}`}>{data[i]??0}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="bg-white border-t border-[#e5e7eb] px-5 py-3 flex items-center gap-2 shrink-0">
                <button className="toolbar-btn primary flex items-center gap-1.5" onClick={exportToCSV}><Download size={11} strokeWidth={1.5}/> Excel...</button>
                {["Notes","Hotel Status"].map(btn=><button key={btn} className="toolbar-btn">{btn}</button>)}
                <div className="w-px h-5 bg-[#e5e7eb] mx-1"/>
                {["Extra Bed","New Rsvn","Group Rsvn","Rate Level"].map(btn=><button key={btn} className="toolbar-btn">{btn}</button>)}
                <div className="flex-1"/>
                <button className="toolbar-btn flex items-center gap-1.5 text-[#9ca3af] hover:text-[#c1121f]"><X size={12} strokeWidth={1.5}/> Close</button>
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}
