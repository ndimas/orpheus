class DrumMachine {
    constructor() {
        this.config = {
            desktop: {
                steps: 16,
                tempo: 120
            },
            mobile: {
                steps: 8,
                tempo: 120,
                breakpoint: 768 // match with CSS media query
            }
        };

        this.isMobile = window.innerWidth <= this.config.mobile.breakpoint;
        this.steps = this.isMobile ? this.config.mobile.steps : this.config.desktop.steps;
        
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.tracks = 9;
        this.currentStep = 0;
        this.isPlaying = false;
        this.tempo = this.isMobile ? this.config.mobile.tempo : this.config.desktop.tempo;
        this.grid = [];
        this.sounds = {};
        this.nextNoteTime = 0;
        this.scheduleAheadTime = 0.2;
        this.lookahead = 25.0;
        this.timerID = null;
        
        this.drumTypes = [
            'kick',
            'snare',
            'clap',
            'hihatClosed',
            'hihatOpen',
            'tomHigh',
            'tomLow',
            'crash',
            'ride'
        ];

        this.initializeGrid();
        this.createStepIndicators();
        this.setupEventListeners();

        // Initialize audio context on user interaction
        document.addEventListener('click', () => {
            if (!this.audioContext || this.audioContext.state === 'suspended') {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                this.audioContext.resume();
            }
        });

        // Pre-compile noise buffer
        this.noiseBuffer = this.createNoiseBuffer();

        // Add page visibility handling
        this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
        document.addEventListener('visibilitychange', this.handleVisibilityChange);

        // Add drum definitions
        this.drumDefinitions = {
            'kick': {
                setup: (context) => {
                    const osc = context.createOscillator();
                    const gain = context.createGain();
                    
                    const oscClick = context.createOscillator();
                    const gainClick = context.createGain();
                    
                    const oscBody = context.createOscillator();
                    const gainBody = context.createGain();
                    
                    const compressor = context.createDynamicsCompressor();
                    compressor.threshold.setValueAtTime(-12, context.currentTime);
                    compressor.knee.setValueAtTime(6, context.currentTime);
                    compressor.ratio.setValueAtTime(4, context.currentTime);
                    compressor.attack.setValueAtTime(0.001, context.currentTime);
                    compressor.release.setValueAtTime(0.1, context.currentTime);
                    
                    // Main sub frequencies
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(60, context.currentTime);
                    osc.frequency.exponentialRampToValueAtTime(30, context.currentTime + 0.2);
                    
                    // Click for attack
                    oscClick.type = 'triangle';
                    oscClick.frequency.setValueAtTime(200, context.currentTime);
                    oscClick.frequency.exponentialRampToValueAtTime(40, context.currentTime + 0.02);
                    
                    // Body tone
                    oscBody.type = 'sine';
                    oscBody.frequency.setValueAtTime(120, context.currentTime);
                    oscBody.frequency.exponentialRampToValueAtTime(50, context.currentTime + 0.1);
                    
                    // Increased gain values for more consistent volume
                    gain.gain.setValueAtTime(3.0, context.currentTime);          // Increased from 2.0
                    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.4);
                    
                    gainClick.gain.setValueAtTime(1.5, context.currentTime);     // Increased from 1.0
                    gainClick.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.05);
                    
                    gainBody.gain.setValueAtTime(1.5, context.currentTime);      // Increased from 1.0
                    gainBody.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.2);
                    
                    osc.connect(gain);
                    oscClick.connect(gainClick);
                    oscBody.connect(gainBody);
                    
                    gain.connect(compressor);
                    gainClick.connect(compressor);
                    gainBody.connect(compressor);
                    
                    return { 
                        osc: osc, 
                        gain: compressor,
                        extraNodes: [
                            { osc: oscClick, gain: gainClick },
                            { osc: oscBody, gain: gainBody }
                        ]
                    };
                }
            },
            'snare': {
                setup: (context) => {
                    const noise = context.createBufferSource();
                    const noiseGain = context.createGain();
                    const filter = context.createBiquadFilter();
                    
                    noise.buffer = this.noiseBuffer;
                    noiseGain.gain.setValueAtTime(0.7, context.currentTime);
                    noiseGain.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.2);
                    
                    filter.type = 'bandpass';
                    filter.frequency.value = 3000;
                    
                    noise.connect(filter);
                    filter.connect(noiseGain);
                    return { noise, gain: noiseGain };
                }
            },
            'clap': {
                setup: (context) => {
                    const noise = context.createBufferSource();
                    const noiseGain = context.createGain();
                    
                    noise.buffer = this.noiseBuffer;
                    noiseGain.gain.setValueAtTime(0.8, context.currentTime);
                    noiseGain.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.1);
                    
                    noise.connect(noiseGain);
                    return { noise, gain: noiseGain };
                }
            },
            'hihatClosed': {
                setup: (context) => {
                    const noise = context.createBufferSource();
                    const gain = context.createGain();
                    const filter = context.createBiquadFilter();
                    
                    noise.buffer = this.noiseBuffer;
                    filter.type = 'highpass';
                    filter.frequency.value = 7000;
                    
                    gain.gain.setValueAtTime(0.3, context.currentTime);
                    gain.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.1);
                    
                    noise.connect(filter);
                    filter.connect(gain);
                    return { noise, gain };
                }
            },
            'hihatOpen': {
                setup: (context) => {
                    const noise = context.createBufferSource();
                    const gain = context.createGain();
                    const filter = context.createBiquadFilter();
                    
                    noise.buffer = this.noiseBuffer;
                    filter.type = 'highpass';
                    filter.frequency.value = 7000;
                    
                    gain.gain.setValueAtTime(0.3, context.currentTime);
                    gain.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.3);
                    
                    noise.connect(filter);
                    filter.connect(gain);
                    return { noise, gain };
                }
            },
            'tomHigh': {
                setup: (context) => {
                    const osc = context.createOscillator();
                    const gain = context.createGain();
                    
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(200, context.currentTime);
                    osc.frequency.exponentialRampToValueAtTime(100, context.currentTime + 0.1);
                    
                    gain.gain.setValueAtTime(0.8, context.currentTime);
                    gain.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.1);
                    
                    osc.connect(gain);
                    return { osc, gain };
                }
            },
            'tomLow': {
                setup: (context) => {
                    const osc = context.createOscillator();
                    const gain = context.createGain();
                    
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(100, context.currentTime);
                    osc.frequency.exponentialRampToValueAtTime(50, context.currentTime + 0.15);
                    
                    gain.gain.setValueAtTime(0.8, context.currentTime);
                    gain.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.15);
                    
                    osc.connect(gain);
                    return { osc, gain };
                }
            },
            'crash': {
                setup: (context) => {
                    const noise = context.createBufferSource();
                    const gain = context.createGain();
                    const filter = context.createBiquadFilter();
                    
                    noise.buffer = this.noiseBuffer;
                    filter.type = 'highpass';
                    filter.frequency.value = 5000;
                    
                    gain.gain.setValueAtTime(0.5, context.currentTime);
                    gain.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 1.0);
                    
                    noise.connect(filter);
                    filter.connect(gain);
                    return { noise, gain };
                }
            },
            'ride': {
                setup: (context) => {
                    const noise = context.createBufferSource();
                    const gain = context.createGain();
                    const filter = context.createBiquadFilter();
                    const highpass = context.createBiquadFilter();
                    
                    noise.buffer = this.noiseBuffer;
                    filter.type = 'bandpass';
                    filter.frequency.value = 8000;
                    filter.Q.value = 1.0;
                    
                    highpass.type = 'highpass';
                    highpass.frequency.value = 6000;
                    
                    gain.gain.setValueAtTime(0.3, context.currentTime);
                    gain.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.8);
                    
                    noise.connect(filter);
                    filter.connect(highpass);
                    highpass.connect(gain);
                    return { noise, gain };
                }
            }
        };

        this.handleResize = this.handleResize.bind(this);
        window.addEventListener('resize', this.handleResize);

        // Add Safari-specific setup
        this.setupSafariAudioContext();

        // Add tempo control setup
        this.setupTempoControl();
    }

    setupSafariAudioContext() {
        const resumeAudioContext = () => {
            if (this.audioContext.state === 'suspended') {
                this.audioContext.resume();
            }
            // Create and play a silent buffer to unlock audio on iOS/Safari
            const buffer = this.audioContext.createBuffer(1, 1, 22050);
            const source = this.audioContext.createBufferSource();
            source.buffer = buffer;
            source.connect(this.audioContext.destination);
            source.start(0);
            
            document.removeEventListener('touchstart', resumeAudioContext);
            document.removeEventListener('click', resumeAudioContext);
        };
        
        document.addEventListener('touchstart', resumeAudioContext);
        document.addEventListener('click', resumeAudioContext);
    }

    handleResize() {
        const wasMobile = this.isMobile;
        this.isMobile = window.innerWidth <= this.config.mobile.breakpoint;

        if (wasMobile !== this.isMobile) {
            this.steps = this.isMobile ? this.config.mobile.steps : this.config.desktop.steps;
            this.rebuildGrid();
        }
    }

    rebuildGrid() {
        if (this.isPlaying) {
            this.togglePlay();
        }

        const currentPattern = this.grid.map(row => 
            row.map(pad => Array.from(pad.classList))
        );

        const gridContainer = document.querySelector('.grid-container');
        gridContainer.innerHTML = '';
        this.grid = [];

        this.initializeGrid();

        for (let row = 0; row < this.tracks; row++) {
            for (let col = 0; col < this.steps; col++) {
                const oldCol = Math.floor(col * (currentPattern[0].length / this.steps));
                if (currentPattern[row] && currentPattern[row][oldCol]) {
                    const classes = currentPattern[row][oldCol];
                    classes.forEach(cls => {
                        if (cls !== 'pad') {
                            this.grid[row][col].classList.add(cls);
                        }
                    });
                }
            }
        }

        const indicatorContainer = document.querySelector('.step-indicators');
        indicatorContainer.innerHTML = '';
        this.createStepIndicators();
    }

    handleVisibilityChange() {
        if (document.hidden && this.isPlaying) {
            try {
                const stepsToSchedule = 32;
                const secondsPerBeat = 60.0 / this.tempo;
                const secondsPerStep = secondsPerBeat / 4;
                const currentTime = this.audioContext.currentTime;

                for (let i = 0; i < stepsToSchedule; i++) {
                    const stepTime = this.nextNoteTime + (i * secondsPerStep);
                    const step = (this.currentStep + i) % this.steps;
                    
                    for (let row = 0; row < this.tracks; row++) {
                        const activeClass = `active-${this.drumTypes[row].replace(/([A-Z])/g, '-$1').toLowerCase()}`;
                        if (this.grid[row][step].classList.contains(activeClass)) {
                            this.playDrumSound(row, stepTime);
                        }
                    }
                }
            } catch (error) {
                console.error('Error in visibility change handler:', error);
            }
        }
    }

    playDrumSound(row, time = null) {
        try {
            const drumType = this.drumTypes[row];
            if (!drumType || !this.drumDefinitions[drumType]) return;

            const setup = this.drumDefinitions[drumType].setup(this.audioContext);
            const startTime = time || this.audioContext.currentTime;

            // Connect to destination
            setup.gain.connect(this.audioContext.destination);

            // Start oscillators and noise sources
            if (setup.osc) {
                setup.osc.start(startTime);
                setup.osc.stop(startTime + 0.2);
            }
            if (setup.noise) {
                setup.noise.start(startTime);
                setup.noise.stop(startTime + 0.2);
            }
            if (setup.extraNodes) {
                setup.extraNodes.forEach(node => {
                    if (node.osc) {
                        node.osc.start(startTime);
                        node.osc.stop(startTime + 0.2);
                    }
                });
            }

            // Cleanup
            const cleanupTime = (startTime - this.audioContext.currentTime + 0.3) * 1000;
            setTimeout(() => {
                setup.gain.disconnect();
                if (setup.extraNodes) {
                    setup.extraNodes.forEach(node => node.gain?.disconnect());
                }
            }, Math.max(0, cleanupTime));

        } catch (error) {
            console.error('Error playing drum sound:', error);
        }
    }

    initializeGrid() {
        const gridContainer = document.querySelector('.grid-container');
        gridContainer.style.gridTemplateColumns = `repeat(${this.steps}, 40px)`;
        
        for (let row = 0; row < this.tracks; row++) {
            this.grid[row] = [];
            for (let col = 0; col < this.steps; col++) {
                const pad = document.createElement('div');
                pad.className = 'pad';
                pad.dataset.row = row;
                pad.dataset.col = col;
                
                pad.addEventListener('click', () => this.togglePad(pad));
                gridContainer.appendChild(pad);
                this.grid[row][col] = pad;
            }
        }
    }

    createStepIndicators() {
        const indicatorContainer = document.querySelector('.step-indicators');
        for (let i = 0; i < this.steps; i++) {
            const indicator = document.createElement('div');
            indicator.className = 'step-indicator';
            indicatorContainer.appendChild(indicator);
        }
    }

    togglePad(pad) {
        const row = parseInt(pad.dataset.row);
        const activeClass = `active-${this.drumTypes[row].replace(/([A-Z])/g, '-$1').toLowerCase()}`;
        
        if (pad.classList.contains(activeClass)) {
            pad.classList.remove(activeClass);
        } else {
            pad.classList.add(activeClass);
            // Add playing animation when clicking
            pad.classList.add('playing');
            setTimeout(() => {
                pad.classList.remove('playing');
            }, 100);
            this.playDrumSound(row);
        }
    }

    setupEventListeners() {
        document.querySelector('.play').addEventListener('click', () => this.togglePlay());
    }

    togglePlay() {
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
        
        this.isPlaying = !this.isPlaying;
        if (this.isPlaying) {
            document.querySelector('.play').textContent = 'Stop';
            this.currentStep = 0;
            this.play(); // Start playing immediately
        } else {
            document.querySelector('.play').textContent = 'Play';
            if (this.timerID) {
                clearTimeout(this.timerID);
                this.timerID = null;
            }
        }
    }

    play() {
        if (!this.isPlaying) return;

        const secondsPerBeat = 60.0 / this.tempo;
        const secondsPerStep = secondsPerBeat / 4;

        // Update step indicators
        document.querySelectorAll('.step-indicator').forEach((indicator, index) => {
            indicator.classList.toggle('active', index === this.currentStep);
        });

        // Play active pads in current step
        for (let row = 0; row < this.tracks; row++) {
            const drumType = this.drumTypes[row];
            const activeClass = `active-${drumType.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
            const currentPad = this.grid[row][this.currentStep];
            
            if (currentPad.classList.contains(activeClass)) {
                this.playDrumSound(row);
                currentPad.classList.add('playing');
                setTimeout(() => {
                    currentPad.classList.remove('playing');
                }, 100);
            }
        }

        // Move to next step
        this.currentStep = (this.currentStep + 1) % this.steps;

        // Schedule next step
        this.timerID = setTimeout(() => {
            requestAnimationFrame(() => this.play());
        }, secondsPerStep * 1000); // Convert to milliseconds
    }

    createNoiseBuffer() {
        const bufferSize = this.audioContext.sampleRate * 0.5;
        const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        return buffer;
    }

    // Clean up when the drum machine is destroyed
    destroy() {
        document.removeEventListener('visibilitychange', this.handleVisibilityChange);
        window.removeEventListener('resize', this.handleResize);
        if (this.timerID) {
            clearTimeout(this.timerID);
        }
    }

    setupTempoControl() {
        const slider = document.querySelector('.tempo-slider');
        const display = document.querySelector('.tempo-display');

        slider.addEventListener('input', (e) => {
            this.tempo = parseInt(e.target.value);
            display.textContent = `${this.tempo} BPM`;
        });

        // Initialize display
        display.textContent = `${this.tempo} BPM`;
        slider.value = this.tempo;
    }
}

// Initialize the drum machine when the page loads
document.addEventListener('DOMContentLoaded', () => {
    const drumMachine = new DrumMachine();
}); 