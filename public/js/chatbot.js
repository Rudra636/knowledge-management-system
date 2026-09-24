(function () {
  const API_BASE = '/api';

  function $(sel) { return document.querySelector(sel); }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str ?? '';
    return div.innerHTML;
  }

  function appendBubble(container, role, text, pending = false) {
    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${role}${pending ? ' pending' : ''}`;
    bubble.textContent = text;
    container.appendChild(bubble);
    container.scrollTop = container.scrollHeight;
    return bubble;
  }

  async function sendMessage({ container, input, fileId }) {
    const question = input.value.trim();
    if (!question) return;
    input.value = '';
    input.disabled = true;

    container.querySelectorAll('.chat-empty').forEach((el) => el.remove());
    appendBubble(container, 'user', question);
    const pendingBubble = appendBubble(container, 'assistant', 'Thinking…', true);

    try {
      const res = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId: fileId || undefined, question })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.details || data.error || 'Chatbot request failed');

      pendingBubble.textContent = data.answer;
      pendingBubble.classList.remove('pending');
    } catch (err) {
      pendingBubble.textContent = `Sorry — ${err.message}`;
      pendingBubble.classList.remove('pending');
    } finally {
      input.disabled = false;
      input.focus();
    }
  }

  async function loadHistory(container, fileId) {
    container.innerHTML = '';
    try {
      const params = fileId ? `?fileId=${fileId}` : '';
      const res = await fetch(`${API_BASE}/chat/history${params}`);
      const history = await res.json();

      if (!history.length) {
        container.innerHTML = '<p class="chat-empty">No messages yet. Ask a question to get started.</p>';
        return;
      }
      history.forEach((m) => appendBubble(container, m.role, m.message));
    } catch (err) {
      container.innerHTML = '<p class="chat-empty">Could not load chat history.</p>';
    }
  }

  // -------------------- Per-file chat --------------------
  let currentFileId = null;

  window.initFileChat = function (fileId) {
    currentFileId = fileId;
    loadHistory($('#fileChatWindow'), fileId);
  };

  $('#fileChatForm').addEventListener('submit', (e) => {
    e.preventDefault();
    sendMessage({
      container: $('#fileChatWindow'),
      input: $('#fileChatInput'),
      fileId: currentFileId
    });
  });

  // -------------------- General chat --------------------
  $('#openGeneralChatBtn').addEventListener('click', () => {
    $('#generalChatBackdrop').hidden = false;
    loadHistory($('#generalChatWindow'), null);
  });
  $('#closeGeneralChatBtn').addEventListener('click', () => { $('#generalChatBackdrop').hidden = true; });
  $('#generalChatBackdrop').addEventListener('click', (e) => {
    if (e.target === $('#generalChatBackdrop')) $('#generalChatBackdrop').hidden = true;
  });

  $('#generalChatForm').addEventListener('submit', (e) => {
    e.preventDefault();
    sendMessage({
      container: $('#generalChatWindow'),
      input: $('#generalChatInput'),
      fileId: null
    });
  });
})();