<template>
  <section class="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden bg-slate-50">
    <!-- Background blobs -->
    <div class="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-7xl overflow-hidden pointer-events-none">
      <div class="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full bg-purple-200/50 blur-3xl mix-blend-multiply animate-blob"></div>
      <div class="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] rounded-full bg-cyan-200/50 blur-3xl mix-blend-multiply animate-blob animation-delay-2000"></div>
    </div>

    <div class="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="lg:grid lg:grid-cols-12 lg:gap-16 items-center">
        <!-- Left content -->
        <div class="lg:col-span-6 text-center lg:text-left">
          <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-100 text-purple-700 text-sm font-semibold mb-6 animate-fade-in">
            <span class="relative flex h-2 w-2">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
              <span class="relative inline-flex rounded-full h-2 w-2 bg-purple-500"></span>
            </span>
            Identification automatique des interlocuteurs
          </div>

          <h1 class="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 tracking-tight mb-8 animate-fade-in-up">
            Dictez.
            <span class="text-transparent bg-clip-text bg-linear-to-r from-purple-600 to-cyan-500">Votre document est prêt.</span>
          </h1>

          <p class="text-lg sm:text-xl text-slate-600 mb-10 max-w-2xl mx-auto lg:mx-0 animate-fade-in-up animation-delay-200">
            Déposez votre enregistrement, récupérez un document structuré en 2 minutes. Conçu pour les avocats, médecins et consultants qui n'ont plus le temps de rédiger.
          </p>

          <div class="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start animate-fade-in-up animation-delay-400">
            <a
              href="#contact"
              class="inline-flex items-center justify-center gap-2 bg-slate-900 text-white px-8 py-4 rounded-full text-base font-semibold hover:bg-slate-800 transition-all hover:shadow-xl hover:-translate-y-1"
            >
              <UIcon name="i-lucide-calendar" class="w-5 h-5" />
              Réserver ma démo
            </a>
            <a
              href="#comment-ca-marche"
              class="inline-flex items-center justify-center gap-2 bg-white text-slate-700 border border-slate-200 px-8 py-4 rounded-full text-base font-semibold hover:bg-slate-50 transition-all hover:shadow-md"
            >
              <UIcon name="i-lucide-play-circle" class="w-5 h-5 text-purple-600" />
              Comment ça marche
            </a>
          </div>

          <div class="mt-8 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-6 text-sm font-medium text-slate-700 bg-white/50 backdrop-blur-sm p-4 rounded-2xl border border-slate-200 shadow-sm max-w-fit mx-auto lg:mx-0 animate-fade-in-up animation-delay-600">
            <div class="flex items-center gap-2">
              <UIcon name="i-lucide-shield-check" class="w-5 h-5 text-green-500" />
              <span>Conforme RGPD</span>
            </div>
            <div class="hidden sm:block w-1 h-1 bg-slate-300 rounded-full"></div>
            <div class="flex items-center gap-2">
              <span class="text-xl leading-none">&#x1F1EB;&#x1F1F7;</span>
              <span>Hébergé en France</span>
            </div>
            <div class="hidden sm:block w-1 h-1 bg-slate-300 rounded-full"></div>
            <div class="flex items-center gap-2">
              <UIcon name="i-lucide-lock" class="w-5 h-5 text-slate-500" />
              <span>Données chiffrées</span>
            </div>
          </div>
        </div>

        <!-- Right visual: App mockup -->
        <div class="lg:col-span-6 mt-16 lg:mt-0 relative">
          <div class="relative rounded-2xl overflow-hidden shadow-2xl bg-white border border-slate-200 max-w-[520px] mx-auto animate-float">
            <!-- Fake window bar -->
            <div class="flex items-center gap-2 px-4 py-3 bg-slate-50 border-b border-slate-100">
              <div class="flex gap-1.5">
                <div class="w-3 h-3 rounded-full bg-red-400"></div>
                <div class="w-3 h-3 rounded-full bg-yellow-400"></div>
                <div class="w-3 h-3 rounded-full bg-green-400"></div>
              </div>
              <div class="flex-1 flex justify-center">
                <div class="flex items-center gap-1.5 px-3 py-1 rounded-md bg-white border border-slate-200 text-xs text-slate-400">
                  <UIcon name="i-lucide-lock" class="w-3 h-3" />
                  app.novika.fr
                </div>
              </div>
            </div>

            <!-- App content -->
            <div class="p-5 space-y-4">
              <!-- Audio player section -->
              <div class="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div class="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
                  <UIcon name="i-lucide-mic" class="w-5 h-5 text-purple-600" />
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-semibold text-slate-800 truncate">Reunion-client-15mars.mp3</p>
                  <p class="text-xs text-slate-400">1h 23min &bull; 54 MB</p>
                </div>
                <div class="px-2.5 py-1 rounded-full bg-green-100 text-green-700 text-xs font-semibold shrink-0">Terminé</div>
              </div>

              <!-- Waveform visualization -->
              <div class="flex items-end gap-[3px] h-12 px-2 justify-center">
                <div v-for="i in 40" :key="i" class="waveform-bar w-[3px] rounded-full bg-purple-400/70" :style="{ animationDelay: `${i * 50}ms` }"></div>
              </div>

              <!-- Separator -->
              <div class="flex items-center gap-3 px-2">
                <div class="flex-1 h-px bg-slate-200"></div>
                <div class="flex items-center gap-1.5 text-xs text-purple-600 font-semibold">
                  <UIcon name="i-lucide-wand-2" class="w-4 h-4" />
                  Restructuration
                </div>
                <div class="flex-1 h-px bg-slate-200"></div>
              </div>

              <!-- Generated document preview -->
              <div class="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
                <div class="flex items-center gap-2 mb-2">
                  <UIcon name="i-lucide-file-text" class="w-4 h-4 text-slate-400" />
                  <span class="text-xs font-semibold text-slate-700">Document structuré</span>
                </div>
                <div class="space-y-2">
                  <div class="h-2.5 bg-slate-800 rounded w-3/4"></div>
                  <div class="h-2 bg-slate-200 rounded w-full"></div>
                  <div class="h-2 bg-slate-200 rounded w-5/6"></div>
                  <div class="h-2 bg-slate-200 rounded w-full"></div>
                </div>
                <div class="pt-2 space-y-2">
                  <div class="h-2.5 bg-slate-700 rounded w-1/2"></div>
                  <div class="h-2 bg-slate-200 rounded w-full"></div>
                  <div class="h-2 bg-slate-200 rounded w-4/5"></div>
                </div>
                <div class="flex gap-2 pt-2">
                  <div class="flex items-center gap-1 px-2 py-1 rounded bg-purple-50 text-purple-700 text-[10px] font-semibold">
                    <UIcon name="i-lucide-download" class="w-3 h-3" />
                    PDF
                  </div>
                  <div class="flex items-center gap-1 px-2 py-1 rounded bg-blue-50 text-blue-700 text-[10px] font-semibold">
                    <UIcon name="i-lucide-download" class="w-3 h-3" />
                    Word
                  </div>
                  <div class="flex items-center gap-1 px-2 py-1 rounded bg-green-50 text-green-700 text-[10px] font-semibold">
                    <UIcon name="i-lucide-share-2" class="w-3 h-3" />
                    Partager
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Floating card: result -->
          <div class="absolute top-10 right-0 lg:right-[-20px] bg-white rounded-xl shadow-lg p-4 border border-slate-100 flex items-center gap-3 z-10 animate-float-card">
            <div class="w-10 h-10 bg-green-100 text-green-600 rounded-full flex items-center justify-center">
              <span class="font-bold text-sm">2m</span>
            </div>
            <div>
              <p class="text-sm font-semibold text-slate-900">Document prêt</p>
              <p class="text-xs text-slate-500">Prêt à l'envoi</p>
            </div>
          </div>

          <!-- Floating card: source -->
          <div class="absolute bottom-10 left-0 lg:left-[-20px] bg-white rounded-xl shadow-lg p-4 border border-slate-100 flex items-center gap-3 z-10 animate-float-card-reverse">
            <div class="w-10 h-10 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center">
              <span class="font-bold text-sm">1h</span>
            </div>
            <div>
              <p class="text-sm font-semibold text-slate-900">Audio déposé</p>
              <p class="text-xs text-slate-500">Réunion enregistrée</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.animate-blob {
  animation: blob 8s ease-in-out infinite;
}

