/**
 * Get the duration of an audio file in seconds
 */
export async function getAudioDuration(file: File): Promise<number> {
    return new Promise((resolve, reject) => {
        const audio = new Audio()
        const objectUrl = URL.createObjectURL(file)

        audio.onloadedmetadata = () => {
            URL.revokeObjectURL(objectUrl)
            resolve(audio.duration)
        }

        audio.onerror = () => {
            URL.revokeObjectURL(objectUrl)
            reject(new Error('Failed to load audio file'))
        }

        audio.src = objectUrl
    })
}
