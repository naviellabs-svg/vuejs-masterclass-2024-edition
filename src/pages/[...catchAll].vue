<script setup lang="ts">
import AppErrorPage from '@/components/AppError/AppErrorPage.vue'
import { useErrorStore } from '@/stores/error'

useErrorStore().setError()

</script>

<template>
  <AppErrorPage />
</template>

<style scoped>
@reference "@/assets/index.css"

.error {
  @apply mx-auto flex justify-center items-center flex-1 p-10 text-center -mt-20 min-h-[90vh];
}
.error__content {
  @apply flex flex-col items-center justify-center w-full;
}

.error__icon {
  @apply text-7xl text-destructive;
}

.error__code {
  @apply font-extrabold text-7xl text-secondary;
}

.error__msg {
  @apply text-3xl font-extrabold text-primary;
}

.error-footer {
  @apply flex flex-col items-center justify-center gap-5 mt-6 font-light;
}

.error-footer__text {
  @apply text-lg text-muted-foreground;
}

p {
  @apply my-2;
}
</style>
