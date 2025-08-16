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
    const faqBtn = document.getElementById('faq-btn');
    const faqModal = document.getElementById('faq-modal');
    const closeFaqBtn = document.getElementById('close-faq-btn');
    const faqList = document.getElementById('faq-list');
    const speedRange = document.getElementById('speed-range');
    const speedLabel = document.getElementById('speed-label');
    const completeBtn = document.getElementById('complete-btn');
    const completionModal = document.getElementById('completion-modal');
    const closeCompletionBtn = document.getElementById('close-completion-btn');

    // State
    let contractData = [];
    let faqData = [];
    let currentSectionIndex = 0;
    let isSpeaking = false;
    let isPaused = false;
    let speechRate = 1.0;

    // Web Speech API
    const synth = window.speechSynthesis;
    let utterance = new SpeechSynthesisUtterance();

    // --- Data Loading ---
    async function loadData() {
        try {
            const [contractRes, faqRes] = await Promise.all([
                fetch('./src/data/contract.json'),
                fetch('./src/data/faq.json')
            ]);
            contractData = await contractRes.json();
            faqData = await faqRes.json();
            initialize();
        } catch (error) {
            console.error('データの読み込みに失敗しました:', error);
            contractText.textContent = '契約書の読み込みに失敗しました。';
        }
    }

    // --- Initialization ---
    function initialize() {
        updateContractContent();
        populateFaqList();
    }

    // --- UI Update ---
    function updateContractContent() {
        if (contractData.length === 0) return;

        const section = contractData[currentSectionIndex];
        contractTitle.textContent = section.title;
        contractText.textContent = section.content;

        // Update progress bar
        const progressPercent = ((currentSectionIndex + 1) / contractData.length) * 100;
        progressBar.style.setProperty('--progress-percent', `${progressPercent}%`);

        progressLabel.textContent = `${currentSectionIndex + 1} / ${contractData.length}`;

        // Update button states
        prevBtn.disabled = currentSectionIndex === 0;
        nextBtn.disabled = currentSectionIndex === contractData.length - 1;
        
        // Show completion button on last section
        if (currentSectionIndex === contractData.length - 1) {
            completeBtn.style.display = 'inline-block';
            nextBtn.style.display = 'none';
        } else {
            completeBtn.style.display = 'none';
            nextBtn.style.display = 'inline-block';
        }
        
        // Stop any ongoing speech
        stopSpeech();
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

    // --- Event Listeners ---
    nextBtn.addEventListener('click', () => {
        if (currentSectionIndex < contractData.length - 1) {
            currentSectionIndex++;
            updateContractContent();
        }
    });

    prevBtn.addEventListener('click', () => {
        if (currentSectionIndex > 0) {
            currentSectionIndex--;
            updateContractContent();
        }
    });

    playPauseBtn.addEventListener('click', handlePlayPause);

    // Speed control
    speedRange.addEventListener('input', (e) => {
        speechRate = parseFloat(e.target.value);
        speedLabel.textContent = `${speechRate.toFixed(1)}倍`;
        
        // If currently speaking, restart with new speed
        if (isSpeaking && !isPaused) {
            stopSpeech();
            startSpeech();
        }
    });

    // --- FAQ Modal ---
    faqBtn.addEventListener('click', () => {
        faqModal.classList.remove('hidden');
    });

    closeFaqBtn.addEventListener('click', () => {
        faqModal.classList.add('hidden');
    });

    // --- Completion Modal ---
    completeBtn.addEventListener('click', () => {
        completionModal.classList.remove('hidden');
        // Record completion time
        const completionTime = new Date().toLocaleString('ja-JP');
        localStorage.setItem('contractCompletionTime', completionTime);
    });

    closeCompletionBtn.addEventListener('click', () => {
        completionModal.classList.add('hidden');
    });

    function populateFaqList() {
        faqList.innerHTML = '';
        faqData.forEach(item => {
            const faqItem = document.createElement('div');
            faqItem.className = 'faq-item';

            const question = document.createElement('div');
            question.className = 'question';
            question.textContent = `Q: ${item.question}`;

            const answer = document.createElement('div');
            answer.className = 'answer';
            answer.textContent = `A: ${item.answer}`;

            faqItem.appendChild(question);
            faqItem.appendChild(answer);
            faqList.appendChild(faqItem);

            question.addEventListener('click', () => {
                answer.style.display = answer.style.display === 'block' ? 'none' : 'block';
                
                // Speak the answer when FAQ is opened
                if (answer.style.display === 'block') {
                    speakFaqAnswer(item.answer);
                }
            });
        });
    }

    // --- FAQ Speech ---
    function speakFaqAnswer(answerText) {
        // Stop any ongoing speech first
        if (synth.speaking) {
            synth.cancel();
        }
        
        const faqUtterance = new SpeechSynthesisUtterance(answerText);
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

    // --- Initial Load ---
    loadData();
});
