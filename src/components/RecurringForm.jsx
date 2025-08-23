import React, { useEffect, useMemo, useState } from 'react';

const GOOGLE_SCRIPT_URL = process.env.REACT_APP_GOOGLE_SCRIPT_URL;
const API_KEY = process.env.REACT_APP_GOOGLE_API_KEY;

export default function RecurringForm() {
  const defaultForm = useMemo(() => ({
    name: '',
    type: '지출',
    amount: '',
    mainCategory: '',
    subCategory: '',
    selectedValue: '',
    selectedKind: '',
    paymentMethod: '',
    dayOfMonth: '',
    startMonth: '',
    endMonth: '',
    memo: ''
  }), []);

  const [form, setForm] = useState(defaultForm);
  const [loading, setLoading] = useState(false);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [paymentOptionGroups, setPaymentOptionGroups] = useState([]);

  const monthsDiffInclusive = (startYYYYMM, endYYYYMM) => {
    const [sy, sm] = startYYYYMM.split('-').map(Number);
    const [ey, em] = endYYYYMM.split('-').map(Number);
    return (ey - sy) * 12 + (em - sm) + 1;
  };

  // ✅ flat payload
  const postToGAS = async (action, body) => {
    if (!GOOGLE_SCRIPT_URL || !API_KEY) {
      throw new Error("환경변수(REACT_APP_GOOGLE_SCRIPT_URL / REACT_APP_GOOGLE_API_KEY)가 비어 있습니다.");
    }
    const payload = { action, apiKey: API_KEY, ...body };
    const res = await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      throw new Error('Invalid server response: ' + text);
    }
  };

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

    if (!form.name || !form.amount || !form.dayOfMonth || !form.startMonth) {
      alert('필수 항목을 모두 입력해주세요.');
      return;
    }
    if (!GOOGLE_SCRIPT_URL || !API_KEY) {
      alert('환경변수가 누락되었습니다. .env 설정을 확인하세요.');
      return;
    }

    const amountNumber = Number(form.amount);
    const dayNumber = Number(form.dayOfMonth);
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
      alert('금액을 올바른 숫자로 입력해주세요.');
      return;
    }
    if (!Number.isInteger(dayNumber) || dayNumber <= 0 || dayNumber > 31) {
      alert('매월 며칠은 1~31 사이의 정수여야 합니다.');
      return;
    }

    let computedRepeatTime = '';
    if (form.endMonth) {
      const [sy, sm] = form.startMonth.split('-').map(Number);
      const [ey, em] = form.endMonth.split('-').map(Number);
      const diff = (ey - sy) * 12 + (em - sm);
      if (diff < 0) {
        alert('종료 월은 시작 월 이후여야 합니다.');
        return;
      }
      computedRepeatTime = String(monthsDiffInclusive(form.startMonth, form.endMonth));
    }

    const requestId = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;

    const payload = {
      name: form.name,
      type: form.type,
      amount: amountNumber,
      mainCategory: form.mainCategory || '',
      subCategory: form.subCategory || '',
      selectedValue: form.selectedValue || '',
      selectedKind: form.selectedKind || '',
      payment: form.paymentMethod || '',
      dayOfMonth: dayNumber,
      startMonth: form.startMonth,
      endMonth: form.endMonth || '',
      repeatTime: computedRepeatTime,
      memo: form.memo || '',
      requestId
    };

    setLoading(true);
    try {
      const result = await postToGAS('sheet.recurring.create', payload);

      if (result.status === 'ok' || result.status === 'success') {
        alert('등록이 완료되었습니다.');
        setForm(defaultForm);
      } else if (result.skipped === 'duplicate_requestId' || result.skipped === 'duplicate_content') {
        alert('중복 요청으로 건너뛰었습니다.');
        setForm(defaultForm);
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

  const handleReset = () => setForm(defaultForm);
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
      {/* 렌더링 부분은 기존 그대로 유지 */}
      <h2 style={{ textAlign: 'center' }}>고정 거래 입력</h2>
      <p style={{ textAlign: 'center', color: '#666', marginBottom: '12px' }}>
        정기적으로 발생하는 수입 및 지출을 등록해주세요
      </p>

      <label>항목 이름 *</label>
      <input
        style={inputStyle}
        placeholder="예: 월세, 헬스장, 급여"
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
        종료 월을 지정하면 시작~종료 월(포함)의 개월 수를 자동 계산해 저장합니다. 비워두면 무기한 반복으로 저장됩니다.
      </small>

      <label>메모</label>
      <input
        style={inputStyle}
        placeholder="메모"
        value={form.memo}
        onChange={(e) => setForm({ ...form, memo: e.target.value })}
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

const formStyle = { display:'flex', flexDirection:'column', maxWidth:'500px', width:'100%', margin:'40px auto', padding:'24px 16px', border:'1px solid #ccc', borderRadius:'8px', backgroundColor:'#f9f9f9', gap:'12px', fontFamily:'sans-serif' };
const inputStyle = { padding:'10px', border:'1px solid #ddd', borderRadius:'4px', fontSize:'14px' };
const buttonGroupStyle = { display:'flex', justifyContent:'space-between', gap:'10px', marginTop:'12px' };
const buttonStyle = { flex:1, padding:'12px', backgroundColor:'#007bff', color:'#fff', border:'none', borderRadius:'4px', fontSize:'16px', cursor:'pointer' };
const secondaryButtonStyle = { ...buttonStyle, backgroundColor:'#6c757d' };
