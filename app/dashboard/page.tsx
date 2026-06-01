"use client";
import { useRouter } from "next/navigation";
import React, { useMemo, useState, useRef, useCallback, useEffect } from "react";
import {
  ArrowDownCircle, ArrowUpCircle, BedDouble, CalendarDays, ClipboardList,
  Home, LayoutGrid, LogOut, User, Search, DollarSign, ChevronLeft,
  Download, RefreshCw, ChevronRight, Settings, Bell, X, MapIcon, Globe, Printer,
  AlertCircle, CheckCircle, Clock, Send, Plus, Trash2,
} from "lucide-react";

type TabName = "Tổng quan"|"Tìm kiếm"|"Sơ đồ phòng"|"Room Plan"|"Đặt phòng"|"Báo cáo"|"Thu ngân"|"Room Availability";
type RoomStatus = "clean"|"occupied"|"dirty";
type MapViewMode = "hotelmap"|"block";
type BookingStatus = "definite"|"tentative"|"group"|"checkedIn"|"waitlist";
type GuestType = "vietnamese"|"foreign";
type ShiftName = "Ca sáng"|"Ca chiều"|"Ca tối";
type TaskPriority = "urgent"|"normal"|"info";
type Guest = { name:string; folio:string; arrival:string; departure:string; rate:number; balance:number; pax:number; plan:string };
type HotelRoom = { id:number; status:RoomStatus; roomType:string; pax:number; guest?:Guest };
type Floor = { name:string; rooms:HotelRoom[] };
type WaitingCustomer = { id:number; folio:string; name:string; roomType:string; checkIn:string; checkOut:string };
type Booking = { id:string; guestName:string; folio:string; roomId:number; startDay:number; nights:number; status:BookingStatus; pax:number; note?:string };
type PlanRoom = { id:number; type:string; floor:number };
type ShiftTask = { id:string; content:string; priority:TaskPriority; done:boolean };
type PendingArrival = { folio:string; name:string; roomType:string; eta:string; pax:number; note:string };
type ShiftReport = {
  id:string; date:string; shift:ShiftName; reporter:string; handoverTo:string;
  confirmedBy:string; confirmedAt:string; status:"draft"|"submitted"|"confirmed";
  tasks:ShiftTask[]; pendingArrivals:PendingArrival[]; generalNote:string;
  cashBalance:number; incidentNote:string;
};
type ArrivalRow = {
  sts:string; stt:number; folio:string; conf:string; title:string; name:string;
  rate:number; vip:boolean; rm:number; type:string; booked:string;
  arrival:string; departure:string; adtCh:string; shr:boolean;
  company:string; sales:string; bkSts:string; nat:string;
};

const ROOM_STATUS: Record<RoomStatus,{label:string;labelVi:string;cell:string;text:string;mapBg:string;mapBorder:string;mapText:string;mapSubText:string;mapPaxColor:string;dotColor:string}> = {
  clean:    { label:"CLEAN",    labelVi:"Đã dọn",   cell:"bg-[#2d6a4f] border-[#1b4332]", text:"text-white", mapBg:"#f0fdf4", mapBorder:"#86efac", mapText:"#14532d", mapSubText:"#15803d", mapPaxColor:"#166534", dotColor:"#22c55e" },
  occupied: { label:"OCCUPIED", labelVi:"Chưa dọn", cell:"bg-[#d4a017] border-[#a37c00]", text:"text-white", mapBg:"#fffbeb", mapBorder:"#fcd34d", mapText:"#78350f", mapSubText:"#92400e", mapPaxColor:"#92400e", dotColor:"#f59e0b" },
  dirty:    { label:"DIRTY",    labelVi:"Chờ dọn",  cell:"bg-[#c1121f] border-[#8b0000]", text:"text-white", mapBg:"#fff1f2", mapBorder:"#fca5a5", mapText:"#7f1d1d", mapSubText:"#991b1b", mapPaxColor:"#991b1b", dotColor:"#ef4444" },
};
const BOOKING_COLOR: Record<BookingStatus,{bg:string;border:string;text:string;label:string}> = {
  definite:  { bg:"#3b82f6", border:"#1d4ed8", text:"#fff", label:"Definite"   },
  tentative: { bg:"#f97316", border:"#c2410c", text:"#fff", label:"Tentative"  },
  group:     { bg:"#22c55e", border:"#15803d", text:"#fff", label:"Group"      },
  checkedIn: { bg:"#8b5cf6", border:"#6d28d9", text:"#fff", label:"Checked In" },
  waitlist:  { bg:"#94a3b8", border:"#64748b", text:"#fff", label:"Waitlist"   },
};
const PRIORITY_CONFIG: Record<TaskPriority,{label:string;color:string;bg:string;icon:React.ElementType}> = {
  urgent: { label:"Khẩn",        color:"#c1121f", bg:"#fff1f2", icon:AlertCircle },
  normal: { label:"Bình thường", color:"#374151", bg:"#f3f4f6", icon:Clock       },
  info:   { label:"Thông tin",   color:"#1d4ed8", bg:"#eff6ff", icon:CheckCircle },
};

const COL_W=48,ROW_H=32,LABEL_W=128;
const ALL_ROOM_TYPES=["ALL","PRETM","PREPM","AVTFM","SUPTN","SUPDN","DLXTC","DLXDDC","PREKM","PREMDM","AVTDM"];
const MENU_ITEMS: Array<{name:TabName;icon:React.ElementType}> = [
  {name:"Tổng quan",icon:Home},{name:"Tìm kiếm",icon:Search},{name:"Sơ đồ phòng",icon:LayoutGrid},
  {name:"Room Plan",icon:CalendarDays},{name:"Đặt phòng",icon:BedDouble},{name:"Báo cáo",icon:ClipboardList},
  {name:"Thu ngân",icon:DollarSign},{name:"Room Availability",icon:CalendarDays},
];
const WAITING_CUSTOMERS: WaitingCustomer[] = [
  {id:1,folio:"10254",name:"NGUYỄN HUY",roomType:"VIP",checkIn:"01/05/2026",checkOut:"05/05/2026"},
  {id:2,folio:"10255",name:"TRẦN THỊ QUYÊN",roomType:"DELUXE",checkIn:"02/05/2026",checkOut:"04/05/2026"},
];
const TODAY_STATS={checkInToday:15,checkOutToday:8,totalRooms:105,available:45,occupied:30,dirty:10};
const HOTEL_ROOM_TYPES=["PIRETM","PREPM","AVITFM","SUPTN","SUPDN","DLXTC","DLXDDC","PRETM","PREKM","PREMDM","AVTDM","AVTFM"];
const CASHIER_FUNCTIONS=["Post Transaction","Cancel Check Out","Group Check Out","Exchange","List Bills Printed","View Transaction","Money Card","Cancel/Noshow Charge","A Currency Conversion","C Group Transactions","D Reports","F Post To Guest Dummy","X Back"];
const ROOM_TYPES_AVAILABILITY=[
  {description:"Avanti Terrace",type:"AVTDM",total:2,available:[1,1,2,0,1,1,2,2,2,1],definite:[1,1,0,2,1,1,0,0,0,1]},
  {description:"Avanti Family Mark",type:"AVTFM",total:5,available:[3,4,4,4,3,3,4,4,5,3],definite:[2,1,1,1,2,2,1,1,0,2]},
  {description:"Premier King Mark",type:"PREKM",total:2,available:[2,1,0,0,0,0,0,1,1,1],definite:[0,1,2,2,2,2,2,1,1,1]},
  {description:"Premier Double M",type:"PREDM",total:6,available:[0,3,1,0,0,0,1,1,1,4],definite:[6,3,5,6,6,6,5,5,5,2]},
  {description:"Premier Tripple M",type:"PREPM",total:5,available:[2,0,2,2,2,2,1,1,2,3],definite:[3,5,3,3,3,3,4,4,3,2]},
  {description:"Premier Twin Mark",type:"PRETM",total:4,available:[0,3,3,3,2,0,2,3,4,4],definite:[4,1,1,1,2,4,2,1,0,0]},
  {description:"Deluxe Twin City",type:"DLXTC",total:12,available:[1,1,1,1,1,0,0,0,8,2],definite:[11,11,11,11,11,12,12,12,4,10]},
  {description:"Deluxe Double City",type:"DLXDDC",total:32,available:[0,0,3,12,12,12,13,18,21,15],definite:[32,32,29,20,20,20,19,14,11,17]},
  {description:"Superior Double N",type:"SUPDN",total:20,available:[6,5,11,3,0,3,0,8,13,11],definite:[14,15,9,17,21,17,21,12,7,9]},
  {description:"Superior Twin No",type:"SUPTN",total:5,available:[3,1,0,3,1,5,1,0,0,0],definite:[2,4,5,2,4,0,4,5,5,6]},
  {description:"ALLOTMENT",type:"ALM",total:0,available:[0,0,0,0,1,1,1,1,0,0],definite:[0,0,0,0,0,0,0,0,0,0]},
];
const NOTES_STATIC={ooi:Array(10).fill(0),phu:Array(10).fill(0),availableRms:Array(10).fill(93),ooo:[3,2,1,2,1,1,1,1,1,1],saleableRms:[90,91,92,91,92,92,92,92,92,92],fitArrival:[36,25,17,32,19,7,10,10,2,15],gitArrival:[2,4,14,0,4,0,5,8,9,0]};
const SAMPLE_GUESTS: Guest[]=[
  {name:"XUAN THANH",folio:"247417",arrival:"01/05/2026",departure:"02/05/2026",rate:985000,balance:0,pax:2,plan:"POA ALL/NO BF."},
  {name:"NGUYEN HUY",folio:"247418",arrival:"01/05/2026",departure:"05/05/2026",rate:1200000,balance:500000,pax:1,plan:"BB"},
  {name:"TRAN THI QUYEN",folio:"247419",arrival:"02/05/2026",departure:"04/05/2026",rate:850000,balance:0,pax:2,plan:"RO"},
  {name:"LE VAN ANH",folio:"247420",arrival:"01/05/2026",departure:"03/05/2026",rate:1500000,balance:0,pax:3,plan:"HB"},
  {name:"PHAM MINH TU",folio:"247421",arrival:"01/05/2026",departure:"06/05/2026",rate:750000,balance:200000,pax:1,plan:"BB"},
  {name:"HOANG THI LAN",folio:"247422",arrival:"02/05/2026",departure:"03/05/2026",rate:900000,balance:0,pax:2,plan:"RO"},
  {name:"VU QUOC HUNG",folio:"247423",arrival:"01/05/2026",departure:"07/05/2026",rate:1100000,balance:0,pax:2,plan:"BB"},
  {name:"DO THI HIEN",folio:"247424",arrival:"03/05/2026",departure:"05/05/2026",rate:680000,balance:0,pax:1,plan:"RO"},
];
const MOCK_REPORTS: ShiftReport[]=[
  {id:"SR001",date:"11/05/2026",shift:"Ca sáng",reporter:"NGUYỄN THỊ HOA",handoverTo:"TRẦN VĂN MINH",confirmedBy:"TRẦN VĂN MINH",confirmedAt:"14:05",status:"confirmed",cashBalance:12500000,incidentNote:"",generalNote:"Ca sáng suôn sẻ, khách đoàn Nhật check-out hài lòng.",
    pendingArrivals:[{folio:"247430",name:"YAMAMOTO KENJI",roomType:"DLXTC",eta:"15:00",pax:2,note:"Yêu cầu tầng cao"},{folio:"247431",name:"PARK JI-WOO",roomType:"SUPDN",eta:"16:30",pax:1,note:"Early check-in nếu được"}],
    tasks:[{id:"T1",content:"Phòng 305 vòi sen bị yếu — đã báo kỹ thuật, chờ xử lý",priority:"urgent",done:false},{id:"T2",content:"Khách phòng 208 gửi hành lý, lấy lúc 18:00",priority:"normal",done:false},{id:"T3",content:"Đoàn 15 khách Hàn Quốc check-in lúc 14:00, cần hỗ trợ dẫn phòng",priority:"urgent",done:false},{id:"T4",content:"Minibar phòng 412 đã được bổ sung",priority:"info",done:true}]},
  {id:"SR002",date:"10/05/2026",shift:"Ca tối",reporter:"LÊ HOÀNG ANH",handoverTo:"NGUYỄN THỊ HOA",confirmedBy:"NGUYỄN THỊ HOA",confirmedAt:"07:12",status:"confirmed",cashBalance:8200000,incidentNote:"Khách phòng 511 phàn nàn tiếng ồn từ phòng bên — đã xử lý.",generalNote:"Ca tối yên tĩnh, không có sự cố lớn.",pendingArrivals:[],tasks:[{id:"T5",content:"Khách phòng 101 yêu cầu thêm chăn — đã cung cấp",priority:"info",done:true}]},
];

const PLAN_ROOMS: PlanRoom[]=[
  {id:101,type:"PRETM",floor:1},{id:102,type:"PREPM",floor:1},{id:103,type:"AVTFM",floor:1},{id:104,type:"SUPTN",floor:1},{id:105,type:"SUPDN",floor:1},{id:106,type:"SUPDN",floor:1},{id:107,type:"SUPDN",floor:1},{id:108,type:"SUPDN",floor:1},{id:109,type:"SUPTN",floor:1},
  {id:201,type:"PREDM",floor:2},{id:202,type:"PREPM",floor:2},{id:203,type:"AVTFM",floor:2},{id:204,type:"SUPTN",floor:2},{id:205,type:"SUPDN",floor:2},{id:206,type:"SUPDN",floor:2},{id:207,type:"SUPDN",floor:2},{id:208,type:"SUPDN",floor:2},{id:209,type:"SUPTN",floor:2},{id:210,type:"SUPTN",floor:2},{id:211,type:"SUPDN",floor:2},{id:212,type:"SUPDN",floor:2},
  {id:301,type:"PREDM",floor:3},{id:302,type:"PREPM",floor:3},{id:303,type:"AVTFM",floor:3},{id:304,type:"SUPDN",floor:3},{id:305,type:"SUPDN",floor:3},{id:306,type:"DLXTC",floor:3},{id:307,type:"DLXDDC",floor:3},{id:308,type:"PRETM",floor:3},{id:309,type:"PREKM",floor:3},{id:310,type:"SUPTN",floor:3},{id:311,type:"SUPDN",floor:3},{id:312,type:"SUPDN",floor:3},
  {id:401,type:"PREDM",floor:4},{id:402,type:"PREPM",floor:4},{id:403,type:"AVTFM",floor:4},{id:404,type:"SUPTN",floor:4},{id:405,type:"SUPDN",floor:4},{id:406,type:"DLXTC",floor:4},{id:407,type:"DLXDDC",floor:4},{id:408,type:"PRETM",floor:4},{id:409,type:"PREKM",floor:4},{id:410,type:"PREMDM",floor:4},{id:411,type:"AVTDM",floor:4},{id:412,type:"AVTFM",floor:4},
  {id:501,type:"PRETM",floor:5},{id:502,type:"PREPM",floor:5},{id:503,type:"AVTFM",floor:5},{id:504,type:"SUPTN",floor:5},{id:505,type:"SUPDN",floor:5},{id:506,type:"DLXTC",floor:5},{id:507,type:"DLXDDC",floor:5},{id:508,type:"PRETM",floor:5},{id:509,type:"PREKM",floor:5},{id:510,type:"PREMDM",floor:5},{id:511,type:"AVTDM",floor:5},{id:512,type:"SUPDN",floor:5},
  {id:601,type:"PREDM",floor:6},{id:602,type:"PREPM",floor:6},{id:603,type:"AVTFM",floor:6},{id:604,type:"SUPTN",floor:6},{id:605,type:"SUPDN",floor:6},{id:606,type:"DLXTC",floor:6},{id:607,type:"DLXDDC",floor:6},{id:608,type:"PRETM",floor:6},{id:609,type:"PREKM",floor:6},{id:610,type:"SUPDN",floor:6},{id:611,type:"SUPDN",floor:6},{id:612,type:"SUPTN",floor:6},
  {id:701,type:"PRETM",floor:7},{id:702,type:"AVTDM",floor:7},{id:703,type:"AVTDM",floor:7},{id:704,type:"DLXTC",floor:7},{id:705,type:"DLXDDC",floor:7},{id:706,type:"DLXDDC",floor:7},{id:707,type:"DLXDDC",floor:7},{id:708,type:"DLXTC",floor:7},{id:709,type:"DLXTC",floor:7},{id:710,type:"DLXTC",floor:7},{id:711,type:"DLXDDC",floor:7},{id:712,type:"SUPDN",floor:7},
  {id:801,type:"PRETM",floor:8},{id:802,type:"PREDM",floor:8},{id:803,type:"PREKM",floor:8},{id:804,type:"DLXDDC",floor:8},{id:805,type:"DLXDDC",floor:8},{id:806,type:"DLXDDC",floor:8},{id:807,type:"DLXDDC",floor:8},{id:808,type:"DLXDDC",floor:8},{id:809,type:"DLXTC",floor:8},{id:810,type:"DLXTC",floor:8},{id:811,type:"DLXDDC",floor:8},{id:812,type:"SUPDN",floor:8},
  {id:901,type:"PRETM",floor:9},{id:902,type:"PREDM",floor:9},{id:903,type:"PREKM",floor:9},{id:904,type:"DLXTC",floor:9},{id:905,type:"DLXDDC",floor:9},{id:906,type:"DLXDDC",floor:9},{id:907,type:"DLXDDC",floor:9},{id:908,type:"DLXDDC",floor:9},{id:909,type:"DLXTC",floor:9},{id:910,type:"DLXTC",floor:9},{id:911,type:"DLXDDC",floor:9},{id:912,type:"SUPDN",floor:9},
];

const ARRIVAL_TODAY_DATA: ArrivalRow[]=[
  {sts:"IH",stt:2,folio:"248813",conf:"1089831",title:"MR",name:"PHAM NHAT MUON",rate:850000,vip:false,rm:105,type:"SUPDN",booked:"SUPDN",arrival:"11/05/2026",departure:"13/05/2026",adtCh:"2/0",shr:false,company:"WALKIN",sales:"225015",bkSts:"Definite",nat:"VNM"},
  {sts:"IH",stt:2,folio:"248813",conf:"",title:"MS",name:"VU THI THU TAM",rate:0,vip:false,rm:105,type:"",booked:"",arrival:"11/05/2026",departure:"13/05/2026",adtCh:"",shr:false,company:"",sales:"225016",bkSts:"",nat:"VNM"},
  {sts:"IH",stt:2,folio:"248706",conf:"1089766",title:"MR",name:"NGUYEN VAN MANH",rate:1500000,vip:false,rm:302,type:"PREPM",booked:"PREPM",arrival:"11/05/2026",departure:"12/05/2026",adtCh:"1/0",shr:false,company:"SHB BANK",sales:"224856",bkSts:"Definite",nat:"VNM"},
  {sts:"IH",stt:2,folio:"248703",conf:"1089766",title:"MRS",name:"VU THI NGUYET ANH",rate:1900000,vip:false,rm:303,type:"AVTFM",booked:"AVTFM",arrival:"11/05/2026",departure:"12/05/2026",adtCh:"1/0",shr:false,company:"SHB BANK",sales:"224853",bkSts:"Definite",nat:"VNM"},
  {sts:"IH",stt:2,folio:"248675",conf:"1089747",title:"MRS",name:"PHAM THI YEN",rate:1080000,vip:false,rm:308,type:"DLXTC",booked:"DLXTC",arrival:"11/05/2026",departure:"13/05/2026",adtCh:"1/0",shr:false,company:"CTY DU LICH HONG NGC",sales:"224823",bkSts:"Definite",nat:"VNM"},
  {sts:"IH",stt:2,folio:"248659",conf:"1089747",title:"MR",name:"DO HUY HOANG",rate:1080000,vip:false,rm:310,type:"DLXTC",booked:"DLXTC",arrival:"11/05/2026",departure:"13/05/2026",adtCh:"2/0",shr:false,company:"CTY DU LICH HONG NGC",sales:"224789",bkSts:"Definite",nat:"VNM"},
  {sts:"IH",stt:2,folio:"248660",conf:"1089747",title:"MR",name:"TRAN VIET THANG",rate:1080000,vip:false,rm:311,type:"DLXTC",booked:"DLXTC",arrival:"11/05/2026",departure:"13/05/2026",adtCh:"1/0",shr:false,company:"CTY DU LICH HONG NGC",sales:"224791",bkSts:"Definite",nat:"VNM"},
  {sts:"IH",stt:2,folio:"246021",conf:"1088383",title:"MRS",name:"NICHELLE AMELIA DARMAWAN",rate:1847115,vip:false,rm:502,type:"PREPM",booked:"PREPM",arrival:"11/05/2026",departure:"13/05/2026",adtCh:"3/0",shr:false,company:"TRAVELOKA",sales:"220662",bkSts:"Definite",nat:"IDN"},
  {sts:"IH",stt:2,folio:"248811",conf:"1089829",title:"MR",name:"JEFFREY LAURENCE JACKEL",rate:1080000,vip:false,rm:509,type:"DLXTC",booked:"DLXTC",arrival:"11/05/2026",departure:"13/05/2026",adtCh:"2/0",shr:false,company:"VIETNAM TRAVEL GROU",sales:"225012",bkSts:"Definite",nat:"AUS"},
  {sts:"IH",stt:2,folio:"248033",conf:"1089381",title:"MR",name:"ANG YU YUAN",rate:1200000,vip:false,rm:605,type:"DLXTC",booked:"DLXTC",arrival:"11/05/2026",departure:"15/05/2026",adtCh:"1/0",shr:false,company:"Matsui Solutions VN",sales:"223743",bkSts:"Definite",nat:"SGP"},
  {sts:"IH",stt:2,folio:"247796",conf:"1089823",title:"MRS",name:"NGUYEN THI VUI",rate:760000,vip:false,rm:912,type:"SUPDN",booked:"SUPDN",arrival:"11/05/2026",departure:"12/05/2026",adtCh:"1/0",shr:false,company:"AGODA B",sales:"224988",bkSts:"Definite",nat:"VNM"},
];
const CHECKOUT_TODAY_DATA: ArrivalRow[]=[
  {sts:"CO",stt:2,folio:"248706",conf:"1089766",title:"MR",name:"NGUYEN VAN MANH",rate:1500000,vip:false,rm:302,type:"PREPM",booked:"PREPM",arrival:"11/05/2026",departure:"14/05/2026",adtCh:"1/0",shr:false,company:"SHB BANK",sales:"224856",bkSts:"CheckedIn",nat:"VNM"},
  {sts:"CO",stt:2,folio:"248703",conf:"1089766",title:"MRS",name:"VU THI NGUYET ANH",rate:1900000,vip:false,rm:303,type:"AVTFM",booked:"AVTFM",arrival:"11/05/2026",departure:"14/05/2026",adtCh:"1/0",shr:false,company:"SHB BANK",sales:"224853",bkSts:"CheckedIn",nat:"VNM"},
  {sts:"CO",stt:2,folio:"248675",conf:"1089747",title:"MRS",name:"PHAM THI YEN",rate:1080000,vip:false,rm:308,type:"DLXTC",booked:"DLXTC",arrival:"12/05/2026",departure:"14/05/2026",adtCh:"1/0",shr:false,company:"CTY DU LICH HONG NGC",sales:"224823",bkSts:"CheckedIn",nat:"VNM"},
  {sts:"CO",stt:2,folio:"248659",conf:"1089747",title:"MR",name:"DO HUY HOANG",rate:1080000,vip:false,rm:310,type:"DLXTC",booked:"DLXTC",arrival:"12/05/2026",departure:"14/05/2026",adtCh:"2/0",shr:false,company:"CTY DU LICH HONG NGC",sales:"224789",bkSts:"CheckedIn",nat:"VNM"},
  {sts:"CO",stt:2,folio:"246021",conf:"1088383",title:"MRS",name:"NICHELLE AMELIA DARMAWAN",rate:1847115,vip:false,rm:502,type:"PREPM",booked:"PREPM",arrival:"10/05/2026",departure:"14/05/2026",adtCh:"3/0",shr:false,company:"TRAVELOKA",sales:"220662",bkSts:"CheckedIn",nat:"IDN"},
  {sts:"CO",stt:2,folio:"248811",conf:"1089829",title:"MR",name:"JEFFREY LAURENCE JACKEL",rate:1080000,vip:false,rm:509,type:"DLXTC",booked:"DLXTC",arrival:"11/05/2026",departure:"14/05/2026",adtCh:"2/0",shr:false,company:"VIETNAM TRAVEL GROU",sales:"225012",bkSts:"CheckedIn",nat:"AUS"},
  {sts:"CO",stt:2,folio:"248033",conf:"1089381",title:"MR",name:"ANG YU YUAN",rate:1200000,vip:false,rm:605,type:"DLXTC",booked:"DLXTC",arrival:"11/05/2026",departure:"14/05/2026",adtCh:"1/0",shr:false,company:"Matsui Solutions VN",sales:"223743",bkSts:"CheckedIn",nat:"SGP"},
  {sts:"CO",stt:2,folio:"247796",conf:"1089823",title:"MRS",name:"NGUYEN THI VUI",rate:760000,vip:false,rm:912,type:"SUPDN",booked:"SUPDN",arrival:"11/05/2026",departure:"14/05/2026",adtCh:"1/0",shr:false,company:"AGODA B",sales:"224988",bkSts:"CheckedIn",nat:"VNM"},
];

