"use client";

import { useState } from "react";
import { motion } from "framer-motion";

export default function AvantiLoginSliding() {
  const [isHotel, setIsHotel] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = () => {
    if (username === "admin" && password === "123") {
      window.location.href = "/dashboard";
    } else {
      alert("Sai tài khoản hoặc mật khẩu rồi 'Sếp' ơi!");
    }
  };

  return (
    <div className="min-h-screen bg-[#e2e8f0] flex items-center justify-center font-sans">
      <div className="relative w-[850px] h-[500px] bg-white rounded-[30px] shadow-2xl overflow-hidden flex">
        
        {/* PHẦN FORM ĐĂNG NHẬP */}
        <div className="absolute inset-0 flex text-black">
          {/* Form Boutique */}
          <div className="w-1/2 flex flex-col items-center justify-center p-12">
            <h2 className="text-3xl font-bold mb-6 text-[#9d174d]">Avanti Boutique</h2>
            <input 
              type="text" 
              placeholder="Username" 
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-gray-100 p-3 rounded-lg mb-4 outline-none border border-gray-200" 
            />
            <input 
              type="password" 
              placeholder="Password" 
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-gray-100 p-3 rounded-lg mb-6 outline-none border border-gray-200" 
            />
            <button onClick={handleLogin} className="bg-[#9d174d] text-white px-10 py-2 rounded-full font-bold hover:opacity-90 transition">LOG IN</button>
          </div>

          {/* Form Hotel */}
          <div className="w-1/2 flex flex-col items-center justify-center p-12">
            <h2 className="text-3xl font-bold mb-6 text-black">Avanti Hotel</h2>
            <input 
              type="text" 
              placeholder="Username" 
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-gray-100 p-3 rounded-lg mb-4 outline-none border border-gray-200" 
            />
            <input 
              type="password" 
              placeholder="Password" 
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-gray-100 p-3 rounded-lg mb-6 outline-none border border-gray-200" 
            />
            <button onClick={handleLogin} className="bg-black text-white px-10 py-2 rounded-full font-bold hover:opacity-80 transition">LOG IN</button>
          </div>
        </div>

        {/* PHẦN LỚP PHỦ TRƯỢT */}
        <motion.div
          animate={{ x: isHotel ? 0 : "100%" }}
          transition={{ type: "spring", stiffness: 100, damping: 20 }}
          className="absolute top-0 left-0 w-1/2 h-full z-10 overflow-hidden"
        >
          <div 
            className={`w-[200%] h-full flex transition-colors duration-500 ${isHotel ? 'bg-black' : 'bg-[#9d174d]'}`}
            style={{ transform: isHotel ? "translateX(0%)" : "translateX(-50%)" }}
          >
            <div className="w-1/2 h-full flex flex-col items-center justify-center text-white p-12 text-center">
              <h1 className="text-4xl font-bold mb-4 italic">Welcome Back!</h1>
              <p className="mb-8 opacity-80">Bạn muốn quản lý chi nhánh Boutique?</p>
              <button onClick={() => setIsHotel(false)} className="border-2 border-white px-10 py-2 rounded-full font-bold hover:bg-white hover:text-black transition">CHỌN BOUTIQUE</button>
            </div>
            <div className="w-1/2 h-full flex flex-col items-center justify-center text-white p-12 text-center">
              <h1 className="text-4xl font-bold mb-4 italic">Hello, Avanti!</h1>
              <p className="mb-8 opacity-80">Quay lại quản lý chi nhánh Hotel?</p>
              <button onClick={() => setIsHotel(true)} className="border-2 border-white px-10 py-2 rounded-full font-bold hover:bg-white hover:text-[#9d174d] transition">CHỌN HOTEL</button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}