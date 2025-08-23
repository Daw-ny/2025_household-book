import React, { useEffect, useMemo, useState } from 'react';

// 환경변수
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

  // 초기 폼 값
  const defaultForm = useMemo(() => ({
    date: getLocalDateTimeString(),
    type: '지출',
    item: '',
    amount: '',
    mainCategory: '',
    subCategory: '',
    selectedValue: '',
    selectedKind: '',
    payment: '',
    memo: ''
  }), []);

  const [form, setForm] = useState(defaultForm);
  const [loading, setLoading] = useState(false);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [paymentOptionGroups, setPaymentOptionGroups] = useState([]);

  // 공통: GAS 호출 헬퍼 (flat payload)
  const postToGAS = async (action, body) => {
    if (!GOOGLE_SCRIPT_URL || !API_KEY) {
      throw new Error("환경변수(REACT_APP_GOOGLE_SCRIPT_URL / REACT_APP_GOOGLE_API_KEY)가 비어 있습니다.");
    }
    const payload = { action, apiKey: API_KEY, ...body };
    const res = await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch (e) {
      throw new Error('Invalid server response: ' + text);
    }
  };

  // 폼 오픈 시: 옵션 로딩
  useEffect(() => {
    if (!GOOGLE_SCRIPT_URL || !API_KEY) return;
    const loadOptions = async () => {
      setOptionsLoading(true);
      try {
        const result = await postToGAS('meta.paymentOptions.list', { nocache: true });
        const groups = (result.data && result.data.groups) || result.groups || [];
        setPaymentOptionGroups(groups);
      } catch (e) {
        console.error(e);
      } finally {
        setOptionsLoading(false);
      }
    };
    loadOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [GOOGLE_SCRIPT_URL, API_KEY]);

  const handleSubmit = async () => {
    if (loading) return;

    if (!form.date || !form.type || !form.item || !form.amount) {
      alert('날짜, 항목, 금액, 수입/지출을 모두 입력해주세요.');
      return;
    }
    if (!GOOGLE_SCRIPT_URL || !API_KEY) {
      alert('환경변수가 누락되었습니다. .env 설정을 확인하세요.');
      return;
    }

    const amountNumber = Number(form.amount);
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
      alert('금액을 올바른 숫자로 입력해주세요.');
      return;
    }

    const requestId = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;

    const payload = {
      date: form.date,
      type: form.type,
      item: form.item,
      amount: amountNumber,
      mainCategory: form.mainCategory || '',
      subCategory: form.subCategory || '',
      selectedValue: form.selectedValue || '',
      selectedKind: form.selectedKind || '',
      payment: form.payment || '',
      memo: form.memo || '',
      requestId
    };

    setLoading(true);
    try {
      const result = await postToGAS('sheet.transactions.create', payload);

      if (result.status === 'ok' || result.status === 'success') {
        alert('등록이 완료되었습니다.');
        setForm({ ...defaultForm, date: getLocalDateTimeString() });
      } else if (result.skipped === 'duplicate_requestId' || result.skipped === 'duplicate_content') {
        alert('중복 요청으로 건너뛰었습니다.');
        setForm({ ...defaultForm, date: getLocalDateTimeString() });
      } else if (result.status === 'unauthorized') {
        alert('접근이 거부되었습니다. API 키를 확인하세요.');
      } else {
        alert('오류 발생: ' + (result.message || result.status || 'unknown'));
      }
    } catch (error) {
      alert('서버 오류: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => setForm({ ...defaultForm, date: getLocalDateTimeString() });
  const handleClose = () => window.close();

  const handlePaymentSelect = (value) => {
    if (!value) {
      setForm(f => ({ ...f, selectedValue: '', selectedKind: '' }));
      return;
    }
    let foundKind = '';
    for (const g of paymentOptionGroups) {
      if (g.options?.some(o => o.value === value)) {
        foundKind = g.kind;
        break;
      }
    }
    setForm(f => ({ ...f, selectedValue: value, selectedKind: foundKind }));
  };

  return (
    <form
      style={formStyle}
      onSubmit={(e) => {
        e.preventDefault();
        handleSubmit();
      }}
    >
      {/* ... 이하 렌더링 동일 (생략 없이 그대로 두세요) */}
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
        <option value="이체">이체</option>
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

      <label>결제/계좌 (드롭다운)</label>
      <select
        style={inputStyle}
        value={form.selectedValue}
        onChange={(e) => handlePaymentSelect(e.target.value)}
        disabled={optionsLoading}
      >
        <option value="">{optionsLoading ? '로딩 중...' : '-- 선택 --'}</option>
        {paymentOptionGroups.map(group => (
          <optgroup key={group.label} label={group.label}>
            {group.options?.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </optgroup>
        ))}
      </select>

      <label>결제 수단(직접 입력)</label>
      <input
        style={inputStyle}
        placeholder="예: 국민카드, 토스뱅크 등"
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
        <button type="submit" style={{...buttonStyle, opacity: loading ? 0.7 : 1}} disabled={loading}>
          {loading ? '등록 중…' : '등록'}
        </button>
        <button type="button" style={secondaryButtonStyle} onClick={handleReset} disabled={loading}>초기화</button>
        <button type="button" style={secondaryButtonStyle} onClick={handleClose} disabled={loading}>닫기</button>
      </div>
    </form>
  );
}

// --- 스타일 동일 ---
const formStyle = { display:'flex', flexDirection:'column', maxWidth:'500px', width:'100%', margin:'40px auto', padding:'24px 16px', border:'1px solid #ccc', borderRadius:'8px', backgroundColor:'#f9f9f9', gap:'12px', fontFamily:'sans-serif' };
const inputStyle = { padding:'10px', border:'1px solid #ddd', borderRadius:'4px', fontSize:'14px' };
const buttonGroupStyle = { display:'flex', justifyContent:'space-between', gap:'10px', marginTop:'12px' };
const buttonStyle = { flex:1, padding:'12px', backgroundColor:'#007bff', color:'#fff', border:'none', borderRadius:'4px', fontSize:'16px', cursor:'pointer' };
const secondaryButtonStyle = { ...buttonStyle, backgroundColor:'#6c757d' };
