// ─── OIL Chat Assistant JS ────────────────────────────────────────────────────

const chatMessages  = document.getElementById('chatMessages');
const chatInput     = document.getElementById('chatInput');
const sendBtn       = document.getElementById('sendBtn');
const suggestionsEl = document.getElementById('suggestions');

// Auto-resize textarea
chatInput.addEventListener('input', () => {
  chatInput.style.height = 'auto';
  chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
});

// Send on Enter (not Shift+Enter)
chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

function useSuggestion(btn) {
  chatInput.value = btn.textContent;
  suggestionsEl.style.display = 'none';
  sendMessage();
}

function appendMessage(role, content) {
  const wrapper = document.createElement('div');
  wrapper.className = 'message ' + role;

  const avatar = document.createElement('div');
  avatar.className = 'msg-avatar';
  avatar.textContent = role === 'assistant' ? '🤖' : '👤';

  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble';
  // Convert newlines to <br> for display
  bubble.innerHTML = content.replace(/\n/g, '<br/>');

  wrapper.appendChild(avatar);
  wrapper.appendChild(bubble);
  chatMessages.appendChild(wrapper);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return wrapper;
}

function appendTyping() {
  const wrapper = document.createElement('div');
  wrapper.className = 'message assistant';
  wrapper.id = 'typingIndicator';

  const avatar = document.createElement('div');
  avatar.className = 'msg-avatar';
  avatar.textContent = '🤖';

  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble';
  bubble.innerHTML = '<div class="typing-dots"><span></span><span></span><span></span></div>';

  wrapper.appendChild(avatar);
  wrapper.appendChild(bubble);
  chatMessages.appendChild(wrapper);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function removeTyping() {
  const el = document.getElementById('typingIndicator');
  if (el) el.remove();
}

async function sendMessage() {
  const question = chatInput.value.trim();
  if (!question) return;

  // Append user message
  appendMessage('user', question);
  chatInput.value = '';
  chatInput.style.height = 'auto';
  sendBtn.disabled = true;

  // Show typing indicator
  appendTyping();

  try {
    const res = await fetch('/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question })
    });

    const data = await res.json();
    removeTyping();

    if (res.ok && data.answer) {
      appendMessage('assistant', data.answer);
    } else {
      appendMessage('assistant', '⚠️ ' + (data.error || 'Sorry, I couldn\'t get an answer. Please try again.'));
    }
  } catch (err) {
    removeTyping();
    appendMessage('assistant', '❌ Network error — please check your connection and try again.');
  } finally {
    sendBtn.disabled = false;
    chatInput.focus();
  }
}
