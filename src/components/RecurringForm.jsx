import React, { useState } from 'react';

const GOOGLE_SCRIPT_URL = process.env.REACT_APP_GOOGLE_SCRIPT_URL;
const API_KEY = process.env.REACT_APP_GOOGLE_API_KEY;

export default function RecurringForm() {
  // 초기 폼 값 (repeatTime은 입력받지 않음)
  const defaultForm = {
    name: '',
    type: '지출',
    amount: '',
    mainCategory: '',
    subCategory: '',
    paymentMethod: '',
    dayOfMonth: '',
    startMonth: '',
    endMonth: '',
    memo: ''
  };

  const [form, setForm] = useState(defaultForm);

  // YYYY-MM 문자열 두 개의 포함 개월 수 계산 (예: 2025-08 ~ 2026-01 -> 6)
  const monthsDiffInclusive = (startYYYYMM, endYYYYMM) => {
    const [sy, sm] = startYYYYMM.split('-').map(Number);
    const [ey, em] = endYYYYMM.split('-').map(Number);
    return (ey - sy) * 12 + (em - sm) + 1;
  };

  const handleSubmit = async () => {
    // 필수값 검증
    if (!form.name || !form.amount || !form.dayOfMonth || !form.startMonth) {
      alert('필수 항목을 모두 입력해주세요.');
      return;
    }

    if (!GOOGLE_SCRIPT_URL || !API_KEY) {
      alert('환경변수가 누락되었습니다. .env 설정을 확인하세요.');
      return;
    }

    // 종료월 유효성 및 반복횟수 계산
    let computedRepeatTime = '';
    if (form.endMonth) {
      const [sy, sm] = form.startMonth.split('-').map(Number);
      const [ey, em] = form.endMonth.split('-').map(Number);
      const diff = (ey - sy) * 12 + (em - sm); // 미포함 차
      if (diff < 0) {
        alert('종료 월은 시작 월 이후여야 합니다.');
        return;
      }
      computedRepeatTime = String(monthsDiffInclusive(form.startMonth, form.endMonth));
    }

    const payload = {
      ...form,
      targetSheet: 'Recurring',
      apiKey: API_KEY,
      repeatTime: computedRepeatTime // 종료월이 없으면 ''(무기한)
    };

    try {
      const response = await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        // preflight(OPTIONS) 방지: simple request 헤더
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      });

      const text = await response.text(); // Apps Script가 text로 응답하는 경우 대비
      const result = JSON.parse(text);

      if (result.status === 'success') {
        alert('등록이 완료되었습니다.');
        setForm(defaultForm);
      } else if (result.status === 'unauthorized') {
        alert('접근이 거부되었습니다. API 키를 확인하세요.');
      } else {
        alert('오류 발생: ' + (result.message || result.status));
      }
    } catch (error) {
      alert('서버 오류: ' + error.message);
    }
  };

  const handleReset = () => setForm(defaultForm);
  const handleClose = () => window.close();

  return (
    <form
      style={formStyle}
      onSubmit={(e) => {
        e.preventDefault();
        handleSubmit();
      }}
    >
      <h2 style={{ textAlign: 'center' }}>고정 거래 입력</h2>
      <p style={{ textAlign: 'center', color: '#666', marginBottom: '12px' }}>
        정기적으로 발생하는 수입 및 지출을 등록해주세요
      </p>

      <label>항목 이름 *</label>
      <input
        style={inputStyle}
        placeholder="예: 월세, 급여"
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
      />

      <label>수입/지출 *</label>
      <select
        style={inputStyle}
        value={form.type}
        onChange={(e) => setForm({ ...form, type: e.target.value })}
      >
        <option value="지출">지출</option>
        <option value="수입">수입</option>
      </select>

      <label>금액 *</label>
      <input
        style={inputStyle}
        type="number"
        placeholder="금액"
        value={form.amount}
        onChange={(e) => setForm({ ...form, amount: e.target.value })}
      />

      <label>대분류</label>
      <input
        style={inputStyle}
        placeholder="대분류"
        value={form.mainCategory}
        onChange={(e) => setForm({ ...form, mainCategory: e.target.value })}
      />

      <label>소분류</label>
      <input
        style={inputStyle}
        placeholder="소분류"
        value={form.subCategory}
        onChange={(e) => setForm({ ...form, subCategory: e.target.value })}
      />

      <label>결제 수단</label>
      <input
        style={inputStyle}
        placeholder="카드, 계좌 등"
        value={form.paymentMethod}
        onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
      />

      <label>매월 며칠에 발생? *</label>
      <input
        type="number"
        style={inputStyle}
        placeholder="예: 1"
        value={form.dayOfMonth}
        onChange={(e) => setForm({ ...form, dayOfMonth: e.target.value })}
      />

      <label>시작 월 *</label>
      <input
        type="month"
        style={inputStyle}
        value={form.startMonth}
        onChange={(e) => setForm({ ...form, startMonth: e.target.value })}
      />

      <label>종료 월 (선택)</label>
      <input
        type="month"
        style={inputStyle}
        value={form.endMonth}
        onChange={(e) => setForm({ ...form, endMonth: e.target.value })}
      />

      <small style={{ fontSize: '12px', color: '#666' }}>
        종료 월을 지정하면 시작~종료 월(포함)의 개월 수를 자동 계산해 저장합니다.
        종료 월을 비워두면 무기한 반복으로 저장됩니다.
      </small>

      <label>메모</label>
      <input
        style={inputStyle}
        placeholder="메모"
        value={form.memo}
        onChange={(e) => setForm({ ...form, memo: e.target.value })}
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
