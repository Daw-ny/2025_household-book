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
    type: '지출',           // '지출' | '수입' | '이체'(선택)
    item: '',
    amount: '',
    mainCategory: '',
    subCategory: '',
    // 드롭다운 선택 결과(백엔드에서 PaymentMethod로 기록)
    selectedValue: '',      // 실제 값
    selectedKind: '',       // 'payment' | 'account'
    // 레거시 입력(텍스트 인풋): 드롭다운과 병행 사용 가능
    payment: '',
    memo: ''
  }), []);

  const [form, setForm] = useState(defaultForm);
  const [loading, setLoading] = useState(false); // 중복 클릭 방지
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [paymentOptionGroups, setPaymentOptionGroups] = useState([]); // [{label, kind, options:[{label,value}]}]

  // 공통: GAS 호출 헬퍼
  const postToGAS = async (action, body) => {
    if (!GOOGLE_SCRIPT_URL || !API_KEY) {
      throw new Error("환경변수(REACT_APP_GOOGLE_SCRIPT_URL / REACT_APP_GOOGLE_API_KEY)가 비어 있습니다.");
    }
    const payload = {
      action,
      body: { ...body, apiKey: API_KEY }, // 바디에 apiKey 포함 (현재 백엔드 방식)
    };
    const res = await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // preflight 회피
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch (e) {
      throw new Error('Invalid server response: ' + text);
    }
  };

  // 폼 오픈 시: PaymentMethod + AccountName 옵션 불러오기
  useEffect(() => {
    if (!GOOGLE_SCRIPT_URL || !API_KEY) return;

    const loadOptions = async () => {
      setOptionsLoading(true);
      try {
        // ✅ 테스트 편의: 캐시 우회
        const result = await postToGAS('meta.paymentOptions.list', { nocache: true });
        const groups = (result.data && result.data.groups) || result.groups || [];
        // 디버그 확인이 필요하면 주석 해제
        // console.log('[meta] groups:', groups);
        setPaymentOptionGroups(groups);
      } catch (e) {
        console.error(e);
        // 실패해도 폼은 사용 가능(텍스트 입력으로 대체)
      } finally {
        setOptionsLoading(false);
      }
    };
    loadOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [GOOGLE_SCRIPT_URL, API_KEY]);

  // 등록
  const handleSubmit = async () => {
    if (loading) return;

    // 기본 검증
    if (!form.date || !form.type || !form.item || !form.amount) {
      alert('날짜, 항목, 금액, 수입/지출을 모두 입력해주세요.');
      return;
    }
    if (!GOOGLE_SCRIPT_URL || !API_KEY) {
      alert('환경변수가 누락되었습니다. .env 설정을 확인하세요.');
      return;
    }

    // 금액 숫자 변환(백엔드 스키마가 number 요구)
    const amountNumber = Number(form.amount);
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
      alert('금액을 올바른 숫자로 입력해주세요.');
      return;
    }

    // 요청 ID (멱등성)
    const requestId = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;

    // 백엔드가 사용하는 키 형태로 매핑 (normalize가 있으니 최소만 맞춰도 됨)
    const payload = {
      date: form.date,
      type: form.type, // '지출' | '수입' | '이체'
      item: form.item,
      amount: amountNumber,
      mainCategory: form.mainCategory || '',
      subCategory: form.subCategory || '',
      // 드롭다운 선택 결과를 보냄 (백엔드에서 PaymentMethod로 기록)
      selectedValue: form.selectedValue || '',
      selectedKind: form.selectedKind || '',
      // 레거시 텍스트 입력도 함께 전송(있다면 우선순위는 selectedValue가 높게 백엔드에서 처리)
      payment: form.payment || '',
      memo: form.memo || '',
      requestId
    };

    setLoading(true);
    try {
      const result = await postToGAS('sheet.transactions.create', payload);

      if (result.status === 'ok' || result.status === 'success') {
        alert('등록이 완료되었습니다.');
        // ✅ 리셋 시점에 현재 시간으로 갱신
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

  // 초기화
  const handleReset = () => setForm({ ...defaultForm, date: getLocalDateTimeString() });

  // 닫기
  const handleClose = () => window.close();

  // 드롭다운 onChange
  const handlePaymentSelect = (value) => {
    if (!value) {
      setForm(f => ({ ...f, selectedValue: '', selectedKind: '' }));
      return;
    }
    // 그룹에서 kind 찾아 저장
    let foundKind = '';
    for (const g of paymentOptionGroups) {
      if (g.options?.some(o => o.value === value)) {
        foundKind = g.kind; // 'payment' | 'account'
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
        <option value="이체">이체</option>{/* 필요 없으면 제거 */}
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

      {/* 통합 드롭다운 */}
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

      {/* 레거시 직접입력(선택) — 드롭다운 대신 직접 텍스트로 쓰고 싶을 때 사용 */}
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

// --- 스타일 ---
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