const AVAILABLE_ROOMS: Record<string,number[]>={
  "SUPDN":[205,206,207,208,304,305,311,312,405,610,611,712,812,912],
  "SUPTN":[104,109,204,209,210,310,404,604,612],
  "DLXTC":[106,306,406,506,606,704,708,709,710,809,810,904,909,910],
  "DLXDDC":[107,307,407,507,607,705,706,707,711,804,805,806,807,808,811,905,906,907,908,911],
  "PREPM":[102,202,302,402,502,602],
  "PREDM":[201,301,401,601,802,902],
  "PRETM":[101,308,408,501,508,601,608,701,801,901],
  "PREKM":[109,309,409,509,609,803,903],
  "AVTFM":[103,203,303,403,503,603],
  "AVTDM":[211,411,511,702,703],
  "PREMDM":[210,410,510],
};
const COUNTRIES=[
  {code:"JP",name:"Japan",flag:"🇯🇵"},{code:"KR",name:"South Korea",flag:"🇰🇷"},{code:"CN",name:"China",flag:"🇨🇳"},{code:"US",name:"United States",flag:"🇺🇸"},
  {code:"GB",name:"United Kingdom",flag:"🇬🇧"},{code:"FR",name:"France",flag:"🇫🇷"},{code:"DE",name:"Germany",flag:"🇩🇪"},{code:"AU",name:"Australia",flag:"🇦🇺"},
  {code:"SG",name:"Singapore",flag:"🇸🇬"},{code:"TH",name:"Thailand",flag:"🇹🇭"},{code:"MY",name:"Malaysia",flag:"🇲🇾"},{code:"IN",name:"India",flag:"🇮🇳"},
  {code:"TW",name:"Taiwan",flag:"🇹🇼"},{code:"HK",name:"Hong Kong",flag:"🇭🇰"},{code:"RU",name:"Russia",flag:"🇷🇺"},{code:"IT",name:"Italy",flag:"🇮🇹"},
  {code:"ES",name:"Spain",flag:"🇪🇸"},{code:"CA",name:"Canada",flag:"🇨🇦"},{code:"OTHER",name:"Other",flag:"🌐"},
];
const VISA_TYPES=["E-visa (30 ngày)","Visa on Arrival","Visa exempt (15 ngày)","Visa exempt (45 ngày)","Diplomatic visa","Business visa","Tourist visa"];
const PROPERTIES=[{id:"avanti",name:"Avanti Hotel",rooms:105,stars:4},{id:"boutique",name:"Boutique Saigon",rooms:42,stars:3},{id:"resort",name:"Avanti Resort",rooms:78,stars:5}];

// ─── HELPERS ───
function makeSeedBookings(): Booking[] {
  const statuses: BookingStatus[]=["definite","tentative","group","checkedIn","waitlist"];
  const names=["Soprapol,","Phattranan N.","Maximillian ANG,","YOKOTA/K,","Tetsuya Tokuoka,","CO MYLAM","Bui Thi Minh","XUAN THANH","CHE LAL","HAN DUL","Dilhani Rupika","Che Yee Khoo,","Brenda,","Samantha Quek,","VU DINH DUC,","Fadhl Muhammad","MR.TAN/CH","HANG VO,","Mindy Nguyen,","Tanaka H.","Kim Ji-woo","Wang Fang","Smith J.","Müller K.","Dupont M."];
  const bookings: Booking[]=[];let bid=1;
  PLAN_ROOMS.forEach((room,ri)=>{const count=(ri*3+7)%3+1;let cursor=(ri*5)%8;for(let b=0;b<count;b++){const nights=((ri+b)*4+2)%8+1;if(cursor+nights>30)break;bookings.push({id:`B${bid++}`,guestName:names[(ri+b*3)%names.length],folio:`${240000+bid}`,roomId:room.id,startDay:cursor,nights,status:statuses[(ri+b)%statuses.length],pax:(b%3)+1});cursor+=nights+((ri+b)%3);}});
  return bookings;
}
function buildDates(start:Date,count:number):Date[]{return Array.from({length:count},(_,i)=>{const d=new Date(start);d.setDate(d.getDate()+i);return d;});}
function isWeekend(d:Date){return d.getDay()===0||d.getDay()===6;}
function availBg(val:number){if(val<0)return "bg-[#fde8e8] text-[#c1121f]";if(val===0)return "bg-[#fff8e1] text-[#7a5800]";return "text-[#1a1a1a]";}
function getRoomStatus(id:number):RoomStatus{const s=(id*7+13)%10;if(s<4)return "occupied";if(s<7)return "clean";return "dirty";}
function buildFloors(){return Array.from({length:9},(_,fi)=>{const fn=fi+1,count=fn===1?9:12;return{name:`Tầng ${fn}`,rooms:Array.from({length:count},(_,ri)=>{const id=fn*100+ri+1,status=getRoomStatus(id),pax=status==="occupied"?((id*3+1)%3)+1:0;return{id,status,roomType:HOTEL_ROOM_TYPES[ri%HOTEL_ROOM_TYPES.length],pax,guest:status==="occupied"?{...SAMPLE_GUESTS[id%SAMPLE_GUESTS.length],pax}:undefined};})};});}

// ─── MICRO COMPONENTS ───
function StatusDot({status}:{status:RoomStatus}){return <span className="inline-block rounded-full shrink-0" style={{width:8,height:8,backgroundColor:ROOM_STATUS[status].dotColor,boxShadow:"0 0 0 1.5px rgba(0,0,0,0.12)"}}/>;}
function WalkIcon({color}:{color:string}){return <svg width={10} height={10} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="4" r="2.5" fill={color}/><path d="M12 7 L10 14 L8 20" stroke={color} strokeWidth="2.2" strokeLinecap="round"/><path d="M12 7 L14 14 L16 20" stroke={color} strokeWidth="2.2" strokeLinecap="round"/><path d="M10 10 L7 13" stroke={color} strokeWidth="2.2" strokeLinecap="round"/><path d="M14 10 L17 13" stroke={color} strokeWidth="2.2" strokeLinecap="round"/></svg>;}
function GuestTooltip({guest,roomType,x}:{guest:Guest;roomType:string;x:number}){
  const TIP_W=270,left=Math.max(208-x+8,-(TIP_W/2)),arrowLeft=Math.min(Math.max(TIP_W/2+left-8,12),TIP_W-20);
  return <div className="absolute z-50 top-full mt-2 pointer-events-none" style={{minWidth:TIP_W,left:"50%",transform:`translateX(${left}px)`}}>
    <div className="absolute -top-1.5 w-3 h-3 rotate-45" style={{left:arrowLeft,background:"#fffef0",borderLeft:"1px solid #d4c87a",borderTop:"1px solid #d4c87a"}}/>
    <div className="text-[12px] text-[#1a1a1a] p-3 rounded-[2px] shadow-2xl" style={{background:"#fffef0",border:"1px solid #d4c87a"}}>
      <div className="space-y-0.5 pb-2 mb-2" style={{borderBottom:"1px solid #e8dfa0"}}>
        <div className="flex flex-wrap gap-x-3 font-semibold"><span><span className="text-[#9ca3af]">Folio: </span><span className="mono font-bold">{guest.folio}</span></span><span><span className="text-[#9ca3af]">RmType: </span><span className="mono font-bold">{roomType}</span></span></div>
        <div className="flex flex-wrap gap-x-3"><span><span className="text-[#9ca3af]">Rate: </span><span className="mono font-bold">{guest.rate.toLocaleString()}NETT</span></span><span><span className="text-[#9ca3af]">Balance: </span><span className={`mono font-bold ${guest.balance>0?"text-[#c1121f]":""}`}>{guest.balance}</span></span></div>
        <div className="flex flex-wrap gap-x-3 text-[#9ca3af]"><span>Arrival: <span className="mono text-[#374151] font-semibold">{guest.arrival}</span></span><span>Departure: <span className="mono text-[#374151] font-semibold">{guest.departure}</span></span></div>
      </div>
      <div className="font-bold text-[13px]">+ {guest.name}</div>
      <div className="text-[#9ca3af] mt-1 text-[11px]" style={{borderTop:"1px dashed #d4c87a",paddingTop:4}}>{guest.plan}</div>
    </div>
  </div>;
}

function HotelCell({room,selected,onClick}:{room:HotelRoom;selected:boolean;onClick:()=>void}){
  const [hover,setHover]=useState(false);const [tipX,setTipX]=useState(0);const cfg=ROOM_STATUS[room.status];
  return <div className="relative" onMouseEnter={e=>{setHover(true);setTipX(e.currentTarget.getBoundingClientRect().left+48);}} onMouseLeave={()=>setHover(false)}>
    <div onClick={onClick} className={`cursor-pointer select-none transition-all duration-150 ${selected?"ring-2 ring-[#0f0f0e] ring-offset-1 z-20 relative shadow-lg scale-[1.03]":"hover:shadow-lg hover:z-10 relative hover:-translate-y-0.5"}`}
      style={{width:96,minHeight:68,background:cfg.mapBg,border:`1.5px solid ${hover||selected?"#374151":cfg.mapBorder}`,borderRadius:3}}>
      <div className="flex items-center justify-between px-1.5 pt-1.5 pb-0.5">
        <StatusDot status={room.status}/>
        {room.pax>0&&<div className="flex items-center gap-0.5">{Array.from({length:Math.min(room.pax,3)}).map((_,i)=><WalkIcon key={i} color={cfg.mapPaxColor}/>)}<span className="mono text-[11px] font-bold ml-0.5" style={{color:cfg.mapPaxColor}}>{room.pax}</span></div>}
      </div>
      <div className="px-1.5 pb-1.5"><div className="mono font-bold text-[14px] leading-tight" style={{color:cfg.mapText}}>{room.id}</div><div className="text-[10px] font-bold tracking-wide uppercase leading-tight" style={{color:cfg.mapSubText}}>{room.roomType}</div></div>
    </div>
    {hover&&room.guest&&<GuestTooltip guest={room.guest} roomType={room.roomType} x={tipX}/>}
  </div>;
}

function BlockCell({room,selected,onClick}:{room:HotelRoom;selected:boolean;onClick:()=>void}){
  const [hover,setHover]=useState(false);const [tipX,setTipX]=useState(0);const cfg=ROOM_STATUS[room.status];
  return <div className="relative" onMouseEnter={e=>{setHover(true);setTipX(e.currentTarget.getBoundingClientRect().left+26);}} onMouseLeave={()=>setHover(false)}>
    <div onClick={onClick} className={`cursor-pointer border rounded-[3px] flex flex-col items-center justify-center transition-all duration-150 text-white ${cfg.cell} ${selected?"ring-2 ring-[#0f0f0e] ring-offset-1 z-20 scale-110 shadow-xl":"hover:scale-[1.1] hover:shadow-lg hover:z-10 relative"}`} style={{width:52,height:44}}>
      {room.pax>0&&<div className="absolute top-0.5 right-0.5 flex items-center gap-0.5"><WalkIcon color="rgba(255,255,255,0.85)"/><span className="mono text-[9px] font-bold">{room.pax}</span></div>}
      <span className="mono text-[11px] font-bold leading-tight">{room.id}</span>
      <span className="text-[8px] font-bold opacity-80 uppercase tracking-wide leading-tight">{room.roomType}</span>
    </div>
    {hover&&room.guest&&<GuestTooltip guest={room.guest} roomType={room.roomType} x={tipX}/>}
  </div>;
}

// ─── SHARED UI ───
function SectionTitle({children}:{children:React.ReactNode}){return <h3 className="text-[11px] font-bold tracking-[0.14em] uppercase text-[#6b7280] mb-4 flex items-center gap-2"><span className="w-4 h-px bg-[#d1d5db] inline-block"/>{children}</h3>;}
function Card({children,className=""}:{children:React.ReactNode;className?:string}){return <div className={`bg-white border border-[#e5e7eb] rounded-[3px] shadow-[0_2px_6px_rgba(0,0,0,0.07)] ${className}`}>{children}</div>;}
function FieldRow({label,children}:{label:string;children:React.ReactNode}){return <div className="grid grid-cols-5 items-center gap-3"><label className="col-span-2 text-[12px] text-[#6b7280] font-semibold">{label}</label><div className="col-span-3">{children}</div></div>;}
const inputCls="w-full border border-[#e5e7eb] rounded-[3px] px-3 py-2 text-[13px] font-semibold outline-none focus:border-[#6b7280] focus:ring-2 focus:ring-[#6b7280]/10 transition-all bg-[#fafafa]";
const selectCls="w-full border border-[#e5e7eb] rounded-[3px] px-3 py-2 text-[13px] font-semibold outline-none focus:border-[#6b7280] focus:ring-2 focus:ring-[#6b7280]/10 transition-all bg-[#fafafa]";

function RateTable({nights,roomType}:{nights:number;roomType:string}){
  const base=850000;
  const rows=Array.from({length:nights},(_,i)=>{const d=new Date(2026,4,10+i);return{date:d.toLocaleDateString("en-GB",{day:"2-digit",month:"2-digit"}),type:roomType,code:"RACK",rate:base};});
  return <div>
    <table className="w-full text-left border-collapse text-[13px]">
      <thead><tr className="border-b border-[#f3f4f6] bg-[#fafafa]">{["Ngày","Loại phòng","Rate code","Đơn giá","Thành tiền"].map(h=><th key={h} className="px-3 py-2 text-[10px] tracking-[0.1em] uppercase text-[#6b7280] font-bold">{h}</th>)}</tr></thead>
      <tbody className="divide-y divide-[#f9f9f7]">{rows.map((r,i)=><tr key={i} className="hover:bg-[#fafafa]"><td className="px-3 py-2 mono font-semibold">{r.date}</td><td className="px-3 py-2 text-[#6b7280] font-semibold">{r.type}</td><td className="px-3 py-2 mono text-[#9ca3af] font-semibold">{r.code}</td><td className="px-3 py-2 mono font-bold">{r.rate.toLocaleString()}</td><td className="px-3 py-2 mono font-bold">{r.rate.toLocaleString()}</td></tr>)}</tbody>
    </table>
    <div className="flex justify-between items-center px-3 py-2.5 border-t border-[#e5e7eb] bg-[#fafafa]">
      <span className="text-[12px] text-[#6b7280] uppercase tracking-wide font-bold">Tổng tiền phòng</span>
      <span className="mono font-bold text-[14px]">{(base*nights).toLocaleString()} VND</span>
    </div>
  </div>;
}

function SortTh({col,label,className="",sortCol,sortAsc,onSort}:{col:keyof ArrivalRow;label:string;className?:string;sortCol:keyof ArrivalRow;sortAsc:boolean;onSort:(col:keyof ArrivalRow)=>void;}){
  return <th onClick={()=>onSort(col)} className={`px-2 py-2.5 text-[10px] tracking-[0.1em] uppercase text-[#6b7280] font-bold cursor-pointer hover:text-[#1a1a1a] select-none whitespace-nowrap transition-colors ${className}`}>
    {label}{sortCol===col?<span className="ml-0.5 text-[#0f0f0e]">{sortAsc?"↑":"↓"}</span>:<span className="ml-0.5 opacity-0">↑</span>}
  </th>;
}

function SidebarProperty(){
  const [open,setOpen]=useState(false);const [selected,setSelected]=useState(PROPERTIES[0]);
  return <div className="border-b border-[#252523]">
    <button onClick={()=>setOpen(o=>!o)} className="w-full flex items-center justify-between px-5 py-4 hover:bg-[#1c1c1a] transition-colors group">
      <div className="text-left"><div className="text-[9px] tracking-[0.2em] text-[#5c5c58] uppercase mb-0.5 font-bold">Property Management</div><div className="text-[15px] font-bold tracking-tight text-white leading-tight">{selected.name}</div><div className="mono text-[11px] text-[#5c5c58] mt-0.5 font-semibold">{selected.rooms} phòng · {"★".repeat(selected.stars)}</div></div>
      <ChevronRight size={13} strokeWidth={2} className="text-[#3a3a38] group-hover:text-[#7a7a75] transition-all shrink-0" style={{transform:open?"rotate(90deg)":"rotate(0deg)",transition:"transform 0.15s"}}/>
    </button>
    {open&&<div className="border-t border-[#1c1c1a]">
      {PROPERTIES.map(p=><button key={p.id} onClick={()=>{setSelected(p);setOpen(false);}} className={`w-full flex items-center justify-between px-5 py-3 text-left transition-colors hover:bg-[#1c1c1a] ${selected.id===p.id?"bg-[#1c1c1a]":""}`}><div><div className={`text-[13px] font-bold ${selected.id===p.id?"text-white":"text-[#7a7a75]"}`}>{p.name}</div><div className="mono text-[10px] text-[#3a3a38] font-semibold">{p.rooms} phòng</div></div>{selected.id===p.id&&<span className="w-1.5 h-1.5 rounded-full bg-white shrink-0"/>}</button>)}
      <div className="px-5 py-2 border-t border-[#1c1c1a]"><div className="mono text-[11px] text-[#3a3a38] font-semibold">{new Date().toLocaleDateString("en-GB",{weekday:"short",day:"2-digit",month:"short",year:"numeric"})}</div></div>
    </div>}
    {!open&&<div className="px-5 pb-3"><div className="mono text-[11px] text-[#5c5c58] font-semibold">{new Date().toLocaleDateString("en-GB",{weekday:"short",day:"2-digit",month:"short",year:"numeric"})}</div></div>}
  </div>;
}

// ─── RESERVATION FORMS ───
function VietnameseForm(){
  return <div className="grid grid-cols-2 gap-x-8 gap-y-3">
    <div className="space-y-3">
      <SectionTitle>Thông tin khách Việt Nam</SectionTitle>
      {[{label:"Họ và tên",ph:"NGUYỄN VĂN A"},{label:"Số CMND / CCCD",ph:"0xx xxxx xxxx"},{label:"Nơi cấp",ph:"Công an TP. HCM"},{label:"Số điện thoại",ph:"09xx xxx xxx"},{label:"Email",ph:""},{label:"Địa chỉ thường trú",ph:"Quận, TP..."},{label:"Công ty / TA",ph:""}].map(({label,ph})=><FieldRow key={label} label={label}><input className={inputCls} placeholder={ph}/></FieldRow>)}
      <FieldRow label="Ngày cấp"><input type="date" className={inputCls}/></FieldRow>
      <FieldRow label="Ngày sinh"><input type="date" className={inputCls}/></FieldRow>
      <FieldRow label="Giới tính"><select className={selectCls}><option>Nam</option><option>Nữ</option></select></FieldRow>
    </div>
    <div className="space-y-3">
      <SectionTitle>Chi tiết đặt phòng</SectionTitle>
      <FieldRow label="Loại phòng"><select className={selectCls}><option>SUPDN — Superior Double</option><option>DLXTC — Deluxe Twin City</option><option>PRETM — Premier Twin</option><option>AVTFM — Avanti Family</option></select></FieldRow>
      <FieldRow label="Số phòng"><select className={selectCls}><option>Auto assign</option><option>205</option><option>206</option><option>311</option></select></FieldRow>
      <FieldRow label="Check-in"><input type="date" className={inputCls} defaultValue="2026-05-10"/></FieldRow>
      <FieldRow label="Check-out"><input type="date" className={inputCls} defaultValue="2026-05-13"/></FieldRow>
      <FieldRow label="Số đêm"><input className={inputCls} defaultValue="3"/></FieldRow>
      <FieldRow label="Số khách"><input className={inputCls} defaultValue="2"/></FieldRow>
      <FieldRow label="Meal Plan"><select className={selectCls}><option>RO — Room Only</option><option>BB — Bed &amp; Breakfast</option><option>HB — Half Board</option><option>FB — Full Board</option></select></FieldRow>
      <FieldRow label="Trạng thái"><select className={selectCls}><option>Definite</option><option>Tentative</option><option>Waitlist</option></select></FieldRow>
      <FieldRow label="Hình thức TT"><select className={selectCls}><option>Tiền mặt</option><option>Chuyển khoản</option><option>Thẻ tín dụng</option><option>Công nợ (AR)</option></select></FieldRow>
      <FieldRow label="Đặt cọc"><input className={inputCls} placeholder="0 VND"/></FieldRow>
      <FieldRow label="Nguồn"><select className={selectCls}><option>Direct</option><option>Booking.com</option><option>Agoda</option><option>Walk-in</option></select></FieldRow>
      <FieldRow label="Ghi chú"><textarea className="w-full border border-[#e5e7eb] rounded-[3px] px-3 py-2 text-[13px] font-semibold outline-none focus:border-[#6b7280] bg-[#fafafa] resize-none h-16" placeholder="Yêu cầu đặc biệt..."/></FieldRow>
    </div>
  </div>;
}

