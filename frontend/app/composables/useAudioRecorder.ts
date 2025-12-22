import type { RecorderState } from '~/types/audio'

export function useAudioRecorder() {
  const state = reactive<RecorderState>({
    isRecording: false,
    isPaused: false,
    duration: 0,
    audioBlob: null,
    audioUrl: null,
    error: null,
  })

  // Audio Context & Processor refs
  let audioContext: AudioContext | null = null
  let mediaStreamSource: MediaStreamAudioSourceNode | null = null
  let scriptProcessor: ScriptProcessorNode | null = null
  let stream: MediaStream | null = null

  // Data buffers
  let leftChannel: Float32Array[] = []
  let recordingLength = 0
  let sampleRate = 44100

  let durationInterval: ReturnType<typeof setInterval> | null = null

  /**
   * Check if recording is supported
   */
  const isSupported = computed(() => {
    if (import.meta.server) return false
    return (
      typeof navigator !== 'undefined' &&
      'mediaDevices' in navigator &&
      'getUserMedia' in navigator.mediaDevices &&
      (typeof AudioContext !== 'undefined' || typeof (window as any).webkitAudioContext !== 'undefined')
    )
  })

  /**
   * Start recording
   */
  async function start(): Promise<boolean> {
    if (!isSupported.value) {
      state.error = 'Audio recording is not supported in this browser'
      return false
    }

    try {
      // 1. Get User Media
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })

      // 2. Init Audio Context
      const AudioCtor = (window.AudioContext || (window as any).webkitAudioContext)
      audioContext = new AudioCtor()
      sampleRate = audioContext.sampleRate

      // 3. Create Source & Processor
      // Buffer size 4096 = ~92ms latency at 44.1kHz
      mediaStreamSource = audioContext.createMediaStreamSource(stream)
      scriptProcessor = audioContext.createScriptProcessor(4096, 1, 1)

      // 4. Reset buffers
      leftChannel = []
      recordingLength = 0
      state.duration = 0
      state.error = null
      state.audioBlob = null
      state.audioUrl = null

      // 5. Processing logic
      scriptProcessor.onaudioprocess = (e) => {
        if (!state.isRecording || state.isPaused) return

        const left = e.inputBuffer.getChannelData(0)
        // Clone buffer to avoid reference issues
        leftChannel.push(new Float32Array(left))
        recordingLength += left.length
      }

      // 6. Connect graph
      mediaStreamSource.connect(scriptProcessor)
      scriptProcessor.connect(audioContext.destination)

      // Start state
      state.isRecording = true
      state.isPaused = false
      startDurationTimer()

      return true

    } catch (err: any) {
      console.error('Recording error:', err)
      if (err.name === 'NotAllowedError') {
        state.error = 'Microphone access denied. Please allow microphone access.'
      } else if (err.name === 'NotFoundError') {
        state.error = 'No microphone found. Please connect a microphone.'
      } else {
        state.error = err.message || 'Failed to start recording'
      }
      return false
    }
  }

  /**
   * Pause recording
   */
  function pause() {
    if (state.isRecording && !state.isPaused) {
      state.isPaused = true
      stopDurationTimer()
      if (audioContext && audioContext.state === 'running') {
        audioContext.suspend()
      }
    }
  }

  /**
   * Resume recording
   */
  function resume() {
    if (state.isRecording && state.isPaused) {
      state.isPaused = false
      startDurationTimer()
      if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume()
      }
    }
  }

  /**
   * Stop recording
   */
  function stop() {
    if (!state.isRecording) return

    stopDurationTimer()
    state.isRecording = false
    state.isPaused = false

    // Stop streams/processors
    if (stream) {
      stream.getTracks().forEach(track => track.stop())
      stream = null
    }

    if (scriptProcessor && mediaStreamSource) {
      scriptProcessor.disconnect()
      mediaStreamSource.disconnect()
    }

    if (audioContext) {
      // We don't necessarily need to close, but good practice if single use
      // audioContext.close(); 
    }

    // Encode WAV
    const blob = encodeWAV(leftChannel, recordingLength, sampleRate)
    state.audioBlob = blob
    state.audioUrl = URL.createObjectURL(blob)
  }

  /**
   * Manual WAV Encoding
   */
  function encodeWAV(samples: Float32Array[], totalLength: number, sampleRate: number) {
    const buffer = new ArrayBuffer(44 + totalLength * 2)
    const view = new DataView(buffer)

    // Flatten buffers
    const result = new Float32Array(totalLength)
    let offset = 0
    for (let i = 0; i < samples.length; i++) {
      result.set(samples[i], offset)
      offset += samples[i].length
    }

    // Write WAV Header
    // RIFF chunk descriptor
    writeString(view, 0, 'RIFF')
    view.setUint32(4, 36 + totalLength * 2, true)
    writeString(view, 8, 'WAVE')
    // fmt sub-chunk
    writeString(view, 12, 'fmt ')
    view.setUint32(16, 16, true)
    view.setUint16(20, 1, true) // PCM (linear quantization)
    view.setUint16(22, 1, true) // Mono
    view.setUint32(24, sampleRate, true)
    view.setUint32(28, sampleRate * 2, true)
    view.setUint16(32, 2, true)
    view.setUint16(34, 16, true)
    // data sub-chunk
    writeString(view, 36, 'data')
    view.setUint32(40, totalLength * 2, true)

    // Write PCM samples
    floatTo16BitPCM(view, 44, result)

    return new Blob([view], { type: 'audio/wav' })
  }

  function floatTo16BitPCM(output: DataView, offset: number, input: Float32Array) {
    for (let i = 0; i < input.length; i++, offset += 2) {
      let s = Math.max(-1, Math.min(1, input[i]))
      // Convert float to 16-bit PCM
      // s < 0 ? s * 0x8000 : s * 0x7FFF
      output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true)
    }
  }

  function writeString(view: DataView, offset: number, string: string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i))
    }
  }

  /**
   * Reset
   */
  function reset() {
    stop()
    if (state.audioUrl) {
      URL.revokeObjectURL(state.audioUrl)
    }
    state.audioBlob = null
    state.audioUrl = null
    state.duration = 0
    state.error = null
    leftChannel = []
    recordingLength = 0
  }

  function startDurationTimer() {
    stopDurationTimer()
    durationInterval = setInterval(() => {
      state.duration += 1
    }, 1000)
  }

  function stopDurationTimer() {
    if (durationInterval) {
      clearInterval(durationInterval)
      durationInterval = null
    }
  }

  /**
   * Get file
   */
  function getFile(): File | null {
    if (!state.audioBlob) return null
    return new File([state.audioBlob], `recording-${Date.now()}.wav`, {
      type: 'audio/wav'
    })
  }

  function formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  onUnmounted(() => {
    reset()
    if (audioContext) {
      audioContext.close()
    }
  })

  return {
    state: readonly(state),
    isSupported,
    start,
    pause,
    resume,
    stop,
    reset,
    getFile,
    formatDuration,
  }
}
