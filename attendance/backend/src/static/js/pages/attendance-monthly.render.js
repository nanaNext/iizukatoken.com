(function () {
  const root = globalThis.AttendanceMonthly || {};
  const core = root.Core || globalThis.MonthlyMonthlyCore || {};
  const state = root.State || globalThis.MonthlyMonthlyState || {};

  const {
    $,
    esc,
    fmtHm,
    fmtWorkHours,
    makeClientId,
    dowJa,
    fromDateTime,
    diffMinutesAllowOvernight,
    isFutureMonth,
    parseHm,
    computeStatus,
    showErr
  } = core;

  const renderTableFull = (host, detail, profile) => {
    if (!host) return;
    const days = Array.isArray(detail?.days) ? detail.days : [];
    const table = document.createElement('table');
    table.id = 'monthTableReal';
    table.className = 'se-month-table-real';
    table.innerHTML = `
    <thead>
      <tr class="tier2">
        <th class="sticky-col-1">日付</th>
        <th>勤務区分</th>
        <th>出社</th>
        <th>在宅</th>
        <th>現場・出張</th>
        <th>現場（任意）</th>
        <th>作業内容</th>
        <th>開始時間</th>
        <th>終了時間</th>
        <th>休憩時間</th>
        <th>深夜休憩</th>
        <th>勤務時間</th>
        <th>超過時間</th>
        <th>遅刻/早退</th>
        <th>理由</th>
        <th>備考</th>
        <th>ステータス</th>
        <th>承認者</th>
        <th>行クリア</th>
        <th>履歴</th>
      </tr>
    </thead>
  `;
    const tbody = document.createElement('tbody');
    const buildTr = (dateStr, isOff, shift, daily, seg, showDateDow) => {
      const primary = !!showDateDow;
      const dow = dowJa(dateStr);
      const offDay = !!isOff || dow === '日' || dow === '土';
      
      const kubunInitRaw = String(daily?.kubun || '').trim();
      const kubunOptions = offDay
        ? ['休日', '休日出勤', '代替出勤']
        : ['出勤', '半休', '欠勤', '有給休暇', '無給休暇', '代替休日'];
      let kubunInit = kubunOptions.includes(kubunInitRaw) ? kubunInitRaw : '';
      const plannedLabel = offDay ? '【予定休日】' : '【予定出勤】';
      const plannedKubun = offDay ? '休日' : '出勤';
      const workKubunSet = new Set(['出勤', '半休', '休日出勤', '代替出勤']);
      // If off day but already has actual check-in/out and kubun is not set, infer 休日出勤 for display
      if (offDay && !kubunInit) {
        const hasActual = !!(seg?.checkIn || seg?.checkOut || seg?.id);
        if (hasActual) kubunInit = '休日出勤';
      }
      const effectiveKubun = kubunInit || plannedKubun;
      const isWorkDay = workKubunSet.has(effectiveKubun);
      const canEditWorkRow = !!state.editableMonth && isWorkDay && !!kubunInit;
      const isHolidayKubun = effectiveKubun === '休日' || effectiveKubun === '代替休日';
      
      const inHm = fromDateTime(seg?.checkIn);
      const outHm = fromDateTime(seg?.checkOut);
      const hasActual = !!(seg?.id || seg?.checkIn || seg?.checkOut);
      const isPlanned = !kubunInit && !hasActual;

      // Permission check: if employee role and has selection or actual data, disable planned options
      const role = String(profile?.role || '').toLowerCase();
      const isEmployee = role === 'employee';
      const disablePlanned = isEmployee && (kubunInit !== '' || hasActual);

      const shiftStart = String(shift?.start_time || '08:00').trim();
      const shiftEnd = String(shift?.end_time || '17:00').trim();
      const shiftStartOk = /^\d{1,2}:\d{2}$/.test(shiftStart);
      const shiftEndOk = /^\d{1,2}:\d{2}$/.test(shiftEnd);

      // Hint logic
      const inInit = inHm || (isWorkDay ? shiftStart : '');
      const outInit = outHm || (isWorkDay ? shiftEnd : '');
      
      // CHỐT: Nếu KHÔNG phải ngày đi làm (isWorkDay = false) thì KHÔNG ĐƯỢC CÓ GIỜ
      const finalIn = isWorkDay ? inInit : '';
      const finalOut = isWorkDay ? outInit : '';

      // QUAN TRỌNG: Gán cờ manual cho ô nếu đã có dữ liệu thực tế (checkIn/checkOut không phải tự động)
      const isManualIn = !!inHm;
      const isManualOut = !!outHm;

      const autoIn = isWorkDay && !inHm && shiftStartOk;
      const autoOut = isWorkDay && !outHm && shiftEndOk;
      
      // CSS Class: CHỈ hiển thị nhạt (is-auto) nếu là (Dự kiến VÀ Giờ tự động)
      // Business rule: if started but not finished yet, start-time stays "planned-like" (faded)
      const inPendingUnconfirmed = !!(isManualIn && !isManualOut);
      const inAutoCls = ((autoIn && isPlanned && !isManualIn) || inPendingUnconfirmed) ? 'is-auto' : '';
      const outAutoCls = (autoOut && isPlanned && !isManualOut) ? 'is-auto' : '';

      const shiftBrRaw = Number(shift?.break_minutes ?? 60);
      const shiftBrMin = Number.isFinite(shiftBrRaw) && shiftBrRaw >= 0 ? shiftBrRaw : 60;
      const brMin = (isWorkDay || hasActual) ? (primary ? Number(daily?.breakMinutes ?? 60) : 60) : 0;
      const nbMin = (isWorkDay || hasActual) ? (primary ? Number(daily?.nightBreakMinutes ?? 0) : 0) : 0;
      const totalBmin = brMin + nbMin;

      const workHm = (finalIn && finalOut) ? (fmtWorkHours(finalIn, finalOut, totalBmin) || '') : '';
      const isAutoWork = isWorkDay && (autoIn || autoOut) && !!workHm;
      const workAutoCls = (isAutoWork && isPlanned) ? 'is-auto' : '';

      // OT Calculation
      const whMin = (() => {
        let inEff = finalIn;
        if (shiftStartOk && finalIn && finalIn < shiftStart) inEff = shiftStart;
        const raw = diffMinutesAllowOvernight(inEff, finalOut);
        return (raw == null || raw <= 0) ? 0 : Math.max(0, raw - totalBmin);
      })();
      const otMin = (() => {
        const outM = parseHm(finalOut);
        const stM = parseHm(shiftStart);
        const etM = parseHm(shiftEnd);
        if (outM != null && stM != null && etM != null) {
          const overnight = etM < stM;
          const endAbs = overnight ? (etM + 24 * 60) : etM;
          const outAbs = overnight && outM < stM ? (outM + 24 * 60) : outM;
          return Math.max(0, outAbs - endAbs);
        }
        return Math.max(0, whMin - (8 * 60));
      })();
      const otHm = (otMin > 0 && finalIn && finalOut) ? fmtHm(otMin) : '';
      const otAutoCls = (otMin > 0 && isAutoWork && isPlanned) ? 'is-auto' : '';

      const statusStr = String(state.currentMonthStatus || '');
      const approved = statusStr === 'approved';
      const approverName = String(detail?.monthStatus?.approverName || '').trim();
      const isAdminView = String(profile?.role || '').toLowerCase() === 'admin' || String(profile?.role || '').toLowerCase() === 'manager';
      const hasAny = !!(finalIn || finalOut);
      const leaveKubunSet = new Set(['休日', '代替休日', '有給休暇', '無給休暇', '欠勤']);
      const isLeaveApplied = !!kubunInit && leaveKubunSet.has(effectiveKubun) && !hasActual;
      let text = '未承認';
      let cls = 'warn';
      if (isPlanned && !hasActual) {
        text = '未申請';
        cls = 'warn';
      } else if (isLeaveApplied) {
        text = isAdminView ? '承認待ち' : '未確認';
        cls = 'warn';
      } else if (approved) {
        text = '承認済み';
        cls = 'ok';
      } else if (hasActual) {
        text = isAdminView ? '承認待ち' : '未確認';
        cls = 'warn';
      } else {
        text = '—';
        cls = 'warn';
      }
      const st = {
        text,
        cls,
        approver: approved ? (approverName || '—') : '—'
      };

      const tr = document.createElement('tr');
      if (dow === '日') tr.classList.add('off', 'sun');
      else if (isOff) tr.classList.add('off', 'holiday');
      else if (dow === '土') tr.classList.add('sat');
      if (dow === '土' && (inHm || outHm)) tr.classList.add('worked');
      if (isPlanned) tr.classList.add('planned');
      if (seg?.id) tr.classList.add('has-entry');
      if (!isWorkDay) tr.classList.add('leave');

      tr.dataset.row = '1';
      tr.dataset.date = dateStr;
      tr.dataset.baseOff = isOff ? '1' : '0';
      tr.dataset.id = seg?.id ? String(seg.id) : '';
      tr.dataset.clientId = tr.dataset.id ? '' : makeClientId();
      tr.dataset.primary = primary ? '1' : '0';
      tr.dataset.kubunConfirmed = Number(daily?.kubunConfirmed || 0) === 1 ? '1' : '';
      tr.dataset.shiftStart = shiftStartOk ? shiftStart : '08:00';

      const wtVal = (() => {
        if (isHolidayKubun) return '';
        const v = String(seg?.workType || (primary ? daily?.workType : '') || '').trim();
        // Không tự động gán '出社' cho ngày 予定出勤; chỉ hiển thị khi có giá trị thực tế
        return (v === 'onsite' || v === 'remote' || v === 'satellite') ? v : '';
      })();
      tr.dataset.workType = wtVal;
      
      const dLoc = isHolidayKubun ? '' : String(daily?.location || '');
      const dMemo = isHolidayKubun ? '' : String(daily?.memo || '');
      const dReason = effectiveKubun === '欠勤' ? String(daily?.reason || '') : '';
      const dNotes = isHolidayKubun ? '' : String(daily?.notes || '');
      const brVal = brMin === 45 ? '0:45' : brMin === 30 ? '0:30' : brMin === 0 ? '0:00' : '1:00';
      const nbVal = nbMin === 60 ? '1:00' : nbMin === 30 ? '0:30' : '0:00';

      const dowColor = (isOff || dow === '日') ? '#b91c1c' : (dow === '土') ? '#1d4ed8' : '#334155';
      const dateMmdd = dateStr.slice(5).replace('-', '/');
      const kubunOptionsHtml = `
      <option value="" ${disablePlanned ? 'disabled' : ''} ${kubunInit === '' ? 'selected' : ''}>${esc(plannedLabel)}</option>
      ${kubunOptions.map((k) => `<option value="${esc(k)}" ${kubunInit === k ? 'selected' : ''}>${esc(k)}</option>`).join('')}
    `;

      tr.innerHTML = `
      <td class="sticky-col-1">${showDateDow ? `<span style="font-weight:900;">${esc(dateMmdd)}</span><span class="dow" style="font-weight:900;color:${esc(dowColor)};">(${esc(dow)})</span>` : ''}</td>
      <td>
        <div class="se-kubun-wrap">
          <select class="se-select se-kubun-select ${kubunInit === '' ? 'is-planned' : ''}" data-field="classification" ${state.editableMonth ? '' : 'disabled'}>
            ${kubunOptionsHtml}
          </select>
        </div>
      </td>
      <td style="text-align:center;"><input class="se-check" data-field="ckOnsite" type="checkbox" ${wtVal === 'onsite' ? 'checked' : ''} ${!canEditWorkRow ? 'disabled' : ''}></td>
      <td style="text-align:center;"><input class="se-check" data-field="ckRemote" type="checkbox" ${wtVal === 'remote' ? 'checked' : ''} ${!canEditWorkRow ? 'disabled' : ''}></td>
      <td style="text-align:center;"><input class="se-check" data-field="ckSatellite" type="checkbox" ${wtVal === 'satellite' ? 'checked' : ''} ${!canEditWorkRow ? 'disabled' : ''}></td>
      <td><input class="se-input" data-field="location" type="text" value="${esc(dLoc)}" ${!canEditWorkRow ? 'disabled' : ''}></td>
      <td><input class="se-input" data-field="memo" type="text" value="${esc(dMemo)}" ${!canEditWorkRow ? 'disabled' : ''}></td>
      <td class="se-time-cell">
        <div class="se-time-wrap">
          <input class="se-time ${inAutoCls}" data-field="checkIn" type="time" value="${esc(finalIn)}" ${!canEditWorkRow ? 'disabled' : ''} data-auto="${autoIn ? '1' : ''}" data-auto-val="${esc(autoIn ? shiftStart : '')}" data-manual="${isManualIn ? '1' : ''}">
        </div>
      </td>
      <td class="se-time-cell">
        <div class="se-time-wrap">
          <input class="se-time ${outAutoCls}" data-field="checkOut" type="time" value="${esc(finalOut)}" ${!canEditWorkRow ? 'disabled' : ''} data-auto="${autoOut ? '1' : ''}" data-auto-val="${esc(autoOut ? shiftEnd : '')}" data-manual="${isManualOut ? '1' : ''}">
        </div>
      </td>
      <td>
        <select class="se-select" data-field="break" ${!canEditWorkRow ? 'disabled' : ''}>
          <option value="1:00" ${brVal === '1:00' ? 'selected' : ''}>1:00</option>
          <option value="0:45" ${brVal === '0:45' ? 'selected' : ''}>0:45</option>
          <option value="0:30" ${brVal === '0:30' ? 'selected' : ''}>0:30</option>
          <option value="0:00" ${brVal === '0:00' ? 'selected' : ''}>0:00</option>
        </select>
      </td>
      <td>
        <select class="se-select" data-field="nightBreak" ${!canEditWorkRow ? 'disabled' : ''}>
          <option value="0:00" ${nbVal === '0:00' ? 'selected' : ''}>0:00</option>
          <option value="0:30" ${nbVal === '0:30' ? 'selected' : ''}>0:30</option>
          <option value="1:00" ${nbVal === '1:00' ? 'selected' : ''}>1:00</option>
        </select>
      </td>
      <td data-field="worked" class="${workAutoCls}" style="font-weight:900;color:#0f172a;">${esc(workHm)}</td>
      <td data-field="excess" class="${otAutoCls}" style="text-align:center;color:#0f172a;font-weight:900;">${esc(otHm)}</td>
      <td data-field="lateEarly" style="text-align:center;color:#64748b;">${(() => { if (!isWorkDay) return '—'; const inM = parseHm(finalIn); const stM = parseHm(shiftStart); const outM = parseHm(finalOut); const etM = parseHm(shiftEnd); const late = (inM!=null && stM!=null && inM>stM); const early = (() => { if (outM==null || stM==null || etM==null) return false; const overnight = etM < stM; const endAbs = overnight ? (etM + 24*60) : etM; const outAbs = overnight && outM < stM ? (outM + 24*60) : outM; return outAbs < endAbs; })(); return late && early ? '遅刻/早退' : late ? '遅刻' : early ? '早退' : '—'; })()}</td>
      <td>
        <select class="se-select" data-field="reason" ${effectiveKubun === '欠勤' && state.editableMonth ? '' : 'disabled'} style="width:140px;${effectiveKubun === '欠勤' ? '' : 'visibility:hidden;'}">
          <option value=""></option>
          <option value="private" ${dReason === 'private' ? 'selected' : ''}>私用</option>
          <option value="late" ${dReason === 'late' ? 'selected' : ''}>遅刻</option>
          <option value="early" ${dReason === 'early' ? 'selected' : ''}>早退</option>
          <option value="other" ${dReason === 'other' ? 'selected' : ''}>その他</option>
        </select>
      </td>
      <td>
        <input class="se-input" data-field="notes" type="text" value="${esc(dNotes)}" ${!canEditWorkRow ? 'disabled' : ''} style="width:100%;">
      </td>
      <td>
        <div class="se-status-wrap">
          <span class="se-status ${esc(st.cls)}">${esc(st.text)}</span>
        </div>
      </td>
      <td style="text-align:center;color:#0f172a;font-weight:800;">${esc(st.approver)}</td>
      <td style="text-align:center;"><button type="button" class="se-icon-btn secondary" data-action="clear" ${state.editableMonth ? '' : 'disabled'}>×</button></td>
      <td style="text-align:center;"><button type="button" class="se-mini-btn" data-action="history">表示</button></td>
    `;
      return tr;
    };

    for (const d of days) {
      const dateStr = String(d?.date || '');
      const isOff = Number(d?.is_off || 0) === 1;
      const shift = d?.shift || null;
      const daily = d?.daily || null;
      const segs = Array.isArray(d?.segments) ? d.segments : [];
      const list0 = segs.length ? [...segs].sort((a, b) => String(b?.checkIn || '').localeCompare(String(a?.checkIn || ''))) : [null];
      const seg = list0.find(s => s && s.checkIn && !s.checkOut) || list0[0];
      tbody.appendChild(buildTr(dateStr, isOff, shift, daily, seg, true));
    }
    table.appendChild(tbody);
    // Use native sticky header via CSS; avoid cloning header to prevent drift
    host.innerHTML = '';
    const isLocked = !state.editableMonth;
    const wrapClass = isLocked ? 'se-month-table-wrap is-locked' : 'se-month-table-wrap';
    const container = document.createElement('div');
    container.className = wrapClass;
    const scrollWrap = document.createElement('div');
    scrollWrap.className = 'se-month-scroll';
    scrollWrap.appendChild(table);
    container.appendChild(scrollWrap);
    host.appendChild(container);

    // Force style refresh if locked
    if (isLocked) {
      requestAnimationFrame(() => {
        container.classList.add('is-locked-ready');
      });
    }

    // Sync column widths to avoid drift across environments
    const syncCols = (attempt = 0) => {
      try {
        const active = document.activeElement;
        if (active && table.contains(active)) {
          const tag = String(active.tagName || '').toLowerCase();
          const type = tag === 'input' ? String(active.getAttribute('type') || '').toLowerCase() : '';
          if (type === 'time') return;
        }
        const first = table.querySelector('tbody tr');
        const cells = first ? Array.from(first.children) : [];
        const widthsMeasured = cells.map(td => Math.max(1, Math.round(td.getBoundingClientRect().width)));
        const ok = widthsMeasured.length && widthsMeasured.every(w => w > 0);
        if (!ok && attempt < 20) {
          requestAnimationFrame(() => syncCols(attempt + 1));
          return;
        }
        const defaultWidths = [
          90, 120, 70, 70, 120, 220, 240, 100, 100, 100, 100, 100, 100, 100, 140, 220, 120, 120, 80, 80
        ]; // 20 columns
        const widths = ok ? widthsMeasured : defaultWidths.slice(0, cells.length);
        const cg = document.createElement('colgroup');
        for (const w of widths) {
          const col = document.createElement('col');
          col.style.width = `${w}px`;
          cg.appendChild(col);
        }
        table.querySelector('colgroup')?.remove();
        table.insertAdjacentElement('afterbegin', cg);
        table.style.tableLayout = 'fixed';
      } catch {}
    };
    requestAnimationFrame(syncCols);
    try {
      const key = '__seMonthlyColSync';
      const w = window;
      if (!w[key]) {
        w[key] = { handlers: new Set() };
        window.addEventListener('resize', () => {
          try {
            requestAnimationFrame(() => {
              const hs = w[key]?.handlers;
              if (!hs) return;
              for (const fn of Array.from(hs)) {
                try { fn(); } catch {}
              }
            });
          } catch {}
        }, { passive: true });
      }
      const reg = () => {
        if (!table.isConnected) {
          try { w[key]?.handlers?.delete(reg); } catch {}
          return;
        }
        syncCols();
      };
      w[key].handlers.add(reg);
    } catch {}
  };

  const renderTable = (host, detail, profile) => {
    renderTableFull(host, detail, profile);
  };

  const markRowSaved = (rowEl) => {
    try {
      rowEl.classList.add('saved');
      const token = String(Date.now());
      rowEl.dataset.savedAt = token;
      try { rowEl.dataset.dirty = ''; } catch {}
      setTimeout(() => {
        try {
          if (rowEl.dataset.savedAt !== token) return;
          rowEl.classList.remove('saved');
        } catch {}
      }, 5000);
    } catch {}
  };

  const recomputeRow = (rowEl) => {
    try {
      const dateStr = String(rowEl.dataset.date || '');
      const dow = dowJa(dateStr);
      const baseOff = String(rowEl.dataset.baseOff || '') === '1';
      
      const clsSel = rowEl.querySelector('select[data-field="classification"]');
      const inEl = rowEl.querySelector('input[data-field="checkIn"]');
      const outEl = rowEl.querySelector('input[data-field="checkOut"]');
      const brSel = rowEl.querySelector('select[data-field="break"]');
      const nbSel = rowEl.querySelector('select[data-field="nightBreak"]');
      const ckOn = rowEl.querySelector('input[data-field="ckOnsite"]');
      const ckRe = rowEl.querySelector('input[data-field="ckRemote"]');
      const ckSa = rowEl.querySelector('input[data-field="ckSatellite"]');
      const locEl = rowEl.querySelector('input[data-field="location"]');
      const reasonSel = rowEl.querySelector('select[data-field="reason"]');
      const memoEl = rowEl.querySelector('input[data-field="memo"]');
      const worked = rowEl.querySelector('[data-field="worked"]');
      const excess = rowEl.querySelector('[data-field="excess"]');
      const lateEarly = rowEl.querySelector('[data-field="lateEarly"]');
      const statusWrap = rowEl.querySelector('.se-status-wrap');

      const idVal = String(rowEl.dataset.id || '').trim();
      const confirmed = String(rowEl.dataset.kubunConfirmed || '') === '1';
      const inManual = String(inEl?.dataset?.manual || '') === '1';
      const outManual = String(outEl?.dataset?.manual || '') === '1';

      const cls = String(clsSel?.value || '').trim();
      const offDay = baseOff || dow === '日' || dow === '土';
      const workKubunSet = new Set(['出勤', '半休', '休日出勤', '代替出勤']);
      const effectiveKubun = cls || (offDay ? '休日' : '出勤');
      const isWorkDay = workKubunSet.has(effectiveKubun);
      const isPlanned = !cls && !idVal && !confirmed;
      const canEditWorkInputs = !!state.editableMonth && isWorkDay && !!cls;

      if (clsSel) {
        clsSel.classList.toggle('is-planned', !cls);
      }

      [inEl, outEl, brSel, nbSel, ckOn, ckRe, ckSa, locEl, memoEl].forEach((el) => {
        if (!el) return;
        if (canEditWorkInputs) el.removeAttribute('disabled');
        else el.setAttribute('disabled', '');
      });
      const notesEl = rowEl.querySelector('input[data-field="notes"]');
      if (notesEl) {
        if (canEditWorkInputs) notesEl.removeAttribute('disabled');
        else notesEl.setAttribute('disabled', '');
      }

      if (statusWrap) {
        const roleStr = String(root.State?.profile?.role || '').toLowerCase();
        const isAdminView = roleStr === 'admin' || roleStr === 'manager';
        const monthApproved = String(state.currentMonthStatus || '') === 'approved';
        const hasActualNow = !!(idVal || (inEl && String(inEl.value).trim()) || (outEl && String(outEl.value).trim()));
        let stText = '未承認';
        let stCls = 'warn';
        if (isPlanned && !hasActualNow) {
          stText = '未申請';
        } else if (monthApproved) {
          stText = '承認済み';
          stCls = 'ok';
        } else if (hasActualNow) {
          stText = isAdminView ? '承認待ち' : '未確認';
        } else {
          stText = '未申請';
        }
        const stSpan = statusWrap.querySelector('span.se-status');
        if (stSpan) {
          if (stSpan.textContent !== stText) stSpan.textContent = stText;
          stSpan.classList.remove('ok','warn','danger');
          stSpan.classList.add(stCls);
        }
      }

      // Update Planned option visibility/disability (Admin/Manager can always select Planned)
      const role = String(root.State?.profile?.role || '').toLowerCase();
      const isEmployee = role === 'employee';
      if (clsSel && isEmployee) {
        const plannedOpt = clsSel.querySelector('option[value=""]');
        if (plannedOpt) {
          const hasActualNow = (inEl && inEl.value !== '') || (outEl && outEl.value !== '');
          const shouldDisable = !!cls || hasActualNow;
          if (plannedOpt.disabled !== shouldDisable) {
            plannedOpt.disabled = shouldDisable;
          }
        }
      } else if (clsSel && !isEmployee) {
        // Admin/Manager can always select Planned
        const plannedOpt = clsSel.querySelector('option[value=""]');
        if (plannedOpt && plannedOpt.disabled) {
          plannedOpt.disabled = false;
        }
      }

      // Xử lý visual class cho dòng (Màu nền cuối tuần)
      const rowClasses = ['sun', 'holiday', 'sat', 'worked', 'planned', 'leave'];
      rowClasses.forEach(c => {
        const shouldHave = (c === 'sun' && dow === '日') ||
                          (c === 'holiday' && ! (dow === '日') && baseOff) ||
                          (c === 'sat' && dow === '土') ||
                          (c === 'planned' && isPlanned) ||
                          (c === 'leave' && !isWorkDay);
        if (rowEl.classList.contains(c) !== shouldHave) {
          rowEl.classList.toggle(c, shouldHave);
        }
      });

      const dowSpan = rowEl.querySelector('td.sticky-col-1 span.dow');
      if (dowSpan) {
        const color = (offDay || dow === '日') ? '#b91c1c' : (dow === '土') ? '#1d4ed8' : '#334155';
        if (dowSpan.style.color !== color) dowSpan.style.color = color;
      }

      // Logic xóa giờ cho ngày nghỉ (Holiday)
      if (!isWorkDay && !!cls) {
        // Nếu là ngày nghỉ, chúng ta xóa trắng giờ nếu không phải đang có ID hoặc không phải là nhập tay mới
        // Tuy nhiên, nếu người dùng VỪA chọn sang "休日", chúng ta nên xóa luôn giờ cũ.
        if (inEl && inEl.value !== '') {
          inEl.value = '';
          inEl.dataset.auto = '';
          inEl.dataset.autoVal = '';
          inEl.dataset.manual = ''; // Reset manual flag when switching to holiday
        }
        if (outEl && outEl.value !== '') {
          outEl.value = '';
          outEl.dataset.auto = '';
          outEl.dataset.autoVal = '';
          outEl.dataset.manual = '';
        }
        if (brSel && brSel.value !== '0:00') {
          brSel.value = '0:00';
          brSel.dataset.auto = '';
        }
        if (nbSel && nbSel.value !== '0:00') nbSel.value = '0:00';
        if (ckOn && ckOn.checked) ckOn.checked = false;
        if (ckRe && ckRe.checked) ckRe.checked = false;
        if (ckSa && ckSa.checked) ckSa.checked = false;
      } else if (isWorkDay) {
        // Áp dụng giờ mặc định cho ngày đi làm
        const dayShift = (() => {
          try {
            const ds = dateStr.slice(0, 10);
            const days = Array.isArray(state.currentMonthDetail?.days) ? state.currentMonthDetail.days : [];
            return days.find(d => String(d?.date || '').slice(0, 10) === ds)?.shift || null;
          } catch { return null; }
        })();
        const shiftStart = String(dayShift?.start_time || '08:00').trim();
        const shiftEnd = String(dayShift?.end_time || '17:00').trim();

        if (inEl && !String(inEl.value || '').trim() && !inManual) {
          inEl.value = shiftStart;
          inEl.dataset.auto = '1';
          inEl.dataset.autoVal = shiftStart;
        }
        if (outEl && !String(outEl.value || '').trim() && !outManual) {
          outEl.value = shiftEnd;
          outEl.dataset.auto = '1';
          outEl.dataset.autoVal = shiftEnd;
        }
        if (brSel && (!brSel.value || brSel.value === '0:00' || brSel.dataset.auto === '1')) {
          const rawBr = Number(dayShift?.break_minutes ?? 60);
          const brVal = rawBr === 45 ? '0:45' : rawBr === 30 ? '0:30' : rawBr === 0 ? '0:00' : '1:00';
          if (brSel.value !== brVal) {
            brSel.value = brVal;
            brSel.dataset.auto = '1';
          }
        }
      } else {
        if (ckOn) ckOn.checked = false;
        if (ckRe) ckRe.checked = false;
        if (ckSa) ckSa.checked = false;
        rowEl.dataset.workType = '';
      }

      if (reasonSel) {
        const allowReason = effectiveKubun === '欠勤';
        if (!allowReason && reasonSel.value !== '') {
          reasonSel.value = '';
        }
        if (allowReason && !!cls) {
          reasonSel.removeAttribute('disabled');
          reasonSel.style.visibility = '';
        } else {
          reasonSel.setAttribute('disabled', '');
          reasonSel.style.visibility = 'hidden';
        }
      }

      // Xử lý hiển thị ĐẬM / NHẠT
      const inVal = String(inEl?.value || '');
      const outVal = String(outEl?.value || '');
      
      const inAuto = String(inEl?.dataset?.auto || '') === '1';
      const outAuto = String(outEl?.dataset?.auto || '') === '1';

      // QUY TẮC HIỂN THỊ ĐẬM/NHẠT:
      // - Nhạt (is-auto) CHỈ KHI: (là giờ tự động) VÀ (trạng thái dự kiến - isPlanned) VÀ (CHƯA bị người dùng sửa - !inManual)
      if (inEl) {
        const hasVal = String(inEl.value || '').trim() !== '';
        const shouldBeAuto = inAuto && isPlanned && !inManual;
        // Nếu có giá trị nhưng không phải là autoVal ban đầu, nó phải ĐẬM
        const forceBold = hasVal && inAuto && String(inEl.value) !== String(inEl.dataset.autoVal);
        const finalAuto = shouldBeAuto && !forceBold;
        if (inEl.classList.contains('is-auto') !== finalAuto) {
          inEl.classList.toggle('is-auto', finalAuto);
        }
      }
      if (outEl) {
        const hasVal = String(outEl.value || '').trim() !== '';
        const shouldBeAuto = outAuto && isPlanned && !outManual;
        const forceBold = hasVal && outAuto && String(outEl.value) !== String(outEl.dataset.autoVal);
        const finalAuto = shouldBeAuto && !forceBold;
        if (outEl.classList.contains('is-auto') !== finalAuto) {
          outEl.classList.toggle('is-auto', finalAuto);
        }
      }
      const b = String(brSel?.value || '0:00');
      const bmin = b === '0:45' ? 45 : b === '0:30' ? 30 : b === '0:00' ? 0 : 60;
      const nb = String(nbSel?.value || '0:00');
      const nbmin = nb === '1:00' ? 60 : nb === '0:30' ? 30 : 0;
      const totalBmin = bmin + nbmin;

      const dayShiftInfo = (() => {
        try {
          const ds = dateStr.slice(0, 10);
          const days = Array.isArray(state.currentMonthDetail?.days) ? state.currentMonthDetail.days : [];
          const s = days.find(d => String(d?.date || '').slice(0, 10) === ds)?.shift || null;
          if (!s) return null;
          const st = String(s.start_time || '08:00').trim();
          const et = String(s.end_time || '17:00').trim();
          const stM = parseHm(st);
          const etM = parseHm(et);
          return { st, et, stM, etM };
        } catch { return null; }
      })();

      const whMin = (() => {
        if (!isWorkDay) return 0;
        let inEff = inVal;
        if (dayShiftInfo?.st && inVal && inVal < dayShiftInfo.st) inEff = dayShiftInfo.st;
        const raw = diffMinutesAllowOvernight(inEff, outVal);
        return (raw == null || raw <= 0) ? 0 : Math.max(0, raw - totalBmin);
      })();
      const otMin = (() => {
        if (!isWorkDay) return 0;
        const outM = parseHm(outVal);
        const stM = dayShiftInfo?.stM;
        const etM = dayShiftInfo?.etM;
        if (outM != null && stM != null && etM != null) {
          const overnight = etM < stM;
          const endAbs = overnight ? (etM + 24 * 60) : etM;
          const outAbs = overnight && outM < stM ? (outM + 24 * 60) : outM;
          return Math.max(0, outAbs - endAbs);
        }
        return Math.max(0, whMin - (8 * 60));
      })();

      const whStr = !isWorkDay ? '' : (fmtWorkHours(inVal, outVal, totalBmin) || '');
      const isAutoWork = isWorkDay && (inAuto || outAuto) && !!whStr;

      if (worked) {
        const text = !isWorkDay ? '' : ((inVal && outVal) ? whStr : (isAutoWork ? whStr : ''));
        if (worked.textContent !== text) worked.textContent = text;
        const shouldWorkAuto = isAutoWork && isPlanned;
        if (worked.classList.contains('is-auto') !== shouldWorkAuto) {
          worked.classList.toggle('is-auto', shouldWorkAuto);
        }
      }
      if (excess) {
        const text = !isWorkDay ? '' : ((inVal && outVal && whMin > 0 && otMin > 0) ? fmtHm(otMin) : '');
        if (excess.textContent !== text) excess.textContent = text;
        const shouldExcessAuto = isAutoWork && otMin > 0 && isPlanned;
        if (excess.classList.contains('is-auto') !== shouldExcessAuto) {
          excess.classList.toggle('is-auto', shouldExcessAuto);
        }
      }
      if (lateEarly) {
        const a = parseHm(inVal);
        const b2 = parseHm(outVal);
        let text = '—';
        if (isWorkDay && a != null && b2 != null) {
          const baseStart = dayShiftInfo?.stM || (8 * 60);
          const baseEnd = dayShiftInfo?.etM || (17 * 60);
          const late = a > baseStart;
          const early = b2 < baseEnd;
          text = late && early ? '遅刻/早退' : late ? '遅刻' : early ? '早退' : '—';
          
          // Thêm cảnh báo nếu giờ quá bất thường (Ví dụ: Check-in trước 5h sáng hoặc check-out sau 2h sáng hôm sau)
          if (a < 300 || (b2 > a && b2 > 1560) || (b2 < a && b2 > 120)) {
             lateEarly.style.color = '#e11d48'; // Màu đỏ cảnh báo
             text += ' (要確認)';
          } else {
             lateEarly.style.color = '#64748b';
          }
        }
        if (lateEarly.textContent !== text) lateEarly.textContent = text;
      }

      if (clsSel) {
        const shouldBePlanned = !cls;
        if (clsSel.classList.contains('is-planned') !== shouldBePlanned) {
          clsSel.classList.toggle('is-planned', shouldBePlanned);
        }
      }
    } catch (e) { console.warn('recomputeRow error:', e); }
  };

  const mod = { renderTableFull, renderTable, markRowSaved, recomputeRow };
  root.Render = mod;
  globalThis.AttendanceMonthly = root;
  globalThis.MonthlyMonthlyRender = mod;
})();
