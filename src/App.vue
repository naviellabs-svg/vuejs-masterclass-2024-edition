<script setup lang="ts">
import { useErrorStore } from './stores/error';

const {activeError} = storeToRefs(useErrorStore())

</script>

<template>
  <AuthLayout>
    <AppErrorPage v-if="activeError" />


    <RouterView v-else v-slot="{ Component, route }">
      <Suspense v-if="Component" :timeout="0">
        <Component v-if="Component" :is="Component" :key="route.name"></Component>
        <template #fallback>
          <span>Loading...</span>
        </template>
      </Suspense>
    </RouterView>
  </AuthLayout>
</template>
