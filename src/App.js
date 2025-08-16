// App.js
import React from "react";
import { BrowserRouter, Routes, Route, Navigate, NavLink, useLocation } from "react-router-dom";
import TransactionForm from "./components/TransactionForm";
import RecurringForm from "./components/RecurringForm";

// 스타일 (기존 스타일 재사용)
const buttonContainerStyle = {
  display: "flex",
  justifyContent: "center",
  gap: "12px",
  margin: "40px 0 20px",
};

const tabStyle = {
  padding: "14px 28px",
  fontSize: "16px",
  backgroundColor: "#f1f1f1",
  color: "#333",
  border: "1px solid #ccc",
  borderRadius: "10px",
  cursor: "pointer",
  transition: "all 0.3s ease",
  textDecoration: "none",
};

const activeTabStyle = {
  ...tabStyle,
  backgroundColor: "#007bff",
  color: "white",
  fontWeight: "bold",
  borderColor: "#0056b3",
  boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
};

function TopTabs() {
  const location = useLocation();
  const isActive = (path) => location.pathname === path;

  return (
    <div style={buttonContainerStyle}>
      <NavLink to="/form1" style={isActive("/form1") ? activeTabStyle : tabStyle}>
        변동 거래 입력
      </NavLink>
      <NavLink to="/form2" style={isActive("/form2") ? activeTabStyle : tabStyle}>
        고정 거래 입력
      </NavLink>
    </div>
  );
}

function NotFound() {
  return (
    <div style={{ textAlign: "center", marginTop: 40 }}>
      <h2>페이지를 찾을 수 없습니다.</h2>
      <p>
        <a href="/form1">/form1</a> 또는 <a href="/form2">/form2</a>로 이동해 주세요.
      </p>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <TopTabs />
      <Routes>
        {/* 시작은 form1로 */}
        <Route path="/" element={<Navigate to="/form1" replace />} />
        <Route path="/form1" element={<TransactionForm />} />
        <Route path="/form2" element={<RecurringForm />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
