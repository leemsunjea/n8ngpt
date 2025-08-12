// debounce 함수 정의
function debounce(func, wait) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// DOM 요소 가져오기
const chatbox = document.getElementById("chatbox");
const input = document.getElementById("input");
const inputForm = document.getElementById("input-form");
const sendButton = document.getElementById("send-button");
const scrollToBottomBtn = document.getElementById("scrollToBottom");

// 전역 상태 변수
let currentBotElement = null;
let currentBotWrapper = null;
let typingIndicatorElement = null;
let streamingChatId = null;
let streamingMessageIndex = null;
let isProcessing = false;
let isBoldOpen = false;
let isUserScrolling = false;

// 스크롤이 하단 근처인지 확인하는 함수 (전역 함수로 이동)
function isNearBottom(threshold = 100) {
  const chatbox = document.getElementById('chatbox');
  if (!chatbox) return true;
  return chatbox.scrollHeight - chatbox.scrollTop <= chatbox.clientHeight + threshold;
}

// UUID 생성 및 가져오기
function getUUID() {
  let uuid = localStorage.getItem("chatbot_uuid");
  if (!uuid) {
    uuid = crypto.randomUUID();
    localStorage.setItem("chatbot_uuid", uuid);
  }
  return uuid;
}
const userUUID = getUUID();

// WebSocket 설정
let socket;
let reconnectAttempts = 0;
let reconnectTimer = null;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 1000; // 1초
const WEBSOCKET_URL = 'wss://port-0-nicen8n-maqzdlvl8104ba24.sel4.cloudtype.app/ws';

// WebSocket 연결 함수
function connectWebSocket() {
    try {
        // 기존 타이머 정리
        if (reconnectTimer) {
            clearTimeout(reconnectTimer);
            reconnectTimer = null;
        }

        // 기존 소켓 정리
        if (socket) {
            socket.onopen = null;
            socket.onclose = null;
            socket.onerror = null;
            socket.onmessage = null;
            if (socket.readyState === WebSocket.OPEN) {
                socket.close(1000, "재연결을 위해 연결을 닫습니다.");
            }
        }

        socket = new WebSocket(WEBSOCKET_URL);
        
        socket.onopen = () => {
            console.log("🔌 WebSocket 연결이 열렸습니다.");
            reconnectAttempts = 0; // 재연결 성공 시 카운터 초기화
            if (window.showToast) {
                showToast("연결되었습니다.", true);
            }
            
            // 채팅 매니저 초기화
            if (!chatManager.currentChatId) {
                chatManager.createNewChat();
            }
            isChatManagerReady = true;
            console.log("채팅 매니저 초기화 완료");
            
            // 웹소켓 연결 시 즉시 타이핑 인디케이터 표시 (처음에만)
            if (!isGreetingShown) {
                showTypingIndicator();
            }
        };
        
        socket.onclose = (event) => {
            console.log(`🔌 WebSocket 연결이 닫혔습니다. (코드: ${event.code}, 이유: ${event.reason || '알 수 없음'})`);
            
            // 정상 종료(1000)가 아닌 경우에만 재연결 시도
            if (event.code !== 1000 && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                const delay = Math.min(RECONNECT_DELAY * Math.pow(2, reconnectAttempts), 30000); // 최대 30초까지
                console.log(`${delay/1000}초 후 재연결을 시도합니다... (시도 ${reconnectAttempts + 1}/${MAX_RECONNECT_ATTEMPTS})`);
                
                if (window.showToast) {
                    showToast(`연결 끊김. ${delay/1000}초 후 재연결 시도 중...`, false);
                }
                
                reconnectTimer = setTimeout(() => {
                    console.log("재연결 시도 중...");
                    connectWebSocket();
                }, delay);
                
                reconnectAttempts++;
            } else if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
                console.error("최대 재연결 시도 횟수에 도달했습니다.");
                if (window.showToast) {
                    showToast("연결에 실패했습니다. 페이지를 새로고침 해주세요.", false);
                }
            }
            
            // 타이핑 인디케이터 숨기기
            hideTypingIndicator();
        };
        
        socket.onerror = (error) => {
            console.error("WebSocket 오류 발생:", error);
            if (window.showToast) {
                showToast("연결 오류가 발생했습니다.", false);
            }
        };
        
        // 메시지 핸들러 연결
        socket.onmessage = handleWebSocketMessage;
        
    } catch (error) {
        console.error("WebSocket 연결 중 오류 발생:", error);
        if (window.showToast) {
            showToast("연결 설정 중 오류가 발생했습니다.", false);
        }
    }
}

