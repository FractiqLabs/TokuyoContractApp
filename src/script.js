document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const characterImage = document.getElementById('character-image');
    const characterName = document.getElementById('character-name');
    const contractTitle = document.getElementById('contract-title');
    const contractText = document.getElementById('contract-text');
    const progressBar = document.getElementById('progress-bar');
    const progressLabel = document.getElementById('progress-label');
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const playPauseBtn = document.getElementById('play-pause-btn');
    const speedRange = document.getElementById('speed-range');
    const speedLabel = document.getElementById('speed-label');
    const completeBtn = document.getElementById('complete-btn');
    const completionModal = document.getElementById('completion-modal');
    const closeCompletionBtn = document.getElementById('close-completion-btn');
    
    // Chat Elements
    const chatBtn = document.getElementById('chat-btn');
    const chatModal = document.getElementById('chat-modal');
    const closeChatBtn = document.getElementById('close-chat-btn');
    const chatMessages = document.getElementById('chat-messages');
    const faqButtons = document.getElementById('faq-buttons');
    
    // Sidebar Elements
    const sidebar = document.getElementById('sidebar');

    // State
    let contractStructure = {};
    let faqData = [];
    let currentDocument = 'important';
    let currentSectionId = 'i1';
    let isSpeaking = false;
    let isPaused = false;
    let speechRate = 1.0;

    // Web Speech API
    const synth = window.speechSynthesis;
    let utterance = new SpeechSynthesisUtterance();

    // --- Data Loading ---
    async function loadData() {
        try {
            const [structureRes, faqRes] = await Promise.all([
                fetch('./src/data/contract_structure.json'),
                fetch('./src/data/faq.json')
            ]);
            contractStructure = await structureRes.json();
            faqData = await faqRes.json();
            initialize();
        } catch (error) {
            console.error('データの読み込みに失敗しました:', error);
            contractText.textContent = 'データの読み込みに失敗しました。';
        }
    }

    // --- Initialization ---
    function initialize() {
        buildSidebar();
        updateContent();
        setupFAQButtons();
        updateProgress();
    }

    // --- Sidebar Management ---
    function buildSidebar() {
        const sections = ['contract', 'important', 'consent', 'admission', 'pricing'];
        
        sections.forEach(sectionKey => {
            const sectionData = contractStructure[sectionKey];
            const sectionElement = document.getElementById(`${sectionKey}-sections`);
            const headerElement = document.querySelector(`[data-section="${sectionKey}"]`);
            
            if (sectionData && sectionElement) {
                sectionElement.innerHTML = '';
                sectionData.sections.forEach(item => {
                    const link = document.createElement('a');
                    link.href = '#';
                    link.className = 'sidebar-link';
                    link.textContent = item.title;
                    link.addEventListener('click', (e) => {
                        e.preventDefault();
                        navigateToSection(sectionKey, item.id);
                    });
                    sectionElement.appendChild(link);
                });
            }
            
            if (headerElement) {
                headerElement.addEventListener('click', () => {
                    toggleSidebarSection(sectionKey);
                });
            }
        });
        
        // デフォルトで重要事項説明書を開く
        toggleSidebarSection('important');
    }

    function toggleSidebarSection(sectionKey) {
        const header = document.querySelector(`[data-section="${sectionKey}"]`);
        const content = document.getElementById(`${sectionKey}-sections`);
        
        // すべてのセクションを閉じる
        document.querySelectorAll('.sidebar-header').forEach(h => h.classList.remove('active'));
        document.querySelectorAll('.sidebar-content').forEach(c => c.classList.remove('active'));
        
        // 選択されたセクションを開く
        header.classList.add('active');
        content.classList.add('active');
    }

    function navigateToSection(documentType, sectionId) {
        currentDocument = documentType;
        currentSectionId = sectionId;
        updateContent();
        updateProgress();
        updateActiveSidebarLink();
        stopSpeech();
    }

    function updateActiveSidebarLink() {
        document.querySelectorAll('.sidebar-link').forEach(link => {
            link.classList.remove('active');
        });
        
        const currentSection = getCurrentSection();
        if (currentSection) {
            const activeLink = Array.from(document.querySelectorAll('.sidebar-link'))
                .find(link => link.textContent === currentSection.title);
            if (activeLink) {
                activeLink.classList.add('active');
            }
        }
    }

    function getCurrentSection() {
        const documentData = contractStructure[currentDocument];
        if (!documentData) return null;
        return documentData.sections.find(section => section.id === currentSectionId);
    }

    function getTotalSections() {
        return Object.values(contractStructure).reduce((total, doc) => total + doc.sections.length, 0);
    }

    function getCurrentSectionIndex() {
        let index = 0;
        const sections = ['contract', 'important', 'consent', 'admission', 'pricing'];
        
        for (let docType of sections) {
            const doc = contractStructure[docType];
            if (!doc) continue;
            
            if (docType === currentDocument) {
                const sectionIndex = doc.sections.findIndex(s => s.id === currentSectionId);
                return index + sectionIndex;
            }
            index += doc.sections.length;
        }
        return 0;
    }

    function navigateToSectionByIndex(targetIndex) {
        let currentIndex = 0;
        const sections = ['contract', 'important', 'consent', 'admission', 'pricing'];
        
        for (let docType of sections) {
            const doc = contractStructure[docType];
            if (!doc) continue;
            
            if (targetIndex < currentIndex + doc.sections.length) {
                const sectionIndex = targetIndex - currentIndex;
                currentDocument = docType;
                currentSectionId = doc.sections[sectionIndex].id;
                toggleSidebarSection(docType);
                updateContent();
                updateProgress();
                updateActiveSidebarLink();
                return;
            }
            currentIndex += doc.sections.length;
        }
    }

    // --- Content Update ---
    function updateContent() {
        const section = getCurrentSection();
        if (!section) return;

        contractTitle.textContent = section.title;
        contractText.textContent = section.content;
        
        // Update navigation buttons
        const currentIndex = getCurrentSectionIndex();
        const totalSections = getTotalSections();
        
        prevBtn.disabled = currentIndex === 0;
        nextBtn.disabled = currentIndex === totalSections - 1;
        
        // Show completion button on last section
        if (currentIndex === totalSections - 1) {
            completeBtn.style.display = 'inline-block';
            nextBtn.style.display = 'none';
        } else {
            completeBtn.style.display = 'none';
            nextBtn.style.display = 'inline-block';
        }
        
        stopSpeech();
    }

    function updateProgress() {
        const currentIndex = getCurrentSectionIndex();
        const totalSections = getTotalSections();
        
        const progressPercent = ((currentIndex + 1) / totalSections) * 100;
        progressBar.style.setProperty('--progress-percent', `${progressPercent}%`);
        progressLabel.textContent = `${currentIndex + 1} / ${totalSections}`;
    }

    // --- Speech Synthesis ---
    function handlePlayPause() {
        if (isSpeaking) {
            if (isPaused) {
                synth.resume();
                isPaused = false;
                playPauseBtn.textContent = '❚❚ 一時停止';
            } else {
                synth.pause();
                isPaused = true;
                playPauseBtn.textContent = '▶ 再生';
            }
        } else {
            startSpeech();
        }
    }

    function startSpeech() {
        const textToSpeak = `${contractTitle.textContent}。${contractText.textContent}`;
        utterance = new SpeechSynthesisUtterance(textToSpeak);
        utterance.lang = 'ja-JP';
        utterance.rate = speechRate;
        utterance.pitch = 1.0;

        utterance.onstart = () => {
            isSpeaking = true;
            isPaused = false;
            playPauseBtn.textContent = '❚❚ 一時停止';
            characterImage.classList.add('speaking');
        };

        utterance.onend = () => {
            stopSpeech();
        };

        synth.speak(utterance);
    }

    function stopSpeech() {
        if (synth.speaking) {
            synth.cancel();
        }
        isSpeaking = false;
        isPaused = false;
        playPauseBtn.textContent = '▶ 再生';
        characterImage.classList.remove('speaking');
    }

    function speakText(text) {
        if (synth.speaking) {
            synth.cancel();
        }
        
        const faqUtterance = new SpeechSynthesisUtterance(text);
        faqUtterance.lang = 'ja-JP';
        faqUtterance.rate = speechRate;
        faqUtterance.pitch = 1.0;
        
        faqUtterance.onstart = () => {
            characterImage.classList.add('speaking');
        };
        
        faqUtterance.onend = () => {
            characterImage.classList.remove('speaking');
        };
        
        synth.speak(faqUtterance);
    }

    // --- Event Listeners ---
    nextBtn.addEventListener('click', () => {
        const currentIndex = getCurrentSectionIndex();
        const totalSections = getTotalSections();
        if (currentIndex < totalSections - 1) {
            navigateToSectionByIndex(currentIndex + 1);
        }
    });

    prevBtn.addEventListener('click', () => {
        const currentIndex = getCurrentSectionIndex();
        if (currentIndex > 0) {
            navigateToSectionByIndex(currentIndex - 1);
        }
    });

    playPauseBtn.addEventListener('click', handlePlayPause);

    speedRange.addEventListener('input', (e) => {
        speechRate = parseFloat(e.target.value);
        speedLabel.textContent = `${speechRate.toFixed(1)}倍`;
        
        if (isSpeaking && !isPaused) {
            stopSpeech();
            startSpeech();
        }
    });

    // --- Completion Modal ---
    completeBtn.addEventListener('click', () => {
        completionModal.classList.remove('hidden');
        const completionTime = new Date().toLocaleString('ja-JP');
        localStorage.setItem('contractCompletionTime', completionTime);
    });

    closeCompletionBtn.addEventListener('click', () => {
        completionModal.classList.add('hidden');
    });

    // --- Chat Modal ---
    chatBtn.addEventListener('click', () => {
        chatModal.classList.remove('hidden');
        if (chatMessages.children.length === 0) {
            addBotMessage('こんにちは！ご質問がございましたら、下のボタンからお選びください。');
        }
    });

    closeChatBtn.addEventListener('click', () => {
        chatModal.classList.add('hidden');
    });

    function setupFAQButtons() {
        faqButtons.innerHTML = '';
        faqData.forEach(faq => {
            const button = document.createElement('button');
            button.className = 'faq-button';
            button.textContent = faq.question;
            button.addEventListener('click', () => {
                addUserMessage(faq.question);
                setTimeout(() => {
                    addBotMessage(faq.answer);
                    speakText(faq.answer);
                }, 500);
            });
            faqButtons.appendChild(button);
        });
    }

    function addUserMessage(message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'chat-message user';
        messageDiv.textContent = message;
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function addBotMessage(message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'chat-message bot';
        messageDiv.textContent = message;
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // --- Initial Load ---
    loadData();
});