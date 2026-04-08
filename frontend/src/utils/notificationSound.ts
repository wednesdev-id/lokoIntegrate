// Notification sound utility for WhatsApp messages

let audioContext: AudioContext | null = null;
let notificationBuffer: AudioBuffer | null = null;

/**
 * Initialize audio context and preload notification sound
 */
export const initializeNotificationSound = async () => {
    try {
        // Create audio context (use webkitAudioContext for Safari)
        audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

        // Preload notification sound
        const response = await fetch('/notification.mp3');
        const arrayBuffer = await response.arrayBuffer();
        notificationBuffer = await audioContext.decodeAudioData(arrayBuffer);

        console.log('✅ Notification sound initialized');
    } catch (error) {
        console.warn('Failed to initialize notification sound:', error);
    }
};

/**
 * Play notification sound for new messages
 * @param volume - Volume level (0-1), default 0.5
 */
export const playNotificationSound = (volume: number = 0.5) => {
    try {
        if (!audioContext || !notificationBuffer) {
            console.warn('Notification sound not initialized');
            return;
        }

        // Resume audio context if suspended (browser autoplay policy)
        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }

        // Create buffer source
        const source = audioContext.createBufferSource();
        source.buffer = notificationBuffer;

        // Create gain node for volume control
        const gainNode = audioContext.createGain();
        gainNode.gain.value = Math.max(0, Math.min(1, volume)); // Clamp 0-1

        // Connect nodes
        source.connect(gainNode);
        gainNode.connect(audioContext.destination);

        // Play sound
        source.start(0);
    } catch (error) {
        console.error('Failed to play notification sound:', error);
    }
};

/**
 * Simple HTML5 Audio fallback (for older browsers or initialization issues)
 */
export const playNotificationSoundFallback = (volume: number = 0.5) => {
    try {
        const audio = new Audio('/notification.mp3');
        audio.volume = Math.max(0, Math.min(1, volume));
        audio.play().catch(err => console.warn('Audio play failed:', err));
    } catch (error) {
        console.error('Failed to play notification sound (fallback):', error);
    }
};

/**
 * Check if notifications are supported and enabled
 */
export const canPlayNotifications = (): boolean => {
    return 'Audio' in window || 'AudioContext' in window || 'webkitAudioContext' in window;
};