// WebSocket 메시지 처리 함수
function handleWebSocketMessage(event) {
    try {
        const data = JSON.parse(event.data);
        console.log("수신된 메시지:", data);
        
        // 기존 onmessage 핸들러 호출 (하위 호환성 유지)
        if (typeof onmessage === 'function') {
            onmessage(event);
        }
    } catch (error) {
        console.error('메시지 처리 중 오류 발생:', error, event.data);
        if (window.showToast) {
            showToast('메시지 처리 중 오류가 발생했습니다.', false);
        }
    }
}

// 페이지 로드 시 WebSocket 연결
if (typeof WebSocket !== 'undefined') {
    connectWebSocket();
} else {
    console.error("이 브라우저는 WebSocket을 지원하지 않습니다.");
    if (window.showToast) {
        showToast("이 브라우저는 WebSocket을 지원하지 않습니다. 최신 브라우저를 사용해주세요.", false);
    }
}

// 페이지 언로드 시 WebSocket 연결 종료 및 리소스 정리
function cleanup() {
    // 재연결 타이머 정리
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }
    
    // WebSocket 연결 정리
    if (socket) {
        if (socket.readyState === WebSocket.OPEN) {
            socket.close(1000, "사용자가 페이지를 나갔습니다.");
        }
        // 이벤트 리스너 제거
        socket.onopen = null;
        socket.onclose = null;
        socket.onerror = null;
        socket.onmessage = null;
    }
}

// 페이지 이벤트 리스너 등록
window.addEventListener('beforeunload', cleanup);
window.addEventListener('pagehide', cleanup);

// 채팅 매니저 초기화
let isChatManagerReady = false;
let isGreetingShown = false; // 인사말이 이미 표시되었는지 추적

// 타이핑 효과로 메시지를 추가하는 함수
function addMessageWithTypingEffect(message, type = 'bot', saveToHistory = true) {
  const chatbox = document.getElementById('chatbox');
  if (!chatbox) return;

  // 이미 showTypingIndicator()로 인디케이터가 표시된 상태이므로 여기서는 추가로 표시하지 않음
  // 타이핑 효과를 위한 딜레이 계산 (글자당 약 30ms)
  const typingDelay = Math.min(2000, message.length * 30); // 최대 2초로 제한
  
  // 실제 메시지 추가 (타이핑 효과)
  setTimeout(() => {
    // 타이핑 인디케이터 제거
    hideTypingIndicator();
    
    // 실제 메시지 추가
    addMessage(type, message, saveToHistory);
    scrollToBottom();
  }, typingDelay); // 메시지 길이에 따른 타이핑 효과 시간만 적용
}

