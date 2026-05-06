import { OTHER_ITEM_LABELS, OVERRIDE_DED_FIELDS, OVERRIDE_EARN_FIELDS } from './editor.constants.js';

export function createPayloadController({ doc, basicCard, dedCard, otherCard, payCard, signal, parseNum, yen }) {
  const addRow = (hostId, init = null) => {
    const host = doc.querySelector(hostId);
    if (!host) return;
    const wrap = doc.createElement('div');
    wrap.className = 'pe-item';
    const label = doc.createElement('input');
    label.className = 'pe-lbl';
    label.placeholder = '項目名';
    label.value = (init && init.label) ? init.label : '';
    const amount = doc.createElement('input');
    amount.type = 'number';
    amount.step = '1';
    amount.className = 'pe-amt';
    amount.placeholder = '金額';
    amount.value = (init && init.amount != null) ? String(init.amount) : '';
    const del = doc.createElement('button');
    del.type = 'button';
    del.textContent = '×';
    del.addEventListener('click', () => { wrap.remove(); }, { signal });
    wrap.appendChild(label);
    wrap.appendChild(amount);
    wrap.appendChild(del);
    host.appendChild(wrap);
  };

  const collectItems = (hostId) => {
    const host = doc.querySelector(hostId);
    const out = [];
    if (!host) return out;
    const rows = Array.from(host.children || []);
    for (const r of rows) {
      const inputs = r.querySelectorAll('input');
      const label = String((inputs[0] && inputs[0].value != null) ? inputs[0].value : '').trim();
      const amount = parseNum((inputs[1] && inputs[1].value != null) ? inputs[1].value : undefined, `${label || '金額'}`, { allowEmpty: true });
      if (!label) continue;
      if (amount == null) continue;
      out.push({ label, amount: yen(amount) });
    }
    return out;
  };

  const setForm = (payload) => {
    const p = payload && typeof payload === 'object' ? payload : {};
    const bm = Object.prototype.hasOwnProperty.call(p, 'baseMonthly') ? p.baseMonthly : '';
    const ac = Object.prototype.hasOwnProperty.call(p, 'autoCalcDeductions') ? (p.autoCalcDeductions ? '1' : '0') : '0';
    const ta = Object.prototype.hasOwnProperty.call(p, 'transportAllowance') ? p.transportAllowance : '';
    const rd = Object.prototype.hasOwnProperty.call(p, 'rentDeduction') ? p.rentDeduction : '';
    basicCard.querySelector('#payrollBaseMonthly').value = bm === '' ? '' : String(bm);
    basicCard.querySelector('#payrollAutoCalc').value = ac;
    basicCard.querySelector('#payrollTransport').value = ta === '' ? '' : String(ta);
    dedCard.querySelector('#payrollRent').value = rd === '' ? '' : String(rd);
    const k = p.kintai && typeof p.kintai === 'object' ? p.kintai : {};
    basicCard.querySelector('#payrollKWork').value = Object.prototype.hasOwnProperty.call(k, '出勤日数') ? String(k['出勤日数']) : '';
    basicCard.querySelector('#payrollKHoliday').value = Object.prototype.hasOwnProperty.call(k, '休日出勤日数') ? String(k['休日出勤日数']) : '';
    basicCard.querySelector('#payrollKHalf').value = Object.prototype.hasOwnProperty.call(k, '半日出勤日数') ? String(k['半日出勤日数']) : '';
    basicCard.querySelector('#payrollKAbsent').value = Object.prototype.hasOwnProperty.call(k, '欠勤日数') ? String(k['欠勤日数']) : '';
    basicCard.querySelector('#payrollKUnpaid').value = Object.prototype.hasOwnProperty.call(k, '無給休暇') ? String(k['無給休暇']) : '';

    const otherItems = Array.isArray(p.otherItems) ? p.otherItems : [];
    const getOther = (label) => {
      const it = otherItems.find(x => String((x && x.label) ? x.label : '') === label);
      return it && it.amount != null ? String(it.amount) : '';
    };
    otherCard.querySelector('#payrollOtherDiff').value = getOther(OTHER_ITEM_LABELS.diff);
    otherCard.querySelector('#payrollOtherMedical').value = getOther(OTHER_ITEM_LABELS.medical);
    otherCard.querySelector('#payrollOtherYec').value = getOther(OTHER_ITEM_LABELS.yec);
    otherCard.querySelector('#payrollOtherYer').value = getOther(OTHER_ITEM_LABELS.yer);

    const pay = p.payment && typeof p.payment === 'object' ? p.payment : {};
    const bp = p.bankAccountParts && typeof p.bankAccountParts === 'object' ? p.bankAccountParts : {};
    payCard.querySelector('#payrollBankName').value = String(bp.bankName || '');
    payCard.querySelector('#payrollBranchName').value = String(bp.branchName || '');
    payCard.querySelector('#payrollAccountType').value = String(bp.accountType || '');
    payCard.querySelector('#payrollAccountNumber').value = String(bp.accountNumber || '');
    payCard.querySelector('#payrollAccountHolder').value = String(bp.accountHolder || '');
    payCard.querySelector('#payrollPayBank').value = Object.prototype.hasOwnProperty.call(pay, '振込支給額') ? String(pay['振込支給額']) : '';
    payCard.querySelector('#payrollPayCash').value = Object.prototype.hasOwnProperty.call(pay, '現金支給額') ? String(pay['現金支給額']) : '';
    payCard.querySelector('#payrollPayKind').value = Object.prototype.hasOwnProperty.call(pay, '現物支給額') ? String(pay['現物支給額']) : '';

    const eh = doc.querySelector('#payrollEarnings');
    const dh = doc.querySelector('#payrollDeductions');
    if (eh) eh.innerHTML = '';
    if (dh) dh.innerHTML = '';
    for (const it of (Array.isArray(p.extraEarnings) ? p.extraEarnings : [])) addRow('#payrollEarnings', it);
    for (const it of (Array.isArray(p.extraDeductions) ? p.extraDeductions : [])) addRow('#payrollDeductions', it);

    const ovE = p.overrideEarnings && typeof p.overrideEarnings === 'object' ? p.overrideEarnings : {};
    for (const f of OVERRIDE_EARN_FIELDS) {
      const v = Object.prototype.hasOwnProperty.call(ovE, f.label) ? ovE[f.label] : '';
      const el = doc.querySelector(f.id);
      if (el) el.value = v === '' ? '' : String(v);
    }

    const ovD = p.overrideDeductions && typeof p.overrideDeductions === 'object' ? p.overrideDeductions : {};
    for (const f of OVERRIDE_DED_FIELDS) {
      const v = Object.prototype.hasOwnProperty.call(ovD, f.label) ? ovD[f.label] : '';
      const el = doc.querySelector(f.id);
      if (el) el.value = v === '' ? '' : String(v);
    }
  };

  const buildPayload = async () => {
    const payload = {};
    const bmEl = basicCard.querySelector('#payrollBaseMonthly');
    const acEl = basicCard.querySelector('#payrollAutoCalc');
    const taEl = basicCard.querySelector('#payrollTransport');
    const rdEl = dedCard.querySelector('#payrollRent');
    const bmN = parseNum(bmEl && bmEl.value != null ? bmEl.value : undefined, '基本給（月給）', { allowEmpty: true });
    const autoCalc = String(acEl && acEl.value != null ? acEl.value : '0') === '1';
    const taN = parseNum(taEl && taEl.value != null ? taEl.value : undefined, '交通手当', { allowEmpty: true });
    const rdN = parseNum(rdEl && rdEl.value != null ? rdEl.value : undefined, '立替家賃（控除）', { allowEmpty: true });
    if (bmN != null) payload.baseMonthly = yen(bmN);
    payload.autoCalcDeductions = !!autoCalc;
    if (taN != null) payload.transportAllowance = yen(taN);
    if (rdN != null) payload.rentDeduction = yen(rdN);
    payload.extraEarnings = collectItems('#payrollEarnings');
    payload.extraDeductions = collectItems('#payrollDeductions');

    const otherItems = [];
    const odEl = otherCard.querySelector('#payrollOtherDiff');
    const omEl = otherCard.querySelector('#payrollOtherMedical');
    const ocEl = otherCard.querySelector('#payrollOtherYec');
    const orEl = otherCard.querySelector('#payrollOtherYer');
    const odN = parseNum(odEl && odEl.value != null ? odEl.value : undefined, OTHER_ITEM_LABELS.diff, { allowEmpty: true });
    const omN = parseNum(omEl && omEl.value != null ? omEl.value : undefined, OTHER_ITEM_LABELS.medical, { allowEmpty: true });
    const ocN = parseNum(ocEl && ocEl.value != null ? ocEl.value : undefined, OTHER_ITEM_LABELS.yec, { allowEmpty: true });
    const orN = parseNum(orEl && orEl.value != null ? orEl.value : undefined, OTHER_ITEM_LABELS.yer, { allowEmpty: true });
    if (odN != null) otherItems.push({ label: OTHER_ITEM_LABELS.diff, amount: yen(odN) });
    if (omN != null) otherItems.push({ label: OTHER_ITEM_LABELS.medical, amount: yen(omN) });
    if (ocN != null) otherItems.push({ label: OTHER_ITEM_LABELS.yec, amount: yen(ocN) });
    if (orN != null) otherItems.push({ label: OTHER_ITEM_LABELS.yer, amount: yen(orN) });
    if (otherItems.length) payload.otherItems = otherItems;

    const payment = {};
    const pbEl = payCard.querySelector('#payrollPayBank');
    const pcEl = payCard.querySelector('#payrollPayCash');
    const pkEl = payCard.querySelector('#payrollPayKind');
    const pbN = parseNum(pbEl && pbEl.value != null ? pbEl.value : undefined, '振込支給額', { allowEmpty: true });
    const pcN = parseNum(pcEl && pcEl.value != null ? pcEl.value : undefined, '現金支給額', { allowEmpty: true });
    const pkN = parseNum(pkEl && pkEl.value != null ? pkEl.value : undefined, '現物支給額', { allowEmpty: true });
    if (pbN != null) payment['振込支給額'] = yen(pbN);
    if (pcN != null) payment['現金支給額'] = yen(pcN);
    if (pkN != null) payment['現物支給額'] = yen(pkN);
    if (Object.keys(payment).length) payload.payment = payment;

    const bankNameEl = payCard.querySelector('#payrollBankName');
    const branchNameEl = payCard.querySelector('#payrollBranchName');
    const accountTypeEl = payCard.querySelector('#payrollAccountType');
    const accountNumberEl = payCard.querySelector('#payrollAccountNumber');
    const accountHolderEl = payCard.querySelector('#payrollAccountHolder');
    const bankName = String(bankNameEl && bankNameEl.value != null ? bankNameEl.value : '').trim();
    const branchName = String(branchNameEl && branchNameEl.value != null ? branchNameEl.value : '').trim();
    const accountType = String(accountTypeEl && accountTypeEl.value != null ? accountTypeEl.value : '').trim();
    const accountNumber = String(accountNumberEl && accountNumberEl.value != null ? accountNumberEl.value : '').replace(/[^\d]/g, '').trim();
    const accountHolder = String(accountHolderEl && accountHolderEl.value != null ? accountHolderEl.value : '').trim();
    const any = bankName || branchName || accountType || accountNumber || accountHolder;
    if (any) payload.bankAccountParts = { bankName, branchName, accountType, accountNumber, accountHolder };

    const ovE = {};
    for (const f of OVERRIDE_EARN_FIELDS) {
      const el = doc.querySelector(f.id);
      const n = parseNum(el && el.value != null ? el.value : undefined, f.label, { allowEmpty: true });
      if (n != null) ovE[f.label] = yen(n);
    }
    if (Object.keys(ovE).length) payload.overrideEarnings = ovE;

    const ovD = {};
    for (const f of OVERRIDE_DED_FIELDS) {
      const el = doc.querySelector(f.id);
      const n = parseNum(el && el.value != null ? el.value : undefined, f.label, { allowEmpty: true });
      if (n != null) ovD[f.label] = yen(n);
    }
    if (Object.keys(ovD).length) payload.overrideDeductions = ovD;

    const kintai = {};
    const kwEl = basicCard.querySelector('#payrollKWork');
    const khEl = basicCard.querySelector('#payrollKHoliday');
    const kkEl = basicCard.querySelector('#payrollKHalf');
    const kaEl = basicCard.querySelector('#payrollKAbsent');
    const kuEl = basicCard.querySelector('#payrollKUnpaid');
    const kwN = parseNum(kwEl && kwEl.value != null ? kwEl.value : undefined, '出勤日数', { allowEmpty: true });
    const khN = parseNum(khEl && khEl.value != null ? khEl.value : undefined, '休日出勤日数', { allowEmpty: true });
    const kkN = parseNum(kkEl && kkEl.value != null ? kkEl.value : undefined, '半日出勤日数', { allowEmpty: true });
    const kaN = parseNum(kaEl && kaEl.value != null ? kaEl.value : undefined, '欠勤日数', { allowEmpty: true });
    const kuN = parseNum(kuEl && kuEl.value != null ? kuEl.value : undefined, '無給休暇', { allowEmpty: true });
    if (kwN != null) kintai['出勤日数'] = yen(kwN);
    if (khN != null) kintai['休日出勤日数'] = yen(khN);
    if (kkN != null) kintai['半日出勤日数'] = yen(kkN);
    if (kaN != null) kintai['欠勤日数'] = yen(kaN);
    if (kuN != null) kintai['無給休暇'] = yen(kuN);
    if (Object.keys(kintai).length) payload.kintai = kintai;

    return payload;
  };

  return { addRow, collectItems, setForm, buildPayload };
}