function ForeignForm(){
  const [country,setCountry]=useState(COUNTRIES[0]);
  return <div className="grid grid-cols-2 gap-x-8 gap-y-3">
    <div className="space-y-3">
      <SectionTitle>Foreign Guest Information</SectionTitle>
      <div className="grid grid-cols-5 items-start gap-3">
        <label className="col-span-2 text-[12px] text-[#6b7280] font-semibold mt-2">Nationality</label>
        <div className="col-span-3 space-y-2">
          <select className={selectCls} value={country.code} onChange={e=>{const c=COUNTRIES.find(c=>c.code===e.target.value);if(c)setCountry(c);}}>
            {COUNTRIES.map(c=><option key={c.code} value={c.code}>{c.flag} {c.name}</option>)}
          </select>
          <div className="flex items-center gap-2 px-3 py-2 bg-[#fafafa] border border-[#e5e7eb] rounded-[3px]">
            <span style={{fontSize:20}}>{country.flag}</span>
            <div><div className="text-[13px] font-bold">{country.name}</div><div className="mono text-[11px] text-[#9ca3af] font-semibold">{country.code}</div></div>
          </div>
        </div>
      </div>
      {[{label:"Last Name",ph:"TANAKA"},{label:"First Name",ph:"Hiroshi"},{label:"Passport No.",ph:"TK1234567"},{label:"Phone",ph:"+81 xxx xxxx xxxx"},{label:"Email",ph:""}].map(({label,ph})=><FieldRow key={label} label={label}><input className={inputCls} placeholder={ph}/></FieldRow>)}
      <FieldRow label="Passport Expiry"><input type="date" className={inputCls}/></FieldRow>
      <FieldRow label="Date of Birth"><input type="date" className={inputCls}/></FieldRow>
      <FieldRow label="Gender"><select className={selectCls}><option>Male</option><option>Female</option><option>Other</option></select></FieldRow>
      <div className="pt-2"><SectionTitle>Khai báo tạm trú (PC06)</SectionTitle>
        <div className="space-y-3">
          <FieldRow label="Visa Type"><select className={selectCls}>{VISA_TYPES.map(v=><option key={v}>{v}</option>)}</select></FieldRow>
          <FieldRow label="Visa No."><input className={inputCls}/></FieldRow>
          <FieldRow label="Visa Issued At"><input className={inputCls} placeholder="Embassy Hanoi..."/></FieldRow>
          <FieldRow label="Port of Entry"><select className={selectCls}><option>Tân Sơn Nhất (SGN)</option><option>Nội Bài (HAN)</option><option>Đà Nẵng (DAD)</option></select></FieldRow>
          <FieldRow label="Visa Expiry"><input type="date" className={inputCls}/></FieldRow>
          <FieldRow label="Entry Date"><input type="date" className={inputCls}/></FieldRow>
        </div>
      </div>
    </div>
    <div className="space-y-3">
      <SectionTitle>Booking Details</SectionTitle>
      <FieldRow label="Room Type"><select className={selectCls}><option>SUPDN — Superior Double</option><option>DLXTC — Deluxe Twin City</option><option>PRETM — Premier Twin</option></select></FieldRow>
      <FieldRow label="Room No."><select className={selectCls}><option>Auto assign</option><option>205</option><option>206</option></select></FieldRow>
      <FieldRow label="Check-in"><input type="date" className={inputCls} defaultValue="2026-05-10"/></FieldRow>
      <FieldRow label="Check-out"><input type="date" className={inputCls} defaultValue="2026-05-13"/></FieldRow>
      <FieldRow label="Nights"><input className={inputCls} defaultValue="3"/></FieldRow>
      <FieldRow label="Pax"><input className={inputCls} defaultValue="2"/></FieldRow>
      <FieldRow label="Meal Plan"><select className={selectCls}><option>RO — Room Only</option><option>BB — Bed &amp; Breakfast</option><option>HB — Half Board</option></select></FieldRow>
      <FieldRow label="Status"><select className={selectCls}><option>Definite</option><option>Tentative</option><option>Waitlist</option></select></FieldRow>
      <FieldRow label="Payment"><select className={selectCls}><option>Cash (USD)</option><option>Cash (VND)</option><option>Credit Card</option><option>Bank Transfer</option><option>AR — Công nợ</option></select></FieldRow>
      <FieldRow label="Currency"><select className={selectCls}><option>VND</option><option>USD</option><option>JPY</option><option>EUR</option><option>SGD</option></select></FieldRow>
      <FieldRow label="Deposit"><input className={inputCls} placeholder="0"/></FieldRow>
      <FieldRow label="Source"><select className={selectCls}><option>Direct</option><option>Booking.com</option><option>Agoda</option><option>Expedia</option><option>Travel Agent</option></select></FieldRow>
      <FieldRow label="Language"><select className={selectCls}><option>English</option><option>日本語</option><option>한국어</option><option>中文</option></select></FieldRow>
      <FieldRow label="Special Request"><textarea className="w-full border border-[#e5e7eb] rounded-[3px] px-3 py-2 text-[13px] font-semibold outline-none focus:border-[#6b7280] bg-[#fafafa] resize-none h-16" placeholder="Non-smoking, high floor..."/></FieldRow>
    </div>
  </div>;
}

