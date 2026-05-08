import React from "react";
import "../index.css";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Sidebar from "./Sidebar";
import Home from "./pages/Home";
import Explore from "./pages/Explore";
import Communities from "./pages/Communities";
import Community from "./pages/Community";
import Following from "./pages/Following";
import Bookmarks from "./pages/Bookmarks";
import BroLLM from "./pages/BroLLM";
import DM from "./pages/DM";
import Profile from "./pages/Profile";
import UserProfile from "./pages/UserProfile";
import Feed from "./Feed";

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-[#2563eb]/35 to-[#b6ff22]/25 text-black font-inter flex">
        <div className="w-72 min-h-screen p-4">
          <Sidebar />
        </div>
        <main className="flex-1 p-8">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/explore" element={<Explore />} />
            <Route path="/communities" element={<Communities />} />
            <Route path="/communities/:communityId" element={<Community />} />
            <Route path="/following" element={<Following />} />
            <Route path="/bookmarks" element={<Bookmarks />} />
            <Route path="/bro-llm" element={<BroLLM />} />
            <Route path="/dm" element={<DM />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/profile/:userId" element={<UserProfile />} />
            <Route path="/feed" element={<Feed />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
