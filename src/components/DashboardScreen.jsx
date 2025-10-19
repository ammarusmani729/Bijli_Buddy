import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Sidebar from "./Sidebar";
import { IonIcon } from "@ionic/react";
import {
  sunnyOutline,
  flashOutline,
  trendingUp,
  sparklesOutline,
} from "ionicons/icons";
import { auth, db } from "../config/firebase.js";
import { doc, getDoc, setDoc } from "firebase/firestore";
import quicktip from "../assets/quick-tip.png";

export default function Dashboard() {
  const [aiResponse, setAiResponse] = useState("");
  const [activeTab, setActiveTab] = useState("Dashboard");
  const [userData, setUserData] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [loadingAI, setLoadingAI] = useState(false);
  const [displayedAdvice, setDisplayedAdvice] = useState([]);

  // ✅ Dynamic meter reading
  const [meterReading, setMeterReading] = useState("");
  const [currentReading, setCurrentReading] = useState(0); // Saved current reading
  const [monthlyUnits, setMonthlyUnits] = useState(0);
  const [predictedBill, setPredictedBill] = useState(0);
  const [nextSlabUnits, setNextSlabUnits] = useState(0);
  const [aiTemperature] = useState("28°C");

  // 🔹 Energy-saving advice list
  const adviceList = [
    [
      "Avoid using heavy appliances like water motors, irons, or washing machines during peak hours (6 PM–10 PM).",
      "Run high-load devices early morning or after 10 PM to reduce stress on your connection.",
      "Use inverter-based appliances — they adjust power usage automatically and save up to 40%.",
      "Install a digital energy meter to track daily electricity consumption.",
    ],
    [
      "Buy ceiling fans that consume 120 watts or less — or switch to AC/DC or brushless (BLDC) fans using only 35–50 watts.",
      "Replace old, noisy fans — older ones often waste 30% more electricity.",
      "Lubricate fan bearings every 6 months for smoother operation and better efficiency.",
      "Clean fan blades monthly — dust buildup increases power draw.",
    ],
    [
      "Keep AC temperature at 26°C — it's the most efficient cooling level for Pakistan's climate.",
      "Prefer inverter ACs — they consume 40–50% less power than normal ACs.",
      "Regularly clean AC filters to maintain cooling efficiency.",
      "Use ceiling fans along with AC to circulate air evenly and reduce cooling time.",
    ],
    [
      "Don't overload the refrigerator — proper air circulation improves cooling efficiency.",
      "Buy energy-efficient fridges rated below 250 watts or with inverter compressors.",
      "Avoid keeping the fridge near sunlight or walls — it forces the compressor to run longer.",
      "Defrost regularly — ice buildup increases power usage.",
    ],
    [
      "Switch to LED bulbs and tube lights — they consume 80% less power and last 10x longer.",
      "Use daylight sensors or timers for outdoor lights.",
      "Install dimmer switches to control brightness in living rooms.",
      "Replace 100W bulbs with 12W LEDs to save around 300 units annually per bulb.",
    ],
  ];

  // 🔹 Fetch AI advice (with delay + fallback)
  const getAdvice = async () => {
    if (!userData) return;

    setLoadingAI(true);
    setAiResponse("");
    setDisplayedAdvice([]);

    await new Promise((resolve) => setTimeout(resolve, 3000));

    try {
      const response = await fetch("http://localhost:5000/get-ai-advice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location: userData.location,
          appliances: userData.appliances,
        }),
      });

      const data = await response.json();
      if (data.advice && data.advice.trim() !== "No response from AI") {
        setAiResponse(data.advice);
      } else {
        const randomSet =
          adviceList[Math.floor(Math.random() * adviceList.length)];
        setDisplayedAdvice(randomSet);
      }
    } catch (err) {
      console.error(err);
      const randomSet =
        adviceList[Math.floor(Math.random() * adviceList.length)];
      setDisplayedAdvice(randomSet);
    } finally {
      setLoadingAI(false);
    }
  };

  // 🔹 Fetch user data and load saved meter readings
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const currentUser = auth.currentUser;
        if (!currentUser) {
          setLoadingUser(false);
          return;
        }

        const userRef = doc(db, "users", currentUser.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          const data = userSnap.data();
          setUserData(data);
          
          // ✅ Load saved meter data from Firestore
          if (data.meterData) {
            setCurrentReading(data.meterData.currentReading || 0);
            setMonthlyUnits(data.meterData.monthlyUnits || 0);
            setPredictedBill(data.meterData.predictedBill || 0);
            setNextSlabUnits(data.meterData.nextSlabUnits || 0);
          }
        } else {
          console.warn("⚠ No user document found in Firestore");
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
      } finally {
        setLoadingUser(false);
      }
    };

    fetchUserData();
  }, []);

  // ✅ Handle Meter Reading Input and save to Firestore
  const handleMeterSubmit = async () => {
    const reading = parseFloat(meterReading);
    if (isNaN(reading) || reading <= 0) {
      alert("⚠ Please enter a valid meter reading.");
      return;
    }

    // Calculate predicted bill (Rs.34 per unit)
    const bill = reading * 34;

    // Slab limits: 200, 400, 600
    let nextLimit = 0;
    if (reading < 200) nextLimit = 200 - reading;
    else if (reading < 400) nextLimit = 400 - reading;
    else if (reading < 600) nextLimit = 600 - reading;
    else nextLimit = 0; // crossed all slabs

    // Update state
    setCurrentReading(reading);
    setMonthlyUnits(reading);
    setPredictedBill(bill);
    setNextSlabUnits(nextLimit);
    setMeterReading("");

    // ✅ Save to Firestore
    try {
      const currentUser = auth.currentUser;
      if (currentUser) {
        const userRef = doc(db, "users", currentUser.uid);
        await setDoc(
          userRef,
          {
            meterData: {
              currentReading: reading,
              monthlyUnits: reading,
              predictedBill: bill,
              nextSlabUnits: nextLimit,
              lastUpdated: new Date().toISOString(),
            },
          },
          { merge: true }
        );
        console.log("✅ Meter data saved to Firestore");
      }
    } catch (error) {
      console.error("Error saving meter data:", error);
      alert("Failed to save data. Please try again.");
    }
  };

  if (loadingUser) {
    return (
      <div className="flex justify-center items-center h-screen text-lg font-medium text-gray-700">
        Loading dashboard...
      </div>
    );
  }

  return (
    <div className="relative flex flex-col md:flex-row min-h-screen bg-gradient-to-b from-[#E0F2F1] via-[#B2DFDB] to-[#80CBC4] overflow-hidden">
      {/* Sidebar */}
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main Content */}
      <div className="flex-grow p-4 pt-20 md:pt-8 bg-emerald-50/50 overflow-y-auto z-10">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Header */}
          <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold text-[#0F766E] mb-2 sm:mb-0">
              Welcome, {userData?.username || userData?.name || "User"}
            </h1>
            <div className="flex items-center text-gray-700">
              <IonIcon
                icon={sunnyOutline}
                className="text-xl mr-2 text-yellow-500"
              />
              <span className="font-semibold text-base sm:text-lg">
                {aiTemperature}
              </span>
            </div>
          </header>

          {/* 🔹 Meter Reading Input */}
          <div className="bg-white rounded-xl p-4 shadow-md mb-6 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-grow">
              <input
                type="number"
                value={meterReading}
                onChange={(e) => setMeterReading(e.target.value)}
                placeholder="Enter your current meter reading (units)"
                className="border border-gray-300 rounded-lg px-3 py-2 w-full focus:ring-2 focus:ring-teal-500 outline-none"
              />
              {currentReading > 0 && (
                <p className="text-sm text-gray-600 mt-2">
                  Current saved reading:{" "}
                  <span className="font-semibold text-teal-700">
                    {currentReading} units
                  </span>
                </p>
              )}
            </div>
            <button
              onClick={handleMeterSubmit}
              className="bg-[#0F766E] text-white px-4 py-2 rounded-lg hover:bg-[#115E59] transition whitespace-nowrap"
            >
              Update Reading
            </button>
          </div>

          {/* Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {[
              {
                title: "Next Slab In",
                value: `${nextSlabUnits} units`,
                icon: flashOutline,
              },
              {
                title: "This Month",
                value: `${monthlyUnits} units`,
                icon: flashOutline,
              },
              {
                title: "Predicted Bill",
                value: `Rs. ${predictedBill.toLocaleString()}`,
                icon: trendingUp,
              },
            ].map((card, idx) => (
              <div
                key={idx}
                className="bg-white rounded-2xl p-5 shadow-lg border-t-4 border-teal-500"
              >
                <IonIcon icon={card.icon} className="text-teal-500 text-2xl" />
                <p className="text-base sm:text-lg font-medium text-gray-700 mt-2">
                  {card.title}
                </p>
                <h2 className="text-3xl sm:text-4xl font-extrabold text-teal-600 mt-1">
                  {card.value}
                </h2>
              </div>
            ))}
          </div>

          {/* Quick Tip / AI Advice */}
          <div className="bg-[#0F766E] border border-[#0F766E]/50 rounded-2xl p-5 sm:p-6 shadow-xl text-white flex flex-col sm:flex-row items-start sm:items-stretch gap-4">
            <div className="w-full sm:w-[70%]">
              <div className="flex items-center mb-3">
                <IonIcon
                  icon={sparklesOutline}
                  className="text-white text-2xl"
                />
                <h2 className="ml-2 text-lg sm:text-xl font-bold">AI Advice</h2>
              </div>

              <button
                onClick={getAdvice}
                className="bg-teal-500 text-white px-4 py-2 rounded font-bold hover:bg-teal-600 transition mb-4"
              >
                Get AI Energy Advice
              </button>

              {loadingAI && <p className="text-gray-200/80">Loading...</p>}

              {!loadingAI && aiResponse && (
                <div className="mt-4 p-4 bg-gray-50/20 rounded border border-gray-200/30 text-gray-100">
                  {aiResponse.split("\n").map((line, index) => (
                    <p key={index}>{line}</p>
                  ))}
                </div>
              )}

              {!loadingAI && displayedAdvice.length > 0 && (
                <ul className="list-disc pl-5 space-y-2 text-gray-200/90 text-base sm:text-lg">
                  {displayedAdvice.map((tip, index) => (
                    <li key={index}>{tip}</li>
                  ))}
                </ul>
              )}
            </div>

            <div className="w-full sm:w-[30%] flex justify-center sm:justify-end mt-3 sm:mt-0">
              <img
                src={quicktip}
                alt="Quick Tip Illustration"
                className="rounded-xl object-contain max-h-40 sm:max-h-56 w-auto sm:w-full"
              />
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
