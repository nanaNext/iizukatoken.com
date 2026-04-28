// FAQ Admin Management Component
export class FaqAdminComponent {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.allQuestions = [];
    this.currentTab = 'unanswered';
  }

  async init() {
    console.log('🚀 Initializing FAQ Admin Component');
    await this.loadQuestions();
    this.render();
  }

  async loadQuestions() {
    try {
      console.log('📥 Loading admin questions...');
      const response = await fetch('/api/faq/admin/questions', {
        credentials: 'include'
      });
      console.log('Response status:', response.status);
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Failed to load questions: ${error.message}`);
      }
      
      const result = await response.json();
      this.allQuestions = result.data || [];
      console.log(`✅ Loaded ${this.allQuestions.length} questions`);
    } catch (e) {
      console.error('❌ Error loading questions:', e);
      alert('エラー: ' + e.message);
    }
  }

  render() {
    const unanswered = this.allQuestions.filter(q => q.status === '未回答');
    const answered = this.allQuestions.filter(q => q.status === '回答済み');

    const html = `
      <div style="max-width:1200px;margin:0 auto;">
        <!-- Stats -->
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:15px;margin-bottom:30px;">
          <div style="background:#f0f9ff;padding:20px;border-left:4px solid #1e40af;border-radius:4px;">
            <div style="font-size:28px;font-weight:bold;color:#1e40af;">${this.allQuestions.length}</div>
            <div style="font-size:12px;color:#666;margin-top:5px;">総質問数</div>
          </div>
          <div style="background:#fffbf0;padding:20px;border-left:4px solid #f59e0b;border-radius:4px;">
            <div style="font-size:28px;font-weight:bold;color:#f59e0b;">${unanswered.length}</div>
            <div style="font-size:12px;color:#666;margin-top:5px;">未回答</div>
          </div>
          <div style="background:#f0fdf4;padding:20px;border-left:4px solid #28a745;border-radius:4px;">
            <div style="font-size:28px;font-weight:bold;color:#28a745;">${answered.length}</div>
            <div style="font-size:12px;color:#666;margin-top:5px;">回答済み</div>
          </div>
        </div>

        <!-- Tabs -->
        <div style="display:flex;gap:10px;margin-bottom:20px;border-bottom:2px solid #ddd;">
          <button class="faq-tab" data-tab="unanswered" style="${this.currentTab === 'unanswered' ? 'border-bottom:3px solid #1e40af;color:#1e40af;' : 'color:#666;'}padding:10px 20px;border:none;background:none;cursor:pointer;font-weight:bold;">
            未回答 (${unanswered.length})
          </button>
          <button class="faq-tab" data-tab="answered" style="${this.currentTab === 'answered' ? 'border-bottom:3px solid #1e40af;color:#1e40af;' : 'color:#666;'}padding:10px 20px;border:none;background:none;cursor:pointer;font-weight:bold;">
            回答済み (${answered.length})
          </button>
          <button class="faq-tab" data-tab="all" style="${this.currentTab === 'all' ? 'border-bottom:3px solid #1e40af;color:#1e40af;' : 'color:#666;'}padding:10px 20px;border:none;background:none;cursor:pointer;font-weight:bold;">
            すべて
          </button>
        </div>

        <!-- Content -->
        <div id="faqContent">
          ${this.renderQuestions()}
        </div>
      </div>
    `;

    this.container.innerHTML = html;
    this.attachEventListeners();
  }

  renderQuestions() {
    let questions = this.allQuestions;
    
    if (this.currentTab === 'unanswered') {
      questions = questions.filter(q => q.status === '未回答');
    } else if (this.currentTab === 'answered') {
      questions = questions.filter(q => q.status === '回答済み');
    }

    if (questions.length === 0) {
      return '<div style="text-align:center;padding:40px;color:#999;">質問がありません</div>';
    }

    return questions.map(q => `
      <div style="background:#f9f9f9;padding:15px;margin-bottom:12px;border-left:4px solid ${q.status === '回答済み' ? '#28a745' : '#1e40af'};border-radius:4px;">
        <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:10px;">
          <div style="flex:1;">
            <div style="font-weight:bold;color:#1e40af;font-size:14px;margin-bottom:5px;">
              ${this.escapeHtml(q.question)}
            </div>
            <div style="font-size:12px;color:#666;">
              社員: <strong>${this.escapeHtml(q.name || 'N/A')}</strong> (ID: ${q.employee_id || 'N/A'})
              <br>
              送信日: ${new Date(q.created_at).toLocaleString('ja-JP')}
              ${q.category ? `<br>カテゴリー: <span style="background:#e8f4f8;padding:2px 6px;border-radius:3px;font-size:11px;">${this.escapeHtml(q.category)}</span>` : ''}
            </div>
          </div>
          <span style="background:${q.status === '未回答' ? '#fff3cd' : '#d4edda'};color:${q.status === '未回答' ? '#856404' : '#155724'};padding:4px 10px;border-radius:12px;font-size:11px;font-weight:bold;white-space:nowrap;">
            ${q.status}
          </span>
        </div>

        ${q.detail ? `
          <div style="background:white;padding:10px;border-radius:4px;margin-bottom:10px;font-size:13px;color:#334155;">
            <strong>詳細:</strong><br>
            ${this.escapeHtml(q.detail)}
          </div>
        ` : ''}

        ${q.admin_answer ? `
          <div style="background:white;padding:12px;border-left:3px solid #28a745;border-radius:4px;margin-bottom:10px;">
            <div style="font-weight:bold;color:#28a745;margin-bottom:8px;">✓ 回答:</div>
            <div style="font-size:13px;color:#155724;white-space:pre-wrap;word-wrap:break-word;line-height:1.5;">
              ${this.escapeHtml(q.admin_answer)}
            </div>
            <div style="font-size:11px;color:#666;margin-top:8px;">
              回答日: ${new Date(q.answered_at).toLocaleString('ja-JP')}
            </div>
          </div>
        ` : `
          <div class="answer-form" id="form-${q.id}" style="display:none;background:white;padding:12px;border-radius:4px;">
            <textarea id="answerText-${q.id}" placeholder="ここに回答を入力してください（2000文字以下）" maxlength="2000" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:4px;font-size:13px;min-height:120px;resize:vertical;box-sizing:border-box;"></textarea>
            <div style="display:flex;gap:10px;margin-top:10px;">
              <button onclick="window.faqAdmin.submitAnswer(${q.id})" style="flex:1;padding:10px;background:#28a745;color:white;border:none;border-radius:4px;cursor:pointer;font-weight:bold;">
                回答を保存
              </button>
              <button onclick="window.faqAdmin.cancelAnswer(${q.id})" style="flex:0 0 120px;padding:10px;background:#ccc;color:#333;border:none;border-radius:4px;cursor:pointer;">
                キャンセル
              </button>
            </div>
          </div>

          <div style="display:flex;gap:10px;margin-top:10px;">
            <button onclick="window.faqAdmin.showAnswerForm(${q.id})" style="padding:10px 20px;background:#1e40af;color:white;border:none;border-radius:4px;cursor:pointer;font-weight:bold;font-size:13px;">
              回答する
            </button>
          </div>
        `}
      </div>
    `).join('');
  }

  attachEventListeners() {
    document.querySelectorAll('.faq-tab').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.currentTab = e.target.dataset.tab;
        this.render();
      });
    });
  }

  showAnswerForm(questionId) {
    const form = document.getElementById(`form-${questionId}`);
    if (form) form.style.display = 'block';
  }

  cancelAnswer(questionId) {
    const form = document.getElementById(`form-${questionId}`);
    if (form) {
      form.style.display = 'none';
      document.getElementById(`answerText-${questionId}`).value = '';
    }
  }

  async submitAnswer(questionId) {
    const answerText = document.getElementById(`answerText-${questionId}`).value.trim();
    
    if (!answerText) {
      alert('回答内容を入力してください');
      return;
    }

    try {
      console.log('🌐 Submitting answer...');
      const response = await fetch(`/api/faq/admin/questions/${questionId}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ answer: answerText })
      });

      console.log('Response status:', response.status);
      
      if (response.ok) {
        console.log('✅ Answer saved successfully');
        alert('✓ 回答を保存しました');
        await this.loadQuestions();
        this.render();
      } else {
        const error = await response.json();
        throw new Error(error.message || 'Failed to save answer');
      }
    } catch (e) {
      console.error('❌ Error:', e);
      alert('エラー: ' + e.message);
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