.animation-delay-2000 {
  animation-delay: 2s;
}

@keyframes blob {
  0%, 100% { transform: scale(1); opacity: 0.4; }
  50% { transform: scale(1.05); opacity: 0.6; }
}

.animate-fade-in {
  animation: fadeIn 0.6s ease-out both;
}

.animate-fade-in-up {
  animation: fadeInUp 0.6s ease-out both;
}

.animation-delay-200 {
  animation-delay: 0.15s;
}
.animation-delay-400 {
  animation-delay: 0.3s;
}
.animation-delay-600 {
  animation-delay: 0.45s;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

.animate-float {
  animation: float 6s ease-in-out infinite;
}

@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-15px); }
}

.animate-float-card {
  animation: floatCard 5s ease-in-out infinite;
  animation-delay: 0.8s;
}

.animate-float-card-reverse {
  animation: floatCardReverse 5.5s ease-in-out infinite;
  animation-delay: 1s;
}

@keyframes floatCard {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}

@keyframes floatCardReverse {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(10px); }
}

.waveform-bar {
  animation: waveform 1.5s ease-in-out infinite;
}

@keyframes waveform {
  0%, 100% { height: 8px; }
  50% { height: calc(8px + var(--random-height, 32px)); }
}

.waveform-bar:nth-child(odd) { --random-height: 28px; }
.waveform-bar:nth-child(3n) { --random-height: 40px; }
.waveform-bar:nth-child(5n) { --random-height: 20px; }
.waveform-bar:nth-child(7n) { --random-height: 36px; }
.waveform-bar:nth-child(2n) { --random-height: 16px; }
.waveform-bar:nth-child(11n) { --random-height: 44px; }
</style>
