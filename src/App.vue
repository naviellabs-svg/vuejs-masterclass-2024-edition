<script setup lang="ts">
import TopNavbar from '@/components/layout/TopNavbar.vue'
import SideBar from '@/components/layout/SideBar.vue'
</script>

<template>
  <SideBar />
  <div class="flex flex-col lg:ml-52 ml-16 transition-[margin]">
    <TopNavbar />
    <main>
      <RouterView />
    </main>
  </div>
</template>
