/**
 * VRoid & VOICEVOX Integration System
 * VRoidStudioで作成したVRMファイルとVOICEVOXの音声を統合
 */

class VRoidVOICEVOXSystem {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.currentVRM = null;
        this.audioContext = null;
        this.audioAnalyser = null;
        this.voiceFiles = new Map(); // 音声ファイルを格納
        this.isInitialized = false;
        this.isSpeaking = false;
        
        this.init();
    }

    async init() {
        try {
            // Three.jsシーンの初期化
            await this.initializeThreeJS();
            
            // イベントリスナーの設定
            this.setupEventListeners();
            
            // オーディオコンテキストの初期化
            await this.initializeAudio();
            
            this.isInitialized = true;
            console.log('VRoid & VOICEVOX System initialized successfully');
        } catch (error) {
            console.error('Failed to initialize VRoid & VOICEVOX System:', error);
            this.fallbackTo2D();
        }
    }

    async initializeThreeJS() {
        const canvas = document.getElementById('vroid-canvas');
        const container = document.getElementById('vroid-container');
        
        if (!canvas || !container) {
            throw new Error('Canvas or container not found');
        }

        // シーンの作成
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x212121);

        // カメラの作成
        this.camera = new THREE.PerspectiveCamera(
            75,
            container.clientWidth / container.clientHeight,
            0.1,
            1000
        );
        this.camera.position.set(0, 1.4, 1);

        // レンダラーの作成
        this.renderer = new THREE.WebGLRenderer({
            canvas: canvas,
            alpha: true,
            antialias: true
        });
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.outputEncoding = THREE.sRGBEncoding;

        // ライティングの設定
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(1, 1, 1).normalize();
        this.scene.add(directionalLight);

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        this.scene.add(ambientLight);

        // リサイズ対応
        window.addEventListener('resize', () => this.onWindowResize());
        
        // レンダリングループの開始
        this.animate();
    }

    async initializeAudio() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.audioAnalyser = this.audioContext.createAnalyser();
            this.audioAnalyser.fftSize = 256;
        } catch (error) {
            console.warn('Audio context initialization failed:', error);
        }
    }

    setupEventListeners() {
        // VRoidファイルアップロード
        const vroidUploadBtn = document.getElementById('upload-vroid-btn');
        const vroidFileInput = document.getElementById('vroid-file-input');
        
        vroidUploadBtn?.addEventListener('click', () => {
            vroidFileInput?.click();
        });
        
        vroidFileInput?.addEventListener('change', (event) => {
            this.handleVRoidUpload(event);
        });

        // 音声ファイルアップロード
        const voiceUploadBtn = document.getElementById('upload-voice-btn');
        const voiceFileInput = document.getElementById('voice-file-input');
        
        voiceUploadBtn?.addEventListener('click', () => {
            voiceFileInput?.click();
        });
        
        voiceFileInput?.addEventListener('change', (event) => {
            this.handleVoiceUpload(event);
        });
    }

    async handleVRoidUpload(event) {
        const file = event.target.files[0];
        if (!file || !file.name.toLowerCase().endsWith('.vrm')) {
            alert('VRMファイルを選択してください');
            return;
        }

        try {
            const arrayBuffer = await file.arrayBuffer();
            await this.loadVRMModel(arrayBuffer);
            
            // 2Dキャラクターを非表示にして3Dを表示
            const character2D = document.getElementById('character-image');
            const vroidContainer = document.getElementById('vroid-container');
            
            if (character2D) character2D.style.display = 'none';
            if (vroidContainer) vroidContainer.style.display = 'flex';
            
            alert('VRoidキャラクターが正常に読み込まれました！');
        } catch (error) {
            console.error('VRM loading failed:', error);
            alert('VRMファイルの読み込みに失敗しました');
        }
    }

    async loadVRMModel(arrayBuffer) {
        if (!window.THREE || !window.VRM) {
            throw new Error('Three.js or VRM library not loaded');
        }

        const loader = new THREE.GLTFLoader();
        
        return new Promise((resolve, reject) => {
            loader.parse(arrayBuffer, '', async (gltf) => {
                try {
                    // 既存のVRMがある場合は削除
                    if (this.currentVRM) {
                        this.scene.remove(this.currentVRM.scene);
                        VRM.dispose(this.currentVRM);
                    }

                    // VRMを作成
                    const vrm = await VRM.from(gltf);
                    this.currentVRM = vrm;
                    
                    // シーンに追加
                    this.scene.add(vrm.scene);
                    
                    // 位置とサイズを調整
                    vrm.scene.position.set(0, 0, 0);
                    vrm.scene.scale.setScalar(1);
                    
                    // 初期ポーズの設定
                    this.setupInitialPose();
                    
                    resolve(vrm);
                } catch (error) {
                    reject(error);
                }
            }, reject);
        });
    }

    setupInitialPose() {
        if (!this.currentVRM) return;

        // 基本的な立ちポーズを設定
        const humanoid = this.currentVRM.humanoid;
        if (humanoid) {
            // 軽く微笑みの表情
            this.setBlendShape('happy', 0.3);
            this.setBlendShape('relaxed', 0.2);
        }
    }

    setBlendShape(expressionName, weight) {
        if (!this.currentVRM?.expressionManager) return;
        
        try {
            this.currentVRM.expressionManager.setValue(expressionName, weight);
        } catch (error) {
            // 表情が存在しない場合は無視
        }
    }

    async handleVoiceUpload(event) {
        const files = Array.from(event.target.files);
        
        for (const file of files) {
            if (!file.type.startsWith('audio/')) {
                continue;
            }
            
            try {
                const arrayBuffer = await file.arrayBuffer();
                const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
                
                // ファイル名から番号を抽出（例：voice_01.wav → 1）
                const match = file.name.match(/(\d+)/);
                const index = match ? parseInt(match[1]) : this.voiceFiles.size + 1;
                
                this.voiceFiles.set(index, {
                    name: file.name,
                    buffer: audioBuffer,
                    url: URL.createObjectURL(file)
                });
                
                console.log(`Voice file loaded: ${file.name} (index: ${index})`);
            } catch (error) {
                console.error(`Failed to load voice file ${file.name}:`, error);
            }
        }
        
        if (this.voiceFiles.size > 0) {
            alert(`${this.voiceFiles.size}個の音声ファイルが読み込まれました`);
        }
    }

    async playVoice(index) {
        const voiceData = this.voiceFiles.get(index);
        if (!voiceData || this.isSpeaking) return;

        try {
            this.isSpeaking = true;
            
            // 音声再生
            const audio = document.getElementById('voicevox-audio');
            audio.src = voiceData.url;
            
            // リップシンクアニメーション開始
            this.startLipSync();
            
            // 表情をしゃべり用に変更
            this.setBlendShape('a', 0.0);
            this.setBlendShape('i', 0.0);
            this.setBlendShape('u', 0.0);
            this.setBlendShape('e', 0.0);
            this.setBlendShape('o', 0.0);
            
            await audio.play();
            
            // 音声終了時の処理
            audio.addEventListener('ended', () => {
                this.stopLipSync();
                this.isSpeaking = false;
            }, { once: true });
            
        } catch (error) {
            console.error('Voice playback failed:', error);
            this.isSpeaking = false;
        }
    }

    startLipSync() {
        if (!this.currentVRM) return;
        
        // 簡単なリップシンクアニメーション
        this.lipSyncInterval = setInterval(() => {
            const time = Date.now() * 0.005;
            const intensity = (Math.sin(time) + 1) * 0.5;
            
            // 口の動きをランダムに変更
            const vowels = ['a', 'i', 'u', 'e', 'o'];
            const currentVowel = vowels[Math.floor(Math.random() * vowels.length)];
            
            // 全ての口形を一旦リセット
            vowels.forEach(vowel => this.setBlendShape(vowel, 0));
            
            // 現在の母音を適用
            this.setBlendShape(currentVowel, intensity * 0.8);
            
            // 表情も少し変化
            this.setBlendShape('happy', 0.3 + intensity * 0.2);
            
        }, 100);
    }

    stopLipSync() {
        if (this.lipSyncInterval) {
            clearInterval(this.lipSyncInterval);
            this.lipSyncInterval = null;
        }
        
        // 口の形をリセット
        ['a', 'i', 'u', 'e', 'o'].forEach(vowel => {
            this.setBlendShape(vowel, 0);
        });
        
        // 基本表情に戻す
        this.setBlendShape('happy', 0.3);
        this.setBlendShape('relaxed', 0.2);
    }

    // 外部から音声再生をトリガーするメソッド
    triggerVoice(index) {
        this.playVoice(index);
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        
        if (this.currentVRM) {
            // VRMのアップデート
            this.currentVRM.update(0.016); // 60fps想定
            
            // 軽い揺れアニメーション
            if (!this.isSpeaking) {
                const time = Date.now() * 0.001;
                this.currentVRM.scene.rotation.y = Math.sin(time) * 0.02;
                this.currentVRM.scene.position.y = Math.sin(time * 2) * 0.01;
            }
        }
        
        if (this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        }
    }

    onWindowResize() {
        const container = document.getElementById('vroid-container');
        if (!container || !this.camera || !this.renderer) return;
        
        const width = container.clientWidth;
        const height = container.clientHeight;
        
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    fallbackTo2D() {
        // 3D読み込みに失敗した場合は2Dキャラクターを表示
        const character2D = document.getElementById('character-image');
        const vroidContainer = document.getElementById('vroid-container');
        
        if (character2D) character2D.style.display = 'block';
        if (vroidContainer) vroidContainer.style.display = 'none';
        
        console.log('Fallback to 2D character display');
    }

    // 外部APIとの統合用メソッド
    getCurrentVoiceCount() {
        return this.voiceFiles.size;
    }

    getAvailableVoices() {
        return Array.from(this.voiceFiles.entries()).map(([index, data]) => ({
            index,
            name: data.name
        }));
    }
}

// グローバルインスタンス作成
window.vroidSystem = null;

// DOM読み込み完了後に初期化
document.addEventListener('DOMContentLoaded', () => {
    // Three.jsライブラリの読み込み確認
    if (typeof THREE !== 'undefined') {
        window.vroidSystem = new VRoidVOICEVOXSystem();
    } else {
        console.warn('Three.js not loaded, falling back to 2D character');
        // 2Dキャラクターのみ表示
        const character2D = document.getElementById('character-image');
        if (character2D) character2D.style.display = 'block';
    }
});