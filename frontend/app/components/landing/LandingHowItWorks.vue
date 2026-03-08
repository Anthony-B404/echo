<script setup lang="ts">
const { reveal } = useScrollReveal()

const steps = [
  {
    title: 'Déposez votre audio',
    description: 'Glissez votre fichier ou enregistrez directement depuis l\'interface. Pas besoin de convertir, 27 formats acceptés.',
    icon: 'i-lucide-upload-cloud',
    color: 'bg-indigo-100 text-indigo-600',
  },
  {
    title: 'Novika rédige',
    description: 'L\'audio est transcrit puis restructuré selon votre modèle de document. Identification des interlocuteurs incluse.',
    icon: 'i-lucide-wand-2',
    color: 'bg-purple-100 text-purple-600',
  },
  {
    title: 'Relisez et envoyez',
    description: 'Votre document est prêt en 2 minutes. Exportez en PDF ou Word, partagez avec votre équipe ou classez au dossier.',
    icon: 'i-lucide-download',
    color: 'bg-emerald-100 text-emerald-600',
  },
]
</script>

<template>
  <section class="py-24 bg-white overflow-hidden">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
      <div class="text-center max-w-3xl mx-auto mb-20">
        <h2 class="text-3xl font-extrabold text-slate-900 tracking-tight sm:text-4xl">
          Déposez. Relisez. Envoyez.
        </h2>
        <p class="mt-4 text-lg text-slate-600">
          Trois étapes, deux minutes. C'est tout ce qu'il faut pour transformer une heure de réunion en document prêt à l'emploi.
        </p>
      </div>

      <div class="relative">
        <!-- Connector Line -->
        <div class="hidden md:block absolute top-12 left-0 w-full h-0.5 bg-slate-100 -z-10"></div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-12 text-center relative z-10">
          <div
            v-for="(step, index) in steps"
            :key="index"
            :ref="(el: any) => reveal(el)"
            class="scroll-reveal flex flex-col items-center"
            :style="{ transitionDelay: `${index * 200}ms` }"
          >
            <div :class="['w-24 h-24 rounded-3xl shadow-lg shadow-slate-200 flex items-center justify-center mb-8 -rotate-6 hover:rotate-0 transition-transform duration-300', step.color]">
              <UIcon :name="step.icon" class="w-10 h-10" />
            </div>

            <h3 class="text-2xl font-bold text-slate-900 mb-4">{{ index + 1 }}. {{ step.title }}</h3>

            <p class="text-slate-600 leading-relaxed max-w-xs">{{ step.description }}</p>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
