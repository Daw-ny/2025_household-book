import React, { useState } from 'react';

// 환경변수에서 URL과 키를 가져옵니다.
const GOOGLE_SCRIPT_URL = process.env.REACT_APP_GOOGLE_SCRIPT_URL;
const API_KEY = process.env.REACT_APP_GOOGLE_API_KEY;

export default function TransactionForm() {
  // 현지 시간 기준 datetime-local 형식 문자열 생성
  const getLocalDateTimeString = () => {
    const now = new Date();
    const offset = now.getTimezoneOffset();
    const local = new Date(now.getTime() - offset * 60000);
    return local.toISOString().slice(0, 16); // yyyy-MM-ddTHH:mm
  };

  // 초기 폼 값 정의
  const defaultForm = {
    date: getLocalDateTimeString(),
    type: '지출',
    item: '',
    amount: '',
    mainCategory: '',
    subCategory: '',
    payment: '',
    memo: ''
  };

  const [form, setForm] = useState(defaultForm);

  // 등록 버튼 클릭 시 호출
  const handleSubmit = async () => {
    if (!form.date || !form.type || !form.item || !form.amount) {
      alert("날짜, 항목, 금액, 수입/지출을 모두 입력해주세요.");
      return;
    }

    if (!GOOGLE_SCRIPT_URL || !API_KEY) {
      alert("환경변수가 누락되었습니다. .env 설정을 확인하세요.");
      return;
    }

    const formWithTargetAndKey = {
      ...form,
      targetSheet: 'Transactions',
      apiKey: API_KEY
    };

    try {
      const response = await fetch(GOOGLE_SCRIPT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8"
        },
        body: JSON.stringify(formWithTargetAndKey)
      });

      const text = await response.text();         // 👈 HTML 응답으로 받음
      const result = JSON.parse(text);            // 👈 수동으로 JSON 파싱

      if (result.status === "success") {
        alert("등록이 완료되었습니다.");
        setForm(defaultForm);
      } else if (result.status === "unauthorized") {
        alert("접근이 거부되었습니다. API 키를 확인하세요.");
      } else {
        alert("오류 발생: " + result.status);
      }
    } catch (error) {
      alert("서버 오류: " + error.message);
    }
  };


  // 초기화
  const handleReset = () => {
    setForm(defaultForm);
  };

  // 닫기
  const handleClose = () => {
    window.close();
  };

  return (
    <form
      style={formStyle}
      onSubmit={(e) => {
        e.preventDefault();
        handleSubmit();
      }}
    >
      <h2 style={{ textAlign: 'center' }}>변동 거래 입력</h2>
      <p style={{ textAlign: 'center', color: '#666', marginBottom: '12px' }}>
        1회성 수입 및 지출 내역을 적어주세요
      </p>

      <label>날짜 *</label>
      <input
        type="datetime-local"
        style={inputStyle}
        value={form.date}
        onChange={e => setForm({ ...form, date: e.target.value })}
      />

      <label>수입/지출 *</label>
      <select
        style={inputStyle}
        value={form.type}
        onChange={e => setForm({ ...form, type: e.target.value })}
      >
        <option value="지출">지출</option>
        <option value="수입">수입</option>
      </select>

      <label>항목 *</label>
      <input
        style={inputStyle}
        placeholder="항목"
        value={form.item}
        onChange={e => setForm({ ...form, item: e.target.value })}
      />

      <label>금액 *</label>
      <input
        style={inputStyle}
        type="number"
        placeholder="금액"
        value={form.amount}
        onChange={e => setForm({ ...form, amount: e.target.value })}
      />

      <label>대분류</label>
      <input
        style={inputStyle}
        placeholder="대분류"
        value={form.mainCategory}
        onChange={e => setForm({ ...form, mainCategory: e.target.value })}
      />

      <label>소분류</label>
      <input
        style={inputStyle}
        placeholder="소분류"
        value={form.subCategory}
        onChange={e => setForm({ ...form, subCategory: e.target.value })}
      />

      <label>결제 수단</label>
      <input
        style={inputStyle}
        placeholder="결제 수단"
        value={form.payment}
        onChange={e => setForm({ ...form, payment: e.target.value })}
      />

      <label>메모</label>
      <input
        style={inputStyle}
        placeholder="메모"
        value={form.memo}
        onChange={e => setForm({ ...form, memo: e.target.value })}
      />

      <div style={buttonGroupStyle}>
        <button type="submit" style={buttonStyle}>등록</button>
        <button type="button" style={secondaryButtonStyle} onClick={handleReset}>초기화</button>
        <button type="button" style={secondaryButtonStyle} onClick={handleClose}>닫기</button>
      </div>
    </form>
  );
}

// --- 스타일 정의 ---
const formStyle = {
  display: 'flex',
  flexDirection: 'column',
  maxWidth: '500px',
  width: '100%',
  margin: '40px auto',
  padding: '24px 16px',
  border: '1px solid #ccc',
  borderRadius: '8px',
  backgroundColor: '#f9f9f9',
  gap: '12px',
  fontFamily: 'sans-serif'
};

const inputStyle = {
  padding: '10px',
  border: '1px solid #ddd',
  borderRadius: '4px',
  fontSize: '14px'
};

const buttonGroupStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '10px',
  marginTop: '12px'
};

const buttonStyle = {
  flex: 1,
  padding: '12px',
  backgroundColor: '#007bff',
  color: '#fff',
  border: 'none',
  borderRadius: '4px',
  fontSize: '16px',
  cursor: 'pointer'
};

const secondaryButtonStyle = {
  ...buttonStyle,
  backgroundColor: '#6c757d'
};