// WebSocket 메시지 처리
socket.onmessage = async (event) => {
  try {
    const trimmedData = event.data.trim();
    if (trimmedData.startsWith('{') && trimmedData.endsWith('}')) {
      const data = JSON.parse(trimmedData);
      console.log("파싱된 메시지 타입:", data.type || 'unknown');
      
      // 인사말 메시지 처리
      if (data.type === 'greeting' && data.message) {
        console.log("인사말 메시지 수신:", data.message);
        
        // 이미 표시된 인사말인지 확인
        if (isGreetingShown) {
          console.log("이미 인사말이 표시됨, 건너뜀");
          return;
        }
        
        // 채팅 매니저가 준비될 때까지 대기 (최대 5초)
        const checkChatManager = (attempt = 0) => {
          if (isChatManagerReady && chatManager.currentChatId) {
            console.log("채팅 매니저 준비됨, 메시지 추가 시도");
            if (!chatManager.chats[chatManager.currentChatId]?.messages?.some(m => m.type === 'bot' && m.content === data.message)) {
              console.log("새 인사말 추가:", data.message);
              // 타이핑 효과와 함께 인사말 추가
              // hideTypingIndicator()는 addMessageWithTypingEffect 내부에서 처리됨
              addMessageWithTypingEffect(data.message, 'bot', true);
              isGreetingShown = true; // 인사말이 표시되었음을 표시
            }
          } else if (attempt < 50) { // 0.1초 간격으로 50번 시도 (총 5초 대기)
            console.log(`채팅 매니저 대기 중... (${attempt + 1}/50)`);
            setTimeout(() => checkChatManager(attempt + 1), 100);
          } else {
            console.error("채팅 매니저 초기화 실패, 인사말을 표시할 수 없음");
          }
        };
        
        checkChatManager();
        return;
      }

      if (data.type === 'text' && data.content) {
        hideTypingIndicator();
        const { html, boldOpen } = parseMessage(data.content, true, isBoldOpen);
        isBoldOpen = boldOpen;

        if (streamingChatId === chatManager.currentChatId) {
          if (!currentBotElement) {
            const { contentEl, wrapperEl } = addBotPlaceholder(html);
            currentBotElement = contentEl;
            currentBotWrapper = wrapperEl;
          } else {
            currentBotElement.innerHTML += html;
          }
          scrollOnResponseComplete();
        }
        return;
      }

      if (data.type === 'references' && Array.isArray(data.content)) {
        console.log(`참조 데이터 ${data.count}개 수신`);
        window.currentReferences = data.content.map(ref => ({
          id: ref.id || `ref-${Date.now()}`,
          title: ref.title || '제목 없음',
          content: ref.content || '내용 없음',
          fileUrl: ref.fileUrl || null
        }));

        if (streamingChatId && chatManager.chats[streamingChatId] && streamingMessageIndex !== null) {
          const chat = chatManager.chats[streamingChatId];
          if (chat.messages[streamingMessageIndex]) {
            chat.messages[streamingMessageIndex].references = [...window.currentReferences];
            chat.updatedAt = new Date().toISOString();
            chatManager.saveToLocalStorage();
          }
        }
        processReferences();
        return;
      }

      if (data.type === 'signal' && data.signal === 'done') {
        console.log("스트리밍 완료");
        hideTypingIndicator();

        if (streamingChatId && chatManager.chats[streamingChatId] && streamingMessageIndex !== null) {
          const chat = chatManager.chats[streamingChatId];
          if (chat.messages[streamingMessageIndex]) {
            chat.messages[streamingMessageIndex].content = currentBotElement?.innerText || '';
            chat.updatedAt = new Date().toISOString();
            chatManager.saveToLocalStorage();
          }
        }

        processReferences();
        currentBotElement = null;
        currentBotWrapper = null;
        streamingChatId = null;
        streamingMessageIndex = null;
        isProcessing = false;
        isBoldOpen = false;
        updateInputControls();
        scrollOnResponseComplete();
        return;
      }

      if (data.type === 'reference_complete') {
        console.log(`참조 완료: ${data.content}`);
        if (data.references && Array.isArray(data.references)) {
          window.currentReferences = data.references.map(ref => ({
            id: ref.id || `ref-${Date.now()}`,
            title: ref.title || '제목 없음',
            content: ref.content || '내용 없음',
            fileUrl: ref.fileUrl || null
          }));
          if (streamingChatId && chatManager.chats[streamingChatId] && streamingMessageIndex !== null) {
            const chat = chatManager.chats[streamingChatId];
            if (chat.messages[streamingMessageIndex]) {
              chat.messages[streamingMessageIndex].references = [...window.currentReferences];
              chat.updatedAt = new Date().toISOString();
              chatManager.saveToLocalStorage();
            }
          }
        }
        if (data.signal === 'done') {
          hideTypingIndicator();
          processReferences();
          currentBotElement = null;
          currentBotWrapper = null;
          streamingChatId = null;
          streamingMessageIndex = null;
          isProcessing = false;
          isBoldOpen = false;
          updateInputControls();
          scrollOnResponseComplete();
        }
        return;
      }
    }

    const { html, boldOpen } = parseMessage(trimmedData, true, isBoldOpen);
    isBoldOpen = boldOpen;

    if (streamingChatId && chatManager.chats[streamingChatId]) {
      const chatData = chatManager.chats[streamingChatId];
      if (streamingMessageIndex === null) {
        chatData.messages = chatData.messages || [];
        chatData.messages.push({ role: 'bot', content: '', references: [] });
        streamingMessageIndex = chatData.messages.length - 1;
      }
    }

    if (streamingChatId === chatManager.currentChatId) {
      if (!currentBotElement) {
        hideTypingIndicator();
        const { contentEl, wrapperEl } = addBotPlaceholder(html);
        currentBotElement = contentEl;
        currentBotWrapper = wrapperEl;
      } else {
        currentBotElement.innerHTML += html;
      }
      scrollOnResponseComplete();
    }
  } catch (e) {
    console.error("WebSocket 메시지 처리 오류:", e);
  }
};