function RoomAssign({initType,initRm,onChange}:{initType:string;initRm:number;onChange:(rm:string,type:string)=>void}){
  const [assignedType,setAssignedType]=useState(initType||"SUPDN");
  const [assignedRoom,setAssignedRoom]=useState(initRm?String(initRm):"");
  const needsRoom=!initRm||initRm===0;
  const roomsForType=AVAILABLE_ROOMS[assignedType]||[];
  return <div className={`bg-white border rounded-[3px] shadow-[0_2px_6px_rgba(0,0,0,0.07)] p-6 ${needsRoom&&!assignedRoom?"border-[#fcd34d]":"border-[#86efac]"}`}>
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-[11px] font-bold tracking-[0.14em] uppercase text-[#6b7280] flex items-center gap-2"><span className="w-4 h-px bg-[#d1d5db] inline-block"/>Gắn phòng</h3>
      {needsRoom&&!assignedRoom&&<span className="text-[11px] px-2 py-0.5 rounded-[2px] font-bold bg-[#fff8e1] text-[#7a5800] border border-[#fcd34d]">⚠ Chưa có phòng</span>}
      {(assignedRoom||!needsRoom)&&<span className="text-[11px] px-2 py-0.5 rounded-[2px] font-bold bg-[#f0fdf4] text-[#15803d] border border-[#86efac]">✓ Phòng {assignedRoom||initRm}</span>}
    </div>
    <div className="grid grid-cols-2 gap-x-8 gap-y-3">
      <FieldRow label="Loại phòng"><select className={selectCls} value={assignedType} onChange={e=>{setAssignedType(e.target.value);setAssignedRoom("");onChange("",e.target.value);}}>{Object.keys(AVAILABLE_ROOMS).map(t=><option key={t} value={t}>{t}</option>)}</select></FieldRow>
      <FieldRow label="Số phòng"><select className={selectCls} value={assignedRoom} onChange={e=>{setAssignedRoom(e.target.value);onChange(e.target.value,assignedType);}}><option value="">— Chọn phòng trống —</option>{roomsForType.map(r=><option key={r} value={String(r)}>Phòng {r}</option>)}</select></FieldRow>
      {assignedRoom&&<><FieldRow label="Tầng"><input className={inputCls} readOnly value={`Tầng ${assignedRoom[0]}`}/></FieldRow><FieldRow label="Trạng thái"><div className="flex items-center gap-2 px-3 py-2 bg-[#f0fdf4] border border-[#86efac] rounded-[3px]"><span className="inline-block w-2 h-2 rounded-full bg-[#22c55e]"/><span className="text-[13px] text-[#15803d] font-bold">Sạch — Sẵn sàng</span></div></FieldRow></>}
    </div>
  </div>;
}

function ReservationRoomAssign(){
  const [source,setSource]=useState("Direct");
  const [assignedType,setAssignedType]=useState("SUPDN");
  const [assignedRoom,setAssignedRoom]=useState("");
  const [confirmed,setConfirmed]=useState(false);
  const isWalkIn=source==="Walk-in"||source==="Direct";
  return <Card className={`p-6 ${isWalkIn?"border-[#fcd34d]":"border-[#e5e7eb]"}`}>
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-[11px] font-bold tracking-[0.14em] uppercase text-[#6b7280] flex items-center gap-2"><span className="w-4 h-px bg-[#d1d5db] inline-block"/>Nguồn đặt phòng & Gắn phòng</h3>
      {isWalkIn&&!confirmed&&<span className="text-[11px] px-2 py-0.5 rounded-[2px] font-bold bg-[#fff8e1] text-[#7a5800] border border-[#fcd34d]">⚠ Walk-in / Direct — nên gắn phòng ngay</span>}
      {confirmed&&<span className="flex items-center gap-1.5 text-[12px] font-bold text-[#2d6a4f]"><CheckCircle size={13} strokeWidth={1.5}/> Đã gắn phòng {assignedRoom} · {assignedType}</span>}
    </div>
    <div className="grid grid-cols-2 gap-x-8 gap-y-3">
      <FieldRow label="Nguồn đặt phòng"><select className={selectCls} value={source} onChange={e=>{setSource(e.target.value);setConfirmed(false);}}>{["Direct","Walk-in","Booking.com","Agoda","Expedia","Travel Agent","OTA khác"].map(s=><option key={s}>{s}</option>)}</select></FieldRow>
      {isWalkIn&&<><FieldRow label="Loại phòng"><select className={selectCls} value={assignedType} onChange={e=>{setAssignedType(e.target.value);setAssignedRoom("");setConfirmed(false);}}>{Object.keys(AVAILABLE_ROOMS).map(t=><option key={t} value={t}>{t}</option>)}</select></FieldRow><FieldRow label="Số phòng"><select className={selectCls} value={assignedRoom} onChange={e=>{setAssignedRoom(e.target.value);setConfirmed(false);}}><option value="">— Chọn phòng trống —</option>{(AVAILABLE_ROOMS[assignedType]||[]).map(r=><option key={r} value={String(r)}>Phòng {r}</option>)}</select></FieldRow></>}
    </div>
    {isWalkIn&&<div className="flex items-center justify-end pt-4 border-t border-[#f3f4f6] mt-3">{confirmed?<span className="flex items-center gap-1.5 text-[12px] font-bold text-[#2d6a4f]"><CheckCircle size={13} strokeWidth={1.5}/> Đã xác nhận phòng {assignedRoom||"(chưa chọn)"}</span>:<button onClick={()=>{if(assignedRoom)setConfirmed(true);else alert("Vui lòng chọn số phòng trước");}} className="pms-btn-primary">✓ OK — Xác nhận gắn phòng</button>}</div>}
  </Card>;
}

function ReservationTab(){
  const [guestType,setGuestType]=useState<GuestType>("vietnamese");
  return <div className="p-7 max-w-6xl mx-auto">
    <div className="flex items-center justify-between mb-5">
      <div><h2 className="text-[16px] font-bold text-[#1a1a1a]">Đặt phòng mới</h2><div className="text-[12px] text-[#9ca3af] mt-0.5 mono font-semibold">New Reservation</div></div>
      <div className="flex border border-[#e5e7eb] rounded-[3px] overflow-hidden shadow-sm">
        <button onClick={()=>setGuestType("vietnamese")} className={`flex items-center gap-2 px-5 py-2.5 text-[13px] font-bold transition-all border-r border-[#e5e7eb] ${guestType==="vietnamese"?"bg-[#0f0f0e] text-white":"bg-white text-[#6b7280] hover:bg-[#f9f9f7]"}`}><span style={{fontSize:16}}>🇻🇳</span> Khách Việt Nam</button>
        <button onClick={()=>setGuestType("foreign")} className={`flex items-center gap-2 px-5 py-2.5 text-[13px] font-bold transition-all ${guestType==="foreign"?"bg-[#0f0f0e] text-white":"bg-white text-[#6b7280] hover:bg-[#f9f9f7]"}`}><Globe size={15} strokeWidth={1.5}/> Foreign Guest</button>
      </div>
    </div>
    <Card className="p-6 mb-4">{guestType==="vietnamese"?<VietnameseForm/>:<ForeignForm/>}</Card>
    <Card className="mb-4"><div className="px-6 py-4 border-b border-[#f3f4f6]"><SectionTitle>Rate &amp; Folio</SectionTitle></div><RateTable nights={3} roomType="SUPDN"/></Card>
    <ReservationRoomAssign/>
    <div className="flex items-center gap-2 flex-wrap mt-4">
      <button className="pms-btn-primary">Lưu — Definite</button>
      <button className="pms-btn-secondary">Lưu — Tentative</button>
      <button className="pms-btn-secondary">Group Booking</button>
      <div className="w-px h-5 bg-[#e5e7eb] mx-1"/>
      {guestType==="foreign"&&<button className="pms-btn-secondary flex items-center gap-1.5"><Download size={13} strokeWidth={1.5}/> Xuất PC06</button>}
      <button className="pms-btn-secondary flex items-center gap-1.5"><Printer size={13} strokeWidth={1.5}/> In xác nhận</button>
      <button className="pms-btn-secondary">Gửi email</button>
      <div className="flex-1"/>
      <button className="px-5 py-2.5 border border-[#e5e7eb] rounded-[3px] text-[13px] font-bold text-[#9ca3af] hover:text-[#c1121f] hover:border-[#fca5a5] transition-all duration-150">Hủy</button>
    </div>
  </div>;
}

// ─── SHIFT REPORT TAB ───
function ShiftReportTab(){
  const [view,setView]=useState<"new"|"history">("new");
  const [selectedReport,setSelectedReport]=useState<ShiftReport|null>(null);
  const [reporter,setReporter]=useState("NGUYỄN THỊ HOA");
  const [handoverTo,setHandoverTo]=useState("");
  const [shift,setShift]=useState<ShiftName>("Ca chiều");
  const [cashBalance,setCashBalance]=useState("");
  const [generalNote,setGeneralNote]=useState("");
  const [incidentNote,setIncidentNote]=useState("");
  const [tasks,setTasks]=useState<ShiftTask[]>([{id:"t1",content:"",priority:"normal",done:false}]);
  const [submitted,setSubmitted]=useState(false);
  const addTask=()=>setTasks(prev=>[...prev,{id:`t${Date.now()}`,content:"",priority:"normal",done:false}]);
  const removeTask=(id:string)=>setTasks(prev=>prev.filter(t=>t.id!==id));
  const updateTask=(id:string,patch:Partial<ShiftTask>)=>setTasks(prev=>prev.map(t=>t.id===id?{...t,...patch}:t));
  const statusBadge=(status:ShiftReport["status"])=>{
    if(status==="confirmed")return <span className="px-2 py-0.5 text-[11px] font-bold rounded-[2px] bg-[#f0fdf4] text-[#15803d] border border-[#86efac]">✓ Đã xác nhận</span>;
    if(status==="submitted")return <span className="px-2 py-0.5 text-[11px] font-bold rounded-[2px] bg-[#fff8e1] text-[#7a5800] border border-[#fcd34d]">⏳ Chờ xác nhận</span>;
    return <span className="px-2 py-0.5 text-[11px] font-bold rounded-[2px] bg-[#f3f4f6] text-[#6b7280] border border-[#e5e7eb]">Nháp</span>;
  };
  if(view==="history"&&!selectedReport) return(
    <div className="p-7 max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div><h2 className="text-[16px] font-bold">Lịch sử báo cáo giao ca</h2><div className="mono text-[12px] text-[#9ca3af] mt-0.5 font-semibold">Shift Handover History</div></div>
        <div className="flex border border-[#e5e7eb] rounded-[3px] overflow-hidden shadow-sm">
          <button onClick={()=>setView("new")} className="px-4 py-2 text-[13px] font-bold border-r border-[#e5e7eb] bg-white text-[#6b7280] hover:bg-[#f9f9f7] transition-colors">+ Tạo báo cáo</button>
          <button onClick={()=>setView("history")} className="px-4 py-2 text-[13px] font-bold bg-[#0f0f0e] text-white">Lịch sử</button>
        </div>
      </div>
      <Card className="overflow-hidden">
        <table className="w-full text-left">
          <thead><tr className="border-b border-[#f3f4f6] bg-[#fafafa]">{["Ngày","Ca","Người bàn giao","Người nhận","Tồn quỹ","Trạng thái",""].map(h=><th key={h} className="px-5 py-3 text-[10px] tracking-[0.12em] uppercase text-[#6b7280] font-bold">{h}</th>)}</tr></thead>
          <tbody>{MOCK_REPORTS.map(r=><tr key={r.id} className="border-b border-[#f9f9f7] hover:bg-[#fafafa] transition-colors cursor-pointer" onClick={()=>setSelectedReport(r)}>
            <td className="px-5 py-3 mono text-[13px] font-semibold text-[#9ca3af]">{r.date}</td>
            <td className="px-5 py-3 text-[13px] font-bold">{r.shift}</td>
            <td className="px-5 py-3 text-[13px] font-semibold">{r.reporter}</td>
            <td className="px-5 py-3 text-[13px] font-semibold text-[#6b7280]">{r.handoverTo}</td>
            <td className="px-5 py-3 mono text-[13px] font-bold">{r.cashBalance.toLocaleString()} ₫</td>
            <td className="px-5 py-3">{statusBadge(r.status)}</td>
            <td className="px-5 py-3 text-right"><button className="text-[12px] font-bold text-[#9ca3af] hover:text-[#1a1a1a]">Xem →</button></td>
          </tr>)}</tbody>
        </table>
      </Card>
    </div>
  );
  if(view==="history"&&selectedReport){const r=selectedReport;return(
    <div className="p-7 max-w-4xl mx-auto space-y-4">
      <button onClick={()=>setSelectedReport(null)} className="flex items-center gap-1.5 text-[13px] text-[#9ca3af] hover:text-[#1a1a1a] font-bold transition-colors"><ChevronLeft size={13} strokeWidth={1.5}/> Quay lại lịch sử</button>
      <div className="flex items-center justify-between"><div><h2 className="text-[16px] font-bold">Báo cáo giao ca — {r.shift}</h2><div className="mono text-[12px] text-[#9ca3af] mt-0.5 font-semibold">{r.date}</div></div>{statusBadge(r.status)}</div>
      <Card className="p-5"><div className="grid grid-cols-3 gap-4">{[["Người bàn giao",r.reporter],["Người nhận ca",r.handoverTo],["Tồn quỹ",r.cashBalance.toLocaleString()+" ₫"],["Ca làm việc",r.shift],["Xác nhận bởi",r.confirmedBy||"—"],["Giờ xác nhận",r.confirmedAt||"—"]].map(([label,val])=><div key={label}><div className="text-[10px] text-[#9ca3af] uppercase tracking-wide mb-0.5 font-bold">{label}</div><div className="font-bold mono text-[13px]">{val}</div></div>)}</div></Card>
      {r.pendingArrivals.length>0&&<Card className="overflow-hidden">
        <div className="px-5 py-3 border-b border-[#f3f4f6]"><SectionTitle>Khách chưa tới — {r.pendingArrivals.length} đặt phòng</SectionTitle></div>
        <table className="w-full text-left text-[13px]"><thead><tr className="border-b border-[#f3f4f6] bg-[#fafafa]">{["Folio","Tên khách","Loại phòng","ETA","Khách","Ghi chú"].map(h=><th key={h} className="px-4 py-2.5 text-[10px] tracking-[0.1em] uppercase text-[#6b7280] font-bold">{h}</th>)}</tr></thead>
          <tbody>{r.pendingArrivals.map((a,i)=><tr key={i} className="border-b border-[#f9f9f7] hover:bg-[#fafafa]"><td className="px-4 py-3 mono text-[#9ca3af] font-semibold">{a.folio}</td><td className="px-4 py-3 font-bold">{a.name}</td><td className="px-4 py-3"><span className="mono text-[11px] px-2 py-0.5 bg-[#f3f4f6] rounded-[2px] font-bold">{a.roomType}</span></td><td className="px-4 py-3 mono font-semibold">{a.eta}</td><td className="px-4 py-3 mono font-semibold">{a.pax}</td><td className="px-4 py-3 text-[#6b7280] font-semibold">{a.note||"—"}</td></tr>)}</tbody>
        </table>
      </Card>}
      <Card className="p-5"><SectionTitle>Việc cần xử lý — {r.tasks.filter(t=>!t.done).length} còn lại</SectionTitle>
        <div className="space-y-2">{r.tasks.map(t=>{const cfg=PRIORITY_CONFIG[t.priority];const Icon=cfg.icon;return<div key={t.id} className="flex items-start gap-3 p-3 rounded-[2px]" style={{background:t.done?"#fafafa":cfg.bg,opacity:t.done?0.6:1}}><Icon size={14} strokeWidth={1.5} style={{color:cfg.color,marginTop:1,flexShrink:0}}/><span className={`text-[13px] flex-1 font-semibold ${t.done?"line-through text-[#9ca3af]":""}`}>{t.content}</span><span className="text-[11px] px-1.5 py-0.5 rounded-[2px] font-bold shrink-0" style={{background:cfg.bg,color:cfg.color}}>{cfg.label}</span>{t.done&&<span className="text-[11px] text-[#2d6a4f] shrink-0 font-bold">✓ Xong</span>}</div>;})}</div>
      </Card>
      {(r.generalNote||r.incidentNote)&&<div className="grid grid-cols-2 gap-4">{r.generalNote&&<Card className="p-5"><SectionTitle>Ghi chú chung</SectionTitle><p className="text-[13px] text-[#374151] font-semibold">{r.generalNote}</p></Card>}{r.incidentNote&&<Card className="p-5"><SectionTitle>Sự cố / Phàn nàn</SectionTitle><p className="text-[13px] text-[#c1121f] font-bold">{r.incidentNote}</p></Card>}</div>}
    </div>
  );}
  if(submitted)return(
    <div className="p-7 max-w-4xl mx-auto flex flex-col items-center justify-center" style={{minHeight:400}}>
      <div className="w-14 h-14 rounded-full bg-[#f0fdf4] flex items-center justify-center mb-4 shadow-md"><CheckCircle size={28} className="text-[#2d6a4f]" strokeWidth={1.5}/></div>
      <h2 className="text-[16px] font-bold mb-2">Báo cáo đã gửi thành công!</h2>
      <p className="text-[13px] text-[#9ca3af] mb-5 text-center font-semibold">Ca nhận sẽ thấy báo cáo này khi đăng nhập.<br/>Họ cần xác nhận để hoàn tất bàn giao.</p>
      <div className="flex gap-2"><button onClick={()=>setSubmitted(false)} className="pms-btn-secondary">Tạo báo cáo mới</button><button onClick={()=>{setView("history");setSubmitted(false);}} className="pms-btn-primary">Xem lịch sử</button></div>
    </div>
  );
  return(
    <div className="p-7 max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div><h2 className="text-[16px] font-bold">Báo cáo giao ca</h2><div className="mono text-[12px] text-[#9ca3af] mt-0.5 font-semibold">Shift Handover Report</div></div>
        <div className="flex border border-[#e5e7eb] rounded-[3px] overflow-hidden shadow-sm">
          <button onClick={()=>setView("new")} className="px-4 py-2 text-[13px] font-bold border-r border-[#e5e7eb] bg-[#0f0f0e] text-white">+ Tạo báo cáo</button>
          <button onClick={()=>setView("history")} className="px-4 py-2 text-[13px] font-bold bg-white text-[#6b7280] hover:bg-[#f9f9f7] transition-colors">Lịch sử</button>
        </div>
      </div>
      <Card className="p-5"><SectionTitle>Thông tin ca bàn giao</SectionTitle>
        <div className="grid grid-cols-2 gap-x-8 gap-y-3">
          <FieldRow label="Người bàn giao"><input className={inputCls} value={reporter} onChange={e=>setReporter(e.target.value)}/></FieldRow>
          <FieldRow label="Người nhận ca"><input className={inputCls} value={handoverTo} onChange={e=>setHandoverTo(e.target.value)} placeholder="Tên lễ tân ca sau..."/></FieldRow>
          <FieldRow label="Ca làm việc"><select className={selectCls} value={shift} onChange={e=>setShift(e.target.value as ShiftName)}><option>Ca sáng</option><option>Ca chiều</option><option>Ca tối</option></select></FieldRow>
          <FieldRow label="Ngày"><input type="date" className={inputCls} defaultValue="2026-05-11"/></FieldRow>
          <FieldRow label="Tồn quỹ (₫)"><input className={inputCls} value={cashBalance} onChange={e=>setCashBalance(e.target.value)} placeholder="0" type="number"/></FieldRow>
          <FieldRow label="Giờ bàn giao"><input type="time" className={inputCls} defaultValue="14:00"/></FieldRow>
        </div>
      </Card>
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4"><SectionTitle>Việc cần xử lý cho ca sau</SectionTitle><button onClick={addTask} className="flex items-center gap-1 text-[12px] text-[#6b7280] hover:text-[#1a1a1a] font-bold transition-colors"><Plus size={12} strokeWidth={2}/> Thêm việc</button></div>
        <div className="space-y-2">{tasks.map(t=>{const cfg=PRIORITY_CONFIG[t.priority];return(
          <div key={t.id} className="flex items-center gap-2 p-2.5 rounded-[2px]" style={{background:cfg.bg}}>
            <input type="checkbox" checked={t.done} onChange={e=>updateTask(t.id,{done:e.target.checked})} className="w-3.5 h-3.5 accent-[#0f0f0e] shrink-0"/>
            <input className="flex-1 bg-transparent outline-none text-[13px] font-semibold placeholder:text-[#9ca3af]" placeholder="Mô tả việc cần làm..." value={t.content} onChange={e=>updateTask(t.id,{content:e.target.value})}/>
            <select className="border border-[#e5e7eb] rounded-[2px] px-2 py-1 text-[12px] outline-none bg-white shrink-0 font-bold" value={t.priority} onChange={e=>updateTask(t.id,{priority:e.target.value as TaskPriority})}><option value="urgent">🔴 Khẩn</option><option value="normal">⚪ Bình thường</option><option value="info">🔵 Thông tin</option></select>
            <button onClick={()=>removeTask(t.id)} className="text-[#d1d5db] hover:text-[#c1121f] transition-colors shrink-0"><Trash2 size={13} strokeWidth={1.5}/></button>
          </div>
        );})}</div>
      </Card>
      <div className="grid grid-cols-2 gap-4">
        <Card className="p-5"><SectionTitle>Ghi chú chung</SectionTitle><textarea className="w-full border border-[#e5e7eb] rounded-[3px] px-3 py-2 text-[13px] font-semibold outline-none focus:border-[#6b7280] bg-[#fafafa] resize-none h-24" placeholder="Tình hình ca, khách đặc biệt..." value={generalNote} onChange={e=>setGeneralNote(e.target.value)}/></Card>
        <Card className="p-5"><SectionTitle>Sự cố / Phàn nàn (nếu có)</SectionTitle><textarea className="w-full border border-[#e5e7eb] rounded-[3px] px-3 py-2 text-[13px] font-semibold outline-none focus:border-[#6b7280] bg-[#fafafa] resize-none h-24" placeholder="Ghi lại sự cố, phàn nàn..." value={incidentNote} onChange={e=>setIncidentNote(e.target.value)}/></Card>
      </div>
      <div className="flex items-center gap-3 pt-1">
        <button onClick={()=>setSubmitted(true)} className="pms-btn-primary flex items-center gap-2"><Send size={13} strokeWidth={1.5}/> Gửi báo cáo giao ca</button>
        <button className="pms-btn-secondary">Lưu nháp</button>
        <button className="pms-btn-secondary flex items-center gap-1.5"><Printer size={13} strokeWidth={1.5}/> In báo cáo</button>
        <div className="flex-1"/>
        <span className="text-[12px] text-[#9ca3af] font-semibold">Ca nhận sẽ thấy báo cáo này khi đăng nhập</span>
      </div>
    </div>
  );
}

// ─── FOLIO DETAIL ───
type FolioCharge={id:string;date:string;code:string;desc:string;ref:string;amount:number;type:"debit"|"credit"};
function FolioDetail({row,onClose}:{row:ArrivalRow;onClose:()=>void}){
  const parseDate=(d:string)=>{const [day,month,year]=d.split("/").map(Number);return new Date(year,month-1,day);};
  const nights=Math.max(1,Math.round((parseDate(row.departure).getTime()-parseDate(row.arrival).getTime())/(1000*60*60*24)));
  const [charges,setCharges]=useState<FolioCharge[]>([
    {id:"F001",date:row.arrival,code:"ROOM",desc:"Tiền phòng",ref:row.type,amount:row.rate*nights,type:"debit"},
    {id:"F002",date:row.arrival,code:"TAX",desc:"VAT 8%",ref:"AUTO",amount:Math.round(row.rate*nights*0.08),type:"debit"},
    {id:"F003",date:row.arrival,code:"DEP",desc:"Đặt cọc",ref:"CASH",amount:0,type:"credit"},
  ]);
  const [showPostForm,setShowPostForm]=useState(false);
  const [postDesc,setPostDesc]=useState("");const [postAmount,setPostAmount]=useState("");
  const [postCode,setPostCode]=useState("MISC");const [postType,setPostType]=useState<"debit"|"credit">("debit");
  const totalDebit=charges.filter(c=>c.type==="debit").reduce((s,c)=>s+c.amount,0);
  const totalCredit=charges.filter(c=>c.type==="credit").reduce((s,c)=>s+c.amount,0);
  const balance=totalDebit-totalCredit;
  const today=new Date().toLocaleDateString("en-GB",{day:"2-digit",month:"2-digit",year:"numeric"});
  const handlePost=()=>{if(!postDesc.trim()||!postAmount)return;setCharges(prev=>[...prev,{id:"F"+Date.now(),date:today,code:postCode,desc:postDesc,ref:"MANUAL",amount:Number(postAmount),type:postType}]);setPostDesc("");setPostAmount("");setShowPostForm(false);};
  return(
    <div className="fixed inset-0 z-50 bg-[#f2f2ef] flex flex-col" style={{fontFamily:"'DM Sans',sans-serif"}}>
      <style>{`.mono{font-family:'DM Mono',monospace;font-weight:600;}`}</style>
      <div className="bg-white border-b border-[#e5e7eb] flex items-center justify-between px-7 shrink-0 sticky top-0 z-10" style={{height:56}}>
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="flex items-center gap-1.5 text-[13px] text-[#9ca3af] hover:text-[#1a1a1a] font-bold transition-colors"><ChevronLeft size={13} strokeWidth={1.5}/> Quay lại</button>
          <span className="text-[#e5e7eb]">|</span>
          <span className="text-[13px] font-bold text-[#1a1a1a]">{row.name} — Folio #{row.folio}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`mono text-[13px] font-bold px-3 py-1 rounded-[3px] border ${balance>0?"bg-[#fff1f2] text-[#c1121f] border-[#fca5a5]":"bg-[#f0fdf4] text-[#15803d] border-[#86efac]"}`}>Balance: {balance.toLocaleString()} ₫</span>
          <button onClick={()=>setShowPostForm(true)} className="pms-btn-secondary flex items-center gap-1.5"><Plus size={12} strokeWidth={2}/> Post Charge</button>
          <button className="pms-btn-secondary flex items-center gap-1.5"><Printer size={12} strokeWidth={1.5}/> In folio</button>
          <button className="pms-btn-secondary flex items-center gap-1.5"><Send size={12} strokeWidth={1.5}/> Gửi email</button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-7">
        <div className="max-w-5xl mx-auto space-y-5">
          <div className="bg-white border border-[#e5e7eb] rounded-[3px] shadow-[0_2px_6px_rgba(0,0,0,0.07)] px-6 py-4 flex items-center gap-8 flex-wrap">
            {[{label:"Khách",value:row.title+" "+row.name},{label:"Folio",value:"#"+row.folio},{label:"Phòng",value:String(row.rm)+" · "+row.type},{label:"Arrival",value:row.arrival},{label:"Departure",value:row.departure},{label:"Số đêm",value:String(nights)},{label:"Nguồn",value:row.company||"Direct"},{label:"NAT",value:row.nat}].map(({label,value})=>(
              <div key={label}><div className="text-[10px] uppercase tracking-[0.12em] text-[#9ca3af] mb-0.5 font-bold">{label}</div><div className="mono text-[13px] font-bold text-[#1a1a1a]">{value}</div></div>
            ))}
          </div>
          {showPostForm&&<div className="bg-white border border-[#fcd34d] rounded-[3px] shadow-[0_2px_6px_rgba(0,0,0,0.07)] p-5">
            <h3 className="text-[11px] font-bold tracking-[0.14em] uppercase text-[#6b7280] mb-4 flex items-center gap-2"><span className="w-4 h-px bg-[#d1d5db] inline-block"/>Post Charge mới</h3>
            <div className="grid grid-cols-2 gap-x-8 gap-y-3">
              <FieldRow label="Mô tả"><input className={inputCls} value={postDesc} onChange={e=>setPostDesc(e.target.value)} placeholder="Minibar, Laundry..."/></FieldRow>
              <FieldRow label="Mã giao dịch"><select className={selectCls} value={postCode} onChange={e=>setPostCode(e.target.value)}>{["ROOM","MINIBAR","LAUNDRY","RESTAURANT","TRANSPORT","SPA","MISC","DEPOSIT","DISCOUNT"].map(c=><option key={c}>{c}</option>)}</select></FieldRow>
              <FieldRow label="Số tiền (₫)"><input className={inputCls} type="number" value={postAmount} onChange={e=>setPostAmount(e.target.value)} placeholder="0"/></FieldRow>
              <FieldRow label="Loại"><div className="flex gap-2">{(["debit","credit"] as const).map(t=><button key={t} onClick={()=>setPostType(t)} className={`flex-1 py-2 rounded-[3px] text-[12px] font-bold border transition-all duration-150 ${postType===t?(t==="debit"?"bg-[#c1121f] text-white border-[#c1121f] shadow-md":"bg-[#2d6a4f] text-white border-[#2d6a4f] shadow-md"):"bg-white border-[#e5e7eb] text-[#6b7280] hover:bg-[#f9f9f7]"}`}>{t==="debit"?"Debit (Phát sinh)":"Credit (Thanh toán)"}</button>)}</div></FieldRow>
            </div>
            <div className="flex items-center justify-end gap-2 mt-4 pt-4 border-t border-[#f3f4f6]">
              <button onClick={()=>setShowPostForm(false)} className="pms-btn-secondary">Hủy</button>
              <button onClick={handlePost} className="pms-btn-primary flex items-center gap-1.5"><Plus size={12} strokeWidth={2}/> Thêm vào folio</button>
            </div>
          </div>}
          <div className="bg-white border border-[#e5e7eb] rounded-[3px] shadow-[0_2px_6px_rgba(0,0,0,0.07)] overflow-hidden">
            <div className="px-5 py-4 border-b border-[#f3f4f6] flex items-center justify-between">
              <h3 className="text-[11px] font-bold tracking-[0.14em] uppercase text-[#6b7280] flex items-center gap-2"><span className="w-4 h-px bg-[#d1d5db] inline-block"/>Chi tiết giao dịch</h3>
              <span className="mono text-[12px] text-[#9ca3af] font-semibold">{charges.length} giao dịch</span>
            </div>
            <table className="w-full text-left">
              <thead><tr className="border-b border-[#f3f4f6] bg-[#fafafa]">{["Ngày","Code","Mô tả","Ref","Debit","Credit",""].map(h=><th key={h} className="px-5 py-2.5 text-[10px] tracking-[0.1em] uppercase text-[#6b7280] font-bold">{h}</th>)}</tr></thead>
              <tbody>{charges.map(c=><tr key={c.id} className="border-b border-[#f9f9f7] hover:bg-[#fafafa] group">
                <td className="px-5 py-3 mono text-[12px] text-[#9ca3af] font-semibold">{c.date}</td>
                <td className="px-5 py-3"><span className="mono text-[11px] px-1.5 py-0.5 bg-[#f3f4f6] rounded-[2px] text-[#374151] font-bold">{c.code}</span></td>
                <td className="px-5 py-3 text-[13px] font-bold">{c.desc}</td>
                <td className="px-5 py-3 mono text-[12px] text-[#9ca3af] font-semibold">{c.ref}</td>
                <td className="px-5 py-3 mono text-[13px] text-right font-bold text-[#c1121f]">{c.type==="debit"?c.amount.toLocaleString():""}</td>
                <td className="px-5 py-3 mono text-[13px] text-right font-bold text-[#2d6a4f]">{c.type==="credit"?c.amount.toLocaleString():""}</td>
                <td className="px-5 py-3 text-right"><button onClick={()=>setCharges(prev=>prev.filter(x=>x.id!==c.id))} className="opacity-0 group-hover:opacity-100 text-[#d1d5db] hover:text-[#c1121f] transition-all"><Trash2 size={13} strokeWidth={1.5}/></button></td>
              </tr>)}</tbody>
            </table>
            <div className="px-5 py-4 border-t-2 border-[#e5e7eb] bg-[#fafafa]">
              <div className="flex justify-end gap-12">
                <div className="text-right"><div className="text-[10px] uppercase tracking-wide text-[#9ca3af] mb-1 font-bold">Total Debit</div><div className="mono font-bold text-[#c1121f] text-[13px]">{totalDebit.toLocaleString()} ₫</div></div>
                <div className="text-right"><div className="text-[10px] uppercase tracking-wide text-[#9ca3af] mb-1 font-bold">Total Credit</div><div className="mono font-bold text-[#2d6a4f] text-[13px]">{totalCredit.toLocaleString()} ₫</div></div>
                <div className="text-right"><div className="text-[10px] uppercase tracking-wide text-[#9ca3af] mb-1 font-bold">Balance</div><div className={`mono font-bold text-[15px] ${balance>0?"text-[#c1121f]":"text-[#2d6a4f]"}`}>{balance.toLocaleString()} ₫</div></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── CHECKOUT PAGE ───
function CheckOutPage({row,onClose,onViewFolio}:{row:ArrivalRow;onClose:()=>void;onViewFolio:()=>void}){
  const [coSaved,setCoSaved]=useState(false);const [payMethod,setPayMethod]=useState("Tiền mặt (VND)");const [discount,setDiscount]=useState(0);
  const parseDate=(d:string)=>{const [day,month,year]=d.split("/").map(Number);return new Date(year,month-1,day);};
  const nights=Math.max(1,Math.round((parseDate(row.departure).getTime()-parseDate(row.arrival).getTime())/(1000*60*60*24)));
  const roomTotal=row.rate*nights;
  const charges=[{label:"Tiền phòng",amount:roomTotal,note:`${nights} đêm × ${row.rate.toLocaleString()} ₫`},{label:"Minibar",amount:0,note:"Không phát sinh"},{label:"Laundry",amount:0,note:"Không phát sinh"},{label:"Restaurant",amount:0,note:"Không phát sinh"},{label:"Dịch vụ khác",amount:0,note:"Không phát sinh"}];
  const subtotal=charges.reduce((s,c)=>s+c.amount,0);
  const discountAmt=Math.round(subtotal*discount/100);const total=subtotal-discountAmt;const VAT=Math.round(total*0.08);const grandTotal=total+VAT;
  if(coSaved)return(
    <div className="fixed inset-0 z-40 bg-[#f2f2ef] flex flex-col items-center justify-center gap-4">
      <div className="w-16 h-16 rounded-full bg-[#fff1f2] flex items-center justify-center shadow-lg"><LogOut size={28} className="text-[#c1121f]" strokeWidth={1.5}/></div>
      <div className="text-center"><div className="text-[16px] font-bold text-[#1a1a1a] mb-1">Check-Out thành công!</div><div className="mono text-[13px] text-[#9ca3af] font-semibold">Phòng {row.rm} · {row.name}</div></div>
      <div className="bg-white border border-[#e5e7eb] rounded-[3px] shadow-[0_2px_8px_rgba(0,0,0,0.1)] px-8 py-5 space-y-2 text-[13px] w-80">
        {[{label:"Folio",value:"#"+row.folio},{label:"Phòng",value:String(row.rm)+" · "+row.type},{label:"Tổng bill",value:grandTotal.toLocaleString()+" ₫"},{label:"Thanh toán",value:payMethod},{label:"Trạng thái",value:"✓ Đã thanh toán"}].map(({label,value})=><div key={label} className="flex justify-between border-b border-[#f3f4f6] pb-2"><span className="text-[#9ca3af] font-semibold">{label}</span><span className="mono font-bold text-[#374151]">{value}</span></div>)}
      </div>
      <div className="flex gap-3 mt-2"><button className="pms-btn-secondary flex items-center gap-1.5"><Printer size={13} strokeWidth={1.5}/> In hóa đơn</button><button onClick={onClose} className="pms-btn-primary">Đóng</button></div>
    </div>
  );
  return(
    <div className="fixed inset-0 z-40 bg-[#f2f2ef] flex flex-col overflow-y-auto">
      <style>{`.mono{font-family:'DM Mono',monospace;font-weight:600;}`}</style>
      <div className="bg-white border-b border-[#e5e7eb] flex items-center justify-between px-7 shrink-0 sticky top-0 z-10" style={{height:56}}>
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="flex items-center gap-1.5 text-[13px] text-[#9ca3af] hover:text-[#1a1a1a] font-bold transition-colors"><ChevronLeft size={13} strokeWidth={1.5}/> Quay lại</button>
          <span className="text-[#e5e7eb]">|</span>
          <span className="text-[13px] font-bold text-[#1a1a1a]">Check-Out — {row.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <button className="pms-btn-secondary flex items-center gap-1.5"><Printer size={12} strokeWidth={1.5}/> In hóa đơn</button>
          <button onClick={()=>setCoSaved(true)} className="pms-btn-danger flex items-center gap-1.5"><LogOut size={12} strokeWidth={1.5}/> Xác nhận Check-Out</button>
        </div>
      </div>
      <div className="p-7 max-w-5xl mx-auto w-full space-y-5">
        <div className="bg-white border border-[#e5e7eb] rounded-[3px] shadow-[0_2px_6px_rgba(0,0,0,0.07)] px-6 py-4 flex items-center gap-8 flex-wrap">
          {[{label:"Phòng",value:String(row.rm)},{label:"Loại",value:row.type},{label:"Arrival",value:row.arrival},{label:"Departure",value:row.departure},{label:"Số đêm",value:String(nights)},{label:"Nguồn",value:row.company||"Direct"}].map(({label,value})=><div key={label}><div className="text-[10px] uppercase tracking-[0.12em] text-[#9ca3af] mb-0.5 font-bold">{label}</div><div className="mono text-[14px] font-bold text-[#1a1a1a]">{value}</div></div>)}
        </div>
        <div className="grid grid-cols-3 gap-5">
          <div className="col-span-2 space-y-4">
            <div className="bg-white border border-[#e5e7eb] rounded-[3px] shadow-[0_2px_6px_rgba(0,0,0,0.07)] overflow-hidden">
              <div className="px-5 py-4 border-b border-[#f3f4f6]"><h3 className="text-[11px] font-bold tracking-[0.14em] uppercase text-[#6b7280] flex items-center gap-2"><span className="w-4 h-px bg-[#d1d5db] inline-block"/>Chi tiết folio</h3></div>
              <table className="w-full text-left"><thead><tr className="border-b border-[#f3f4f6] bg-[#fafafa]">{["Khoản mục","Ghi chú","Thành tiền"].map(h=><th key={h} className="px-5 py-2.5 text-[10px] tracking-[0.1em] uppercase text-[#6b7280] font-bold">{h}</th>)}</tr></thead>
                <tbody>{charges.map((c,i)=><tr key={i} className="border-b border-[#f9f9f7] hover:bg-[#fafafa]"><td className="px-5 py-3 text-[13px] font-bold">{c.label}</td><td className="px-5 py-3 text-[12px] text-[#9ca3af] font-semibold">{c.note}</td><td className="px-5 py-3 mono text-[13px] text-right font-bold">{c.amount>0?c.amount.toLocaleString()+" ₫":"—"}</td></tr>)}</tbody>
              </table>
              <div className="px-5 py-3 border-t-2 border-[#e5e7eb] space-y-2">
                <div className="flex justify-between text-[13px]"><span className="text-[#9ca3af] font-semibold">Tạm tính</span><span className="mono font-bold">{subtotal.toLocaleString()} ₫</span></div>
                <div className="flex justify-between items-center text-[13px]"><span className="text-[#9ca3af] font-semibold">Giảm giá</span>
                  <div className="flex items-center gap-2"><input type="number" min={0} max={100} value={discount} onChange={e=>setDiscount(Number(e.target.value))} className="mono w-14 border border-[#e5e7eb] rounded-[3px] px-2 py-1 text-[13px] font-bold outline-none text-right"/><span className="text-[#9ca3af] font-semibold">%</span><span className="mono text-[#c1121f] font-bold">-{discountAmt.toLocaleString()} ₫</span></div>
                </div>
                <div className="flex justify-between text-[13px]"><span className="text-[#9ca3af] font-semibold">VAT (8%)</span><span className="mono font-bold">{VAT.toLocaleString()} ₫</span></div>
                <div className="flex justify-between text-[15px] pt-2 border-t border-[#e5e7eb]"><span className="font-bold">Tổng thanh toán</span><span className="mono font-bold text-[#2d6a4f]">{grandTotal.toLocaleString()} ₫</span></div>
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <div className="bg-white border border-[#e5e7eb] rounded-[3px] shadow-[0_2px_6px_rgba(0,0,0,0.07)] p-5">
              <h3 className="text-[11px] font-bold tracking-[0.14em] uppercase text-[#6b7280] mb-4 flex items-center gap-2"><span className="w-4 h-px bg-[#d1d5db] inline-block"/>Thanh toán</h3>
              <div className="space-y-3">
                <FieldRow label="Hình thức"><select className={selectCls} value={payMethod} onChange={e=>setPayMethod(e.target.value)}>{["Tiền mặt (VND)","Tiền mặt (USD)","Thẻ tín dụng","Chuyển khoản","Công nợ (AR)"].map(p=><option key={p}>{p}</option>)}</select></FieldRow>
                <FieldRow label="Số tiền nhận"><input className={inputCls} placeholder={grandTotal.toLocaleString()+" ₫"} type="number"/></FieldRow>
                <FieldRow label="Tiền thừa"><input className={inputCls} readOnly value="0 ₫"/></FieldRow>
              </div>
            </div>
            <div className="bg-white border border-[#e5e7eb] rounded-[3px] shadow-[0_2px_6px_rgba(0,0,0,0.07)] p-5">
              <h3 className="text-[11px] font-bold tracking-[0.14em] uppercase text-[#6b7280] mb-3 flex items-center gap-2"><span className="w-4 h-px bg-[#d1d5db] inline-block"/>Tóm tắt</h3>
              <div className="space-y-2 text-[13px]">
                {[{label:"Khách",value:row.name},{label:"Phòng",value:String(row.rm)+" · "+row.type},{label:"Số đêm",value:String(nights)},{label:"Tổng",value:grandTotal.toLocaleString()+" ₫",green:true}].map(({label,value,green})=><div key={label} className="flex justify-between border-b border-[#f3f4f6] pb-1.5"><span className="text-[#9ca3af] font-semibold">{label}</span><span className={`mono font-bold ${green?"text-[#2d6a4f]":"text-[#374151]"}`}>{value}</span></div>)}
              </div>
            </div>
            <div className="space-y-2">
              <button onClick={()=>setCoSaved(true)} className="w-full pms-btn-danger justify-center"><LogOut size={14} strokeWidth={1.5}/> Xác nhận Check-Out</button>
              <button onClick={onViewFolio} className="w-full pms-btn-secondary justify-center"><DollarSign size={13} strokeWidth={1.5}/> Xem & Post Folio</button>
              <button className="w-full pms-btn-secondary justify-center"><Printer size={13} strokeWidth={1.5}/> In hóa đơn</button>
              <button onClick={onClose} className="w-full px-4 py-2.5 border border-[#e5e7eb] rounded-[3px] text-[13px] font-bold text-[#9ca3af] hover:text-[#c1121f] hover:border-[#fca5a5] transition-all duration-150">Hủy</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── SEARCH TAB ───
function SearchTab({onAssignRoom}:{onAssignRoom:()=>void}){
  const [guestInfo,setGuestInfo]=useState("");const [roomInfo,setRoomInfo]=useState("");
  const [inHouse,setInHouse]=useState(false);
  const [arrivalDate,setArrivalDate]=useState(true);const [arrivalFrom,setArrivalFrom]=useState("2026-05-14");const [arrivalTo,setArrivalTo]=useState("2026-05-14");
  const [departureDate,setDepartureDate]=useState(false);const [departureFrom,setDepartureFrom]=useState("2026-05-14");const [departureTo,setDepartureTo]=useState("2026-05-14");
  const [lastName,setLastName]=useState("");const [firstName,setFirstName]=useState("");const [company,setCompany]=useState("");
  const [filterStatuses,setFilterStatuses]=useState({Reserved:true,"In House":true,"Arrival Today":true,"C/O Today":true,Definite:true,Waiting:true});
  const [results,setResults]=useState<ArrivalRow[]|null>(null);const [searched,setSearched]=useState(false);const [searchMode,setSearchMode]=useState<"arrival"|"departure">("arrival");
  const [selectedRow,setSelectedRow]=useState<string|null>(null);const [sortCol,setSortCol]=useState<keyof ArrivalRow>("rm");const [sortAsc,setSortAsc]=useState(true);
  const [checkInRow,setCheckInRow]=useState<ArrivalRow|null>(null);const [checkOutRow,setCheckOutRow]=useState<ArrivalRow|null>(null);const [folioRow,setFolioRow]=useState<ArrivalRow|null>(null);
  const [ciName,setCiName]=useState("");const [ciIdNo,setCiIdNo]=useState("");const [ciPhone,setCiPhone]=useState("");
  const [ciRoom,setCiRoom]=useState("");const [ciRoomType,setCiRoomType]=useState("");const [ciSaved,setCiSaved]=useState(false);
  const [ciErrors,setCiErrors]=useState<string[]>([]);const [ciInfoSaved,setCiInfoSaved]=useState(false);const [ciRoomSaved,setCiRoomSaved]=useState(false);
  const [assignedRooms,setAssignedRooms]=useState<Record<string,{rm:string;type:string}>>({});
  const handleSort=(col:keyof ArrivalRow)=>{if(sortCol===col)setSortAsc(a=>!a);else{setSortCol(col);setSortAsc(true);}};
  const doSearch=(mode:"arrival"|"departure")=>{
    const baseData=mode==="departure"?CHECKOUT_TODAY_DATA:ARRIVAL_TODAY_DATA;
    let rows=[...baseData];const q=(guestInfo+lastName+firstName).toLowerCase().trim();
    if(q)rows=rows.filter(r=>r.name.toLowerCase().includes(q)||r.folio.includes(q));
    if(roomInfo.trim())rows=rows.filter(r=>String(r.rm).includes(roomInfo.trim())||r.type.toLowerCase().includes(roomInfo.toLowerCase()));
    if(company.trim())rows=rows.filter(r=>r.company.toLowerCase().includes(company.toLowerCase()));
    rows.sort((a,b)=>{const av=a[sortCol],bv=b[sortCol];if(typeof av==="number"&&typeof bv==="number")return sortAsc?av-bv:bv-av;return sortAsc?String(av).localeCompare(String(bv)):String(bv).localeCompare(String(av));});
    setSearchMode(mode);setResults(rows);setSearched(true);setSelectedRow(null);
  };
  const handleReset=()=>{setResults(null);setSearched(false);setGuestInfo("");setRoomInfo("");setLastName("");setFirstName("");setCompany("");setSelectedRow(null);};
  const handleCheckInRowOpen=(r:ArrivalRow)=>{setCheckInRow(r);setCiName(r.name);setCiIdNo("");setCiPhone("");setCiRoom(r.rm?String(r.rm):"");setCiRoomType(r.type||"SUPDN");setCiSaved(false);setCiErrors([]);setCiInfoSaved(false);setCiRoomSaved(false);};
  const handleCheckInSave=()=>{const ok=!!ciName.trim()||!!ciIdNo.trim()||!!ciRoom;if(!ok){setCiErrors(["Vui lòng nhập ít nhất một trong ba: Họ tên, CMND/Passport, hoặc Số phòng"]);return;}setCiErrors([]);setCiSaved(true);};
  const natColor=(nat:string)=>{if(nat==="VNM")return "text-[#15803d]";if(nat==="SGP")return "text-[#1d4ed8]";if(nat==="AUS")return "text-[#b45309]";if(nat==="IDN")return "text-[#7c3aed]";return "text-[#374151]";};

  return(
    <div className="p-7 max-w-6xl mx-auto space-y-4">
      {folioRow&&<FolioDetail row={folioRow} onClose={()=>setFolioRow(null)}/>}
      {checkOutRow&&<CheckOutPage row={checkOutRow} onClose={()=>setCheckOutRow(null)} onViewFolio={()=>{setFolioRow(checkOutRow);setCheckOutRow(null);}}/>}
      {checkInRow&&(
        <div className="fixed inset-0 z-40 bg-[#f2f2ef] flex flex-col overflow-y-auto">
          <style>{`.mono{font-family:'DM Mono',monospace;font-weight:600;}`}</style>
          {ciSaved?(
            <div className="flex-1 flex flex-col items-center justify-center gap-4">
              <div className="w-16 h-16 rounded-full bg-[#f0fdf4] flex items-center justify-center shadow-lg"><CheckCircle size={28} className="text-[#2d6a4f]" strokeWidth={1.5}/></div>
              <div className="text-center"><div className="text-[16px] font-bold mb-1">Check-In thành công!</div><div className="mono text-[13px] text-[#9ca3af] font-semibold">Phòng {ciRoom} · {checkInRow.name}</div></div>
              <div className="bg-white border border-[#e5e7eb] rounded-[3px] shadow-[0_2px_8px_rgba(0,0,0,0.1)] px-8 py-5 space-y-2 text-[13px] w-80">
                {[{label:"Folio",value:"#"+checkInRow.folio},{label:"Phòng",value:ciRoom+" · "+ciRoomType},{label:"Arrival",value:checkInRow.arrival},{label:"Departure",value:checkInRow.departure},{label:"Nguồn",value:checkInRow.company||"Direct"}].map(({label,value})=><div key={label} className="flex justify-between border-b border-[#f3f4f6] pb-2"><span className="text-[#9ca3af] font-semibold">{label}</span><span className="mono font-bold text-[#374151]">{value}</span></div>)}
              </div>
              <div className="flex gap-3 mt-2"><button className="pms-btn-secondary flex items-center gap-1.5"><Printer size={13} strokeWidth={1.5}/> In Reg Card</button><button onClick={()=>{setCheckInRow(null);setCiSaved(false);}} className="pms-btn-primary">Đóng</button></div>
            </div>
          ):(
            <>
              <div className="bg-white border-b border-[#e5e7eb] flex items-center justify-between px-7 shrink-0 sticky top-0 z-10" style={{height:56}}>
                <div className="flex items-center gap-3">
                  <button onClick={()=>setCheckInRow(null)} className="flex items-center gap-1.5 text-[13px] text-[#9ca3af] hover:text-[#1a1a1a] font-bold transition-colors"><ChevronLeft size={13} strokeWidth={1.5}/> Quay lại</button>
                  <span className="text-[#e5e7eb]">|</span>
                  <span className="text-[13px] font-bold">Check-In — {checkInRow.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button className="pms-btn-secondary flex items-center gap-1.5"><Printer size={12} strokeWidth={1.5}/> In Reg Card</button>
                  <button className="pms-btn-secondary flex items-center gap-1.5"><Download size={12} strokeWidth={1.5}/> Xuất PC06</button>
                  <button onClick={()=>{setFolioRow(checkInRow);setCheckInRow(null);}} className="pms-btn-secondary flex items-center gap-1.5"><DollarSign size={12} strokeWidth={1.5}/> Xem Folio</button>
                  <button onClick={handleCheckInSave} className="pms-btn-primary">✓ Xác nhận Check-In</button>
                </div>
              </div>
              <div className="p-7 max-w-6xl mx-auto w-full space-y-5">
                <div className="bg-white border border-[#e5e7eb] rounded-[3px] shadow-[0_2px_6px_rgba(0,0,0,0.07)] px-6 py-4 flex items-center gap-8 flex-wrap">
                  {[{label:"Phòng",value:String(checkInRow.rm||"—")},{label:"Loại",value:checkInRow.type||"—"},{label:"Arrival",value:checkInRow.arrival},{label:"Departure",value:checkInRow.departure},{label:"Pax",value:checkInRow.adtCh||"—"},{label:"Rate",value:checkInRow.rate>0?checkInRow.rate.toLocaleString()+" ₫":"—"},{label:"Nguồn",value:checkInRow.company||"Direct"}].map(({label,value})=><div key={label}><div className="text-[10px] uppercase tracking-[0.12em] text-[#9ca3af] mb-0.5 font-bold">{label}</div><div className="mono text-[14px] font-bold text-[#1a1a1a]">{value}</div></div>)}
                </div>
                <div className="grid grid-cols-3 gap-5">
                  <div className="col-span-2 space-y-4">
                    <div className="bg-white border border-[#e5e7eb] rounded-[3px] shadow-[0_2px_6px_rgba(0,0,0,0.07)] p-6">
                      <h3 className="text-[11px] font-bold tracking-[0.14em] uppercase text-[#6b7280] mb-4 flex items-center gap-2"><span className="w-4 h-px bg-[#d1d5db] inline-block"/>Thông tin khách</h3>
                      <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                        <div className="space-y-3">
                          <FieldRow label="Quốc tịch"><select className={selectCls} defaultValue={checkInRow.nat==="VNM"?"VN":"OTHER"}><option value="VN">🇻🇳 Việt Nam</option>{COUNTRIES.map(c=><option key={c.code} value={c.code}>{c.flag} {c.name}</option>)}</select></FieldRow>
                          <FieldRow label="Họ và tên"><input className={inputCls} value={ciName} onChange={e=>setCiName(e.target.value)}/></FieldRow>
                          <FieldRow label="Điện thoại"><input className={inputCls} value={ciPhone} onChange={e=>setCiPhone(e.target.value)} placeholder="09xx xxx xxx"/></FieldRow>
                          <FieldRow label="Email"><input className={inputCls}/></FieldRow>
                        </div>
                        <div className="space-y-3">
                          <FieldRow label="CMND / CCCD / Passport"><input className={inputCls} value={ciIdNo} onChange={e=>setCiIdNo(e.target.value)} placeholder="Số giấy tờ tuỳ thân"/></FieldRow>
                          <FieldRow label="Ngày cấp"><input type="date" className={inputCls}/></FieldRow>
                          <FieldRow label="Địa chỉ"><input className={inputCls} placeholder="Địa chỉ thường trú"/></FieldRow>
                          <FieldRow label="Công ty / TA"><input className={inputCls} defaultValue={checkInRow.company}/></FieldRow>
                        </div>
                      </div>
                      <div className="flex items-center justify-end pt-3 border-t border-[#f3f4f6] mt-3">{ciInfoSaved?<span className="flex items-center gap-1.5 text-[12px] font-bold text-[#2d6a4f]"><CheckCircle size={13} strokeWidth={1.5}/> Đã lưu thông tin</span>:<button onClick={()=>setCiInfoSaved(true)} className="pms-btn-primary">✓ OK — Lưu thông tin</button>}</div>
                    </div>
                    <RoomAssign initType={checkInRow.type||"SUPDN"} initRm={checkInRow.rm||0} onChange={(rm,type)=>{setCiRoom(rm);setCiRoomType(type);setCiRoomSaved(false);}}/>
                    <div className="flex items-center justify-end mt-1">{ciRoomSaved?<span className="flex items-center gap-1.5 text-[12px] font-bold text-[#2d6a4f]"><CheckCircle size={13} strokeWidth={1.5}/> Đã gắn phòng {ciRoom}</span>:<button onClick={()=>{if(ciRoom){setCiRoomSaved(true);setAssignedRooms(prev=>({...prev,[checkInRow.sales]:{rm:ciRoom,type:ciRoomType}}));setResults(prev=>prev?prev.map(r=>r.sales===checkInRow.sales?{...r,rm:Number(ciRoom),type:ciRoomType}:r):prev);}else{alert("Vui lòng chọn số phòng trước");}}} className="pms-btn-primary">✓ OK — Xác nhận phòng</button>}</div>
                    <div className="bg-white border border-[#e5e7eb] rounded-[3px] shadow-[0_2px_6px_rgba(0,0,0,0.07)] p-6"><h3 className="text-[11px] font-bold tracking-[0.14em] uppercase text-[#6b7280] mb-4 flex items-center gap-2"><span className="w-4 h-px bg-[#d1d5db] inline-block"/>Yêu cầu đặc biệt</h3><textarea className="w-full border border-[#e5e7eb] rounded-[3px] px-3 py-2 text-[13px] font-semibold outline-none focus:border-[#6b7280] bg-[#fafafa] resize-none h-20" placeholder="Non-smoking, high floor, extra pillow..."/></div>
                  </div>
                  <div className="space-y-4">
                    <div className="bg-white border border-[#e5e7eb] rounded-[3px] shadow-[0_2px_6px_rgba(0,0,0,0.07)] p-5"><h3 className="text-[11px] font-bold tracking-[0.14em] uppercase text-[#6b7280] mb-4 flex items-center gap-2"><span className="w-4 h-px bg-[#d1d5db] inline-block"/>Tóm tắt folio</h3><RateTable nights={3} roomType={checkInRow.type||"SUPDN"}/></div>
                    <div className="bg-white border border-[#e5e7eb] rounded-[3px] shadow-[0_2px_6px_rgba(0,0,0,0.07)] p-5">
                      <h3 className="text-[11px] font-bold tracking-[0.14em] uppercase text-[#6b7280] mb-4 flex items-center gap-2"><span className="w-4 h-px bg-[#d1d5db] inline-block"/>Thanh toán</h3>
                      <div className="space-y-3">
                        <FieldRow label="Hình thức"><select className={selectCls}><option>Tiền mặt (VND)</option><option>Thẻ tín dụng</option><option>Chuyển khoản</option><option>Công nợ (AR)</option></select></FieldRow>
                        <FieldRow label="Đặt cọc"><input className={inputCls} placeholder="0 ₫" type="number"/></FieldRow>
                        <FieldRow label="Meal Plan"><select className={selectCls}><option>RO — Room Only</option><option>BB — Bed & Breakfast</option><option>HB — Half Board</option></select></FieldRow>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {ciErrors.length>0&&<div className="border border-[#fca5a5] bg-[#fff1f2] rounded-[3px] px-4 py-3 space-y-1">{ciErrors.map((e,i)=><div key={i} className="text-[12px] text-[#c1121f] font-bold flex items-start gap-1.5"><span className="shrink-0 mt-0.5">•</span>{e}</div>)}</div>}
                      <button onClick={handleCheckInSave} className="w-full pms-btn-primary py-3 justify-center text-[13px]">✓ Xác nhận Check-In</button>
                      <button className="w-full pms-btn-secondary justify-center">Lưu nháp</button>
                      <button onClick={()=>setCheckInRow(null)} className="w-full px-4 py-2.5 border border-[#e5e7eb] rounded-[3px] text-[13px] font-bold text-[#9ca3af] hover:text-[#c1121f] hover:border-[#fca5a5] transition-all duration-150">Hủy</button>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div><h2 className="text-[16px] font-bold">Tìm kiếm</h2><div className="mono text-[12px] text-[#9ca3af] mt-0.5 font-semibold">Guest & Reservation Search</div></div>
        <div className="flex gap-2"><button className="pms-btn-secondary">Walk In</button><button className="pms-btn-primary">+ New Reservation</button></div>
      </div>

      <Card className="p-6">
        <SectionTitle>Tìm kiếm khách hàng</SectionTitle>
        <div className="grid grid-cols-2 gap-x-8 mb-4">
          <div className="space-y-2.5">
            <FieldRow label="Thông tin khách"><input className={inputCls} value={guestInfo} onChange={e=>setGuestInfo(e.target.value)} placeholder="Tên, folio..."/></FieldRow>
            <FieldRow label="Số phòng / Loại"><input className={inputCls} value={roomInfo} onChange={e=>setRoomInfo(e.target.value)} placeholder="Số phòng hoặc loại phòng"/></FieldRow>
            <FieldRow label="Mã đoàn"><input className={inputCls}/></FieldRow>
            <FieldRow label="Member ID"><input className={inputCls}/></FieldRow>
          </div>
          <div className="space-y-2.5">
            <FieldRow label="Info 1"><input className={inputCls}/></FieldRow>
            <FieldRow label="Info 2"><input className={inputCls}/></FieldRow>
            <FieldRow label="Info 3"><input className={inputCls}/></FieldRow>
            <FieldRow label="Info 4"><input className={inputCls}/></FieldRow>
          </div>
        </div>
        <div className="flex items-center justify-between pt-4 border-t border-[#f3f4f6]">
          <label className="flex items-center gap-1.5 text-[13px] text-[#6b7280] cursor-pointer font-semibold"><input type="checkbox" checked={inHouse} onChange={e=>setInHouse(e.target.checked)} className="w-3.5 h-3.5 accent-[#0f0f0e]"/> In House</label>
          <div className="flex gap-2"><button onClick={handleReset} className="pms-btn-secondary">Xóa</button><button onClick={()=>doSearch(departureDate?"departure":"arrival")} className="pms-btn-primary flex items-center gap-2"><Search size={12} strokeWidth={1.5}/> Tìm kiếm</button></div>
        </div>
      </Card>

      <Card className="p-6">
        <SectionTitle>Tìm kiếm nâng cao</SectionTitle>
        <div className="grid grid-cols-2 gap-x-8 mb-4">
          <div className="space-y-2.5">
            <FieldRow label="Họ"><input className={inputCls} value={lastName} onChange={e=>setLastName(e.target.value)}/></FieldRow>
            <FieldRow label="Tên"><input className={inputCls} value={firstName} onChange={e=>setFirstName(e.target.value)}/></FieldRow>
            <FieldRow label="Mã ngoài"><input className={inputCls}/></FieldRow>
          </div>
          <div className="space-y-2.5">
            <FieldRow label="Công ty"><input className={inputCls} value={company} onChange={e=>setCompany(e.target.value)}/></FieldRow>
            <FieldRow label="Quốc gia"><input className={inputCls}/></FieldRow>
            <FieldRow label="Market Segment"><input className={inputCls}/></FieldRow>
          </div>
        </div>
        <div className="border border-[#e5e7eb] rounded-[3px] p-4 mb-3 bg-[#fafafa] space-y-3">
          <div className="flex flex-wrap items-center gap-6">
            <label className="flex items-center gap-2 text-[13px] text-[#374151] font-bold cursor-pointer w-32"><input type="checkbox" checked={arrivalDate} onChange={e=>{setArrivalDate(e.target.checked);if(e.target.checked)setDepartureDate(false);}} className="w-3.5 h-3.5 accent-[#0f0f0e]"/>Arrival date</label>
            <div className="flex items-center gap-2"><span className="text-[#9ca3af] font-semibold text-[13px]">From</span><input type="date" value={arrivalFrom} onChange={e=>setArrivalFrom(e.target.value)} disabled={!arrivalDate} className="mono text-[13px] font-semibold border border-[#e5e7eb] rounded-[3px] px-2 py-1 outline-none focus:border-[#6b7280] bg-white disabled:opacity-40"/><span className="text-[#9ca3af] font-semibold text-[13px]">To</span><input type="date" value={arrivalTo} onChange={e=>setArrivalTo(e.target.value)} disabled={!arrivalDate} className="mono text-[13px] font-semibold border border-[#e5e7eb] rounded-[3px] px-2 py-1 outline-none focus:border-[#6b7280] bg-white disabled:opacity-40"/></div>
          </div>
          <div className="flex flex-wrap items-center gap-6 pt-2.5 border-t border-[#e5e7eb]">
            <label className="flex items-center gap-2 text-[13px] font-bold cursor-pointer w-32"><input type="checkbox" checked={departureDate} onChange={e=>{setDepartureDate(e.target.checked);if(e.target.checked)setArrivalDate(false);}} className="w-3.5 h-3.5 accent-[#c1121f]"/><span className={departureDate?"text-[#c1121f]":"text-[#374151]"}>Departure date</span></label>
            <div className="flex items-center gap-2"><span className="text-[#9ca3af] font-semibold text-[13px]">From</span><input type="date" value={departureFrom} onChange={e=>setDepartureFrom(e.target.value)} disabled={!departureDate} className="mono text-[13px] font-semibold border border-[#e5e7eb] rounded-[3px] px-2 py-1 outline-none bg-white disabled:opacity-40"/><span className="text-[#9ca3af] font-semibold text-[13px]">To</span><input type="date" value={departureTo} onChange={e=>setDepartureTo(e.target.value)} disabled={!departureDate} className="mono text-[13px] font-semibold border border-[#e5e7eb] rounded-[3px] px-2 py-1 outline-none bg-white disabled:opacity-40"/></div>
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-[#f3f4f6] pt-4">
          <div className="flex flex-wrap gap-4">{(Object.keys(filterStatuses) as (keyof typeof filterStatuses)[]).map(s=><label key={s} className="flex items-center gap-1.5 text-[12px] text-[#6b7280] cursor-pointer hover:text-[#1a1a1a] font-semibold"><input type="checkbox" checked={filterStatuses[s]} onChange={e=>setFilterStatuses(f=>({...f,[s]:e.target.checked}))} className="w-3.5 h-3.5 accent-[#0f0f0e]"/> {s}</label>)}</div>
          <button onClick={()=>doSearch(departureDate?"departure":"arrival")} className="pms-btn-primary">Advanced Search</button>
        </div>
      </Card>

      {searched&&results!==null&&(
        <div className="fixed inset-0 z-30 bg-[#f2f2ef] flex flex-col">
          <div className="bg-white border-b border-[#e5e7eb] flex items-center justify-between px-7 shrink-0" style={{height:56}}>
            <div className="flex items-center gap-3">
              <button onClick={handleReset} className="flex items-center gap-1.5 text-[13px] text-[#9ca3af] hover:text-[#1a1a1a] font-bold transition-colors"><ChevronLeft size={13} strokeWidth={1.5}/> Quay lại</button>
              <span className="text-[#e5e7eb]">|</span>
              <span className="text-[13px] font-bold text-[#1a1a1a]">{searchMode==="departure"?"Danh sách Check-out":"Danh sách Check-in"}</span>
            </div>
            <div className="flex items-center gap-4">
              {searchMode==="departure"?<span className="text-[11px] px-2 py-0.5 rounded-[2px] font-bold bg-[#fff1f2] text-[#c1121f] border border-[#fca5a5]">C/O Today</span>:<span className="text-[11px] px-2 py-0.5 rounded-[2px] font-bold bg-[#f0fdf4] text-[#15803d] border border-[#86efac]">Arrival Today</span>}
              <span className="mono text-[12px] text-[#9ca3af] font-semibold">Folio 1 to {results.length} of {results.length}</span>
            </div>
          </div>
          <div className="flex-1 overflow-auto px-7 py-5">
            <div className="bg-white border border-[#e5e7eb] rounded-[3px] shadow-[0_2px_6px_rgba(0,0,0,0.07)] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse" style={{minWidth:1100}}>
                  <thead>
                    <tr className="border-b-2 border-[#e5e7eb] bg-[#fafafa] sticky top-0 z-10">
                      <SortTh col="sts" label="Sts" className="pl-5" sortCol={sortCol} sortAsc={sortAsc} onSort={handleSort}/>
                      <SortTh col="stt" label="Stt" sortCol={sortCol} sortAsc={sortAsc} onSort={handleSort}/>
                      <SortTh col="folio" label="Folio #" sortCol={sortCol} sortAsc={sortAsc} onSort={handleSort}/>
                      <SortTh col="conf" label="Conf #" sortCol={sortCol} sortAsc={sortAsc} onSort={handleSort}/>
                      <SortTh col="title" label="Title" sortCol={sortCol} sortAsc={sortAsc} onSort={handleSort}/>
                      <SortTh col="name" label="Tên khách" sortCol={sortCol} sortAsc={sortAsc} onSort={handleSort}/>
                      <SortTh col="rate" label="Rate" sortCol={sortCol} sortAsc={sortAsc} onSort={handleSort}/>
                      <SortTh col="rm" label="Rm" sortCol={sortCol} sortAsc={sortAsc} onSort={handleSort}/>
                      <SortTh col="type" label="Type" sortCol={sortCol} sortAsc={sortAsc} onSort={handleSort}/>
                      <SortTh col="arrival" label="Arrival" sortCol={sortCol} sortAsc={sortAsc} onSort={handleSort}/>
                      <SortTh col="departure" label="Departure" sortCol={sortCol} sortAsc={sortAsc} onSort={handleSort}/>
                      <SortTh col="adtCh" label="Adt/Ch" sortCol={sortCol} sortAsc={sortAsc} onSort={handleSort}/>
                      <SortTh col="company" label="Company" sortCol={sortCol} sortAsc={sortAsc} onSort={handleSort}/>
                      <SortTh col="bkSts" label="BkSts" sortCol={sortCol} sortAsc={sortAsc} onSort={handleSort}/>
                      <SortTh col="nat" label="NAT" className="pr-5" sortCol={sortCol} sortAsc={sortAsc} onSort={handleSort}/>
                    </tr>
                  </thead>
                  <tbody>
                    {results.length===0?<tr><td colSpan={15} className="px-5 py-10 text-center text-[13px] text-[#9ca3af] font-semibold">Không tìm thấy khách nào phù hợp</td></tr>
                    :results.map((r,i)=>{
                      const isSelected=selectedRow===r.folio+r.sales;
                      const rowBg=isSelected?"bg-[#fffbeb]":(i%2===0?"bg-white":"bg-[#fafafa]");
                      return <tr key={r.folio+r.sales+i} onClick={()=>{setSelectedRow(isSelected?null:r.folio+r.sales);if(r.sts==="CO")setCheckOutRow(r);else handleCheckInRowOpen(r);}} className={`border-b border-[#f3f4f6] cursor-pointer transition-colors hover:bg-[#fffbeb] ${rowBg}`}>
                        <td className={`pl-5 py-3 text-[13px] font-bold mono ${r.sts==="CO"?"text-[#c1121f]":"text-[#2d6a4f]"}`}>{r.sts}</td>
                        <td className="px-2 py-3 mono text-[12px] text-[#9ca3af] font-semibold">{r.stt}</td>
                        <td className="px-2 py-3 mono text-[13px] font-bold text-[#374151]">{r.folio}</td>
                        <td className="px-2 py-3 mono text-[12px] text-[#9ca3af] font-semibold">{r.conf}</td>
                        <td className="px-2 py-3 text-[12px] font-semibold text-[#6b7280]">{r.title}</td>
                        <td className="px-2 py-3 text-[13px] font-bold max-w-[160px] truncate">{r.name}</td>
                        <td className="px-2 py-3 mono text-[12px] text-right font-bold">{r.rate>0?r.rate.toLocaleString():""}</td>
                        <td className="px-2 py-3 mono text-[13px] font-bold text-[#374151]">{assignedRooms[r.sales]?.rm?<span className="text-[#15803d]">{assignedRooms[r.sales].rm}</span>:r.rm||""}</td>
                        <td className="px-2 py-3">{(assignedRooms[r.sales]?.type||r.type)&&<span className="mono text-[11px] px-1.5 py-0.5 rounded-[2px] font-bold" style={{background:"#f0fdf4",color:"#15803d",border:"1px solid #86efac"}}>{assignedRooms[r.sales]?.type||r.type}</span>}</td>
                        <td className="px-2 py-3 mono text-[12px] font-semibold text-[#374151]">{r.arrival}</td>
                        <td className="px-2 py-3 mono text-[12px] font-semibold text-[#374151]">{r.departure}</td>
                        <td className="px-2 py-3 mono text-[12px] text-[#9ca3af] font-semibold">{r.adtCh}</td>
                        <td className="px-2 py-3 text-[12px] text-[#6b7280] font-semibold max-w-[120px] truncate">{r.company}</td>
                        <td className="px-2 py-3">{r.bkSts&&<span className="text-[11px] px-1.5 py-0.5 rounded-[2px] font-bold bg-[#eff6ff] text-[#1d4ed8] border border-[#bfdbfe]">{r.bkSts}</span>}</td>
                        <td className={`pr-5 py-3 mono text-[12px] font-bold ${natColor(r.nat)}`}>{r.nat}</td>
                      </tr>;
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <div className="bg-white border-t border-[#e5e7eb] px-7 py-3 flex items-center gap-3 shrink-0">
            <span className="text-[13px] font-bold text-[#374151]">Total: {results.length}</span>
            {selectedRow&&results&&(()=>{const r=results.find(r=>r.folio+r.sales===selectedRow);return r?<button onClick={()=>setFolioRow(r)} className="pms-btn-secondary flex items-center gap-1.5"><DollarSign size={11} strokeWidth={1.5}/> Xem Folio</button>:null;})()}
            <div className="flex-1"/>
            <button onClick={handleReset} className="flex items-center gap-1.5 px-4 py-2 border border-[#e5e7eb] rounded-[3px] text-[13px] font-bold text-[#9ca3af] hover:text-[#c1121f] hover:border-[#fca5a5] transition-all duration-150"><ChevronLeft size={12} strokeWidth={1.5}/> Quay lại tìm kiếm</button>
          </div>
        </div>
      )}

      {!searched&&(
        <Card className="overflow-hidden">
          <div className="px-6 py-4 border-b border-[#f3f4f6]"><SectionTitle>Waiting List — Chưa gán phòng</SectionTitle></div>
          <table className="w-full text-left">
            <thead><tr className="border-b border-[#f3f4f6] bg-[#fafafa]">{["Folio","Tên khách","Loại phòng","Check-in","Check-out",""].map(h=><th key={h} className="px-6 py-3 text-[10px] tracking-[0.12em] uppercase text-[#6b7280] font-bold">{h}</th>)}</tr></thead>
            <tbody>{WAITING_CUSTOMERS.map(cus=><tr key={cus.id} className="border-b border-[#f9f9f7] hover:bg-[#fafafa] transition-colors">
              <td className="px-6 py-4 mono text-[13px] text-[#9ca3af] font-semibold">{cus.folio}</td>
              <td className="px-6 py-4 text-[14px] font-bold">{cus.name}</td>
              <td className="px-6 py-4"><span className="text-[12px] px-2 py-0.5 bg-[#f3f4f6] rounded-[2px] text-[#374151] font-bold mono">{cus.roomType}</span></td>
              <td className="px-6 py-4 mono text-[13px] text-[#9ca3af] font-semibold">{cus.checkIn}</td>
              <td className="px-6 py-4 mono text-[13px] text-[#9ca3af] font-semibold">{cus.checkOut}</td>
              <td className="px-6 py-4 text-right"><button onClick={onAssignRoom} className="pms-btn-secondary">Gán phòng</button></td>
            </tr>)}</tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

// ─── ROOM PLAN TAB ───
function RoomPlanTab(){
  const NUM_DAYS=30;
  const [startDate,setStartDate]=useState(new Date(2026,4,1));
  const [filterType,setFilterType]=useState("ALL");const [filterFloor,setFilterFloor]=useState("ALL");const [searchName,setSearchName]=useState("");
  const [bookings,setBookings]=useState<Booking[]>(()=>makeSeedBookings());
  const [dragging,setDragging]=useState<{bookingId:string;offsetDay:number}|null>(null);
  const [dragOver,setDragOver]=useState<{roomId:number;day:number}|null>(null);
  const [selected,setSelected]=useState<string|null>(null);
  const [tooltip,setTooltip]=useState<{booking:Booking;x:number;y:number}|null>(null);
  const gridRef=useRef<HTMLDivElement>(null);
  const dates=useMemo(()=>buildDates(startDate,NUM_DAYS),[startDate]);
  const filteredRooms=useMemo(()=>{
    let rooms=PLAN_ROOMS;
    if(filterType!=="ALL")rooms=rooms.filter(r=>r.type===filterType);
    if(filterFloor!=="ALL")rooms=rooms.filter(r=>r.floor===Number(filterFloor));
    if(searchName.trim()){const q=searchName.toLowerCase();const matchIds=new Set(bookings.filter(b=>b.guestName.toLowerCase().includes(q)).map(b=>b.roomId));rooms=rooms.filter(r=>matchIds.has(r.id));}
    return rooms;
  },[filterType,filterFloor,searchName,bookings]);
  const bookingsByRoom=useMemo(()=>{const m=new Map<number,Booking[]>();bookings.forEach(b=>{if(!m.has(b.roomId))m.set(b.roomId,[]);m.get(b.roomId)!.push(b);});return m;},[bookings]);
  const hasCollision=useCallback((roomId:number,startDay:number,nights:number,excludeId:string)=>{const rb=(bookingsByRoom.get(roomId)||[]).filter(b=>b.id!==excludeId);return rb.some(b=>startDay<b.startDay+b.nights&&startDay+nights>b.startDay);},[bookingsByRoom]);
  const onDragStart=(e:React.DragEvent,bk:Booking,clickedDay:number)=>{setDragging({bookingId:bk.id,offsetDay:clickedDay-bk.startDay});setSelected(bk.id);e.dataTransfer.effectAllowed="move";};
  const onCellDragOver=(e:React.DragEvent,roomId:number,day:number)=>{e.preventDefault();e.dataTransfer.dropEffect="move";setDragOver({roomId,day});};
  const onDrop=(e:React.DragEvent,targetRoomId:number,day:number)=>{e.preventDefault();if(!dragging)return;const bk=bookings.find(b=>b.id===dragging.bookingId);if(!bk)return;const newStart=day-dragging.offsetDay;if(newStart<0||newStart+bk.nights>NUM_DAYS)return;if(hasCollision(targetRoomId,newStart,bk.nights,bk.id))return;setBookings(prev=>prev.map(b=>b.id===dragging.bookingId?{...b,roomId:targetRoomId,startDay:newStart}:b));setDragging(null);setDragOver(null);};
  const onDragEnd=()=>{setDragging(null);setDragOver(null);};
  const goBack=()=>{const d=new Date(startDate);d.setDate(d.getDate()-7);setStartDate(d);};
  const goFwd=()=>{const d=new Date(startDate);d.setDate(d.getDate()+7);setStartDate(d);};
  const floors=[...new Set(PLAN_ROOMS.map(r=>r.floor))].sort((a,b)=>a-b);
  return(
    <div className="flex flex-col bg-[#f2f2ef]" style={{height:"calc(100vh - 56px)"}}>
      <div className="bg-white border-b border-[#e5e7eb] px-5 py-2.5 flex items-center gap-4 shrink-0 flex-wrap">
        <div className="flex items-center gap-1.5"><span className="text-[13px] font-bold text-[#374151]">Start Date</span><input type="date" value={startDate.toISOString().split("T")[0]} onChange={e=>{const d=new Date(e.target.value);if(!isNaN(d.getTime()))setStartDate(d);}} className="mono text-[13px] font-semibold border border-[#e5e7eb] rounded-[3px] px-2 py-1 outline-none focus:border-[#6b7280] bg-[#fafafa]"/></div>
        <div className="w-px h-4 bg-[#e5e7eb]"/>
        <div className="flex items-center gap-1.5"><span className="text-[13px] font-bold text-[#374151]">Rm Type</span><select value={filterType} onChange={e=>setFilterType(e.target.value)} className="border border-[#e5e7eb] rounded-[3px] px-2 py-1 text-[13px] font-bold outline-none focus:border-[#6b7280] bg-[#fafafa] mono">{ALL_ROOM_TYPES.map(t=><option key={t} value={t}>{t}</option>)}</select></div>
        <div className="flex items-center gap-1.5"><span className="text-[13px] font-bold text-[#374151]">Floor</span><select value={filterFloor} onChange={e=>setFilterFloor(e.target.value)} className="border border-[#e5e7eb] rounded-[3px] px-2 py-1 text-[13px] font-bold outline-none focus:border-[#6b7280] bg-[#fafafa] mono"><option value="ALL">ALL</option>{floors.map(f=><option key={f} value={f}>Tầng {f}</option>)}</select></div>
        <div className="w-px h-4 bg-[#e5e7eb]"/>
        <div className="flex items-center gap-1.5"><span className="text-[13px] font-bold text-[#374151]">Name</span><div className="flex items-center gap-1 border border-[#e5e7eb] rounded-[3px] px-2 py-1 bg-[#fafafa]"><Search size={11} strokeWidth={1.5} className="text-[#d1d5db]"/><input value={searchName} onChange={e=>setSearchName(e.target.value)} className="outline-none bg-transparent text-[13px] font-semibold w-28 mono" placeholder="Tìm tên khách..."/></div></div>
        <div className="flex-1"/>
        <div className="flex items-center gap-3">{(Object.entries(BOOKING_COLOR) as [BookingStatus,typeof BOOKING_COLOR[BookingStatus]][]).map(([k,c])=><div key={k} className="flex items-center gap-1 text-[12px] text-[#6b7280] font-semibold"><span className="w-3 h-3 rounded-[2px] inline-block" style={{background:c.bg}}/>{c.label}</div>)}</div>
        <div className="flex items-center gap-1 border border-[#e5e7eb] rounded-[3px] overflow-hidden shadow-sm">
          <button onClick={goBack} className="px-2 py-1.5 hover:bg-[#f3f4f6] transition-colors border-r border-[#e5e7eb]"><ChevronLeft size={13} strokeWidth={2}/></button>
          <button onClick={()=>setStartDate(new Date(2026,4,1))} className="px-3 py-1.5 text-[12px] font-bold hover:bg-[#f3f4f6] transition-colors border-r border-[#e5e7eb]">Today</button>
          <button onClick={goFwd} className="px-2 py-1.5 hover:bg-[#f3f4f6] transition-colors"><ChevronRight size={13} strokeWidth={2}/></button>
        </div>
      </div>
      <div className="flex-1 overflow-auto" ref={gridRef}>
        <div style={{minWidth:LABEL_W+COL_W*NUM_DAYS}}>
          <div className="flex sticky top-0 z-30 bg-white border-b-2 border-[#e5e7eb]" style={{height:44}}>
            <div className="shrink-0 flex items-end px-3 pb-2 border-r border-[#e5e7eb]" style={{width:LABEL_W,background:"#fafafa"}}><span className="mono text-[11px] text-[#6b7280] font-bold tracking-widest uppercase">Room</span></div>
            {dates.map((d,i)=>{const weekend=isWeekend(d),isToday=d.toDateString()===new Date(2026,4,1).toDateString();return<div key={i} style={{width:COL_W,minWidth:COL_W}} className={`shrink-0 flex flex-col items-center justify-end pb-1 border-r border-[#f0f0ed] ${weekend?"bg-[#fdf8f0]":""}`}><div className={`mono text-[11px] font-bold ${isToday?"text-[#c1121f]":weekend?"text-[#b45309]":"text-[#374151]"}`}>{d.getDate()}/{d.getMonth()+1}</div><div className={`text-[9px] uppercase tracking-wide font-bold ${weekend?"text-[#b45309]":"text-[#9ca3af]"}`}>{d.toLocaleDateString("en-GB",{weekday:"short"})}</div></div>;})}
          </div>
          {filteredRooms.map((room,ri)=>{
            const roomBookings=bookingsByRoom.get(room.id)||[],isEven=ri%2===0;
            return<div key={room.id} className="flex relative" style={{height:ROW_H}} onDragOver={e=>e.preventDefault()}>
              <div className={`shrink-0 flex items-center gap-2 px-3 border-r border-b border-[#e5e7eb] sticky left-0 z-20 ${isEven?"bg-white":"bg-[#fafafa]"}`} style={{width:LABEL_W}}><span className="mono text-[12px] font-bold text-[#374151]">{room.id}</span><span className="text-[10px] text-[#9ca3af] uppercase tracking-wide font-bold">{room.type}</span></div>
              <div className="relative flex flex-1 border-b border-[#f0f0ed]">
                {dates.map((d,di)=>{const weekend=isWeekend(d),isDrop=dragOver?.roomId===room.id&&dragOver?.day===di;return<div key={di} style={{width:COL_W,minWidth:COL_W}} className={`shrink-0 h-full border-r border-[#f0f0ed] ${weekend?"bg-[#fdf8f0]":isEven?"bg-white":"bg-[#fafafa]"} ${isDrop?"!bg-blue-50":""}`} onDragOver={e=>onCellDragOver(e,room.id,di)} onDrop={e=>onDrop(e,room.id,di)}/>;} )}
                {roomBookings.map(bk=>{
                  if(bk.startDay>=NUM_DAYS||bk.startDay+bk.nights<=0)return null;
                  const cs=Math.max(0,bk.startDay),ce=Math.min(NUM_DAYS,bk.startDay+bk.nights),cn=ce-cs;
                  const c=BOOKING_COLOR[bk.status],isSel=selected===bk.id,isDrag=dragging?.bookingId===bk.id;
                  return<div key={bk.id} draggable onDragStart={e=>onDragStart(e,bk,cs)} onDragEnd={onDragEnd} onClick={e=>{e.stopPropagation();setSelected(isSel?null:bk.id);}} onMouseEnter={e=>setTooltip({booking:bk,x:e.clientX,y:e.clientY})} onMouseLeave={()=>setTooltip(null)} className={`absolute top-[3px] rounded-[3px] cursor-grab active:cursor-grabbing flex items-center px-2 overflow-hidden select-none transition-all duration-100 ${isDrag?"opacity-40":""}`} style={{left:cs*COL_W+1,width:cn*COL_W-2,height:ROW_H-6,background:c.bg,border:`1.5px solid ${isSel?"#1a1a1a":c.border}`,boxShadow:isSel?"0 0 0 2px #1a1a1a, 0 4px 12px rgba(0,0,0,0.2)":"0 1px 4px rgba(0,0,0,0.2)",zIndex:isSel?25:15,transform:isSel?"scale(1.01)":""}}>
                    <div className="absolute left-0 top-0 bottom-0 w-1.5 rounded-l-[3px]" style={{background:c.border}}/>
                    <span className="mono text-[10px] font-bold pl-2 truncate" style={{color:c.text}}>{bk.guestName}</span>
                  </div>;
                })}
              </div>
            </div>;
          })}
          {filteredRooms.length===0&&<div className="flex items-center justify-center py-16 text-[14px] text-[#9ca3af] font-semibold">Không tìm thấy phòng phù hợp</div>}
        </div>
      </div>
      {tooltip&&(()=>{const bk=tooltip.booking,c=BOOKING_COLOR[bk.status],room=PLAN_ROOMS.find(r=>r.id===bk.roomId);return<div className="fixed z-50 pointer-events-none text-[12px] bg-white border border-[#e5e7eb] rounded-[3px] shadow-xl p-3" style={{left:tooltip.x+12,top:tooltip.y-8,minWidth:220}}><div className="flex items-center gap-2 mb-2 pb-2 border-b border-[#f3f4f6]"><span className="w-2.5 h-2.5 rounded-[2px]" style={{background:c.bg}}/><span className="font-bold text-[13px]">{bk.guestName}</span></div><div className="space-y-0.5 text-[#6b7280]"><div><span className="text-[#9ca3af] font-semibold">Phòng: </span><span className="mono font-bold text-[#374151]">{bk.roomId}·{room?.type}</span></div><div><span className="text-[#9ca3af] font-semibold">Số đêm: </span><span className="mono font-bold text-[#374151]">{bk.nights}</span></div></div><div className="mt-2 pt-2 border-t border-[#f3f4f6] text-[11px] text-[#9ca3af] italic font-semibold">Kéo thả để đổi phòng</div></div>;})()}
      <div className="bg-white border-t border-[#e5e7eb] px-5 py-2.5 flex items-center gap-2 shrink-0">
        <button className="toolbar-btn" onClick={()=>setSearchName("")}><RefreshCw size={11} strokeWidth={2} className="inline mr-1"/>Reset</button>
        <div className="w-px h-4 bg-[#e5e7eb] mx-1"/>
        <button className="toolbar-btn">Availability</button><button className="toolbar-btn">Print</button><button className="toolbar-btn">Notes</button>
        <div className="flex-1"/>
        {selected&&(()=>{const bk=bookings.find(b=>b.id===selected);if(!bk)return null;const c=BOOKING_COLOR[bk.status];return<div className="flex items-center gap-3 text-[13px]"><span className="w-2 h-2 rounded-[2px]" style={{background:c.bg}}/><span className="font-bold">{bk.guestName}</span><span className="text-[#9ca3af] font-semibold">Phòng <span className="mono text-[#374151] font-bold">{bk.roomId}</span></span><span className="text-[#9ca3af] font-semibold">{bk.nights} đêm</span><div className="w-px h-4 bg-[#e5e7eb]"/><button className="pms-btn-secondary text-[12px]">Xem folio</button><button className="pms-btn-secondary text-[12px]">Đổi phòng</button><button onClick={()=>setSelected(null)} className="text-[#9ca3af] hover:text-[#1a1a1a] text-[15px] font-bold transition-colors">✕</button></div>;})()}
        <button className="toolbar-btn flex items-center gap-1.5 text-[#9ca3af] hover:text-[#c1121f]"><X size={11} strokeWidth={2}/> Close</button>
      </div>
    </div>
  );
}

// ─── MAIN COMPONENT ───
export default function AvantiPMS(){
  const router=useRouter();
  const [loggedIn,setLoggedIn]=useState(false);
  const [staffName,setStaffName]=useState("");
  const [staffRole,setStaffRole]=useState("");
  const [isMounted,setIsMounted]=useState(false);
  const [currentTab,setCurrentTab]=useState<TabName>("Tổng quan");
  const [mapViewMode,setMapViewMode]=useState<MapViewMode>("hotelmap");
  const [selectedRoom,setSelectedRoom]=useState<number|null>(null);
  const [cashierView,setCashierView]=useState<"menu"|"postTransaction">("menu");
  const [availNumDays,setAvailNumDays]=useState(10);
  const [availFilters,setAvailFilters]=useState({definite:true,tentative:true,seri:true,ooo:true,allotment:true,ooiPhu:true});
  const [availStartDate,setAvailStartDate]=useState(new Date(2026,4,1));

  useEffect(()=>{
    setIsMounted(true);
    if(typeof window==="undefined")return;
    try{
      const savedName=localStorage.getItem("staffName");
      const savedRole=localStorage.getItem("staffRole");
      if(savedName&&savedRole){setStaffName(savedName);setStaffRole(savedRole);setLoggedIn(true);}
      else{router.push("/");}
    }catch(e){router.push("/");}
  },[router]);

  useEffect(()=>{if(currentTab==="Sơ đồ phòng")setMapViewMode("hotelmap");if(currentTab==="Thu ngân")setCashierView("menu");setSelectedRoom(null);},[currentTab]);

  const floors=useMemo(()=>buildFloors(),[]);
  const allRooms=useMemo(()=>floors.flatMap(f=>f.rooms),[floors]);
  const mapStats=useMemo(()=>({clean:allRooms.filter(r=>r.status==="clean").length,occupied:allRooms.filter(r=>r.status==="occupied").length,dirty:allRooms.filter(r=>r.status==="dirty").length}),[allRooms]);
  const simpleFloors=useMemo(()=>Array.from({length:9},(_,fi)=>{const fn=fi+1,count=fn===1?9:12;return{name:`Tầng ${fn}`,rooms:Array.from({length:count},(_,ri)=>{const id=fn*100+ri+1;return{id,status:getRoomStatus(id),roomType:HOTEL_ROOM_TYPES[ri%HOTEL_ROOM_TYPES.length]};})};}),[]);
  const availDates=useMemo(()=>buildDates(availStartDate,availNumDays),[availStartDate,availNumDays]);
  const dailyTotals=useMemo(()=>Array.from({length:availNumDays},(_,i)=>ROOM_TYPES_AVAILABILITY.reduce((s,rt)=>s+(rt.available[i]??0),0)),[availNumDays]);
  const dailyDefinite=useMemo(()=>Array.from({length:availNumDays},(_,i)=>ROOM_TYPES_AVAILABILITY.reduce((s,rt)=>s+(rt.definite[i]??0),0)),[availNumDays]);
  const totalAvailRooms=ROOM_TYPES_AVAILABILITY.reduce((s,rt)=>s+rt.total,0);
  const selectedRoomData=selectedRoom!==null?allRooms.find(r=>r.id===selectedRoom):null;

  if(!isMounted)return null;
  if(!loggedIn)return(<div className="min-h-screen flex items-center justify-center bg-[#f2f2ef]" style={{fontFamily:"'DM Sans',sans-serif"}}><div className="text-[14px] text-[#9ca3af] mono font-semibold">Đang chuyển hướng...</div></div>);

  const exportToCSV=()=>{
    const hdr=["Description","Type","Total",...availDates.map(d=>d.toLocaleDateString("en-GB",{day:"2-digit",month:"short"}))];
    const rows=ROOM_TYPES_AVAILABILITY.map(rt=>[rt.description,rt.type,rt.total,...availDates.map((_,i)=>rt.available[i]??0)]);
    const csv=[hdr,...rows].map(r=>r.join(",")).join("\n");
    const blob=new Blob([csv],{type:"text/csv;charset=utf-8;"});const url=URL.createObjectURL(blob);
    const a=document.createElement("a");a.href=url;a.download="room_availability.csv";
    document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);
  };

  const SimpleLegend=()=><div className="flex gap-5">{(Object.entries(ROOM_STATUS) as [RoomStatus,typeof ROOM_STATUS[RoomStatus]][]).map(([k,c])=><div key={k} className="flex items-center gap-1.5 text-[12px] text-[#6b7280] font-semibold"><span className={`w-2.5 h-2.5 rounded-[2px] border inline-block ${c.cell}`}/>{c.labelVi}</div>)}</div>;
  const MapLegend=()=><div className="flex gap-4">{(Object.entries(ROOM_STATUS) as [RoomStatus,typeof ROOM_STATUS[RoomStatus]][]).map(([k,c])=><div key={k} className="flex items-center gap-1.5 text-[12px] text-[#6b7280] font-semibold"><span className="inline-block rounded-full" style={{width:8,height:8,backgroundColor:c.dotColor,boxShadow:"0 0 0 1.5px rgba(0,0,0,0.1)"}}/>{c.labelVi}</div>)}</div>;

  return(
    <div className="flex min-h-screen bg-[#f2f2ef] text-[#1a1a1a]" style={{fontFamily:"'DM Sans','Helvetica Neue',Arial,sans-serif"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=DM+Mono:wght@400;500;600&display=swap');
        body{font-weight:500;}
        .mono{font-family:'DM Mono','Courier New',monospace;font-weight:600;}
        /* ── Professional Button System ── */
        .pms-btn-primary{display:inline-flex;align-items:center;gap:6px;padding:8px 18px;border-radius:3px;font-size:13px;font-weight:700;letter-spacing:0.01em;background:#0f0f0e;color:#fff;border:1px solid #0f0f0e;cursor:pointer;transition:all 0.15s ease;box-shadow:0 1px 3px rgba(0,0,0,0.2),0 1px 2px rgba(0,0,0,0.12);user-select:none;}
        .pms-btn-primary:hover{background:#252523;box-shadow:0 4px 12px rgba(0,0,0,0.25),0 2px 4px rgba(0,0,0,0.15);transform:translateY(-1px);}
        .pms-btn-primary:active{background:#0a0a09;box-shadow:0 1px 2px rgba(0,0,0,0.2);transform:translateY(0);}
        .pms-btn-secondary{display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:3px;font-size:13px;font-weight:700;background:#fff;color:#374151;border:1px solid #d1d5db;cursor:pointer;transition:all 0.15s ease;box-shadow:0 1px 2px rgba(0,0,0,0.06);user-select:none;}
        .pms-btn-secondary:hover{background:#f3f4f6;border-color:#9ca3af;box-shadow:0 3px 8px rgba(0,0,0,0.1);transform:translateY(-1px);}
        .pms-btn-secondary:active{background:#e5e7eb;transform:translateY(0);box-shadow:none;}
        .pms-btn-danger{display:inline-flex;align-items:center;gap:6px;padding:8px 18px;border-radius:3px;font-size:13px;font-weight:700;background:#c1121f;color:#fff;border:1px solid #9b1015;cursor:pointer;transition:all 0.15s ease;box-shadow:0 1px 3px rgba(193,18,31,0.3),0 1px 2px rgba(0,0,0,0.1);user-select:none;}
        .pms-btn-danger:hover{background:#9b1015;box-shadow:0 4px 12px rgba(193,18,31,0.4);transform:translateY(-1px);}
        .pms-btn-danger:active{background:#7f0d12;transform:translateY(0);}
        /* ── Room cells ── */
        .room-cell{transition:transform 0.1s ease,box-shadow 0.1s ease;}
        .room-cell:hover{transform:scale(1.1);box-shadow:0 4px 12px rgba(0,0,0,0.25);z-index:10;position:relative;}
        .room-cell.is-selected{outline:2.5px solid #111110;outline-offset:2px;z-index:20;position:relative;}
        /* ── Tables ── */
        .avail-table th,.avail-table td{border-right:1px solid #f0f0ed;}
        .avail-table th:last-child,.avail-table td:last-child{border-right:none;}
        .avail-table tbody tr:hover td{background-color:#f7f7f4!important;}
        .weekend-col{background-color:#fdf8f0;}
        .notes-divider{background-color:#1a1a1a;height:2px;}
        /* ── Toolbar ── */
        .toolbar-btn{padding:6px 14px;border:1px solid #d1d5db;border-radius:3px;font-size:12px;font-weight:700;background:white;cursor:pointer;transition:all 0.12s ease;box-shadow:0 1px 2px rgba(0,0,0,0.05);}
        .toolbar-btn:hover{background:#f3f4f6;border-color:#9ca3af;box-shadow:0 2px 6px rgba(0,0,0,0.1);transform:translateY(-1px);}
        .toolbar-btn:active{background:#e5e7eb;transform:translateY(0);}
        .toolbar-btn.primary{background:#0f0f0e;color:white;border-color:#0f0f0e;}
        .toolbar-btn.primary:hover{background:#2a2a28;}
        ::-webkit-scrollbar{width:5px;height:5px;}
        ::-webkit-scrollbar-thumb{background:#d1d5db;border-radius:3px;}
        ::-webkit-scrollbar-track{background:transparent;}
      `}</style>

      {/* SIDEBAR */}
      <aside className="w-52 shrink-0 flex flex-col bg-[#0f0f0e] text-white">
        <SidebarProperty/>
        <nav className="flex-1 py-2">
          {MENU_ITEMS.map(({name,icon:Icon})=>(
            <button key={name} onClick={()=>setCurrentTab(name)} className={`flex w-full items-center gap-3 px-5 py-2.5 text-left transition-all duration-150 text-[13px] ${currentTab===name?"text-white bg-[#252523] border-l-2 border-white":"text-[#7a7a75] hover:text-white hover:bg-[#1c1c1a] border-l-2 border-transparent hover:translate-x-0.5"}`}>
              <Icon size={15} strokeWidth={currentTab===name?2:1.5}/><span className="font-bold">{name}</span>
            </button>
          ))}
        </nav>
        <div className="px-5 py-4 border-t border-[#252523] space-y-0.5">
          <button className="flex w-full items-center gap-2.5 py-2 text-[12px] text-[#5c5c58] hover:text-white transition-colors font-semibold"><Settings size={13} strokeWidth={1.5}/> Cài đặt</button>
          <button onClick={()=>{window.location.href="/";}} className="flex w-full items-center gap-2.5 py-2 text-[12px] text-[#5c5c58] hover:text-[#ef4444] transition-colors font-semibold"><LogOut size={13} strokeWidth={1.5}/> Đăng xuất</button>
        </div>
      </aside>

      {/* MAIN */}
      <div className="flex flex-col flex-1 overflow-hidden">
        <header className="bg-white border-b border-[#e5e7eb] flex items-center justify-between px-7 shrink-0 shadow-[0_1px_3px_rgba(0,0,0,0.06)]" style={{height:56}}>
          <div className="flex items-center gap-2 text-[13px]"><span className="text-[#9ca3af] font-semibold">Avanti OS</span><ChevronRight size={11} className="text-[#d1d5db]" strokeWidth={2}/><span className="font-bold text-[#1a1a1a]">{currentTab}</span></div>
          <div className="flex items-center gap-5">
            <div className="flex items-center gap-3 text-[12px] text-[#6b7280] font-semibold">
              <span className="flex items-center gap-1.5"><ArrowDownCircle size={13} strokeWidth={2} className="text-[#2d6a4f]"/><span className="mono font-bold">{TODAY_STATS.checkInToday}</span> Arrivals</span>
              <span className="text-[#e5e7eb]">|</span>
              <span className="flex items-center gap-1.5"><ArrowUpCircle size={13} strokeWidth={2} className="text-[#c1121f]"/><span className="mono font-bold">{TODAY_STATS.checkOutToday}</span> Departures</span>
            </div>
            <button className="w-8 h-8 flex items-center justify-center hover:bg-[#f2f2ef] rounded-[3px] transition-all hover:shadow-sm"><Bell size={15} strokeWidth={1.5} className="text-[#9ca3af]"/></button>
            <div className="w-8 h-8 rounded-full bg-[#0f0f0e] text-white text-[11px] font-bold flex items-center justify-center tracking-wide shadow-md">{staffRole.toUpperCase().slice(0,2)||"GM"}</div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">

          {/* TỔNG QUAN */}
          {currentTab==="Tổng quan"&&(
            <div className="p-7 max-w-6xl mx-auto space-y-5">
              <div className="grid grid-cols-5 gap-3">
                {[
                  {label:"Tổng phòng",value:TODAY_STATS.totalRooms,sub:"Total rooms",accent:"#374151"},
                  {label:"Đang có khách",value:TODAY_STATS.occupied,sub:"Occupied",accent:"#7a5800",bar:"#e9c46a"},
                  {label:"Đã dọn sạch",value:TODAY_STATS.available,sub:"Clean & ready",accent:"#1b4332",bar:"#2d6a4f"},
                  {label:"Chờ dọn phòng",value:TODAY_STATS.dirty,sub:"Needs cleaning",accent:"#8b0000",bar:"#c1121f"},
                  {label:"Check-in hôm nay",value:TODAY_STATS.checkInToday,sub:"Arrivals today",accent:"#374151"},
                ].map(({label,value,sub,accent,bar})=>(
                  <Card key={label} className="p-5 hover:shadow-md transition-shadow duration-150 cursor-default">
                    <div className="text-[10px] tracking-[0.14em] uppercase text-[#9ca3af] mb-3 font-bold">{label}</div>
                    <div className="mono text-[30px] font-bold leading-none mb-1" style={{color:accent}}>{value}</div>
                    <div className="text-[12px] text-[#9ca3af] mb-3 font-semibold">{sub}</div>
                    {bar&&<div className="h-1 bg-[#f3f4f6] rounded-full"><div className="h-full rounded-full w-2/3" style={{backgroundColor:bar}}/></div>}
                  </Card>
                ))}
              </div>
              <div className="flex gap-2 items-center">
                {[{label:"Walk In",icon:User},{label:"New Reservation",icon:BedDouble},{label:"Find Guest",icon:Search,action:()=>setCurrentTab("Tìm kiếm")}].map(({label,icon:Icon,action})=>(
                  <button key={label} onClick={action} className="pms-btn-secondary flex items-center gap-1.5"><Icon size={13} strokeWidth={1.5}/> {label}</button>
                ))}
                <div className="flex-1 flex items-center gap-2 bg-white border border-[#e5e7eb] rounded-[3px] px-3 hover:border-[#9ca3af] transition-all shadow-sm hover:shadow">
                  <Search size={13} strokeWidth={1.5} className="text-[#d1d5db]"/>
                  <input className="flex-1 py-2 text-[13px] font-semibold outline-none bg-transparent placeholder:text-[#d1d5db]" placeholder="Tên khách, số phòng, folio..."/>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-5">
                <Card className="col-span-2 p-5">
                  <div className="flex items-center justify-between mb-4"><SectionTitle>Sơ đồ phòng — 3 tầng đầu</SectionTitle><button onClick={()=>setCurrentTab("Sơ đồ phòng")} className="text-[12px] text-[#9ca3af] hover:text-[#1a1a1a] transition-colors font-bold">Xem đầy đủ →</button></div>
                  <div className="space-y-3">{simpleFloors.slice(0,3).map(floor=><div key={floor.name}><div className="mono text-[10px] tracking-[0.1em] uppercase text-[#9ca3af] mb-1.5 font-bold">{floor.name}</div><div className="flex gap-1 flex-wrap">{floor.rooms.map(room=><div key={room.id} className={`room-cell w-9 h-7 border rounded-[2px] flex items-center justify-center cursor-pointer ${ROOM_STATUS[room.status as RoomStatus].cell} ${ROOM_STATUS[room.status as RoomStatus].text}`}><span className="mono text-[10px] font-bold">{room.id}</span></div>)}</div></div>)}</div>
                  <div className="mt-4 pt-4 border-t border-[#f3f4f6]"><SimpleLegend/></div>
                </Card>
                <div className="space-y-4">
                  <Card className="p-5">
                    <SectionTitle>Waiting List</SectionTitle>
                    <div className="space-y-3">{WAITING_CUSTOMERS.map(cus=><div key={cus.id} className="flex items-center justify-between py-2 border-b border-[#f3f4f6] last:border-0"><div><div className="text-[13px] font-bold">{cus.name}</div><div className="mono text-[11px] text-[#9ca3af] font-semibold">{cus.roomType}·{cus.checkIn}</div></div><button onClick={()=>setCurrentTab("Sơ đồ phòng")} className="pms-btn-secondary text-[11px] py-1.5 px-3">Gán phòng</button></div>)}</div>
                  </Card>
                  <Card className="p-5">
                    <SectionTitle>Hoạt động gần đây</SectionTitle>
                    <div className="space-y-3">{[{dot:"#2d6a4f",text:"Nguyen Huy — check-in phòng 102",time:"10 phút trước"},{dot:"#2d6a4f",text:"Phòng 208 — đã dọn xong",time:"25 phút trước"},{dot:"#c1121f",text:"Phòng 315 — chờ dọn",time:"1 giờ trước"}].map((act,i)=><div key={i} className="flex gap-2.5 items-start"><span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{backgroundColor:act.dot}}/><div><div className="text-[13px] text-[#374151] font-semibold">{act.text}</div><div className="mono text-[11px] text-[#9ca3af] font-semibold">{act.time}</div></div></div>)}</div>
                  </Card>
                </div>
              </div>
            </div>
          )}

          {currentTab==="Tìm kiếm"&&<SearchTab onAssignRoom={()=>setCurrentTab("Sơ đồ phòng")}/>}

          {/* SƠ ĐỒ PHÒNG */}
          {currentTab==="Sơ đồ phòng"&&(
            <div className="flex flex-col" style={{height:"calc(100vh - 56px)"}}>
              <div className="bg-white border-b border-[#e5e7eb] px-7 py-4 flex items-center justify-between shrink-0 shadow-sm">
                <div>
                  <h1 className="text-[21px] font-bold tracking-[0.16em] uppercase" style={{color:"#2d6a4f"}}>AVANTI HOTEL</h1>
                  <div className="flex items-center gap-4 mt-1">
                    <span className="mono text-[12px] text-[#9ca3af] font-semibold">{allRooms.length} phòng · 9 tầng</span>
                    <span className="text-[#e5e7eb]">|</span>
                    {(["clean","occupied","dirty"] as RoomStatus[]).map(s=><span key={s} className="flex items-center gap-1 text-[12px] font-bold" style={{color:ROOM_STATUS[s].mapSubText}}><StatusDot status={s}/> {mapStats[s]} {ROOM_STATUS[s].labelVi}</span>)}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <MapLegend/>
                  <div className="w-px h-5 bg-[#e5e7eb]"/>
                  <div className="flex border border-[#e5e7eb] rounded-[3px] overflow-hidden shadow-sm">
                    <button onClick={()=>setMapViewMode("hotelmap")} className={`flex items-center gap-1.5 px-4 py-2 text-[13px] font-bold transition-all border-r border-[#e5e7eb] ${mapViewMode==="hotelmap"?"bg-[#0f0f0e] text-white":"bg-white text-[#6b7280] hover:bg-[#f9f9f7]"}`}><MapIcon size={13} strokeWidth={1.5}/> Hotel Map</button>
                    <button onClick={()=>setMapViewMode("block")} className={`flex items-center gap-1.5 px-4 py-2 text-[13px] font-bold transition-all ${mapViewMode==="block"?"bg-[#0f0f0e] text-white":"bg-white text-[#6b7280] hover:bg-[#f9f9f7]"}`}><LayoutGrid size={13} strokeWidth={1.5}/> Block View</button>
                  </div>
                </div>
              </div>
              <div className="flex-1 overflow-auto p-6">
                <div className={mapViewMode==="block"?"bg-white border border-[#e5e7eb] rounded-[3px] shadow-sm p-6":""}>
                  <div className="space-y-5">{floors.map(floor=><div key={floor.name}><div className="mono text-[10px] tracking-[0.14em] uppercase text-[#9ca3af] font-bold mb-2">{floor.name}</div><div className="flex flex-wrap gap-1">{floor.rooms.map(room=>mapViewMode==="hotelmap"?<HotelCell key={room.id} room={room} selected={selectedRoom===room.id} onClick={()=>setSelectedRoom(prev=>prev===room.id?null:room.id)}/>:<BlockCell key={room.id} room={room} selected={selectedRoom===room.id} onClick={()=>setSelectedRoom(prev=>prev===room.id?null:room.id)}/>)}</div></div>)}</div>
                </div>
              </div>
              {selectedRoomData&&(
                <div className="bg-white border-t border-[#e5e7eb] px-7 py-3 flex items-center gap-5 shrink-0 text-[13px] shadow-[0_-1px_4px_rgba(0,0,0,0.06)]">
                  <div className="flex items-center gap-2 font-bold shrink-0"><StatusDot status={selectedRoomData.status}/><span className="mono text-[15px]">Phòng {selectedRoomData.id}</span><span className="text-[#9ca3af] font-semibold">· {selectedRoomData.roomType}</span><span className="px-2 py-0.5 rounded-[2px] text-[11px] font-bold text-white ml-1" style={{background:ROOM_STATUS[selectedRoomData.status].dotColor}}>{ROOM_STATUS[selectedRoomData.status].labelVi.toUpperCase()}</span></div>
                  <div className="w-px h-4 bg-[#e5e7eb] shrink-0"/>
                  {selectedRoomData.guest?(<><span className="font-bold">{selectedRoomData.guest.name}</span><span className="text-[#9ca3af] font-semibold">Folio <span className="mono text-[#374151] font-bold">{selectedRoomData.guest.folio}</span></span><span className="text-[#9ca3af] font-semibold">{selectedRoomData.guest.arrival} → {selectedRoomData.guest.departure}</span><div className="flex-1"/><div className="flex gap-1.5">{["Check Out","Post Charge","View Folio"].map(btn=><button key={btn} className="pms-btn-secondary text-[11px] py-1.5">{btn}</button>)}</div></>):(<><span className="text-[#9ca3af] font-semibold">Không có khách</span><div className="flex-1"/><button className="pms-btn-primary text-[12px]">Walk In</button></>)}
                  <button onClick={()=>setSelectedRoom(null)} className="text-[#9ca3af] hover:text-[#1a1a1a] text-[15px] ml-1 font-bold transition-colors">✕</button>
                </div>
              )}
            </div>
          )}

          {currentTab==="Room Plan"&&<RoomPlanTab/>}
          {currentTab==="Đặt phòng"&&<ReservationTab/>}
          {currentTab==="Báo cáo"&&<ShiftReportTab/>}

          {/* THU NGÂN */}
          {currentTab==="Thu ngân"&&(
            <div className="p-7 max-w-5xl mx-auto space-y-4">
              {cashierView==="menu"&&(
                <>
                  <h2 className="text-[16px] font-bold">Cashier Functions</h2>
                  <Card className="p-6">
                    <div className="grid grid-cols-2 gap-2">
                      {CASHIER_FUNCTIONS.map(fn=>{
                        const isWide=/^[ACDFX] /.test(fn),isPrimary=fn==="Post Transaction";
                        return<button key={fn} onClick={()=>{if(isPrimary)setCashierView("postTransaction");}} className={`text-left px-5 py-3 rounded-[3px] text-[13px] font-bold transition-all duration-150 border ${isWide?"col-span-2":""}${isPrimary?" pms-btn-primary w-full justify-start":" bg-[#fafafa] border-[#e5e7eb] text-[#374151] hover:bg-[#f3f4f6] hover:border-[#d1d5db] hover:shadow-sm hover:-translate-y-0.5"}`}>{fn}</button>;
                      })}
                    </div>
                  </Card>
                </>
              )}
              {cashierView==="postTransaction"&&(
                <div className="space-y-4">
                  <button onClick={()=>setCashierView("menu")} className="flex items-center gap-1.5 text-[13px] text-[#9ca3af] hover:text-[#1a1a1a] font-bold transition-colors"><ChevronLeft size={13} strokeWidth={1.5}/> Quay lại</button>
                  <div className="flex gap-4">
                    <Card className="w-64 shrink-0 p-5">
                      <SectionTitle>Thông tin khách</SectionTitle>
                      <div className="space-y-2">
                        {[{label:"Khách",type:"input",ph:"Tên khách"},{label:"Đoàn",type:"input",ph:""},{label:"TA / Cty",type:"input",ph:""},{label:"Trạng thái",type:"static",val:"IN HOUSE"},{label:"Phòng",type:"static",val:"101"},{label:"Giá phòng",type:"static",val:"23,500"},{label:"Số dư",type:"static",val:"0",red:true}].map(({label,type,ph,val,red})=>(
                          <div key={label} className="grid grid-cols-5 items-center gap-2">
                            <label className="col-span-2 text-[11px] text-[#9ca3af] font-bold uppercase tracking-wide">{label}</label>
                            {type==="input"?<input className="col-span-3 border border-[#e5e7eb] rounded-[3px] px-2.5 py-1.5 text-[13px] font-semibold outline-none focus:border-[#6b7280] bg-[#fafafa]" placeholder={ph}/>:<div className={`col-span-3 mono text-[13px] font-bold ${red?"text-[#c1121f]":"text-[#1a1a1a]"}`}>{val}</div>}
                          </div>
                        ))}
                        <div className="pt-1"><div className="text-[11px] text-[#9ca3af] font-bold uppercase tracking-wide mb-1">Ghi chú</div><textarea className="w-full border border-[#e5e7eb] rounded-[3px] px-2.5 py-1.5 text-[13px] font-semibold outline-none bg-[#fafafa] h-14 resize-none"/></div>
                      </div>
                    </Card>
                    <div className="flex-1 flex flex-col gap-3">
                      <Card className="p-3 flex items-center gap-3">
                        <label className="flex items-center gap-1.5 text-[13px] text-[#6b7280] font-bold cursor-pointer"><input type="checkbox" className="w-3.5 h-3.5 accent-[#0f0f0e]"/> In House</label>
                        <input className="flex-1 border border-[#e5e7eb] rounded-[3px] px-3 py-1.5 text-[13px] font-semibold outline-none bg-[#fafafa]" placeholder="Tìm folio..."/>
                        <button className="pms-btn-primary">Tìm</button>
                      </Card>
                      <Card className="overflow-hidden">
                        <table className="w-full text-left">
                          <thead><tr className="border-b border-[#f3f4f6] bg-[#fafafa]">{["Sts","Folio#","Tên khách","Phòng","Số dư","Ngày đến","Ngày đi"].map(h=><th key={h} className="px-3 py-2.5 text-[10px] tracking-[0.1em] uppercase text-[#6b7280] font-bold">{h}</th>)}</tr></thead>
                          <tbody><tr className="hover:bg-[#fafafa] cursor-pointer transition-colors"><td className="px-3 py-3 text-[13px] text-[#2d6a4f] font-bold mono">OK</td><td className="px-3 py-3 mono text-[13px] font-bold">10254</td><td className="px-3 py-3 text-[13px] font-bold">NGUYEN HUY</td><td className="px-3 py-3 mono text-[13px] font-bold">101</td><td className="px-3 py-3 mono text-[13px] font-bold">0</td><td className="px-3 py-3 mono text-[12px] font-semibold text-[#9ca3af]">01/05/2026</td><td className="px-3 py-3 mono text-[12px] font-semibold text-[#9ca3af]">05/05/2026</td></tr></tbody>
                        </table>
                      </Card>
                    </div>
                  </div>
                  <Card className="overflow-hidden">
                    <table className="w-full text-left">
                      <thead><tr className="border-b border-[#f3f4f6] bg-[#fafafa]">{["Ngày","Code","Mô tả","Ref #","Số tiền","Phòng gốc","Thuế","Inv Date","User"].map(h=><th key={h} className="px-3 py-2.5 text-[10px] tracking-[0.1em] uppercase text-[#6b7280] font-bold">{h}</th>)}</tr></thead>
                      <tbody><tr><td colSpan={9} className="px-3 py-10 text-center text-[13px] text-[#d1d5db] font-semibold">Chưa có giao dịch</td></tr></tbody>
                    </table>
                    <div className="px-5 py-3 border-t border-[#f3f4f6] flex justify-between items-center"><span className="text-[12px] text-[#9ca3af] uppercase tracking-wide font-bold">Balance</span><span className="mono font-bold text-[15px]">0</span></div>
                  </Card>
                  <div className="flex flex-wrap gap-1.5">{["New","Paid","HSKP","Out","Post","Adv Rim","Edit","Split","Print","Set Bill","Cxl Bill","Close"].map(btn=><button key={btn} className="toolbar-btn mono">{btn}</button>)}</div>
                </div>
              )}
            </div>
          )}

          {/* ROOM AVAILABILITY */}
          {currentTab==="Room Availability"&&(
            <div className="flex flex-col" style={{height:"calc(100vh - 56px)"}}>
              <div className="bg-white border-b border-[#e5e7eb] px-5 py-3 flex items-center gap-6 shrink-0 shadow-sm">
                <div className="flex items-center gap-2">
                  <input type="date" value={availStartDate.toISOString().split("T")[0]} onChange={e=>{const d=new Date(e.target.value);if(!isNaN(d.getTime()))setAvailStartDate(d);}} className="mono text-[13px] font-bold border border-[#e5e7eb] rounded-[3px] px-2 py-1.5 outline-none focus:border-[#6b7280] bg-[#fafafa]"/>
                  <span className="text-[15px] font-bold text-[#374151]">{availStartDate.toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric"})}</span>
                </div>
                <div className="flex items-center gap-4 text-[13px] text-[#6b7280]">
                  {(Object.entries(availFilters) as [keyof typeof availFilters,boolean][]).map(([key,val])=>(
                    <label key={key} className="flex items-center gap-1.5 cursor-pointer hover:text-[#1a1a1a] font-semibold">
                      <input type="checkbox" checked={val} onChange={e=>setAvailFilters(f=>({...f,[key]:e.target.checked}))} className="w-3.5 h-3.5 accent-[#0f0f0e]"/>
                      {key==="ooiPhu"?"OOI+PHU":key.charAt(0).toUpperCase()+key.slice(1)}
                    </label>
                  ))}
                </div>
                <div className="flex items-center gap-2 text-[13px] text-[#6b7280] ml-auto">
                  <span className="font-bold">Num Days</span>
                  <input type="number" value={availNumDays} min={1} max={30} onChange={e=>setAvailNumDays(Math.max(1,Math.min(30,Number(e.target.value))))} className="mono w-14 border border-[#e5e7eb] rounded-[3px] px-2 py-1 text-[13px] font-bold outline-none focus:border-[#6b7280] bg-[#fafafa] text-center"/>
                  <button className="toolbar-btn flex items-center gap-1.5" onClick={()=>{setAvailStartDate(new Date(2026,4,1));setAvailNumDays(10);}}><RefreshCw size={11} strokeWidth={2}/> Refresh</button>
                </div>
              </div>
              <div className="flex-1 overflow-auto px-5 py-4">
                <div className="bg-white border border-[#e5e7eb] rounded-[3px] shadow-[0_2px_6px_rgba(0,0,0,0.07)] overflow-hidden">
                  <table className="avail-table w-full text-left border-collapse text-[13px]" style={{minWidth:900}}>
                    <thead>
                      <tr className="border-b-2 border-[#e5e7eb] bg-[#fafafa]">
                        <th className="px-4 py-3 text-[11px] tracking-[0.12em] uppercase text-[#6b7280] font-bold sticky left-0 bg-[#fafafa] z-10 min-w-[160px]">Description</th>
                        <th className="px-3 py-3 text-[11px] tracking-[0.12em] uppercase text-[#6b7280] font-bold min-w-[56px]">Type</th>
                        <th className="px-3 py-3 text-[11px] tracking-[0.12em] uppercase text-[#6b7280] font-bold min-w-[44px] text-center">Total</th>
                        {availDates.map((d,i)=><th key={i} className={`px-2 py-0 text-center min-w-[52px] ${isWeekend(d)?"weekend-col":""}`}><div className="py-2"><div className={`mono text-[12px] font-bold ${isWeekend(d)?"text-[#b45309]":"text-[#374151]"}`}>{d.toLocaleDateString("en-GB",{day:"numeric",month:"numeric"})}</div><div className={`text-[9px] tracking-wide uppercase font-bold ${isWeekend(d)?"text-[#b45309]":"text-[#9ca3af]"}`}>{d.toLocaleDateString("en-GB",{weekday:"short"})}</div></div></th>)}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f3f4f6]">
                      {ROOM_TYPES_AVAILABILITY.map((rt,idx)=>(
                        <tr key={idx} className="transition-colors">
                          <td className="px-4 py-2.5 font-bold text-[14px] sticky left-0 bg-white z-10">{rt.description}</td>
                          <td className="px-3 py-2.5 mono text-[12px] text-[#9ca3af] font-bold">{rt.type}</td>
                          <td className="px-3 py-2.5 mono text-[13px] font-bold text-center">{rt.total}</td>
                          {availDates.map((d,i)=>{const val=rt.available[i]??0;return<td key={i} className={`px-2 py-2.5 text-center ${isWeekend(d)?"weekend-col":""}`}><span className={`mono text-[13px] font-bold inline-block w-8 py-0.5 rounded-[2px] ${availBg(val)}`}>{val}</span></td>;})}
                        </tr>
                      ))}
                      <tr className="bg-[#fafafa] border-t-2 border-[#e5e7eb]">
                        <td className="px-4 py-2.5 font-bold text-[14px] sticky left-0 bg-[#fafafa] z-10">Total</td>
                        <td className="px-3 py-2.5"/>
                        <td className="px-3 py-2.5 mono text-[13px] font-bold text-center">{totalAvailRooms}</td>
                        {availDates.map((d,i)=><td key={i} className={`px-2 py-2.5 text-center ${isWeekend(d)?"weekend-col":""}`}><span className="mono text-[13px] font-bold">{dailyTotals[i]??0}</span></td>)}
                      </tr>
                      <tr><td colSpan={3+availNumDays} className="px-0 py-0"><div className="notes-divider"/></td></tr>
                      <tr className="bg-[#0f0f0e]"><td colSpan={3+availNumDays} className="px-4 py-1"><span className="text-[11px] tracking-[0.14em] uppercase text-[#6b6b68] font-bold">*** NOTES ***</span></td></tr>
                      {([{label:"OOI",data:NOTES_STATIC.ooi},{label:"PHU",data:NOTES_STATIC.phu},{label:"Available Rms",data:NOTES_STATIC.availableRms,bold:true},{label:"OOO",data:NOTES_STATIC.ooo},{label:"Saleable Rms",data:NOTES_STATIC.saleableRms,bold:true}] as {label:string;data:number[];bold?:boolean}[]).map(({label,data,bold})=>(
                        <tr key={label} className="border-t border-[#f3f4f6] hover:bg-[#fafafa]">
                          <td className={`px-4 py-1.5 text-[13px] sticky left-0 bg-white z-10 ${bold?"font-bold":"text-[#6b7280] font-semibold"}`}>{label}</td>
                          <td className="px-3 py-1.5"/><td className="px-3 py-1.5 mono text-[12px] text-center text-[#9ca3af] font-semibold">{data[0]??0}</td>
                          {availDates.map((d,i)=><td key={i} className={`px-2 py-1.5 text-center ${isWeekend(d)?"weekend-col":""}`}><span className={`mono text-[12px] ${bold?"font-bold text-[#1a1a1a]":"text-[#6b7280] font-semibold"}`}>{data[i]??0}</span></td>)}
                        </tr>
                      ))}
                      <tr className="border-t border-[#f3f4f6] hover:bg-[#fafafa]">
                        <td className="px-4 py-1.5 text-[13px] text-[#6b7280] font-semibold sticky left-0 bg-white z-10">Definite</td>
                        <td className="px-3 py-1.5"/><td className="px-3 py-1.5 mono text-[12px] text-center text-[#9ca3af] font-semibold">{dailyDefinite[0]??0}</td>
                        {availDates.map((d,i)=>{const val=dailyDefinite[i]??0,pct=Math.round((val/(NOTES_STATIC.saleableRms[i]||1))*100);return<td key={i} className={`px-2 py-1.5 text-center ${isWeekend(d)?"weekend-col":""}`}><span className="mono text-[12px] text-[#1b4332] font-bold">{val}</span><span className="mono text-[9px] text-[#9ca3af] ml-0.5 font-semibold">({pct}%)</span></td>;})}
                      </tr>
                      <tr className="border-t border-[#f3f4f6] bg-[#fafafa]">
                        <td className="px-4 py-1.5 text-[13px] font-bold sticky left-0 bg-[#fafafa] z-10">Total Occ</td>
                        <td className="px-3 py-1.5"/><td className="px-3 py-1.5 mono text-[12px] text-center font-bold">{totalAvailRooms-(NOTES_STATIC.availableRms[0]??93)}</td>
                        {availDates.map((d,i)=>{const occ=totalAvailRooms-(NOTES_STATIC.availableRms[i]??93),pct=Math.round((occ/(NOTES_STATIC.saleableRms[i]||1))*100),hi=pct>=70;return<td key={i} className={`px-2 py-1.5 text-center ${isWeekend(d)?"weekend-col":""}`}><span className={`mono text-[12px] font-bold ${hi?"text-[#c1121f]":"text-[#1a1a1a]"}`}>{occ}</span><span className={`mono text-[9px] ml-0.5 font-semibold ${hi?"text-[#c1121f]":"text-[#9ca3af]"}`}>({pct}%)</span></td>;})}
                      </tr>
                      <tr><td colSpan={3+availNumDays} className="py-1"/></tr>
                      {([{label:"FIT Arrival",data:NOTES_STATIC.fitArrival},{label:"GIT Arrival",data:NOTES_STATIC.gitArrival},{label:"Waiting List",data:Array(10).fill(0)}]).map(({label,data})=>(
                        <tr key={label} className="border-t border-[#f3f4f6] hover:bg-[#fafafa]">
                          <td className="px-4 py-1.5 text-[13px] text-[#6b7280] font-semibold sticky left-0 bg-white z-10">{label}</td>
                          <td className="px-3 py-1.5"/><td className="px-3 py-1.5 mono text-[12px] text-center text-[#9ca3af] font-semibold">{data[0]??0}</td>
                          {availDates.map((d,i)=><td key={i} className={`px-2 py-1.5 text-center mono text-[12px] font-bold text-[#374151] ${isWeekend(d)?"weekend-col":""}`}>{data[i]??0}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="bg-white border-t border-[#e5e7eb] px-5 py-3 flex items-center gap-2 shrink-0 shadow-[0_-1px_4px_rgba(0,0,0,0.06)]">
                <button className="toolbar-btn primary flex items-center gap-1.5" onClick={exportToCSV}><Download size={11} strokeWidth={2}/> Excel...</button>
                {["Notes","Hotel Status"].map(btn=><button key={btn} className="toolbar-btn">{btn}</button>)}
                <div className="w-px h-5 bg-[#e5e7eb] mx-1"/>
                {["Extra Bed","New Rsvn","Group Rsvn","Rate Level"].map(btn=><button key={btn} className="toolbar-btn">{btn}</button>)}
                <div className="flex-1"/>
                <button className="toolbar-btn flex items-center gap-1.5 text-[#9ca3af] hover:text-[#c1121f]"><X size={12} strokeWidth={2}/> Close</button>
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}
