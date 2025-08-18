document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const characterImage = document.getElementById('character-image');
    const characterName = document.getElementById('character-name');
    const contractTitle = document.getElementById('subtitle-title');
    const contractText = document.getElementById('subtitle-text');
    const progressBar = document.getElementById('progress-bar');
    const progressBarVideo = document.getElementById('progress-bar-video');
    const progressLabel = document.getElementById('progress-label');
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const playPauseBtn = document.getElementById('play-pause-btn');
    const speedRange = document.getElementById('speed-range');
    const speedLabel = document.getElementById('speed-label');
    const completeBtn = document.getElementById('complete-btn');
    const completionModal = document.getElementById('completion-modal');
    const closeCompletionBtn = document.getElementById('close-completion-btn');
    const fullscreenBtn = document.getElementById('fullscreen-btn');
    
    
    // Sidebar Elements
    const sidebar = document.getElementById('sidebar');
    
    // FAQ Elements
    const faqBtn = document.getElementById('faq-btn');
    const faqModal = document.getElementById('faq-modal');
    const closeFaqBtn = document.getElementById('close-faq-btn');
    const faqMessages = document.getElementById('faq-messages');
    const faqButtons = document.getElementById('faq-buttons');
    const faqChatContainer = document.getElementById('faq-chat-container');
    const faqMessagesSidebar = document.getElementById('faq-messages-sidebar');
    const faqButtonsSidebar = document.getElementById('faq-buttons-sidebar');

    // State
    let contractStructure = {};
    let faqData = [];
    let currentDocument = 'important';
    let currentSectionId = 'i1';
    let isSpeaking = false;
    let isPaused = false;
    let speechRate = 1.0;
    let continuousPlay = false;

    // Web Speech API
    const synth = window.speechSynthesis;
    let utterance = new SpeechSynthesisUtterance();
    
    // VRoid & VOICEVOX Integration
    let currentVoiceIndex = 1; // 現在の音声インデックス
    
    // Fullscreen State
    let isFullscreen = false;
    
    // Progress Management
    let sessionStarted = false;
    let progressSaved = false;

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
        updateProgress();
        setupFAQButtons();
        setupSidebarFAQ();
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
        
        // 現在のセクションが既に開いているかチェック
        const isCurrentlyActive = header.classList.contains('active');
        
        // すべてのセクションを閉じる
        document.querySelectorAll('.sidebar-header').forEach(h => h.classList.remove('active'));
        document.querySelectorAll('.sidebar-content').forEach(c => c.classList.remove('active'));
        
        // 既に開いていなかった場合のみ開く（クリックで開閉トグル）
        if (!isCurrentlyActive) {
            header.classList.add('active');
            content.classList.add('active');
        }
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

    // --- Progress Management ---
    function saveProgress() {
        const progressData = {
            currentDocument,
            currentSectionId,
            currentVoiceIndex,
            sessionStarted,
            timestamp: new Date().getTime()
        };
        localStorage.setItem('contractvt_progress', JSON.stringify(progressData));
        progressSaved = true;
        console.log('Progress saved:', progressData);
    }
    
    function loadProgress() {
        try {
            const savedData = localStorage.getItem('contractvt_progress');
            if (savedData) {
                return JSON.parse(savedData);
            }
        } catch (error) {
            console.error('Error loading progress:', error);
        }
        return null;
    }
    
    function clearProgress() {
        localStorage.removeItem('contractvt_progress');
        resetToInitialState();
        console.log('Progress cleared - reset to beginning');
    }
    
    function resetToInitialState() {
        currentDocument = 'important';
        currentSectionId = 'i1';
        currentVoiceIndex = 1;
        sessionStarted = false;
        progressSaved = false;
        
        updateContent();
        updateProgress();
        stopSpeech();
    }
    
    function markSessionStarted() {
        if (!sessionStarted) {
            sessionStarted = true;
            saveProgress();
            console.log('Session started - progress tracking enabled');
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
        progressBarVideo.style.setProperty('--progress-percent', `${progressPercent}%`);
        progressLabel.textContent = `${currentIndex + 1} / ${totalSections}`;
    }

    // --- Speech Synthesis ---
    function handlePlayPause() {
        markSessionStarted();
        
        if (isSpeaking) {
            if (isPaused) {
                synth.resume();
                isPaused = false;
                playPauseBtn.textContent = '⏸';
            } else {
                synth.pause();
                isPaused = true;
                continuousPlay = false;
                playPauseBtn.textContent = '▶';
            }
        } else {
            continuousPlay = true; // 連続再生モードを有効化
            
            // VRoid音声が利用可能な場合はそちらを優先
            if (window.vroidSystem && window.vroidSystem.getCurrentVoiceCount() > 0) {
                startVRoidSpeech();
            } else {
                startSpeech(); // フォールバック：Web Speech API
            }
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
            playPauseBtn.textContent = '⏸';
            characterImage.classList.add('speaking');
        };

        utterance.onend = () => {
            if (continuousPlay) {
                // 連続再生モード: 次のセクションに自動進行
                const currentIndex = getCurrentSectionIndex();
                const totalSections = getTotalSections();
                if (currentIndex < totalSections - 1) {
                    navigateToSectionByIndex(currentIndex + 1);
                    setTimeout(() => startSpeech(), 500); // 少し待ってから次を再生
                } else {
                    stopSpeech();
                    continuousPlay = false;
                }
            } else {
                stopSpeech();
            }
        };

        synth.speak(utterance);
    }

    // VRoid & VOICEVOX音声再生
    function startVRoidSpeech() {
        if (!window.vroidSystem) {
            startSpeech(); // フォールバック
            return;
        }
        
        try {
            // 現在のセクションに対応する音声インデックスを使用
            window.vroidSystem.triggerVoice(currentVoiceIndex);
            
            isSpeaking = true;
            playPauseBtn.textContent = '⏸';
            characterImage?.classList.add('speaking');
            
            // 次の音声インデックスを更新
            currentVoiceIndex++;
            
            // 音声再生終了を監視
            const audio = document.getElementById('voicevox-audio');
            if (audio) {
                const handleVRoidEnd = () => {
                    audio.removeEventListener('ended', handleVRoidEnd);
                    
                    if (continuousPlay) {
                        const currentIndex = getCurrentSectionIndex();
                        const totalSections = getTotalSections();
                        if (currentIndex < totalSections - 1) {
                            navigateToSectionByIndex(currentIndex + 1);
                            setTimeout(() => startVRoidSpeech(), 500);
                        } else {
                            stopSpeech();
                            continuousPlay = false;
                        }
                    } else {
                        stopSpeech();
                    }
                };
                
                audio.addEventListener('ended', handleVRoidEnd);
            }
            
        } catch (error) {
            console.error('VRoid voice playback failed:', error);
            // フォールバック：Web Speech API
            startSpeech();
        }
    }

    function stopSpeech() {
        // Web Speech API停止
        if (synth.speaking) {
            synth.cancel();
        }
        
        // VRoid音声停止
        const audio = document.getElementById('voicevox-audio');
        if (audio && !audio.paused) {
            audio.pause();
            audio.currentTime = 0;
        }
        
        // VRoidリップシンク停止
        if (window.vroidSystem) {
            window.vroidSystem.stopLipSync();
        }
        
        isSpeaking = false;
        isPaused = false;
        continuousPlay = false;
        playPauseBtn.textContent = '▶';
        characterImage?.classList.remove('speaking');
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
        markSessionStarted();
        const currentIndex = getCurrentSectionIndex();
        const totalSections = getTotalSections();
        if (currentIndex < totalSections - 1) {
            navigateToSectionByIndex(currentIndex + 1);
            saveProgress();
        }
    });

    prevBtn.addEventListener('click', () => {
        markSessionStarted();
        const currentIndex = getCurrentSectionIndex();
        if (currentIndex > 0) {
            navigateToSectionByIndex(currentIndex - 1);
            saveProgress();
        }
    });

    playPauseBtn.addEventListener('click', handlePlayPause);
    
    // Fullscreen button event listener
    fullscreenBtn?.addEventListener('click', toggleFullscreen);

    speedRange.addEventListener('input', (e) => {
        speechRate = parseFloat(e.target.value);
        speedLabel.textContent = `${speechRate.toFixed(1)}x`;
        
        // 読み上げ中の場合は即時反映
        if (isSpeaking && !isPaused) {
            const wasContinuous = continuousPlay;
            synth.cancel(); // 現在の読み上げを停止
            continuousPlay = wasContinuous; // 連続再生状態を復元
            setTimeout(() => startSpeech(), 100); // 新しい速度で再開
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

    // --- FAQ Sidebar ---
    faqBtn.addEventListener('click', () => {
        faqChatContainer.classList.toggle('hidden');
    });

    function setupFAQButtons() {
        if (faqButtons) {
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
    }

    function setupSidebarFAQ() {
        faqButtonsSidebar.innerHTML = '';
        faqData.forEach(faq => {
            const button = document.createElement('button');
            button.className = 'faq-button-sidebar';
            button.textContent = faq.question;
            button.addEventListener('click', () => {
                addUserMessageSidebar(faq.question);
                setTimeout(() => {
                    addBotMessageSidebar(faq.answer);
                    speakText(faq.answer);
                }, 500);
            });
            faqButtonsSidebar.appendChild(button);
        });
    }

    function addUserMessage(message) {
        if (faqMessages) {
            const messageDiv = document.createElement('div');
            messageDiv.className = 'faq-message user';
            messageDiv.textContent = message;
            faqMessages.appendChild(messageDiv);
            faqMessages.scrollTop = faqMessages.scrollHeight;
        }
    }

    function addBotMessage(message) {
        if (faqMessages) {
            const messageDiv = document.createElement('div');
            messageDiv.className = 'faq-message bot';
            messageDiv.textContent = message;
            faqMessages.appendChild(messageDiv);
            faqMessages.scrollTop = faqMessages.scrollHeight;
        }
    }

    function addUserMessageSidebar(message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'faq-message-sidebar user';
        messageDiv.textContent = message;
        faqMessagesSidebar.appendChild(messageDiv);
        faqMessagesSidebar.scrollTop = faqMessagesSidebar.scrollHeight;
    }

    function addBotMessageSidebar(message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'faq-message-sidebar bot';
        messageDiv.textContent = message;
        faqMessagesSidebar.appendChild(messageDiv);
        faqMessagesSidebar.scrollTop = faqMessagesSidebar.scrollHeight;
    }

    // --- Fullscreen Functionality ---
    function toggleFullscreen() {
        if (!isFullscreen) {
            enterFullscreen();
        } else {
            exitFullscreen();
        }
    }
    
    function enterFullscreen() {
        const appContainer = document.getElementById('app-container');
        
        // Add fullscreen class
        document.body.classList.add('fullscreen-mode');
        
        // Request fullscreen API
        if (appContainer.requestFullscreen) {
            appContainer.requestFullscreen();
        } else if (appContainer.webkitRequestFullscreen) {
            appContainer.webkitRequestFullscreen();
        } else if (appContainer.msRequestFullscreen) {
            appContainer.msRequestFullscreen();
        }
        
        isFullscreen = true;
        fullscreenBtn.innerHTML = '⛶'; // Change icon for exit
        
        console.log('Entered fullscreen mode');
    }
    
    function exitFullscreen() {
        // Remove fullscreen class
        document.body.classList.remove('fullscreen-mode');
        
        // Exit fullscreen API
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
        }
        
        isFullscreen = false;
        fullscreenBtn.innerHTML = '⛶'; // Reset icon
        
        console.log('Exited fullscreen mode');
    }
    
    // Listen for fullscreen changes
    document.addEventListener('fullscreenchange', () => {
        if (!document.fullscreenElement) {
            exitFullscreen();
        }
    });
    
    document.addEventListener('webkitfullscreenchange', () => {
        if (!document.webkitFullscreenElement) {
            exitFullscreen();
        }
    });
    
    document.addEventListener('msfullscreenchange', () => {
        if (!document.msFullscreenElement) {
            exitFullscreen();
        }
    });
    
    // ESC key handling
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && isFullscreen) {
            exitFullscreen();
        }
    });
    
    // --- Page Reload/Leave Warning ---
    window.addEventListener('beforeunload', (e) => {
        if (sessionStarted && progressSaved) {
            const message = '説明途中でページを離れると、進捗がリセットされ最初からやり直しになります。本当に続行しますか？';
            e.preventDefault();
            e.returnValue = message;
            return message;
        }
    });
    
    // Page visibility change handling
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden' && sessionStarted) {
            saveProgress();
        }
    });
    
    // Page load handling - clear progress on every page load
    window.addEventListener('load', () => {
        clearProgress();
        console.log('Page loaded - progress reset to beginning');
    });

    // --- Initial Load ---
    loadData();
});