// 스크롤 동기화 함수
function setupScrollSync() {
  if (!chatbox) return;

  let isProgrammaticScroll = false;

  function isNearBottom() {
    return chatbox.scrollHeight - chatbox.scrollTop - chatbox.clientHeight < 50;
  }

  const updateScrollbar = debounce(() => {
    const chatContentHeight = chatbox.scrollHeight;
    const chatVisibleHeight = chatbox.clientHeight;
    const isScrollable = chatContentHeight > chatVisibleHeight;
    scrollToBottomBtn.classList.toggle('visible', isScrollable && !isNearBottom());
  }, 100);

  chatbox.addEventListener('scroll', debounce(() => {
    if (isProgrammaticScroll) return;
    isUserScrolling = !isNearBottom();
    if (chatManager.currentChatId) {
      chatManager.chats[chatManager.currentChatId].scrollPosition = chatbox.scrollTop;
      chatManager.saveToLocalStorage();
    }
    updateScrollbar();
  }, 50));

  const observer = new MutationObserver(debounce(() => {
    updateScrollbar();
    if (!isUserScrolling) {
      scrollOnResponseComplete();
    }
  }, 100));
  observer.observe(chatbox, { childList: true, subtree: true, characterData: true });

  const resizeObserver = new ResizeObserver(debounce(() => {
    updateScrollbar();
    if (!isUserScrolling) {
      scrollOnResponseComplete();
    }
  }, 100));
  resizeObserver.observe(chatbox);

  scrollToBottomBtn.addEventListener('click', () => {
    isUserScrolling = false;
    scrollToBottom();
  });

  updateScrollbar();

  if (chatManager.currentChatId) {
    const savedPosition = chatManager.chats[chatManager.currentChatId]?.scrollPosition || 0;
    chatbox.scrollTop = savedPosition;
    isUserScrolling = !isNearBottom();
  }
}

// 채팅 관리자 객체
const chatManager = {
  currentChatId: null,
  chats: {},
  STORAGE_KEY: 'chatSessions',

  createNewChat() {
    try {
      const chatId = 'chat-' + Date.now();
      this.currentChatId = chatId;
      this.chats[chatId] = {
        id: chatId,
        title: '새 채팅',
        messages: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      this.saveToLocalStorage();
      this.updateChatList();
      this.loadChat(chatId);
      return chatId;
    } catch (error) {
      console.error('새 채팅 생성 중 오류:', error);
      return null;
    }
  },

  loadChat(chatId) {
    flushStreamingBotMessage();
    if (this.chats[chatId]) {
      this.currentChatId = chatId;
      const chat = this.chats[chatId];
      const chatMessages = document.getElementById('chatbox');

      if (!chatMessages) {
        console.error('채팅 메시지 컨테이너를 찾을 수 없습니다.');
        return false;
      }

      chatMessages.innerHTML = '';
      if (Array.isArray(chat.messages)) {
        chat.messages.forEach(msg => {
          if (msg && msg.content) {
            addMessage(msg.role, msg.content, false, msg.references || []);
          }
        });
      }

      chat.updatedAt = new Date().toISOString();
      this.saveToLocalStorage();
      document.querySelectorAll('.chat-item.active').forEach(el => el.classList.remove('active'));
      const activeItem = document.querySelector(`.chat-item[data-id="${chatId}"]`);
      if (activeItem) activeItem.classList.add('active');

      const input = document.getElementById('input');
      if (input) {
        input.value = '';
        input.focus();
      }

      isUserScrolling = !isNearBottom();
      return true;
    }
    return false;
  },

  addMessage(role, content) {
    if (!this.currentChatId) {
      this.createNewChat();
    }

    if (!content || typeof content !== 'string') return null;

    const message = {
      id: 'msg-' + Date.now(),
      role,
      content,
      timestamp: new Date().toISOString()
    };

    this.chats[this.currentChatId] = this.chats[this.currentChatId] || { messages: [] };
    this.chats[this.currentChatId].messages = this.chats[this.currentChatId].messages || [];
    this.chats[this.currentChatId].messages.push(message);

    if (this.chats[this.currentChatId].title === '새 채팅' && role === 'user') {
      const shortContent = content.length > 20 ? content.substring(0, 20) + '...' : content;
      this.chats[this.currentChatId].title = shortContent;
      this.updateChatList();
    }

    this.chats[this.currentChatId].updatedAt = new Date().toISOString();
    this.saveToLocalStorage();
    return message;
  },

  updateChatList() {
    const chatList = document.getElementById('chatHistory');
    if (!chatList) return;

    if (Object.keys(this.chats).length === 0) {
      chatList.innerHTML = '<div class="no-chats">채팅 내역이 없습니다</div>';
      return;
    }

    chatList.innerHTML = '';
    Object.values(this.chats)
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      .forEach(chat => {
        const chatItem = document.createElement('div');
        chatItem.className = 'chat-item' + (chat.id === this.currentChatId ? ' active' : '');
        chatItem.dataset.id = chat.id;
        
        // Create chat title span
        const titleSpan = document.createElement('span');
        titleSpan.className = 'chat-title';
        titleSpan.textContent = chat.title;
        
        // Create delete button
        const deleteBtn = document.createElement('span');
        deleteBtn.className = 'delete-chat';
        deleteBtn.innerHTML = '&times;';
        deleteBtn.title = '채팅방 삭제';
        
        // Delete chat room immediately on click
        deleteBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.deleteChat(chat.id);
        });

        // Add elements to chat item
        chatItem.appendChild(titleSpan);
        chatItem.appendChild(deleteBtn);
        
        chatItem.addEventListener('click', () => {
          this.loadChat(chat.id);
        });
        chatList.appendChild(chatItem);
      });
  },

  saveToLocalStorage() {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify({
        chats: this.chats,
        currentChatId: this.currentChatId
      }));
    } catch (error) {
      console.error('로컬 스토리지 저장 실패:', error);
    }
  },

  loadFromLocalStorage() {
    try {
      const savedData = localStorage.getItem(this.STORAGE_KEY);
      if (!savedData) return false;
      const parsed = JSON.parse(savedData);
      if (!parsed.chats || typeof parsed.chats !== 'object') throw new Error('Invalid chat data');
      this.chats = parsed.chats;
      this.currentChatId = parsed.currentChatId || null;
      this.updateChatList();
      return true;
    } catch (error) {
      console.error('로컬 스토리지 불러오기 실패:', error);
      localStorage.removeItem(this.STORAGE_KEY);
      return false;
    }
  },
  
  deleteChat(chatId) {
    // If we're deleting the current chat, switch to another one
    if (chatId === this.currentChatId) {
      const chatIds = Object.keys(this.chats);
      const currentIndex = chatIds.indexOf(chatId);
      const nextChatId = chatIds[currentIndex + 1] || chatIds[currentIndex - 1];
      
      if (nextChatId) {
        this.loadChat(nextChatId);
      } else {
        // If this was the last chat, create a new one
        this.createNewChat();
      }
    }
    
    // Delete the chat
    delete this.chats[chatId];
    
    // Update storage and UI
    this.saveToLocalStorage();
    this.updateChatList();
    
    // Clear chatbox if we deleted the current chat
    if (chatId === this.currentChatId) {
      const chatbox = document.getElementById('chatbox');
      if (chatbox) chatbox.innerHTML = '';
    }
  }
};

