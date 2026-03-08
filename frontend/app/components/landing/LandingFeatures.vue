<script setup lang="ts">
const { reveal } = useScrollReveal()

const features = [
  {
    title: 'Déposez, c\'est tout',
    description: 'Glissez votre fichier audio dans l\'interface. MP3, WAV, M4A — 27 formats acceptés. Pas besoin de convertir, pas besoin de compétence technique.',
    icon: 'i-lucide-upload-cloud',
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
  },
  {
    title: 'Un document, pas un pavé de texte',
    description: 'Novika ne se contente pas de transcrire. Il restructure votre audio en un document adapté à votre métier : compte-rendu, synthèse, plan d\'action.',
    icon: 'i-lucide-file-text',
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
  },
  {
    title: 'Vos consignes, vos règles',
    description: 'Définissez vos consignes de rédaction. Novika les applique à chaque audio pour un résultat fidèle à vos habitudes de travail.',
    icon: 'i-lucide-settings',
    color: 'text-green-600',
    bgColor: 'bg-green-100',
  },
  {
    title: 'Prêt à envoyer en un clic',
    description: 'Exportez en PDF ou Word, formaté professionnellement. Prêt à envoyer au client, à classer au dossier ou à partager avec votre équipe.',
    icon: 'i-lucide-download',
    color: 'text-orange-600',
    bgColor: 'bg-orange-100',
  },
]
</script>

<template>
  <section id="fonctionnalites" class="py-24 bg-white">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="text-center max-w-3xl mx-auto mb-16">
        <h2 class="text-3xl font-extrabold text-slate-900 tracking-tight sm:text-4xl mb-4">
          De l'audio brut au document final, sans effort
        </h2>
        <p class="text-lg text-slate-600">
          Novika transcrit, restructure et met en forme. Vous relisez et envoyez.
        </p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        <div
          v-for="(feature, index) in features"
          :key="index"
          :ref="(el: any) => reveal(el)"
          class="scroll-reveal relative p-8 bg-white border border-slate-100 rounded-2xl shadow-sm hover:shadow-lg transition-shadow duration-300"
          :style="{ transitionDelay: `${index * 100}ms` }"
        >
          <div :class="['w-12 h-12 rounded-xl flex items-center justify-center mb-6', feature.bgColor, feature.color]">
            <UIcon :name="feature.icon" class="w-6 h-6" />
          </div>
          <h3 class="text-xl font-bold text-slate-900 mb-3">{{ feature.title }}</h3>
          <p class="text-slate-600 leading-relaxed">{{ feature.description }}</p>
        </div>
      </div>
    </div>
  </section>
</template>
