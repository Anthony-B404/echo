<script setup lang="ts">
const { reveal } = useScrollReveal();
</script>

<template>
  <section id="comment-ca-marche" class="bg-white py-24">
    <div class="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
      <div
        :ref="(el: any) => reveal(el)"
        class="scroll-reveal mb-12 text-center"
      >
        <h2
          class="mb-4 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl"
        >
          Voyez par vous-même
        </h2>
        <p class="mx-auto max-w-2xl text-lg text-slate-600">
          De l'audio brut au document structuré en 2 minutes — regardez la
          transformation.
        </p>
      </div>

      <div
        :ref="(el: any) => reveal(el)"
        class="scroll-reveal relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-900 shadow-2xl"
        style="padding: 56.25% 0 0 0; position: relative"
      >
        <iframe
          src="https://player.vimeo.com/video/1171409155?badge=0&autopause=0&player_id=0&app_id=58479&autoplay=1&loop=1&dnt=1&background=1"
          allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media"
          referrerpolicy="strict-origin-when-cross-origin"
          style="position: absolute; top: 0; left: 0; width: 100%; height: 100%"
          title="Novika - Démo"
          frameborder="0"
        />
      </div>
    </div>
  </section>
</template>