// 입력 이벤트 리스너
input.addEventListener('input', function () {
  autoResize(this);
  updateInputControls();
});

let isComposing = false;
input.addEventListener('compositionstart', () => { isComposing = true; });
input.addEventListener('compositionend', () => { isComposing = false; });
input.addEventListener('keydown', function (e) {
  if (e.key === 'Enter' && !e.shiftKey && !isComposing) {
    e.preventDefault();
    if (!isProcessing) {
      inputForm.dispatchEvent(new Event('submit'));
    }
  }
});

// 폼 제출 이벤트
inputForm.onsubmit = sendMessage;

// 출처 토글 설정
const sourceToggle = document.getElementById('sourceToggle');
if (sourceToggle) {
  const savedToggleState = localStorage.getItem('showSources');
  if (savedToggleState !== null) {
    sourceToggle.checked = savedToggleState === 'true';
  }
  sourceToggle.addEventListener('change', function () {
    const show = this.checked;
    localStorage.setItem('showSources', show);
    document.querySelectorAll('.references-container').forEach(container => {
      container.style.display = show ? 'block' : 'none';
    });
  });
}

// 새 채팅 버튼 이벤트
document.getElementById('newChatBtn').addEventListener('click', () => {
  chatManager.createNewChat();
});

// 사이드바 토글 설정
document.addEventListener('DOMContentLoaded', function () {
  setupScrollSync();

  const hamburgerBtn = document.getElementById('hamburgerBtn');
  const sidebar = document.getElementById('sidebar');

  if (!hamburgerBtn || !sidebar) {
    console.error('햄버거 버튼 또는 사이드바를 찾을 수 없습니다.');
    return;
  }

  function toggleSidebar() {
    const isCollapsed = sidebar.classList.toggle('collapsed');
    const icon = hamburgerBtn.querySelector('svg');
    if (isCollapsed) {
      icon.innerHTML = '<path d="M3 12H21M3 6H21M3 18H21" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';
      document.body.classList.remove('sidebar-open');
    } else {
      icon.innerHTML = '<path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';
      document.body.classList.add('sidebar-open');
    }
  }

  hamburgerBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    toggleSidebar();
  });

  document.addEventListener('click', function (e) {
    const isMobile = window.innerWidth <= 768;
    const isSidebarOpen = !sidebar.classList.contains('collapsed');
    const isClickInsideSidebar = e.target.closest('.sidebar');
    const isClickOnHamburger = e.target === hamburgerBtn;

    if (isMobile && isSidebarOpen && !isClickInsideSidebar && !isClickOnHamburger) {
      toggleSidebar();
    }
  });

  const isMobileView = window.innerWidth <= 768;
  if (isMobileView) {
    sidebar.classList.add('collapsed');
  }
});

// 초기화
chatManager.loadFromLocalStorage();
if (!chatManager.currentChatId) {
  chatManager.createNewChat();
}

// 메시지 전송 함수
function sendMessage(event) {
  event.preventDefault();
  const message = input.value.trim();
  if (message === '' || isProcessing) return;

  isProcessing = true;
  updateInputControls();

  addMessage('user', message);
  input.value = '';
  autoResize(input);

  sendToN8N({
    uuid: userUUID,
    type: "user",
    message: message,
    references: [],
    timestamp: new Date().toISOString()
  });

  showTypingIndicator();
  streamingChatId = chatManager.currentChatId;
  currentBotElement = null;
  currentBotWrapper = null;
  isBoldOpen = false;

  socket.send(JSON.stringify({
    uuid: userUUID,
    chatInput: message
  }));
}

// 입력 컨트롤 업데이트
function updateInputControls() {
  sendButton.disabled = isProcessing;
  sendButton.classList.toggle('active', input.value.trim() !== '' && !isProcessing);
}

// 메시지 추가 함수
function addMessage(type, text, doSave = true, references = []) {
  const messageDiv = document.createElement('div');
  messageDiv.className = 'message ' + (type === 'user' ? 'message-user' : 'message-bot');

  const wrapper = document.createElement("div");
  wrapper.className = "message-content-wrapper";

  if (type === "bot") {
    const avatar = document.createElement("div");
    avatar.className = `avatar ${type}-avatar`;
    avatar.innerHTML = `<svg width="24" height="24" fill="white"><circle cx="12" cy="12" r="10"/></svg>`;
    wrapper.appendChild(avatar);
  }

  const content = document.createElement("div");
  content.className = "message-content";
  content.innerHTML = parseMessage(text, false).html;
  wrapper.appendChild(content);

  if (type === 'bot' && Array.isArray(references) && references.length) {
    const processedRefs = references.map(ref => {
      if (ref.content === ref.title || ref.content.endsWith('.pdf')) {
        return {
          ...ref,
          content: `이 문서는 '${ref.title || '알 수 없는 문서'}'에서 참조되었습니다.`
        };
      }
      return ref;
    });

    addReferences(wrapper, processedRefs);
  }

  messageDiv.appendChild(wrapper);
  chatbox.appendChild(messageDiv);

  if (doSave && chatManager.currentChatId) {
    chatManager.chats[chatManager.currentChatId].messages = chatManager.chats[chatManager.currentChatId].messages || [];
    chatManager.chats[chatManager.currentChatId].messages.push({ role: type, content: text, references });
    if (chatManager.chats[chatManager.currentChatId].title === '새 채팅' && type === 'user') {
      const shortContent = text.length > 20 ? text.substring(0, 20) + '...' : text;
      chatManager.chats[chatManager.currentChatId].title = shortContent;
      chatManager.updateChatList();
    }
    chatManager.saveToLocalStorage();
  }
  scrollOnResponseComplete();
}

// 봇 메시지 플레이스홀더 추가
function addBotPlaceholder(initialHTML) {
  hideTypingIndicator();
  const messageDiv = document.createElement('div');
  messageDiv.className = 'message message-bot';

  const wrapper = document.createElement("div");
  wrapper.className = "message-content-wrapper";

  const avatar = document.createElement("div");
  avatar.className = "avatar bot-avatar";
  avatar.innerHTML = `<svg width="24" height="24" fill="white"><circle cx="12" cy="12" r="10"/></svg>`;

  const content = document.createElement("div");
  content.className = "message-content";
  content.innerHTML = initialHTML;

  wrapper.appendChild(avatar);
  wrapper.appendChild(content);
  messageDiv.appendChild(wrapper);
  chatbox.appendChild(messageDiv);

  return { contentEl: content, wrapperEl: wrapper };
}

// 메시지 파싱
function parseMessage(text, isStreaming = false, prevBoldOpen = false) {
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  if (!isStreaming) {
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    return { html: html.replace(/\n/g, "<br>"), boldOpen: false };
  }

  let output = prevBoldOpen ? '<strong>' : '';
  let boldOpen = prevBoldOpen;
  let i = 0;

  while (i < html.length) {
    if (html.slice(i, i + 2) === '**') {
      if (!boldOpen) {
        output += '<strong>';
        boldOpen = true;
      } else {
        output += '</strong>';
        boldOpen = false;
      }
      i += 2;
    } else {
      output += html[i];
      i++;
    }
  }

  return { html: output.replace(/\n/g, "<br>"), boldOpen };
}

// 텍스트AREA 자동 크기 조정
function autoResize(textarea) {
  textarea.style.height = 'auto';
  textarea.style.height = textarea.scrollHeight + 'px';
}

// 참조 데이터 표시
function addReferences(messageWrapper, references) {
  if (!references || !messageWrapper || references.length === 0) return;

  // 기존 컨테이너 제거
  const existingContainer = messageWrapper.querySelector('.references-outer-container');
  if (existingContainer) existingContainer.remove();

  // 외부 컨테이너 생성 (토글 버튼 + 참조 컨테이너)
  const outerContainer = document.createElement('div');
  outerContainer.className = 'references-outer-container';
  
  // 출처 토글 버튼 생성
  const toggleButton = document.createElement('div');
  toggleButton.className = 'references-toggle collapsed';
  toggleButton.textContent = '출처 보기';
  
  // 참조 컨테이너 생성
  const referencesContainer = document.createElement('div');
  referencesContainer.className = 'references-container';
  
  // 각 참조 박스 생성
  references.forEach(ref => {
    const refBox = document.createElement('div');
    refBox.className = 'reference-box';
    refBox.innerHTML = `
      <div class="reference-header">
        <div class="reference-title">${ref.title || '제목 없음'}</div>
        <button class="reference-download" aria-label="문서 다운로드" tabindex="0" data-filename="${ref.title || 'unknown'}">
          <svg viewBox="0 0 24 24">
            <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
          </svg>
          다운로드
        </button>
        <div class="reference-toggle">▼</div>
      </div>
      <div class="reference-content">${ref.content || '내용 없음'}</div>
    `;

    // 개별 참조 박스 토글 이벤트 (터치 지원)
    const header = refBox.querySelector('.reference-header');
    let touchStartTime = 0;
    let touchStartX = 0;
    let touchStartY = 0;

    const handleToggle = (e) => {
      // 다운로드 버튼 클릭 시 토글 방지
      if (e.target.closest('.reference-download')) return;
      
      // 모바일에서 스크롤 중에 토글이 동작하는 것 방지
      if (e.type === 'touchend') {
        const touch = e.changedTouches[0];
        const moveX = Math.abs(touch.clientX - touchStartX);
        const moveY = Math.abs(touch.clientY - touchStartY);
        const touchDuration = Date.now() - touchStartTime;
        
        // 일정 거리 이상 움직였거나, 너무 짧게 누른 경우 무시
        if (moveX > 10 || moveY > 10 || touchDuration < 100) {
          return;
        }
      }
      
      e.preventDefault();
      e.stopPropagation();
      
      refBox.classList.toggle('expanded');
      const content = refBox.querySelector('.reference-content');
      if (refBox.classList.contains('expanded')) {
        content.style.maxHeight = `${content.scrollHeight}px`;
        // 모바일에서 스크롤이 부드럽게 되도록 함
        setTimeout(() => {
          content.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 100);
      } else {
        content.style.maxHeight = '0';
      }
    };

    // 터치 이벤트 리스너 추가
    header.addEventListener('touchstart', (e) => {
      touchStartTime = Date.now();
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }, { passive: true });

    header.addEventListener('touchend', handleToggle, { passive: false });
    header.addEventListener('click', handleToggle);

    // 다운로드 버튼 이벤트 (터치 지원)
    const downloadBtn = refBox.querySelector('.reference-download');
    downloadBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      downloadReference(ref, downloadBtn);
    });

    // 모바일에서 터치 피드백을 위한 클래스 토글
    header.addEventListener('touchstart', () => {
      header.classList.add('active-touch');
    }, { passive: true });

    header.addEventListener('touchend', () => {
      header.classList.remove('active-touch');
    }, { passive: true });

    referencesContainer.appendChild(refBox);
  });

  // 토글 버튼 클릭 이벤트 (터치 지원)
  const handleToggleAll = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    toggleButton.classList.toggle('collapsed');
    referencesContainer.classList.toggle('visible');
    
    // 토글 버튼 텍스트 업데이트
    if (toggleButton.classList.contains('collapsed')) {
      toggleButton.textContent = '출처 보기';
    } else {
      toggleButton.textContent = '출처 숨기기';
      // 모바일에서 스크롤이 부드럽게 되도록 함
      setTimeout(() => {
        referencesContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 100);
    }
  };

  // 데스크톱과 모바일 모두 지원
  toggleButton.addEventListener('click', handleToggleAll);
  toggleButton.addEventListener('touchend', (e) => {
    e.preventDefault();
    handleToggleAll(e);
  }, { passive: false });

  // DOM에 요소 추가
  outerContainer.appendChild(toggleButton);
  outerContainer.appendChild(referencesContainer);
  
  // 메시지 래퍼에 추가
  messageWrapper.appendChild(outerContainer);
  
  // 소스 표시 토글이 켜져있으면 자동으로 펼치기
  if (document.getElementById('sourceToggle')?.checked) {
    toggleButton.click();
  }
}

// 참조 문서 다운로드
function downloadReference(ref, button) {
  button.disabled = true;
  button.innerHTML = `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2" class="spinner"/></svg> 다운로드`;

  // 참조 제목에서 "참조 X: " 접두어 제거하여 filename 생성
  const filename = ref.title?.replace(/^참조 \d+: /, '') || 'unknown';

  fetch('/download-link', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename })
  })
    .then(response => {
      if (!response.ok) throw new Error();
      return response.json();
    })
    .then(data => {
      if (data.download_url) {
        const link = document.createElement('a');
        link.href = data.download_url;
        link.download = filename || 'document';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    })
    .catch(() => {
      // 오류 시 아무 메시지도 표시하지 않음
    })
    .finally(() => {
      button.disabled = false;
      button.innerHTML = `<svg viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg> 다운로드`;
    });
}

// n8n 전송
function sendToN8N(payload, successCallback, errorCallback) {
  console.log("n8n payload:", payload);
  fetch("https://sunjea1149.app.n8n.cloud/webhook/d8b35487-e81b-45c6-95ce-248852c5e3a3", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  })
    .then(response => {
      if (!response.ok) throw new Error(`n8n 응답 오류: ${response.status}`);
      return response.json();
    })
    .then(data => {
      console.log("n8n 전송 성공:", data);
      if (successCallback) successCallback(data);
    })
    .catch(err => {
      console.warn("n8n 전송 실패:", err);
      if (errorCallback) errorCallback(err);
    });
}

// 토스트 알림 표시
function showToast(message, isSuccess = false) {
  const toast = document.createElement('div');
  toast.className = `toast ${isSuccess ? 'success' : ''}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// 참조 데이터 처리
function processReferences() {
  if (window.currentReferences && currentBotWrapper) {
    console.log("참조 데이터 처리 시작", window.currentReferences);
    if (chatManager.currentChatId && chatManager.chats[chatManager.currentChatId]) {
      const chat = chatManager.chats[chatManager.currentChatId];
      const messages = chat.messages || [];
      const targetIdx = streamingMessageIndex;

      if (targetIdx !== null && messages[targetIdx]) {
        // 참조 데이터 복사본을 저장
        const referencesCopy = [...window.currentReferences];
        messages[targetIdx].references = referencesCopy;
        chat.updatedAt = new Date().toISOString();
        chatManager.saveToLocalStorage();
        // 참조 데이터 표시
        addReferences(currentBotWrapper, referencesCopy);
        return;
      }
    }
    // targetIdx가 없거나 메시지를 찾을 수 없는 경우
    addReferences(currentBotWrapper, [...window.currentReferences]);
  }
}

// 스트리밍 메시지 플러시
function flushStreamingBotMessage() {
  if (currentBotElement && chatManager.currentChatId) {
    chatManager.chats[chatManager.currentChatId].messages = chatManager.chats[chatManager.currentChatId].messages || [];
    chatManager.chats[chatManager.currentChatId].messages.push({
      role: 'bot',
      content: currentBotElement.innerText || '',
      references: []
    });
    chatManager.chats[chatManager.currentChatId].updatedAt = new Date().toISOString();
    chatManager.saveToLocalStorage();
    currentBotElement = null;
    currentBotWrapper = null;
  }
}

// 스크롤 관련 함수
function scrollToBottom() {
  if (!chatbox) return;
  chatbox.scrollTo({
    top: chatbox.scrollHeight,
    behavior: 'smooth'
  });
}

function scrollOnResponseComplete() {
  if (!isUserScrolling) {
    setTimeout(scrollToBottom, 300);
  }
}

// 타이핑 인디케이터 표시
function showTypingIndicator() {
  if (!typingIndicatorElement) {
    typingIndicatorElement = document.createElement('div');
    typingIndicatorElement.className = 'message message-bot';
    typingIndicatorElement.innerHTML = `
      <div class="message-content-wrapper">
        <div class="avatar bot-avatar">
          <svg width="24" height="24" fill="white"><circle cx="12" cy="12" r="10"/></svg>
        </div>
        <div class="typing-indicator">
          <span></span><span></span><span></span>
        </div>
      </div>
    `;
    chatbox.appendChild(typingIndicatorElement);
    scrollOnResponseComplete();
  }
}

// 타이핑 인디케이터 숨기기
function hideTypingIndicator() {
  if (typingIndicatorElement) {
    typingIndicatorElement.remove();
    typingIndicatorElement = null;
  }
}